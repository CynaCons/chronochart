/**
 * DegradationEngine - Card type degradation system
 *
 * Handles the intelligent card type selection and degradation based on:
 * - Event density and space constraints
 * - Card type capacity (full -> compact -> title-only)
 * - Degradation metrics and telemetry tracking
 * - Individual card creation with proper positioning
 */

import type { Event } from '../../types';
import type { LayoutConfig, PositionedCard, CardType } from '../types';
import type { ColumnGroup, DegradationMetrics } from '../LayoutEngine';
import { FEATURE_FLAGS, CARD_HEIGHT_CELLS } from '../config';
import { CARD_SPACING } from '../cardMetrics';
import { getHalfColumnBudget } from '../layoutBudget';

/**
 * Per-tier density ceilings (soft). Historically these were "physics" limits
 * approximating how many cards of each type fit; with the real cell budget now
 * driving capacity (B2), they are readability/density preferences, not hard
 * physical limits. Title-only intentionally has NO fixed cap — the budget is
 * its only limit (the legacy value of 8 was dropped 2026-07-05 so tall
 * viewports can show more events). See LAYOUT_IMPROVEMENT_PLAN.md §5.
 */
const DENSITY_CAPS: { full: number; compact: number } = { full: 2, compact: 4 };

export class DegradationEngine {
  private config: LayoutConfig;

  // Metrics tracking
  private degradationMetrics: DegradationMetrics = {
    totalGroups: 0,
    fullCardGroups: 0,
    compactCardGroups: 0,
    titleOnlyCardGroups: 0,
    degradationRate: 0,
    spaceReclaimed: 0,
    degradationTriggers: [],
    totalClusters: 0,
    clustersWithOverflow: 0,
    clustersWithMixedTypes: 0, // Tracks clusters using mixed card types (v0.3.6.3)
    clusterCoordinationEvents: []
  };

  constructor(config: LayoutConfig) {
    this.config = config;
  }

  /**
   * Get current degradation metrics for telemetry
   */
  getDegradationMetrics(): DegradationMetrics {
    return { ...this.degradationMetrics };
  }

  /**
   * Apply degradation and promotion logic to column groups
   * Uses cluster coordination if feature flag enabled, otherwise falls back to legacy algorithm
   */
  applyDegradationAndPromotion(groups: ColumnGroup[]): ColumnGroup[] {
    // Reset metrics for new layout calculation
    this.resetMetrics();

    if (FEATURE_FLAGS.ENABLE_CLUSTER_COORDINATION) {
      return this.applyClusterCoordinatedDegradation(groups);
    } else {
      return this.applyLegacyDegradation(groups);
    }
  }

  /**
   * Legacy degradation algorithm - per half-column assignment
   * Used when ENABLE_CLUSTER_COORDINATION is false
   */
  private applyLegacyDegradation(groups: ColumnGroup[]): ColumnGroup[] {
    for (const group of groups) {
      this.assignCardsForGroup(group);
    }

    return groups;
  }

  /**
   * Assign card types for a single half-column group (B2 budget-driven packing).
   * The per-position card types come from packHalfColumn, which fills the
   * half-column's actual cell budget rather than a hard-coded count recipe.
   */
  private assignCardsForGroup(group: ColumnGroup): void {
    const combined: Event[] = [
      ...group.events,
      ...(Array.isArray(group.overflowEvents) ? group.overflowEvents : [])
    ];

    this.degradationMetrics.totalGroups++;

    if (combined.length === 0) {
      group.cards = [];
      group.overflowEvents = undefined;
      return;
    }

    const types = FEATURE_FLAGS.ENABLE_MIXED_CARD_TYPES
      ? this.packHalfColumn(combined.length, group.side)
      : this.packUniform(combined.length);

    group.cards = this.buildCards(group, combined, types);
    this.trackGroupMetrics(types);
  }

  /** Returns true when the group ended up with more than one distinct card type. */
  private assignCardsForGroupAndDetectMixed(group: ColumnGroup): boolean {
    this.assignCardsForGroup(group);
    const types = new Set(group.cards.map(card => card.cardType));
    return types.size > 1;
  }

  private describeGroupCardTypes(group: ColumnGroup): string {
    const types = new Set(group.cards.map(card => card.cardType));
    if (types.size === 0) return 'none';
    if (types.size === 1) return group.cards[0]?.cardType ?? 'none';
    return 'mixed';
  }

