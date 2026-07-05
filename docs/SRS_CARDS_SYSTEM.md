# Card System & Overflow Management Requirements

This fragment expands on Sections 3 and 4 of the primary `SRS.md`. It captures detailed acceptance criteria, implementation references, and linked tests for the card type system, degradation logic, and overflow management.

## Requirement Table

### Card Type Requirements

| ID | Requirement | Acceptance Criteria | Code | Tests |
|---|---|---|---|---|
| CC-REQ-CARD-FULL-001 | Full cards are 132px tall (derived from typography contract) and show title, description, and date without clipping | Full cards have width=260px, height=132px (derived in `src/layout/cardMetrics.ts`)<br> Display title (up to 2 lines), description (up to 3 lines), and date directly below description<br> Ellipsis truncation at end of last visible line when content exceeds line budget; no pixel clipping outside the card<br> Used for low-density timelines (<=2 events per half-column) | `src/layout/cardMetrics.ts`, `src/layout/config.ts`, `src/layout/DeterministicLayoutComponent.tsx` | v5/03, v5/104 |
| CC-REQ-CARD-COMPACT-001 | Compact cards have same width as full (260px), 90px tall (derived from typography contract), and show 1 description line | Compact cards have width=260px, height=90px (derived in `src/layout/cardMetrics.ts`)<br> Display title (up to 2 lines), partial description (1 line), and date directly below description<br> Description truncated with ellipsis if needed<br> Used for medium-density timelines (3-4 events per half-column) | `src/layout/cardMetrics.ts`, `src/layout/config.ts`, `src/layout/DeterministicLayoutComponent.tsx` | v5/03, v5/47 |
| CC-REQ-CARD-TITLE-ONLY-001 | Title-only cards appear when cluster density exceeds compact capacity, with no overlaps | Title-only cards have width=260px, height=32px<br> Display only title and icon (no date, no description)<br> Title displayed in single line with ellipsis truncation<br> Used for high-density timelines (>4 events per half-column)<br> No visual overlaps occur even at maximum density | `src/layout/LayoutEngine.ts`, `src/layout/CardRenderer.tsx` | v5/48 |

### Card Degradation Requirements

| ID | Requirement | Acceptance Criteria | Code | Tests |
|---|---|---|---|---|
| CC-REQ-DEGRADATION-001 | Cards degrade from full -> compact -> title-only to fill each half-column's vertical budget without overlaps | Card types are a function of the half-column cell budget `K = getHalfColumnBudget(config, side).cells`, not fixed event-count thresholds (B2, 2026-07-05)<br> Visibility first: `visible = min(N, K)` events shown as title-only, remainder overflow<br> Leftover budget upgrades the earliest events (title-only->compact->full), yielding a non-increasing staircase; uniform tiers emerge when the whole stack fits one tier<br> Soft density caps: full <= 2, compact <= 4 per half-column; title-only uncapped (budget-limited)<br> Each half-column packs against its OWN per-side budget (above/below independent)<br> Deterministic: identical (N, side, config) -> identical packing | `src/layout/engine/DegradationEngine.ts`, `src/layout/layoutBudget.ts` | v5/36, v5/39, v5/67, v5/70 |
| CC-REQ-SEMICOL-002 | If a semi-column totals 3-4 events, degrade to compact and show them without overflow; overflow only after visible budget is exceeded | Semi-columns with 3-4 events display all as compact cards<br> No overflow badges appear for 3-4 event groups<br> Overflow badges only appear when event count exceeds card type capacity<br> Visual budget fully utilized before triggering overflow | `src/layout/LayoutEngine.ts`, `src/layout/config.ts` | v5/47 |
| CC-REQ-DEGRADATION-METRICS-001 | System tracks degradation metrics for monitoring and debugging | Telemetry includes: totalGroups, fullCardGroups, compactCardGroups, titleOnlyCardGroups<br> Degradation rate calculated as percentage of degraded groups<br> Space reclaimed metrics show vertical space saved by degradation<br> Degradation triggers logged with before/after card types | `src/layout/engine/DegradationEngine.ts` | v5/05 |

### Cluster-Level Coordination Requirements

