import { test, expect, type Page as PlaywrightPage } from '@playwright/test';
import { zoomAndSwipe, type ZoomSwipePosition } from '../helpers/zoom-and-swipe';

/**
 * Test Suite: Mixed Card Types Overlap Detection & Degradation Validation
 *
 * Uses the comprehensive zoom-and-swipe procedure to:
 * - Test all zoom levels (0-9)
 * - Pan left-to-right at each zoom level
 * - Dynamically detect timeline Y position from DOM (viewport-agnostic)
 * - Validate cards at every position for:
 *   - No overlaps (especially in mixed columns)
 *   - Proper 12px spacing between cards
 *   - X-alignment within half-columns (≤10px variation)
 *   - Card heights match card types
 *   - Degradation rules compliance:
 *     * Valid card type patterns (1 full, 2 full, 1f+2c, 4c, 2c+3t, 2c+4t, 1c+6t, 8t)
 *     * No overflow badges with full or compact cards
 *     * No invalid mixing (e.g., 1 compact alone, 2 compact alone, full+title without compact)
 *   - Mixed column alignment:
 *     * Left edges aligned (X-coordinates within 10px)
 *     * Right edges aligned (X+width within 10px)
 *     * Consistent Y-gaps between all adjacent cards
 */

interface CardData {
  id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  cardType: string;
}

interface HalfColumnAnalysis {
  side: 'above' | 'below';
  cardCount: number;
  cardTypes: string[];
  isMixed: boolean;
  heights: number[];
  yCoordinates: number[];
  yGaps: number[];
  xVariation: number;
  hasOverlaps: boolean;
  spacingIssues: string[];
  cards: CardData[];
  degradationViolations: string[];  // NEW: Tracks degradation rule violations
  xAlignmentIssues: string[];       // NEW: Tracks X-alignment issues in mixed columns
}

interface ClusterAnalysis {
  clusterId: number;
  centerX: number;
  above: HalfColumnAnalysis | null;
  below: HalfColumnAnalysis | null;
  hasOverflow: boolean;  // Whether overflow was detected for this cluster
  overflowSource?: string;  // How overflow was detected (badge, count, pattern)
}

interface LayoutAnalysis {
  position: ZoomSwipePosition;
  totalCards: number;
  clusters: ClusterAnalysis[];
  issues: string[];
  mixedColumns: number;
  overlapCount: number;
  misalignedColumns: number;
}

const EXPECTED_SPACING = 12; // Standard card spacing in px
const SPACING_TOLERANCE = 3; // Allow ±3px variance
const X_ALIGNMENT_TOLERANCE = 10; // Max X-variation allowed in px
// TIMELINE_Y will be dynamically detected from DOM (see test setup below)

