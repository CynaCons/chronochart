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
import { FEATURE_FLAGS } from '../config';
import { CARD_SPACING } from '../cardMetrics';
import { getHalfColumnBudget } from '../layoutBudget';

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
   * Assign card types for a single half-column group.
   * Prefers mixed types (full + compact + title-only) when enabled so we use
   * available vertical space before jumping to uniform title-only.
   */
  private assignCardsForGroup(group: ColumnGroup): void {
    const overflowLen = group.overflowEvents?.length ?? 0;
    const totalEventCount = group.events.length + overflowLen;

    if (FEATURE_FLAGS.ENABLE_MIXED_CARD_TYPES && totalEventCount > 1) {
      const combined: Event[] = [
        ...group.events,
        ...(Array.isArray(group.overflowEvents) ? group.overflowEvents : [])
      ];
      const mixedTypes = this.determineMixedCardTypes(combined);
      group.cards = this.createIndividualCards(group, mixedTypes);
      return;
    }

    const cardType = this.determineCardType(group);
    group.cards = this.createIndividualCards(group, [cardType]);
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
   * Determine the appropriate UNIFORM card type for the entire group
   * Uses viewport-aware capacity: if events exceed what physically fits
   * for a given card type, degrade further.
   */
  private determineCardType(group: ColumnGroup): CardType {
    // Consider both primary and overflow events when selecting card type
    const overflowLen = Array.isArray(group.overflowEvents) ? group.overflowEvents.length : 0;
    const eventCount = group.events.length + overflowLen;

    // Track metrics for telemetry
    this.degradationMetrics.totalGroups++;

    // Viewport-aware degradation: check if events fit in the chosen type's capacity
    if (eventCount <= this.getMaxCardsPerHalfColumn('full')) {
      this.degradationMetrics.fullCardGroups++;
      return 'full';
    } else if (eventCount <= this.getMaxCardsPerHalfColumn('compact')) {
      this.degradationMetrics.compactCardGroups++;

      const fullCardHeight = this.config.cardConfigs.full.height;
      const compactCardHeight = this.config.cardConfigs.compact.height;
      const spaceSavedPerCard = fullCardHeight - compactCardHeight;
      const totalSpaceSaved = spaceSavedPerCard * eventCount;

      this.degradationMetrics.spaceReclaimed += totalSpaceSaved;
      this.degradationMetrics.degradationTriggers.push({
        groupId: group.id,
        eventCount,
        from: 'full',
        to: 'compact',
        spaceSaved: totalSpaceSaved
      });

      return 'compact';
    } else {
      this.degradationMetrics.titleOnlyCardGroups++;

      const compactH = this.config.cardConfigs.compact.height;
      const titleH = this.config.cardConfigs['title-only'].height;
      const spaceSavedPerCard = compactH - titleH;
      const totalSpaceSaved = Math.max(0, spaceSavedPerCard * Math.min(eventCount, 3));

      this.degradationMetrics.spaceReclaimed += totalSpaceSaved;
      this.degradationMetrics.degradationTriggers.push({
        groupId: group.id,
        eventCount,
        from: 'compact',
        to: 'title-only',
        spaceSaved: totalSpaceSaved
      });

      return 'title-only';
    }
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
   * Determine mixed card types with chronological priority
   * Earlier events get full cards, later events degrade to compact/title-only
   *
   * IMPORTANT: Returns single-element array for uniform types to signal standard capacity calculation
   * Returns multi-element array only for truly mixed types
   *
   * Viewport-aware: checks actual capacity to avoid creating cards that don't physically fit
   */
  private determineMixedCardTypes(events: Event[]): CardType[] {
    const count = events.length;
    const compactCap = this.getMaxCardsPerHalfColumn('compact');

    // SDS event-count thresholds drive type selection; createIndividualCards
    // enforces viewport capacity separately (visible vs overflow).
    if (count <= 2) {
      return ['full'];
    } else if (count === 3) {
      // Mixed: 1 full + 2 compact (chronological priority)
      return ['full', 'compact', 'compact'];
    } else if (count <= 4) {
      return ['compact'];
    } else if (count <= compactCap) {
      return ['compact'];
    } else if (count === 5) {
      // Mixed: 2 compact + 3 title-only
      return ['compact', 'compact', 'title-only', 'title-only', 'title-only'];
    } else if (count === 6) {
      // Mixed: 2 compact + 4 title-only
      return ['compact', 'compact', 'title-only', 'title-only', 'title-only', 'title-only'];
    } else if (count === 7) {
      // Mixed: 1 compact + 6 title-only
      return ['compact', 'title-only', 'title-only', 'title-only', 'title-only', 'title-only', 'title-only'];
    } else {
      // 8+ events or anything exceeding compact capacity: uniform title-only
      return ['title-only'];
    }
  }

  /**
   * Create individual cards for a group
   */
  createIndividualCards(group: ColumnGroup, cardTypes: CardType[]): PositionedCard[] {
    const cards: PositionedCard[] = [];
    const cardConfig = this.config.cardConfigs;

    // Build from combined pool so we can promote overflow into visible when switching to compact
    const combined: Event[] = [
      ...group.events,
      ...(Array.isArray(group.overflowEvents) ? group.overflowEvents : [])
    ];

    // Determine max cards based on card types
    let maxCardsPerHalfColumn: number;

    if (cardTypes.length === 1) {
      // Uniform card type - use simple capacity calculation
      maxCardsPerHalfColumn = this.getMaxCardsPerHalfColumn(cardTypes[0]);
    } else {
      // Mixed card types - calculate based on accumulated heights
      maxCardsPerHalfColumn = this.calculateMixedTypeCapacity(combined.length, cardTypes);
    }

    const visibleEvents = combined.slice(0, maxCardsPerHalfColumn);

    // VALIDATION: Ensure card types are coherent with actual visible count
    // Note: Mismatch validation removed to reduce console noise

    visibleEvents.forEach((event, index) => {
      // Cycle through card types if multiple provided
      const cardType = cardTypes[index % cardTypes.length];

      cards.push({
        id: `${group.id}-${index}`,
        event,
        x: 0,
        y: 0,
        width: cardConfig[cardType].width,
        height: cardConfig[cardType].height,
        cardType,
        clusterId: group.id
      });
    });

    // Update overflowEvents to remainder for accurate anchor counts and future passes
    const remainder = combined.slice(visibleEvents.length);
    group.overflowEvents = remainder.length > 0 ? remainder : undefined;

    return cards;
  }

  /**
   * Calculate how many cards fit in a half-column with mixed card types
   * based on available vertical space
   */
  private calculateMixedTypeCapacity(eventCount: number, cardTypes: CardType[]): number {
    const cardConfig = this.config.cardConfigs;
    const cardSpacing = CARD_SPACING; // pixels between cards

    // Available vertical space for a half-column (single source of truth).
    const availableHeight = getHalfColumnBudget(this.config, 'above').pixels;

    let accumulatedHeight = 0;
    let cardsFit = 0;

    for (let i = 0; i < eventCount; i++) {
      const cardType = cardTypes[i % cardTypes.length];
      const cardHeight = cardConfig[cardType].height;
      const heightWithSpacing = cardHeight + (i > 0 ? cardSpacing : 0);

      if (accumulatedHeight + heightWithSpacing <= availableHeight) {
        accumulatedHeight += heightWithSpacing;
        cardsFit++;
      } else {
        break; // No more cards fit
      }
    }

    return cardsFit;
  }
}