| ID | Requirement | Acceptance Criteria | Code | Tests |
|---|---|---|---|---|
| CC-REQ-CLUSTER-COORD-001 | Above/below half-columns degrade INDEPENDENTLY; spatial clusters remain a reporting/badge grouping only | Each half-column selects card types from its OWN per-side cell budget (B2 packing); a crowded `above` never forces a sparse `below` to degrade, and vice versa<br> Spatial clusters (X-position proximity) are still identified, but only for telemetry and overflow-badge placement — NOT for card-type decisions<br> `hasOverflow`/`totalEvents` on a cluster are informational; no `recommendedCardType` coordination remains<br> Rewritten 2026-07-05 (B3): supersedes the prior "both sides degrade uniformly on any overflow" rule, which fought CC-REQ-CAPACITY-INDEPENDENT-001 | `src/layout/engine/DegradationEngine.ts`, `src/layout/layoutBudget.ts` | v5/67, v5/70 |
| CC-REQ-MIXED-TYPES-001 | Mixed card types are the norm; each half-column is a non-increasing tier staircase filling its own budget | A half-column freely mixes full/compact/title-only to fill its per-side cell budget; mixing is no longer gated on cluster overflow<br> Tiers are non-increasing chronologically (earliest events richest) per CC-REQ-MIXED-TYPES-002<br> Overflow on one half-column does NOT force uniform types on its cluster partner<br> Rewritten 2026-07-05 (B3): supersedes the prior "mixed types only when cluster has NO overflow" rule | `src/layout/engine/DegradationEngine.ts` | v5/67, v5/70 |
| CC-REQ-MIXED-TYPES-002 | Within mixed card type clusters, chronological priority determines card type | Earlier events receive full cards, later events receive compact/title-only cards<br> Card type degradation follows chronological order (earliest = best)<br> Ensures important/early events maintain maximum information density<br> Consistent prioritization across all spatial clusters | `src/layout/engine/DegradationEngine.ts` | v5/67 |

### Visual Layout Requirements

| ID | Requirement | Acceptance Criteria | Code | Tests |
|---|---|---|---|---|
| CC-REQ-LAYOUT-XALIGN-001 | Cards within the same half-column must maintain exact X-alignment throughout all layout operations | All cards in a half-column positioned at group.centerX (deterministic)<br> Collision resolution must NOT horizontally displace cards within same half-column<br> Only cards from DIFFERENT half-columns may be nudged horizontally to prevent overlap<br> X-alignment must be deterministic with ZERO tolerance (no approximation)<br> Above and below half-columns do NOT need to align with each other | `src/layout/engine/PositioningEngine.ts` | v5/68, v5/69 |

### Overflow Management Requirements

| ID | Requirement | Acceptance Criteria | Code | Tests |
|---|---|---|---|---|
| CC-REQ-OVERFLOW-001 | Navigating to an empty period shows no leftover overflow badges; anchors filter to view window when zoomed | When navigating to timeline area with no events, no overflow badges render<br> Overflow badges filtered by view window to prevent stale indicators<br> **When zoomed**: Anchors filter to events within visible time window only<br> **When not zoomed**: All anchors remain visible for full timeline navigation<br> System cleans up overflow state when zooming/panning | `src/layout/LayoutEngine.ts`, `src/layout/DeterministicLayoutComponent.tsx` | v5/30, v5/62 |
| CC-REQ-OVERFLOW-002 | Overflow reduces/disappears appropriately when zooming out | Zooming out increases available space and reduces overflow count<br> Overflow badges update dynamically as zoom level changes<br> Overflow may disappear completely if all events fit after zoom out<br> Overflow count accurately reflects hidden events at current zoom | `src/layout/LayoutEngine.ts`, `src/layout/DeterministicLayoutComponent.tsx` | v5/30 |
| CC-REQ-OVERFLOW-003 | When events exceed capacity, overflow badges (+N) appear showing hidden event count | Overflow badges display "+N" format where N is count of hidden events<br> Badge count includes both primary overflow and degraded overflow events<br> Badges positioned relative to anchor points<br> Badge visibility tied to anchor visibility (no orphaned badges) | `src/layout/LayoutEngine.ts`, `src/layout/DeterministicLayoutComponent.tsx` | v5/56 |
| CC-REQ-OVERFLOW-004 | Overflow indicators maintain minimum spacing to prevent visual overlap | Nearby overflow badges are merged to prevent visual crowding<br> Merged badges show combined count of all included overflows<br> Merged badge positioned at centroid of component badge positions<br> Minimum spacing threshold prevents badge collision | `src/layout/DeterministicLayoutComponent.tsx` | v5/15 |

### Capacity Management Requirements