  /**
   * Cluster-coordinated degradation algorithm
   * Implements spatial cluster coordination with optional mixed card types
   */
  private applyClusterCoordinatedDegradation(groups: ColumnGroup[]): ColumnGroup[] {
    // Phase 1: Identify spatial clusters
    const clusters = this.identifySpatialClusters(groups);
    this.degradationMetrics.totalClusters = clusters.length;

    // Phase 2: Apply per-side degradation (never use combined above+below counts)
    for (const cluster of clusters) {
      if (cluster.hasOverflow) {
        this.degradationMetrics.clustersWithOverflow++;
      }

      const aboveUsesMixed = cluster.aboveGroup
        ? this.assignCardsForGroupAndDetectMixed(cluster.aboveGroup)
        : false;
      const belowUsesMixed = cluster.belowGroup
        ? this.assignCardsForGroupAndDetectMixed(cluster.belowGroup)
        : false;

      if (aboveUsesMixed || belowUsesMixed) {
        this.degradationMetrics.clustersWithMixedTypes++;
      }

      this.degradationMetrics.clusterCoordinationEvents.push({
        clusterId: cluster.id,
        hasOverflow: cluster.hasOverflow,
        aboveCardType: cluster.aboveGroup
          ? this.describeGroupCardTypes(cluster.aboveGroup)
          : 'none',
        belowCardType: cluster.belowGroup
          ? this.describeGroupCardTypes(cluster.belowGroup)
          : 'none',
        coordinationApplied: false
      });
    }

    return groups;
  }

  /**
   * Reset all metrics for new calculation cycle
   */
  private resetMetrics(): void {
    this.degradationMetrics = {
      totalGroups: 0,
      fullCardGroups: 0,
      compactCardGroups: 0,
      titleOnlyCardGroups: 0,
      degradationRate: 0,
      spaceReclaimed: 0,
      degradationTriggers: [],
      totalClusters: 0,
      clustersWithOverflow: 0,
      clustersWithMixedTypes: 0,
      clusterCoordinationEvents: []
    };
  }

  /**
   * Uniform fallback used only when ENABLE_MIXED_CARD_TYPES is off.
   * Picks the richest uniform tier whose full stack fits, then trims to what
   * physically fits (mirrors the pre-B2 uniform behavior).
   */
  private packUniform(n: number): CardType[] {
    const tier: CardType =
      n <= this.getMaxCardsPerHalfColumn('full') ? 'full'
      : n <= this.getMaxCardsPerHalfColumn('compact') ? 'compact'
      : 'title-only';
    const visible = Math.min(n, this.getMaxCardsPerHalfColumn(tier));
    return new Array(Math.max(0, visible)).fill(tier);
  }


  /**
   * Get maximum cards per half-column based on card type and viewport constraints
   * Type-specific caps (legacy reference):
   * - Full cards: up to 2 per half-column
   * - Compact cards: up to 4 per half-column
   * - Title-only: up to 8 per half-column
   * Actual cap is min(type cap, what physically fits in available height)
   */
  getMaxCardsPerHalfColumn(cardType: CardType): number {
    const cardConfig = this.config.cardConfigs;
    const cardHeight = cardConfig[cardType].height;
    const cardSpacing = CARD_SPACING;

    // Available vertical space for a half-column (single source of truth).
    // Uses the `above` budget for the per-type cap, as it has always done.
    const availableHeight = getHalfColumnBudget(this.config, 'above').pixels;

    // How many cards physically fit in the available space
    const maxBySpace = Math.max(1, Math.floor((availableHeight + cardSpacing) / (cardHeight + cardSpacing)));

    // Return the minimum of the type-specific cap and what physically fits
    const typeCap = cardType === 'full' ? 2
      : cardType === 'compact' ? 4
      : cardType === 'title-only' ? 8
      : 2;

    return Math.min(typeCap, maxBySpace);
  }

  /**
   * Identify spatial clusters by matching above/below half-columns
   * Groups share the same X-region if their centerX positions are within threshold
   */
  private identifySpatialClusters(
    groups: ColumnGroup[],
  ): import('../LayoutEngine').SpatialCluster[] {
    const X_THRESHOLD = 50; // pixels - groups within 50px are same cluster

    const aboveGroups = groups.filter(g => g.side === 'above');
    const belowGroups = groups.filter(g => g.side === 'below');
    const clusters: import('../LayoutEngine').SpatialCluster[] = [];
    const processedBelow = new Set<string>();

    // Iterate through above groups and find matching below groups
    for (const above of aboveGroups) {
      // Find below group in same X-region
      const below = belowGroups.find(g =>
        !processedBelow.has(g.id) &&
        Math.abs(g.centerX - above.centerX) < X_THRESHOLD
      );

      if (below) processedBelow.add(below.id);

      // Only treat dispatch overflow as cluster overflow — predicted checks were
      // forcing uniform title-only even when vertical space was available.
      const aboveOverflow = (above.overflowEvents?.length ?? 0) > 0;
      const belowOverflow = (below?.overflowEvents?.length ?? 0) > 0;
      const hasOverflow = aboveOverflow || belowOverflow;

      const totalEvents = above.events.length + (below?.events.length ?? 0);
      const recommendedCardType = this.determineUniformCardType(totalEvents);

      clusters.push({
        id: `cluster-${above.centerX}`,
        xRegion: {
          start: above.startX,
          end: above.endX,
          center: above.centerX
        },
        aboveGroup: above,
        belowGroup: below ?? null,
        hasOverflow,
        totalEvents,
        recommendedCardType
      });
    }

    // Handle orphan below groups (no matching above group)
    const orphanBelowGroups = belowGroups.filter(g => !processedBelow.has(g.id));
    for (const below of orphanBelowGroups) {
      const hasOverflow = (below.overflowEvents?.length ?? 0) > 0;
      const totalEvents = below.events.length;
      const recommendedCardType = this.determineUniformCardType(totalEvents);

      clusters.push({
        id: `cluster-${below.centerX}`,
        xRegion: {
          start: below.startX,
          end: below.endX,
          center: below.centerX
        },
        aboveGroup: null,
        belowGroup: below,
        hasOverflow,
        totalEvents,
        recommendedCardType
      });
    }

    return clusters;
  }