test.describe('Mixed Card Types Overlap Detection', () => {
  test('Comprehensive zoom-and-swipe validation', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes for comprehensive analysis (15 zoom levels with deep zoom)

    // Navigate directly to French Revolution timeline (using username-based URL)
    await page.goto('/cynacons/timeline/french-revolution');
    await page.waitForSelector('[data-testid="event-card"]', { timeout: 10000 });
    await page.waitForTimeout(1000); // Allow time for all events to load and render

    // Dynamically detect timeline Y position from DOM
    const timelineAxis = await page.locator('[data-testid="timeline-axis"]');
    const timelineBox = await timelineAxis.boundingBox();
    const TIMELINE_Y = timelineBox ? timelineBox.y : (1080 / 2); // Fallback to viewport center

    console.log(`📍 Detected Timeline Y position: ${TIMELINE_Y}px`);

    /**
     * Validates degradation rules for a half-column
     *
     * Valid configurations:
     * - 1 full card alone
     * - 2 full cards (uniform)
     * - 1 full + 2 compact (mixed - 3 events)
     * - 4 compact cards (uniform)
     * - 2 compact + 3 title-only (mixed - 5 events)
     * - 2 compact + 4 title-only (mixed - 6 events)
     * - 1 compact + 6 title-only (mixed - 7 events)
     * - 8 title-only cards (uniform)
     *
     * Invalid configurations:
     * - 1 compact alone (should be 2 full)
     * - 2 compact alone (should be 2 full or 4 compact)
     * - 3 compact alone (should be 1 full + 2 compact)
     * - 1 full + 1 compact (invalid pattern)
     * - Full or compact with overflow (should degrade to title-only)
     * - Title-only mixed directly with full (should use compact as bridge)
     */
    // B2 budget-driven packing (2026-07-05) replaced the old count-recipes with
    // a per-half-column staircase that fills each side's own cell budget. The
    // contract is now expressed as invariants rather than exact per-count
    // patterns, and half-columns degrade INDEPENDENTLY — a rich `above` may sit
    // in the same cluster as an overflowing `below` (hence hasOverflow, which is
    // cluster-level, does not constrain a half-column's tiers):
    //   - richness is non-increasing chronologically (earliest event = richest)
    //   - soft density caps: full <= 2, compact <= 4 per half-column
    const RICHNESS: Record<string, number> = { full: 3, compact: 2, 'title-only': 1 };
    const validateDegradationRules = (
      cardTypes: string[],
      _hasOverflow: boolean
    ): string[] => {
      const violations: string[] = [];
      const pattern = cardTypes.join(',');
      const fullCount = cardTypes.filter(t => t === 'full').length;
      const compactCount = cardTypes.filter(t => t === 'compact').length;

      // Rule 1: non-increasing tier richness (the B2 staircase invariant).
      for (let i = 1; i < cardTypes.length; i++) {
        if (RICHNESS[cardTypes[i]] > RICHNESS[cardTypes[i - 1]]) {
          violations.push(
            `Non-monotonic tiers: [${pattern}] (earlier events must be at least as rich)`
          );
          break;
        }
      }

      // Rule 2: soft density caps.
      if (fullCount > 2) violations.push(`Full cap exceeded: [${pattern}] (${fullCount} > 2)`);
      if (compactCount > 4) violations.push(`Compact cap exceeded: [${pattern}] (${compactCount} > 4)`);

      return violations;
    };

    /**
     * Validates X-alignment and card edge alignment for mixed-type columns
     */
    const validateMixedTypeAlignment = (cards: CardData[]): string[] => {
      const issues: string[] = [];

      if (cards.length < 2) return issues; // Need at least 2 cards to check alignment

      // Check left edge alignment (X coordinate)
      const xCoords = cards.map(c => c.x);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const xVariation = maxX - minX;

      if (xVariation > X_ALIGNMENT_TOLERANCE) {
        issues.push(
          `Left edge misalignment: X-variation ${xVariation}px exceeds ${X_ALIGNMENT_TOLERANCE}px tolerance ` +
          `(X-coords: [${xCoords.join(', ')}])`
        );
      }

      // Check right edge alignment (X + width)
      const rightEdges = cards.map(c => c.x + c.width);
      const minRight = Math.min(...rightEdges);
      const maxRight = Math.max(...rightEdges);
      const rightVariation = maxRight - minRight;

      if (rightVariation > X_ALIGNMENT_TOLERANCE) {
        issues.push(
          `Right edge misalignment: variation ${rightVariation}px exceeds ${X_ALIGNMENT_TOLERANCE}px tolerance ` +
          `(right edges: [${rightEdges.map(r => Math.round(r)).join(', ')}])`
        );
      }

      return issues;
    };

    /**
     * Analyzes half-column for overlaps, spacing, and alignment issues
     */
    const analyzeHalfColumn = (cards: CardData[], side: 'above' | 'below', hasOverflow = false): HalfColumnAnalysis => {
      if (cards.length === 0) {
        return {
          side,
          cardCount: 0,
          cardTypes: [],
          isMixed: false,
          heights: [],
          yCoordinates: [],
          yGaps: [],
          xVariation: 0,
          hasOverlaps: false,
          spacingIssues: [],
          cards: [],
          degradationViolations: [],
          xAlignmentIssues: []
        };
      }

      // Sort cards by Y (top-to-bottom for below, bottom-to-top for above)
      const sortedCards = side === 'below'
        ? [...cards].sort((a, b) => a.y - b.y)  // Top to bottom
        : [...cards].sort((a, b) => b.y - a.y);  // Bottom to top

      const cardTypes = sortedCards.map(c => c.cardType);
      const uniqueTypes = new Set(cardTypes);
      const isMixed = uniqueTypes.size > 1;

      const heights = sortedCards.map(c => c.height);
      const yCoordinates = sortedCards.map(c => c.y);

      // Calculate Y-gaps between adjacent cards
      const yGaps: number[] = [];
      let hasOverlaps = false;
      const spacingIssues: string[] = [];

      for (let i = 0; i < sortedCards.length - 1; i++) {
        const current = sortedCards[i];
        const next = sortedCards[i + 1];

        // Calculate gap based on stacking direction
        // ABOVE: sorted bottom-to-top, gap = current.top - next.bottom
        // BELOW: sorted top-to-bottom, gap = next.top - current.bottom
        const gap = side === 'above'
          ? current.y - (next.y + next.height)  // current.top - next.bottom
          : next.y - (current.y + current.height);  // next.top - current.bottom

        yGaps.push(gap);

        // Check for overlap
        if (gap < 0) {
          hasOverlaps = true;
          spacingIssues.push(
            `OVERLAP: Card ${i} (type=${current.cardType}, y=${current.y}, h=${current.height}) ` +
            `overlaps Card ${i + 1} (type=${next.cardType}, y=${next.y}) by ${Math.abs(gap)}px`
          );
        }
        // Check for incorrect spacing
        else if (Math.abs(gap - EXPECTED_SPACING) > SPACING_TOLERANCE) {
          spacingIssues.push(
            `SPACING: Gap between Card ${i} and ${i + 1} is ${gap}px ` +
            `(expected ${EXPECTED_SPACING}px ±${SPACING_TOLERANCE}px)`
          );
        }
      }

      // Calculate X-variation
      const xPositions = sortedCards.map(c => c.x);
      const xVariation = Math.max(...xPositions) - Math.min(...xPositions);

      // NEW: Validate degradation rules
      const degradationViolations = validateDegradationRules(cardTypes, hasOverflow);

      // NEW: Validate X-alignment for mixed-type columns
      const xAlignmentIssues = isMixed ? validateMixedTypeAlignment(sortedCards) : [];

      return {
        side,
        cardCount: cards.length,
        cardTypes,
        isMixed,
        heights,
        yCoordinates,
        yGaps,
        xVariation,
        hasOverlaps,
        spacingIssues,
        cards: sortedCards,
        degradationViolations,
        xAlignmentIssues
      };
    };

    /**
     * Analysis callback for zoom-and-swipe procedure
     * Validates card layout at current viewport position
     */
    const analyzePosition = async (page: PlaywrightPage, position: ZoomSwipePosition): Promise<LayoutAnalysis> => {
      const cards = await page.locator('[data-testid="event-card"]').all();

      const cardData: CardData[] = [];
      for (const card of cards) {
        const box = await card.boundingBox();
        const cardType = await card.getAttribute('data-card-type');
        const eventId = await card.getAttribute('data-event-id');

        if (box && cardType) {
          cardData.push({
            id: eventId,
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
            cardType
          });
        }
      }

      // Group cards by spatial proximity (same X-region = same cluster)
      const xTolerance = 100;
      const spatialGroups: CardData[][] = [];

      for (const card of cardData) {
        const existingGroup = spatialGroups.find(group => {
          return group.some(c => Math.abs(c.x - card.x) < xTolerance);
        });

        if (existingGroup) {
          existingGroup.push(card);
        } else {
          spatialGroups.push([card]);
        }
      }

      // Detect overflow for each cluster using THREE methods:
      // 1. Overflow badges ("+N" text rendered on page)
      // 2. Event count > 8 (predicted overflow before badges are rendered)
      // 3. Pattern analysis (title-only in non-standard counts)
      const overflowBadges = await page.locator('text=/^\\+\\d+$/').all();
      const overflowByCluster = new Map<number, boolean>();
      const overflowSourceByCluster = new Map<number, string[]>();

      // Method 1: Map overflow badges to clusters by X-position proximity
      for (const badge of overflowBadges) {
        const badgeBox = await badge.boundingBox();
        if (badgeBox) {
          const badgeX = badgeBox.x;
          // Find which cluster this overflow belongs to
          for (let i = 0; i < spatialGroups.length; i++) {
            const group = spatialGroups[i];
            const groupXs = group.map(c => c.x);
            const avgX = groupXs.reduce((sum, x) => sum + x, 0) / groupXs.length;
            // Reduced tolerance from 150px to 50px to prevent cross-cluster badge attribution
            if (Math.abs(badgeX - avgX) < 50) {
              overflowByCluster.set(i, true);
              const sources = overflowSourceByCluster.get(i) || [];
              sources.push(`overflow-badge@${Math.round(badgeX)}`);
              overflowSourceByCluster.set(i, sources);
              break;
            }
          }
        }
      }

      // Method 2: Check event count per half-column (predicted overflow)
      // If a half-column has > 8 events (even if not all visible), there WILL be overflow
      // Maximum capacity is 8 title-only cards per half-column
      for (let i = 0; i < spatialGroups.length; i++) {
        const group = spatialGroups[i];
        const above = group.filter(c => c.y < TIMELINE_Y);
        const below = group.filter(c => c.y >= TIMELINE_Y);

        // Check if either half-column has more than 8 title-only cards (max capacity)
        // This indicates predicted overflow even if badges haven't been created yet
        if (above.length > 8 || below.length > 8) {
          overflowByCluster.set(i, true);
          const sources = overflowSourceByCluster.get(i) || [];
          sources.push(`count>8 (above:${above.length}, below:${below.length})`);
          overflowSourceByCluster.set(i, sources);
        }

        // Method 3: Pattern analysis - if all cards are title-only AND count doesn't match standard patterns
        // This suggests overflow forced title-only degradation
        const aboveTitleOnly = above.every(c => c.cardType === 'title-only');
        const belowTitleOnly = below.every(c => c.cardType === 'title-only');

        if (aboveTitleOnly && above.length > 0 && ![1, 8].includes(above.length)) {
          // Not a standard uniform pattern - likely forced by overflow
          overflowByCluster.set(i, true);
          const sources = overflowSourceByCluster.get(i) || [];
          sources.push(`pattern-above (${above.length} title-only, non-standard)`);
          overflowSourceByCluster.set(i, sources);
        }
        if (belowTitleOnly && below.length > 0 && ![1, 8].includes(below.length)) {
          // Not a standard uniform pattern - likely forced by overflow
          overflowByCluster.set(i, true);
          const sources = overflowSourceByCluster.get(i) || [];
          sources.push(`pattern-below (${below.length} title-only, non-standard)`);
          overflowSourceByCluster.set(i, sources);
        }
      }

      // Analyze each spatial cluster
      const clusters: ClusterAnalysis[] = [];
      const issues: string[] = [];
      let mixedColumns = 0;
      let overlapCount = 0;
      let misalignedColumns = 0;

      for (let i = 0; i < spatialGroups.length; i++) {
        const group = spatialGroups[i];
        const above = group.filter(c => c.y < TIMELINE_Y);
        const below = group.filter(c => c.y >= TIMELINE_Y);

        const centerX = Math.round(
          group.reduce((sum, c) => sum + c.x, 0) / group.length
        );

        const hasOverflow = overflowByCluster.get(i) ?? false;

        const aboveAnalysis = above.length > 0 ? analyzeHalfColumn(above, 'above', hasOverflow) : null;
        const belowAnalysis = below.length > 0 ? analyzeHalfColumn(below, 'below', hasOverflow) : null;

        // Count mixed columns
        if (aboveAnalysis?.isMixed) mixedColumns++;
        if (belowAnalysis?.isMixed) mixedColumns++;

        // Count overlaps
        if (aboveAnalysis?.hasOverlaps) overlapCount++;
        if (belowAnalysis?.hasOverlaps) overlapCount++;

        // Count misaligned columns
        if (aboveAnalysis && aboveAnalysis.xVariation > X_ALIGNMENT_TOLERANCE) {
          misalignedColumns++;
          issues.push(
            `Cluster ${i + 1} ABOVE: X-variation ${aboveAnalysis.xVariation}px exceeds tolerance`
          );
        }
        if (belowAnalysis && belowAnalysis.xVariation > X_ALIGNMENT_TOLERANCE) {
          misalignedColumns++;
          issues.push(
            `Cluster ${i + 1} BELOW: X-variation ${belowAnalysis.xVariation}px exceeds tolerance`
          );
        }

        // Collect spacing issues
        if (aboveAnalysis) {
          aboveAnalysis.spacingIssues.forEach(issue => {
            issues.push(`Cluster ${i + 1} ABOVE: ${issue}`);
          });
        }
        if (belowAnalysis) {
          belowAnalysis.spacingIssues.forEach(issue => {
            issues.push(`Cluster ${i + 1} BELOW: ${issue}`);
          });
        }

        // NEW: Collect degradation rule violations
        if (aboveAnalysis) {
          aboveAnalysis.degradationViolations.forEach(violation => {
            issues.push(`Cluster ${i + 1} ABOVE: DEGRADATION RULE: ${violation}`);
          });
        }
        if (belowAnalysis) {
          belowAnalysis.degradationViolations.forEach(violation => {
            issues.push(`Cluster ${i + 1} BELOW: DEGRADATION RULE: ${violation}`);
          });
        }

        // NEW: Collect X-alignment issues for mixed columns
        if (aboveAnalysis && aboveAnalysis.isMixed) {
          aboveAnalysis.xAlignmentIssues.forEach(issue => {
            issues.push(`Cluster ${i + 1} ABOVE: X-ALIGNMENT: ${issue}`);
          });
        }
        if (belowAnalysis && belowAnalysis.isMixed) {
          belowAnalysis.xAlignmentIssues.forEach(issue => {
            issues.push(`Cluster ${i + 1} BELOW: X-ALIGNMENT: ${issue}`);
          });
        }

        clusters.push({
          clusterId: i + 1,
          centerX,
          above: aboveAnalysis,
          below: belowAnalysis,
          hasOverflow,
          overflowSource: hasOverflow ? (overflowSourceByCluster.get(i) || []).join(', ') : undefined
        });
      }

      // Print compact summary for this position
      const posLabel = `Z${position.zoomLevel}P${position.panStep}`;
      if (issues.length > 0) {
        console.log(`    ⚠️ ${posLabel}: ${cardData.length} cards, ${issues.length} issues (${overlapCount} overlaps, ${mixedColumns} mixed)`);
      } else {
        console.log(`    ✓ ${posLabel}: ${cardData.length} cards, ${mixedColumns} mixed columns, no issues`);
      }

      return {
        position,
        totalCards: cardData.length,
        clusters,
        issues,
        mixedColumns,
        overlapCount,
        misalignedColumns
      };
    };

    // Execute zoom-and-swipe procedure
    const swipeResults = await zoomAndSwipe(page, analyzePosition, {
      zoomLevels: 15, // Test 15 zoom levels for deep coverage of dense areas
      pansPerLevel: 8,
      useZoomButtons: true
    });

    // Flatten all results for analysis
    const allAnalyses = swipeResults.results.flat();

    // Generate detailed summary report
    console.log(`\n${'='.repeat(70)}`);
    console.log('📊 DETAILED SUMMARY REPORT');
    console.log('='.repeat(70));

    const totalIssues = allAnalyses.reduce((sum, a) => sum + a.issues.length, 0);
    const totalOverlaps = allAnalyses.reduce((sum, a) => sum + a.overlapCount, 0);
    const totalMisaligned = allAnalyses.reduce((sum, a) => sum + a.misalignedColumns, 0);
    const totalMixed = allAnalyses.reduce((sum, a) => sum + a.mixedColumns, 0);

    // NEW: Count degradation violations and X-alignment issues
    const totalDegradationViolations = allAnalyses.reduce((sum, a) => {
      return sum + a.issues.filter(issue => issue.includes('DEGRADATION RULE')).length;
    }, 0);
    const totalXAlignmentIssues = allAnalyses.reduce((sum, a) => {
      return sum + a.issues.filter(issue => issue.includes('X-ALIGNMENT')).length;
    }, 0);

    console.log(`Total positions analyzed: ${swipeResults.totalPositions}`);
    console.log(`Total cards analyzed: ${allAnalyses.reduce((sum, a) => sum + a.totalCards, 0)}`);
    console.log(`Total mixed columns found: ${totalMixed}`);
    console.log(`Total overlaps detected: ${totalOverlaps}`);
    console.log(`Total misaligned columns: ${totalMisaligned}`);
    console.log(`Total degradation violations: ${totalDegradationViolations}`); // NEW
    console.log(`Total X-alignment issues (mixed): ${totalXAlignmentIssues}`); // NEW
    console.log(`Total issues: ${totalIssues}`);

    if (totalIssues > 0) {
      console.log(`\n❌ VALIDATION FAILURES (${totalIssues} issues across ${swipeResults.totalPositions} positions)`);

      // Find positions with issues
      const problematicPositions = allAnalyses.filter(a => a.issues.length > 0);
      console.log(`\nPositions with issues (${problematicPositions.length}):`);

      // Group by zoom level for better readability
      const issuesByZoom: Map<number, LayoutAnalysis[]> = new Map();
      problematicPositions.forEach(a => {
        const zoomLevel = a.position.zoomLevel;
        if (!issuesByZoom.has(zoomLevel)) {
          issuesByZoom.set(zoomLevel, []);
        }
        issuesByZoom.get(zoomLevel)!.push(a);
      });

      issuesByZoom.forEach((positions, zoomLevel) => {
        console.log(`\n  Zoom Level ${zoomLevel}: ${positions.length} positions with issues`);
        positions.forEach(a => {
          console.log(`    - Pan ${a.position.panStep}: ${a.issues.length} issues`);
          a.issues.forEach(issue => {
            console.log(`      • ${issue}`);
          });
        });
      });

      // Print detailed cluster info for first few problematic positions
      console.log(`\n📋 DETAILED CLUSTER DIAGNOSTICS (first 5 problematic positions):`);
      problematicPositions.slice(0, 5).forEach(analysis => {
        const pos = analysis.position;
        console.log(`\n  ━━━ Zoom ${pos.zoomLevel}, Pan ${pos.panStep} ━━━`);

        analysis.clusters.forEach(cluster => {
          // Show ALL clusters, not just ones with overlaps/spacing issues
          const hasAnyIssues =
            cluster.above?.hasOverlaps || cluster.below?.hasOverlaps ||
            cluster.above?.spacingIssues.length || cluster.below?.spacingIssues.length ||
            cluster.above?.degradationViolations.length || cluster.below?.degradationViolations.length ||
            cluster.above?.xAlignmentIssues.length || cluster.below?.xAlignmentIssues.length;

          if (hasAnyIssues) {
            console.log(`    🔍 Cluster ${cluster.clusterId} (centerX ≈ ${cluster.centerX}):`);
            console.log(`       Overflow detected: ${cluster.hasOverflow ? '🔴 YES' : '🟢 NO'}`);
            if (cluster.hasOverflow && cluster.overflowSource) {
              console.log(`       Overflow source: ${cluster.overflowSource}`);
            }
            console.log('');

            if (cluster.above) {
              const a = cluster.above;
              console.log(`      ╔══ ABOVE: ${a.cardCount} cards ${a.isMixed ? '[MIXED]' : '[UNIFORM]'}`);
              console.log(`      ║ Card Types: [${a.cardTypes.join(', ')}]`);
              console.log(`      ║ Card IDs: [${a.cards.map(c => c.id || 'unknown').join(', ')}]`);
              console.log(`      ║ Heights: [${a.heights.join(', ')}]px`);
              console.log(`      ║ Y-coords: [${a.yCoordinates.join(', ')}]`);
              console.log(`      ║ Y-gaps: [${a.yGaps.map(g => `${g}px`).join(', ')}]`);
              console.log(`      ║ X-variation: ${a.xVariation}px (tolerance: ${X_ALIGNMENT_TOLERANCE}px)`);

              // Show specific issues
              if (a.hasOverlaps) console.log(`      ║ ⚠️ HAS OVERLAPS!`);
              if (a.spacingIssues.length) {
                console.log(`      ║ ⚠️ SPACING ISSUES:`);
                a.spacingIssues.forEach(issue => console.log(`      ║   • ${issue}`));
              }
              if (a.degradationViolations.length) {
                console.log(`      ║ ⚠️ DEGRADATION VIOLATIONS:`);
                a.degradationViolations.forEach(violation => console.log(`      ║   • ${violation}`));
              }
              if (a.xAlignmentIssues.length) {
                console.log(`      ║ ⚠️ X-ALIGNMENT ISSUES:`);
                a.xAlignmentIssues.forEach(issue => console.log(`      ║   • ${issue}`));
              }
              console.log(`      ╚══`);
            }

            if (cluster.below) {
              const b = cluster.below;
              console.log(`      ╔══ BELOW: ${b.cardCount} cards ${b.isMixed ? '[MIXED]' : '[UNIFORM]'}`);
              console.log(`      ║ Card Types: [${b.cardTypes.join(', ')}]`);
              console.log(`      ║ Card IDs: [${b.cards.map(c => c.id || 'unknown').join(', ')}]`);
              console.log(`      ║ Heights: [${b.heights.join(', ')}]px`);
              console.log(`      ║ Y-coords: [${b.yCoordinates.join(', ')}]`);
              console.log(`      ║ Y-gaps: [${b.yGaps.map(g => `${g}px`).join(', ')}]`);
              console.log(`      ║ X-variation: ${b.xVariation}px (tolerance: ${X_ALIGNMENT_TOLERANCE}px)`);

              // Show specific issues
              if (b.hasOverlaps) console.log(`      ║ ⚠️ HAS OVERLAPS!`);
              if (b.spacingIssues.length) {
                console.log(`      ║ ⚠️ SPACING ISSUES:`);
                b.spacingIssues.forEach(issue => console.log(`      ║   • ${issue}`));
              }
              if (b.degradationViolations.length) {
                console.log(`      ║ ⚠️ DEGRADATION VIOLATIONS:`);
                b.degradationViolations.forEach(violation => console.log(`      ║   • ${violation}`));
              }
              if (b.xAlignmentIssues.length) {
                console.log(`      ║ ⚠️ X-ALIGNMENT ISSUES:`);
                b.xAlignmentIssues.forEach(issue => console.log(`      ║   • ${issue}`));
              }
              console.log(`      ╚══`);
            }
            console.log('');
          }
        });
      });
    } else {
      console.log('\n✅ ALL VALIDATION CHECKS PASSED');
      console.log(`Tested ${swipeResults.totalPositions} positions across ${swipeResults.config.zoomLevels} zoom levels`);
      console.log(`Found ${totalMixed} mixed columns - all with correct spacing and alignment!`);
      console.log(`✓ No overlaps detected`);
      console.log(`✓ No degradation rule violations`);
      console.log(`✓ All mixed columns have perfect X-alignment (left & right edges)`);
      console.log(`✓ All Y-gaps between cards are ${EXPECTED_SPACING}px ±${SPACING_TOLERANCE}px`);
    }

    console.log('='.repeat(70) + '\n');

    // Test assertions
    expect(totalOverlaps).toBe(0);
    expect(totalMisaligned).toBe(0);
    expect(totalDegradationViolations).toBe(0); // NEW: No degradation violations
    expect(totalXAlignmentIssues).toBe(0); // NEW: No X-alignment issues in mixed columns
    expect(totalIssues).toBe(0);
  });
});