| ID | Requirement | Acceptance Criteria | Code | Tests |
|---|---|---|---|---|
| CC-REQ-CAPACITY-001 | System reports total/used cells and utilization metrics for monitoring | Capacity model tracks slot usage per half-column and per side<br> Metrics include: total slots, used slots, utilization percentage, cellsPerSide<br> **Viewport-responsive**: cellsPerSide adapts to viewport height (3-16 cells)<br> Separate tracking for above/below timeline sections<br> Real-time capacity reporting for developer tools | `src/layout/LayoutEngine.ts`, `src/layout/CapacityModel.ts` | v5/05, v0.8.16 |
| CC-REQ-CAPACITY-SLOTS-001 | Cell footprints follow fixed rules based on card type | Per-card cell footprint (44px cells): full = 4 cells, compact = 3 cells, title-only = 1 cell, per `ceil((height + CARD_SPACING) / 44)`<br> Per-half-column type caps: full <= 2, compact <= 4, title-only <= 8 (bounded by physical fit)<br> Cell counts are deterministic and consistent across all timelines | `src/layout/config.ts` (`CARD_HEIGHT_CELLS`), `src/layout/engine/DegradationEngine.ts` | v5/03, v5/48 |
| CC-REQ-CAPACITY-INDEPENDENT-001 | Above and below timeline sections have independent capacity tracking | Above section capacity calculated independently from below section<br> Different card types can be used simultaneously (above=compact, below=full)<br> Capacity exhaustion in one section doesn't affect the other<br> Each section optimizes space usage independently<br> **Exception**: Degradation decisions coordinate at spatial cluster level per CC-REQ-CLUSTER-COORD-001 | `src/layout/LayoutEngine.ts` | v5/12 |
| CC-REQ-CAPACITY-VIEWPORT-001 | Capacity scales dynamically with viewport height without artificial caps | Capacity calculation: floor((viewportHeight/2 - TIMELINE_MARGIN) / (TITLE_CARD_HEIGHT + SPACING))<br> Minimum capacity: 3 cells per side (prevents broken layouts on mobile)<br> Soft maximum: 16 cells per side (safety limit for ultra-wide displays)<br> Capacity increases naturally with viewport size:<br> - 768px height → ~6 cells<br> - 1080px height → ~10 cells<br> - 1440px height → ~14 cells<br> - 2160px height → 16 cells (soft cap)<br> No artificial MAX cap prevents viewport responsiveness | `src/layout/CapacityModel.ts` | v0.8.16 |

### Performance Optimizations (v0.8.3)

| ID | Requirement | Acceptance Criteria | Code | Tests | Status |
|---|---|---|---|---|---|
| CC-REQ-PERF-SPATIAL-001 | Spatial hashing for collision detection reduces O(n²) complexity to O(n) | Collision detection uses spatial hashing with 100px grid cells<br> Cards register in all grid cells they overlap<br> Collision checks only compare cards within same or adjacent cells<br> Average complexity O(n) instead of O(n²)<br> Implementation handles edge cases (cards spanning multiple cells) | `src/layout/engine/PositioningEngine.ts:buildSpatialHash()` | 97-high-density-stress.spec.ts, 98-interaction-model-v083.spec.ts | Implemented |
| CC-REQ-PERF-VIRTUAL-001 | Card virtualization keeps DOM size constant regardless of event count | Only render cards within viewport bounds (±200px buffer)<br> DOM stays at ~20-40 nodes regardless of total events<br> Full card list maintained for anchor positioning and telemetry<br> Scroll performance remains smooth with 1000+ events | `src/layout/DeterministicLayoutComponent.tsx` | 97-high-density-stress.spec.ts | Implemented |
| CC-REQ-PERF-CACHE-001 | Layout caching prevents redundant recalculations during pan/zoom | Cache layout results when events unchanged<br> Invalidate cache on: events change, viewport resize, viewStart/viewEnd change<br> Pan operations reuse cached layout (no recalculation)<br> Zoom operations trigger recalculation only when necessary | `src/layout/DeterministicLayoutComponent.tsx:layoutCacheRef` | 98-interaction-model-v083.spec.ts | Implemented |
| CC-REQ-PERF-MAP-001 | Anchor-card map provides O(1) lookup for event-to-card associations | O(1) anchor-to-card lookup via Map<eventId, PositionedCard[]><br> Replaces O(n²) filter operations for card queries<br> Map updated whenever layout recalculates<br> Supports multiple cards per event (stacking scenarios) | `src/layout/DeterministicLayoutComponent.tsx:cardsByEventId` | 98-interaction-model-v083.spec.ts | Implemented |

### Hover Effects (v0.8.3)