  /**
   * Determine uniform card type based on total event count (SDS spec):
   * - 1-2 events: full
   * - 3-4 events: compact
   * - 5+ events: title-only
   */
  private determineUniformCardType(eventCount: number): CardType {
    if (eventCount <= 2) return 'full';
    if (eventCount <= 4) return 'compact';
    return 'title-only';
  }

  /**
   * B2 — budget-driven card type packing for one half-column.
   *
   * Returns one CardType per VISIBLE event, in chronological order. The result
   * is a non-increasing "staircase" (earliest events are richest) that fills the
   * half-column's actual cell budget K = getHalfColumnBudget(config, side).cells,
   * replacing the old hard-coded event-count recipes.
   *
   * Algorithm:
   *  1. Visibility first: visible = min(N, K), every card title-only. This
   *     maximizes how many events are shown before spending any budget on
   *     richer (taller) cards.
   *  2. Two upgrade rounds spend the leftover budget from the earliest event
   *     forward: title-only -> compact, then compact -> full. Each round walks
   *     the cards in chronological order and upgrades a prefix until the tier
   *     cap (DENSITY_CAPS) or the budget runs out. Because upgrades always take
   *     the earliest cards first, the tier sequence stays non-increasing and
   *     uniform tiers emerge naturally when the whole stack can reach one tier.
   *
   * Deterministic: identical (N, side, config) always yields the same array.
   */
  private packHalfColumn(n: number, side: 'above' | 'below'): CardType[] {
    const K = getHalfColumnBudget(this.config, side).cells;
    if (K <= 0 || n <= 0) return [];

    const cost = CARD_HEIGHT_CELLS; // { full: 4, compact: 3, 'title-only': 1 }
    const visible = Math.min(n, Math.floor(K / cost['title-only'])); // = min(n, K)
    const types: CardType[] = new Array(visible).fill('title-only');
    let usedCells = visible * cost['title-only'];

    // Upgrade rounds, richest last. Each raises a prefix of cards one tier.
    const rounds: Array<{ from: CardType; to: CardType; cap: number }> = [
      { from: 'title-only', to: 'compact', cap: DENSITY_CAPS.compact },
      { from: 'compact', to: 'full', cap: DENSITY_CAPS.full },
    ];

    for (const round of rounds) {
      const delta = cost[round.to] - cost[round.from];
      let upgraded = 0;
      for (let i = 0; i < visible; i++) {
        if (types[i] !== round.from) continue; // already past this tier (or a later, cheaper card)
        if (upgraded >= round.cap) break; // tier density ceiling reached
        if (usedCells + delta > K) break; // no budget left — stop (no skipping)
        types[i] = round.to;
        usedCells += delta;
        upgraded++;
      }
    }

    return types;
  }

  /**
   * Build the positioned cards for a group from an explicit per-position type
   * list (length = visible count). Remaining events become overflow.
   */
  private buildCards(group: ColumnGroup, combined: Event[], types: CardType[]): PositionedCard[] {
    const cardConfig = this.config.cardConfigs;
    const cards: PositionedCard[] = types.map((cardType, index) => ({
      id: `${group.id}-${index}`,
      event: combined[index],
      x: 0,
      y: 0,
      width: cardConfig[cardType].width,
      height: cardConfig[cardType].height,
      cardType,
      clusterId: group.id,
    }));

    const remainder = combined.slice(types.length);
    group.overflowEvents = remainder.length > 0 ? remainder : undefined;
    return cards;
  }

  /**
   * Update degradation telemetry for a packed group. A group is classified by
   * its richest (earliest) card; spaceReclaimed measures the vertical space
   * saved versus rendering every visible card as a full card.
   */
  private trackGroupMetrics(types: CardType[]): void {
    if (types.length === 0) return;

    const richest = types[0];
    if (richest === 'full') this.degradationMetrics.fullCardGroups++;
    else if (richest === 'compact') this.degradationMetrics.compactCardGroups++;
    else this.degradationMetrics.titleOnlyCardGroups++;

    const cardConfig = this.config.cardConfigs;
    const fullStackHeight = cardConfig.full.height * types.length;
    const actualHeight = types.reduce((sum, t) => sum + cardConfig[t].height, 0);
    this.degradationMetrics.spaceReclaimed += Math.max(0, fullStackHeight - actualHeight);
  }
}