| ID | Requirement | Acceptance Criteria | Code | Tests | Status |
|---|---|---|---|---|---|
| CC-REQ-CARD-HOVER-001 | Cards elevate on hover with subtle lift effect | Cards scale to 1.02x on hover<br> Shadow elevation changes to shadow-lg<br> Z-index increases above adjacent cards (prevents shadow clipping)<br> Transition duration 200ms ease-out<br> Effect applies to all card types (full, compact, title-only) | `src/styles/index.css:.card-hover-scale` | 98-interaction-model-v083.spec.ts | Implemented |
| CC-REQ-CARD-PREVIEW-001 | Hover preview displays full content for degraded cards | Floating preview appears after 300ms hover delay<br> Shows full title, date, description, and sources for compact/title-only cards<br> Positioned to right of card (or left if near viewport edge)<br> Preview dismissed on mouse leave<br> Z-index ensures preview appears above all cards<br> Only shown for cards with truncated content | `src/components/CardHoverPreview.tsx` | 98-interaction-model-v083.spec.ts | Implemented |

### Source Indicator (v0.9.6)

| ID | Requirement | Acceptance Criteria | Code | Tests | Status |
|---|---|---|---|---|---|
| CC-REQ-CARD-SOURCE-001 | Cards with sources display a visual indicator icon | Events with non-empty `sources[]` array show a subtle link icon<br> Icon uses theme-aware color (var(--color-text-tertiary)) at 60% opacity<br> Icon positioned in card header area next to title<br> Hover tooltip shows source count (e.g., "2 sources")<br> Icon NOT displayed when sources array is empty or undefined<br> Applies to all card types (full, compact, title-only) | `src/layout/DeterministicLayoutComponent.tsx:SourceIndicator` | tests/editor/102-source-indicator.spec.ts | Implemented |

## Implementation Notes

### Card Type Selection Logic

The degradation engine uses event count to determine card type:

```typescript
// From DegradationEngine.ts
if (eventCount <= 2) {
 return 'full'; // 1-2 events: full cards
} else if (eventCount <= 4) {
 return 'compact'; // 3-4 events: compact cards
} else {
 return 'title-only'; // 5+ events: title-only cards
}
```

### Mixed Card Type Scenarios

**Current Implementation**: Mixed card types are now implemented via `FEATURE_FLAGS.ENABLE_MIXED_CARD_TYPES` (see `src/config/featureFlags.ts`). When enabled, cards within spatial clusters can use different card types based on chronological priority.

#### When Mixed Types Are Allowed

Mixed card types can be used ONLY when a spatial cluster meets ALL these conditions:

1. **Zero Overflow**: No overflow in either above OR below half-columns
2. **Space Available**: Sufficient vertical space to accommodate mixed heights
3. **Event Count**: 3-5 events where mixed types provide better information density
4. **Chronological Priority**: Earlier events receive full cards, later events degrade

#### Example Scenarios

| Scenario | Above Events | Below Events | Cluster Overflow? | Card Types | Reasoning |
|----------|--------------|--------------|-------------------|------------|-----------|
| **Scenario 1: No Overflow** | 3 events (2024-01-01, 01-02, 01-03) | 0 events | NO | Above: 1 full + 2 compact | Safe to use mixed types - no overflow in cluster |
| **Scenario 2: Overflow Above** | 5 events (overflows) | 2 events | YES | Above: 5 title-only<br>Below: 2 full | Uniform degradation - overflow forces title-only above |
| **Scenario 3: Overflow Below** | 2 events | 5 events (overflows) | YES | Above: 2 compact<br>Below: 5 title-only | Cluster coordination - overflow below forces degradation |
| **Scenario 4: Both Overflow** | 6 events (overflows) | 7 events (overflows) | YES | Above: title-only<br>Below: title-only | Uniform title-only due to cluster overflow |
| **Scenario 5: Sparse Cluster** | 1 event | 1 event | NO | Above: 1 full<br>Below: 1 full | Full cards when plenty of space available |

#### Critical Rule: Cluster Coordination

> **Spatial clusters must coordinate overflow checking across above/below half-columns.**
>
> If the above half-column has overflow, the below half-column must also consider this when selecting card types, even if the below section has available space. This prevents visual inconsistency where one side shows full cards while the other is overflowing.

**Anti-Pattern (Bug):**
```
X-Region 500px:
  Above: 5 events → overflowing → showing title-only cards (correct)
  Below: 2 events → no overflow → showing full cards (WRONG!)
  ❌ Visual inconsistency - bottom shows luxury while top is cramped
```

**Correct Pattern:**
```
X-Region 500px:
  Above: 5 events → cluster has overflow
  Below: 2 events → cluster has overflow
  ✅ Both degrade uniformly (title-only or compact based on total cluster density)
```

### Overflow Event Management

Overflow events are stored separately from visible events:

- **Primary Events**: Events that fit within card capacity and are displayed
- **Overflow Events**: Events that exceed capacity, stored in `group.overflowEvents` array
- **View Window Filtering**: Overflow events filtered by visible time window to prevent leftover badges

### Badge Merging Strategy

Overflow badges use spatial proximity merging:

1. Identify badges within minimum spacing threshold
2. Group nearby badges into merge candidates
3. Calculate centroid position for merged badge
4. Display single badge with combined count

This prevents visual clutter when multiple half-columns have overflow in close proximity.

## Test Coverage

### Card Degradation Tests
- **v5/36-card-degradation-system.spec.ts**: Core degradation system validation
- **v5/37-degradation-system-validation.spec.ts**: Degradation edge cases
- **v5/38-degradation-with-real-data.spec.ts**: Real-world data degradation
- **v5/39-simple-degradation-test.spec.ts**: Simple degradation scenarios
- **v5/47-jfk-fitall-overflow-semi.spec.ts**: Semi-column degradation thresholds
- **v5/48-title-only-degradation.spec.ts**: Title-only card triggering
- **v5/49-title-only-capacity-and-width.spec.ts**: Title-only capacity validation

### Overflow Management Tests
- **v5/13-overflow-logic.spec.ts**: Overflow calculation logic
- **v5/15-overflow-label-overlap.spec.ts**: Overflow badge spacing
- **v5/30-leftover-overflow-detection.spec.ts**: Leftover overflow prevention
- **v5/31-aggressive-leftover-detection.spec.ts**: Comprehensive leftover detection
- **v5/32-view-window-overflow-bug.spec.ts**: View window overflow filtering
- **v5/56-overflow-indicators-visibility.spec.ts**: Overflow badge visibility

### Capacity Management Tests
- **v5/05-capacity-model.spec.ts**: Capacity tracking and metrics
- **v5/03-non-overlap-fit.spec.ts**: Zero-overlap guarantee validation

## Notes & Change History

- 2025-10-01 Initial extraction from `docs/SRS.md` and consolidation of card-related requirements
- 2025-10-01 Documented current implementation: Compact cards are 82px
- 2025-10-01 Added CC-REQ-CAPACITY-SLOTS-001 and CC-REQ-CAPACITY-INDEPENDENT-001 for slot allocation rules
- 2025-10-01 Added CC-REQ-DEGRADATION-METRICS-001 for telemetry tracking
- 2025-10-01 Documented overflow badge merging strategy from DeterministicLayoutComponent.tsx
- 2025-12-27 Updated compact card height from 92px to 82px; updated capacity slots terminology to "cells"; noted FEATURE_FLAGS.ENABLE_MIXED_CARD_TYPES implementation
- 2025-12-31 Added v0.8.3 Performance Optimizations requirements (CC-REQ-PERF-SPATIAL-001, CC-REQ-PERF-VIRTUAL-001, CC-REQ-PERF-CACHE-001, CC-REQ-PERF-MAP-001)
- 2025-12-31 Added v0.8.3 Hover Effects requirements (CC-REQ-CARD-HOVER-001, CC-REQ-CARD-PREVIEW-001)
- 2026-07-04 Card heights re-derived from typography contract (`src/layout/cardMetrics.ts`): full 132px, compact 90px, title-only 32px; updated CC-REQ-CARD-FULL-001 (line-clamped description replaces "no truncation"), CC-REQ-CARD-COMPACT-001, CC-REQ-CAPACITY-SLOTS-001 (per-card footprints 4/3/1 cells vs per-column caps 2/4/8)
- 2026-07-05 **B3 above/below independence** (user-approved): rewrote CC-REQ-CLUSTER-COORD-001 and CC-REQ-MIXED-TYPES-001 — half-columns now degrade independently against their own per-side budgets; spatial clusters are telemetry/badge grouping only. Resolves the long-standing contradiction with CC-REQ-CAPACITY-INDEPENDENT-001. Removed dead `recommendedCardType`/`determineUniformCardType` from `DegradationEngine`.
- 2026-07-05 **B2 budget-driven packing**: rewrote CC-REQ-DEGRADATION-001 — card types now fill the per-half-column cell budget (`getHalfColumnBudget`) via a visibility-first + earliest-richest upgrade algorithm instead of fixed event-count thresholds. Title-only per-column cap of 8 removed (budget-limited). Half-columns pack independently (above/below). **Open for B3 sign-off:** CC-REQ-MIXED-TYPES-001 ("mixed types only when cluster has NO overflow") and CC-REQ-CLUSTER-COORD-001 are superseded by independent per-side packing and need formal reconciliation — see `LAYOUT_IMPROVEMENT_PLAN.md` §5.
