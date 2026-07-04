# Card System & Overflow Management - Design Specification

This document provides the technical design specification for the card system, degradation logic, and overflow management in PowerTimeline. It explains **how** the requirements in `SRS_CARDS_SYSTEM.md` are implemented.

## 1. Card Type Design

### 1.1 Physical Dimensions

All card types share a universal width for visual consistency:

| Card Type | Width | Height | Content |
|---|---|---|---|
| **Full** | 260px | 132px | Title (≤2 lines) + Description (≤3 lines) + Date |
| **Compact** | 260px | 90px | Title (≤2 lines) + Description (≤1 line) + Date |
| **Title-only** | 260px | 32px | Title (1 line) + source icon only (no date, no description) |

**Source**: `src/layout/cardMetrics.ts` (single source of truth; consumed by `src/layout/config.ts` `DEFAULT_CARD_CONFIGS`).

Heights are **derived from the typography contract**, not chosen by hand: `height = title lines × 17.5px + gap + description lines × 16.8px + gap + date 14.4px + padding + 2px border` (border-box), rounded up with a 1–2px safety margin. The unit test `src/layout/cardMetrics.test.ts` fails if the configured heights drift from this derivation.

### 1.2 Content Layout Rules

**Full Cards (132px height):**
- **Title**: Max 2 lines, ellipsis truncation at end of last line
- **Description**: Max 3 lines, ellipsis truncation at end of last line
- **Date**: Directly under description (top-aligned stack, no bottom spacer)
- **Spacing**: 12px padding (`p-3`), 2px between elements (`mt-0.5`)

**Compact Cards (90px height):**
- **Title**: Max 2 lines, ellipsis truncation
- **Description**: Single line, ellipsis truncation
- **Date**: Directly under description (top-aligned stack)
- **Spacing**: 8px padding (`p-2`), 2px between elements
- **Design note**: Height derived from typography contract (see §1.1); replaced earlier hand-tuned values (78 → 92 → 120 → 90px)

**Title-only Cards (32px height):**
- **Title**: Single line, ellipsis truncation
- **Icon**: Source indicator displayed on the right
- **No date or description displayed**
- **Spacing**: 4px padding (`p-1`), horizontal layout
- **Use case**: High-density timelines with >4 events per half-column

### 1.3 Typography Specifications

All card types share one typography scale (`src/styles/index.css`), which is the input to the height derivation in `src/layout/cardMetrics.ts`:

```css
.card-title       { font-size: 0.875rem; font-weight: 600; line-height: 1.25; } /* 17.5px/line */
.card-description { font-size: 0.75rem;  font-weight: 400; line-height: 1.4;  } /* 16.8px/line */
.card-date        { font-size: 0.75rem;  font-weight: 500; line-height: 1.2;  } /* 14.4px */
```

Line limits are enforced by `.card-clamp-*` utilities (`-webkit-line-clamp` plus an em-based `max-height` tied to the line count) so the ellipsis always lands at the end of the last visible line, never mid-block.

### 1.4 Visual Hierarchy

Cards use color-coding and visual weight to convey information density:
- **Full cards**: Richer background, prominent shadows, high visual weight
- **Compact cards**: Medium background, moderate shadows, balanced visual weight
- **Title-only cards**: Minimal background, subtle shadows, low visual weight

This creates an intuitive visual signal: larger, more prominent cards = more space = fewer events.

## 2. Degradation Algorithm Design

### 2.1 Event Count Thresholds

The degradation system uses fixed event count thresholds per half-column:

```typescript
// From DegradationEngine.ts - determineCardType()

if (eventCount <= 2) {
  return 'full';      // Low density: 1-2 events
} else if (eventCount <= 4) {
  return 'compact';   // Medium density: 3-4 events
} else {
  return 'title-only'; // High density: 5+ events
}
```

**Rationale:**
- **2 events**: Matches full card slot capacity (2 slots per half-column)
- **4 events**: Matches compact card slot capacity (4 slots per half-column)
- **5+ events**: Requires title-only cards (8 slots per half-column)

### 2.2 Degradation Decision Tree

```
Event Count → Card Type Selection
│
├─ eventCount ≤ 2
│  └─ Use FULL cards
│     - 2 slots per half-column
│     - Full description visible
│     - Optimal readability
│
├─ eventCount = 3-4
│  └─ Use COMPACT cards
│     - 4 slots per half-column
│     - Partial description (1 line)
│     - Good readability, higher density
│
└─ eventCount ≥ 5
   └─ Use TITLE-ONLY cards
      - 8 slots per half-column
      - No description shown
      - Maximum density, scan-optimized
```

### 2.3 Space Reclamation Calculations

The degradation engine tracks vertical space saved by degradation:

```typescript
// Heights come from CARD_HEIGHTS in src/layout/cardMetrics.ts
// Space saved by degrading from full to compact
const fullCardHeight = 132;    // Full card height
const compactCardHeight = 90;  // Compact card height
const spaceSavedPerCard = fullCardHeight - compactCardHeight; // 42px per card
const totalSpaceSaved = spaceSavedPerCard * eventCount;

// Space saved by degrading from compact to title-only
const titleOnlyHeight = 32;    // Title-only card height
const spaceSavedPerCard = compactCardHeight - titleOnlyHeight; // 58px per card
const totalSpaceSaved = spaceSavedPerCard * Math.min(eventCount, 4);
```

**Telemetry**: Space reclamation metrics tracked in `degradationMetrics.spaceReclaimed`

### 2.4 Degradation Metrics Interface

```typescript
interface DegradationMetrics {
  totalGroups: number;              // Total half-columns processed
  fullCardGroups: number;           // Groups using full cards
  compactCardGroups: number;        // Groups using compact cards
  titleOnlyCardGroups: number;      // Groups using title-only cards
  degradationRate: number;          // Percentage of groups degraded
  spaceReclaimed: number;           // Total vertical space saved (px)
  degradationTriggers: Array<{      // Individual degradation events
    groupId: string;
    eventCount: number;
    from: CardType;
    to: CardType;
    spaceSaved: number;
  }>;
}
```

**Source**: `src/layout/LayoutEngine.ts` - Exported interface

### 2.5 Two-Phase Degradation Strategy with Cluster Coordination

**Current Implementation**: Uniform degradation (single card type per half-column)

**Future Enhancement**: Two-phase strategy that coordinates degradation at spatial cluster level

#### Phase 1: Cluster Identification and Overflow Analysis

Before making degradation decisions, the system must identify spatial clusters and check for overflow:

```typescript
// Pseudocode - Future implementation
interface SpatialCluster {
  id: string;
  xRegion: { start: number; end: number };  // X-position range
  aboveGroup?: ColumnGroup;                 // Half-column above timeline
  belowGroup?: ColumnGroup;                 // Half-column below timeline
  hasOverflow: boolean;                     // ANY overflow in cluster
  totalEvents: number;                      // Combined event count
}

function identifySpatialClusters(groups: ColumnGroup[]): SpatialCluster[] {
  // Step 1: Group half-columns by X-region proximity
  // Step 2: Match above/below pairs that share same X-region
  // Step 3: Check cluster-wide overflow

  const clusters: SpatialCluster[] = [];
  const xThreshold = 50; // Pixels - consider groups within 50px as same cluster

  for (const aboveGroup of aboveGroups) {
    // Find matching below group in same X-region
    const belowGroup = belowGroups.find(g =>
      Math.abs(g.centerX - aboveGroup.centerX) < xThreshold
    );

    // Check if EITHER half-column has overflow
    const aboveHasOverflow = (aboveGroup.overflowEvents?.length ?? 0) > 0;
    const belowHasOverflow = (belowGroup?.overflowEvents?.length ?? 0) > 0;
    const clusterHasOverflow = aboveHasOverflow || belowHasOverflow;

    clusters.push({
      id: `cluster-${aboveGroup.centerX}`,
      xRegion: { start: aboveGroup.startX, end: aboveGroup.endX },
      aboveGroup,
      belowGroup,
      hasOverflow: clusterHasOverflow,
      totalEvents: aboveGroup.events.length + (belowGroup?.events.length ?? 0)
    });
  }

  return clusters;
}
```

**Key Insight**: Overflow checking happens at the **spatial cluster** level, not the individual half-column level.

#### Phase 2: Degradation Decision with Coordination

Once spatial clusters are identified, degradation decisions coordinate across above/below pairs:

```typescript
// Pseudocode - Future implementation
function determineCardTypeForCluster(cluster: SpatialCluster): {
  aboveCardTypes: CardType[];
  belowCardTypes: CardType[];
} {
  // CRITICAL: Check cluster-wide overflow FIRST
  if (cluster.hasOverflow) {
    // Phase 2a: Uniform degradation when overflow exists
    // Both above and below must use same degradation level
    const totalEvents = cluster.totalEvents;
    const uniformCardType = determineUniformCardType(totalEvents);

    return {
      aboveCardTypes: [uniformCardType], // All cards same type
      belowCardTypes: [uniformCardType]  // All cards same type
    };
  } else {
    // Phase 2b: Mixed card types allowed (no overflow in cluster)
    // Can optimize information density with chronological priority

    const aboveEvents = cluster.aboveGroup?.events ?? [];
    const belowEvents = cluster.belowGroup?.events ?? [];

    return {
      aboveCardTypes: determineMixedCardTypes(aboveEvents),
      belowCardTypes: determineMixedCardTypes(belowEvents)
    };
  }
}

function determineUniformCardType(eventCount: number): CardType {
  // Same logic as current implementation
  if (eventCount <= 2) return 'full';
  if (eventCount <= 4) return 'compact';
  return 'title-only';
}

function determineMixedCardTypes(events: Event[]): CardType[] {
  // Mixed types with chronological priority
  // Earlier events get full cards, later events degrade
  const cardTypes: CardType[] = [];

  for (let i = 0; i < events.length; i++) {
    if (i < 1) {
      cardTypes.push('full');      // First event: full card
    } else if (i < 3) {
      cardTypes.push('compact');   // Events 2-3: compact cards
    } else {
      cardTypes.push('title-only'); // Events 4+: title-only
    }
  }

  return cardTypes;
}
```

#### Algorithm Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Cluster Identification & Overflow Analysis     │
└─────────────────────────────────────────────────────────┘
                        ↓
    ┌───────────────────────────────────────┐
    │ Identify spatial clusters by X-region │
    │ Match above/below half-column pairs   │
    └───────────────────────────────────────┘
                        ↓
    ┌───────────────────────────────────────┐
    │ Check: Does cluster have overflow?    │
    │ (ANY overflow in above OR below)      │
    └───────────────────────────────────────┘
                        ↓
            ┌───────────┴───────────┐
            ↓                       ↓
    ┌──────────────┐        ┌──────────────┐
    │ YES: Overflow│        │ NO: No       │
    │ exists       │        │ overflow     │
    └──────────────┘        └──────────────┘
            ↓                       ↓
┌──────────────────────────┐ ┌─────────────────────────┐
│ Phase 2a: Uniform        │ │ Phase 2b: Mixed Card    │
│ Degradation Required     │ │ Types Allowed           │
└──────────────────────────┘ └─────────────────────────┘
            ↓                       ↓
    ┌──────────────┐        ┌──────────────────────┐
    │ Both above   │        │ Chronological        │
    │ AND below    │        │ Priority:            │
    │ use SAME     │        │ - Earliest → Full    │
    │ card type    │        │ - Middle → Compact   │
    │              │        │ - Latest → Title     │
    └──────────────┘        └──────────────────────┘
```

#### Critical Design Rules

**Rule 1: Cluster-Wide Overflow Coordination**
> If ANY half-column in a spatial cluster has overflow, BOTH half-columns must degrade uniformly.

**Rule 2: Overflow Precedence**
> Overflow checking takes priority over all other degradation optimizations.

**Rule 3: Mixed Types Only When Safe**
> Mixed card types can only be used when the spatial cluster has ZERO overflow.

**Rule 4: Chronological Priority in Mixed Mode**
> When using mixed card types, earlier events receive higher priority (full > compact > title-only).

#### Example Scenarios

**Scenario A: Overflow Above, No Overflow Below**
```
Spatial Cluster at X=500px:
  Above: 6 events → HAS OVERFLOW
  Below: 2 events → NO OVERFLOW

Decision:
  ✅ Above: Use title-only (fits 6 events)
  ✅ Below: Use title-only (MUST MATCH above due to cluster overflow)
  ❌ Below: Use full cards (WRONG - violates cluster coordination)
```

**Scenario B: No Overflow in Cluster**
```
Spatial Cluster at X=800px:
  Above: 3 events → NO OVERFLOW
  Below: 0 events → NO OVERFLOW

Decision:
  ✅ Above: Use 1 full + 2 compact (mixed types allowed)
  ✅ Below: N/A (no events)
```

**Scenario C: Both Have Overflow**
```
Spatial Cluster at X=1200px:
  Above: 10 events → HAS OVERFLOW
  Below: 8 events → HAS OVERFLOW

Decision:
  ✅ Above: Use title-only (uniform degradation)
  ✅ Below: Use title-only (uniform degradation)
```

#### Implementation Notes

**Current Status**: The system currently uses uniform degradation (all cards in a half-column are the same type) without cluster coordination. This means overflow in the above section doesn't affect degradation decisions in the below section.

**Migration Path**:
1. Implement `identifySpatialClusters()` function in DegradationEngine
2. Update `determineCardType()` to check cluster-wide overflow
3. Add `determineMixedCardTypes()` for Phase 2b optimization
4. Update tests to validate cluster coordination
5. Enable feature flag for gradual rollout

**Performance Impact**: Cluster identification adds O(n log n) complexity for sorting and matching, but n is typically small (<50 groups per layout), so impact is negligible.

## 3. Slot Allocation System

### 3.1 Slots Per Half-Column

The slot system provides deterministic capacity guarantees:

| Card Type | Slots Per Half-Column | Calculation |
|---|---|---|
| **Full** | 2 | Base capacity |
| **Compact** | 4 | 2× full card slots |
| **Title-only** | 8 | High-density capacity (8 × 32px + 7 × 12px = 340px) |

**Implementation**: `src/layout/engine/DegradationEngine.ts` - `determineCardType()`

**Note**: When events exceed title-only capacity, overflow badges ("+N") are displayed instead of creating additional card types.

### 3.2 Slot Occupancy Tracking

The capacity model tracks slot usage separately for above/below sections:

```typescript
interface ColumnGroup {
  capacity: {
    above: { used: number; total: number };
    below: { used: number; total: number };
  };
}
```

**Key principles:**
- Each half-column has independent capacity
- Above and below sections don't share slots
- Slot exhaustion triggers degradation or overflow

### 3.3 Zero-Overlap Guarantee

The slot system prevents overlaps through deterministic allocation:

1. **Calculate required slots**: `eventCount × slotsPerEvent`
2. **Check available capacity**: `totalSlots - usedSlots ≥ requiredSlots`
3. **If insufficient slots**: Degrade to smaller card type
4. **If degradation insufficient**: Create overflow events

This ensures **mathematical guarantee** of zero overlaps.

### 3.4 Viewport-Responsive Capacity Calculation

The capacity system dynamically adapts to viewport height without artificial caps.

#### Capacity Formula

```typescript
availableHeight = (viewportHeight / 2) - TIMELINE_MARGIN;
cellUnit = TITLE_ONLY_CARD_HEIGHT + CARD_VERTICAL_SPACING; // 44px
calculatedCells = floor(availableHeight / cellUnit);
cellsPerSide = max(MIN_CELLS_PER_SIDE, min(SOFT_MAX_CELLS_PER_SIDE, calculatedCells));
```

#### Capacity by Viewport Size

| Viewport | Available Height | Calculated | Final | Notes |
|---|---|---|---|---|
| 400px (mobile) | 100px | 2.27 | **3** | MIN clamp |
| 768px (laptop) | 284px | 6.45 | **6** | Natural |
| 1080px (FHD) | 440px | 10.0 | **10** | Natural (was 8) |
| 1440px (QHD) | 620px | 14.09 | **14** | Natural (was 8) |
| 2160px (4K) | 980px | 22.27 | **16** | SOFT_MAX |

#### Design Rationale

**Why Remove MAX_CELLS_PER_SIDE = 8?**
- FHD can fit 10 cells naturally but was capped at 8 (20% waste)
- QHD can fit 14 cells but was capped at 8 (43% waste!)

**Why Keep MIN_CELLS_PER_SIDE = 3?**
- Mobile viewports need minimum capacity guarantee
- Prevents broken layouts when calculated < 3

**Why Add SOFT_MAX_CELLS_PER_SIDE = 16?**
- Safety guard for 4K+ displays
- Prevents potential performance issues
- Still allows 2× current capacity

## 4. Overflow System Design

### 4.1 Overflow Detection Logic

Overflow occurs when events exceed card type capacity:

```typescript
// From DegradationEngine.ts - createIndividualCards()

const maxCards = this.getMaxCardsPerHalfColumn(cardTypes[0]);
const allEvents = [
  ...group.events,
  ...(Array.isArray(group.overflowEvents) ? group.overflowEvents : [])
];

if (allEvents.length > maxCards) {
  // Split into visible events and overflow events
  const visibleEvents = allEvents.slice(0, maxCards);
  const remainder = allEvents.slice(maxCards);

  // Update group overflow
  group.overflowEvents = remainder.length > 0 ? remainder : undefined;
}
```

**Logic:**
1. Combine primary events + existing overflow events
2. Take first N events that fit in slots (N = maxCards)
3. Store remainder in `overflowEvents` array
4. Generate overflow badge showing remainder count

### 4.2 View Window Filtering

Overflow events are filtered by visible time window to prevent "leftover badges":

```typescript
// From PositioningEngine.ts - createEventAnchors()

const filterEventsByViewWindow = (events: Event[]) => {
  if (!visibleTimeWindow) return events;
  return events.filter(event => {
    const eventTime = getEventTimestamp(event);
    return eventTime >= visibleTimeWindow.visibleStartTime &&
           eventTime <= visibleTimeWindow.visibleEndTime;
  });
};

const relevantOverflowEvents = group.overflowEvents
  ? filterEventsByViewWindow(group.overflowEvents)
  : [];
```

**Result**: Only overflow events within current view window contribute to badge count

### 4.3 Overflow Badge Calculation

Badge count includes both primary and view-filtered overflow:

```typescript
const overflowCount = relevantOverflowEvents.length;

if (overflowCount > 0) {
  // Render badge with "+N" format
  return `+${overflowCount}`;
}
```

## 5. Overflow Badge Rendering

### 5.1 Badge Positioning Algorithm

Badges are positioned relative to anchor points:

```typescript
// From DeterministicLayoutComponent.tsx

const badgeX = anchor.x;  // Align with anchor X position
const badgeY = anchor.side === 'above'
  ? timelineY - 40  // Above timeline: 40px above axis
  : timelineY + 40; // Below timeline: 40px below axis
```

### 5.2 Minimum Spacing Enforcement

To prevent visual overlap, badges are checked for proximity:

```typescript
const MIN_BADGE_SPACING = 60; // Minimum pixels between badges

// Check if badges are too close
const distance = Math.abs(badge1.x - badge2.x);
if (distance < MIN_BADGE_SPACING) {
  // Trigger badge merging
}
```

### 5.3 Badge Merging Strategy

When badges are within minimum spacing, they are merged:

```typescript
// Merge nearby overflow badges to prevent overlaps
const mergedBadges = [];
const processed = new Set();

for (const anchor of anchors) {
  if (processed.has(anchor.id)) continue;

  // Find nearby anchors within merge threshold
  const nearby = anchors.filter(a =>
    !processed.has(a.id) &&
    Math.abs(a.x - anchor.x) < MIN_BADGE_SPACING
  );

  if (nearby.length > 1) {
    // Calculate centroid position
    const centroidX = nearby.reduce((sum, a) => sum + a.x, 0) / nearby.length;
    const totalOverflow = nearby.reduce((sum, a) => sum + a.overflowCount, 0);

    mergedBadges.push({
      x: centroidX,
      count: totalOverflow,
      componentIds: nearby.map(a => a.id)
    });

    nearby.forEach(a => processed.add(a.id));
  }
}
```

**Source**: `src/layout/DeterministicLayoutComponent.tsx` - Badge merging implementation

### 5.4 Centroid Calculation

Merged badge position uses weighted average:

```typescript
const centroidX = anchors.reduce((sum, anchor) => {
  return sum + (anchor.x * anchor.overflowCount);
}, 0) / totalOverflowCount;
```

This positions the merged badge at the visual "center of mass" of the component badges.

## 6. Implementation Architecture

### 6.1 Code Organization

**Card Configuration:**
- `src/layout/config.ts` - Card dimension constants and viewport-adaptive sizing

**Degradation Logic:**
- `src/layout/engine/DegradationEngine.ts` - Card type determination, degradation metrics
- Methods: `determineCardType()`, `getMaxCardsPerHalfColumn()`, `createIndividualCards()`

**Overflow Management:**
- `src/layout/engine/DispatchEngine.ts` - Overflow event assignment to groups
- `src/layout/engine/PositioningEngine.ts` - View window filtering for overflow
- `src/layout/DeterministicLayoutComponent.tsx` - Overflow badge rendering and merging

**Capacity Tracking:**
- `src/layout/CapacityModel.ts` - Slot occupancy tracking
- `src/layout/LayoutEngine.ts` - Capacity metrics aggregation

### 6.2 Data Structures

**ColumnGroup Interface:**
```typescript
interface ColumnGroup {
  id: string;
  events: Event[];              // Visible events (within slot capacity)
  overflowEvents?: Event[];     // Events exceeding capacity
  startX: number;
  endX: number;
  centerX: number;
  side: 'above' | 'below';
  anchor: Anchor;
  cards: PositionedCard[];
  capacity: {
    above: { used: number; total: number };
    below: { used: number; total: number };
  };
}
```

**Anchor Interface:**
```typescript
interface Anchor {
  id: string;
  x: number;
  date: Date;
  side: 'above' | 'below';
  overflowCount: number;        // Count of overflow events
  hasVisibleCards: boolean;     // Whether this anchor has visible cards
}
```

### 6.3 Algorithm Flow

```
Layout Engine Flow:
│
1. Dispatch Events to Half-Columns
│  └─ DispatchEngine.dispatchEvents()
│     - Sort events chronologically
│     - Assign to above/below alternating
│     - Create half-column groups
│
2. Apply Degradation Logic
│  └─ DegradationEngine.applyDegradationAndPromotion()
│     - Count events per group (primary + overflow)
│     - Determine card type based on count
│     - Create individual cards for visible events
│     - Store remainder in overflowEvents
│
3. Position Cards and Create Anchors
│  └─ PositioningEngine.positionCards() + createEventAnchors()
│     - Filter overflow by view window
│     - Calculate anchor positions
│     - Attach overflow counts to anchors
│
4. Render Cards and Badges
   └─ DeterministicLayoutComponent
      - Render positioned cards
      - Render individual overflow badges
      - Merge nearby badges
      - Render merged badges at centroids
```

### 6.4 Cluster Coordination Implementation Guidance

This section provides practical guidance for implementing spatial cluster coordination in the degradation engine.

#### Step 1: Add Spatial Cluster Interface

Add new types to `src/layout/LayoutEngine.ts`:

```typescript
/**
 * Spatial Cluster - Represents a visual grouping of events spanning above/below timeline
 */
export interface SpatialCluster {
  id: string;
  xRegion: {
    start: number;
    end: number;
    center: number;
  };
  aboveGroup: ColumnGroup | null;
  belowGroup: ColumnGroup | null;
  hasOverflow: boolean;        // True if ANY half-column has overflow
  totalEvents: number;          // Combined event count
  recommendedCardType: CardType; // Uniform card type for cluster
}
```

#### Step 2: Implement Cluster Identification

Add new method to `DegradationEngine.ts`:

```typescript
/**
 * Identify spatial clusters by matching above/below half-columns
 * Groups share the same X-region if their centerX positions are within threshold
 */
private identifySpatialClusters(groups: ColumnGroup[]): SpatialCluster[] {
  const X_THRESHOLD = 50; // pixels - groups within 50px are same cluster

  const aboveGroups = groups.filter(g => g.side === 'above');
  const belowGroups = groups.filter(g => g.side === 'below');
  const clusters: SpatialCluster[] = [];
  const processedBelow = new Set<string>();

  // Iterate through above groups and find matching below groups
  for (const above of aboveGroups) {
    // Find below group in same X-region
    const below = belowGroups.find(g =>
      !processedBelow.has(g.id) &&
      Math.abs(g.centerX - above.centerX) < X_THRESHOLD
    );

    if (below) processedBelow.add(below.id);

    // Check cluster-wide overflow
    const aboveOverflow = (above.overflowEvents?.length ?? 0) > 0;
    const belowOverflow = (below?.overflowEvents?.length ?? 0) > 0;
    const hasOverflow = aboveOverflow || belowOverflow;

    // Calculate total events
    const totalEvents = above.events.length + (below?.events.length ?? 0);

    // Determine recommended uniform card type for cluster
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
 * Determine uniform card type based on total event count
 * Same thresholds as current production algorithm
 */
private determineUniformCardType(eventCount: number): CardType {
  if (eventCount <= 2) return 'full';
  if (eventCount <= 4) return 'compact';
  return 'title-only';
}
```

#### Step 3: Update Degradation Logic to Use Clusters

Modify `applyDegradationAndPromotion()` in `DegradationEngine.ts`:

```typescript
/**
 * Apply degradation with cluster coordination
 */
applyDegradationAndPromotion(groups: ColumnGroup[]): ColumnGroup[] {
  this.resetMetrics();

  // Phase 1: Identify spatial clusters
  const clusters = this.identifySpatialClusters(groups);

  // Phase 2: Apply coordinated degradation
  for (const cluster of clusters) {
    if (cluster.hasOverflow) {
      // Phase 2a: Uniform degradation (overflow exists)
      const cardType = cluster.recommendedCardType;

      if (cluster.aboveGroup) {
        cluster.aboveGroup.cards = this.createIndividualCards(
          cluster.aboveGroup,
          [cardType] // Uniform card type
        );
      }

      if (cluster.belowGroup) {
        cluster.belowGroup.cards = this.createIndividualCards(
          cluster.belowGroup,
          [cardType] // Same uniform card type
        );
      }

      // Update metrics
      this.trackDegradation(cluster, cardType, 'uniform');

    } else {
      // Phase 2b: Mixed card types allowed (no overflow)

      if (cluster.aboveGroup) {
        const mixedTypes = this.determineMixedCardTypes(cluster.aboveGroup.events);
        cluster.aboveGroup.cards = this.createIndividualCards(
          cluster.aboveGroup,
          mixedTypes // Can use mixed card types
        );
      }

      if (cluster.belowGroup) {
        const mixedTypes = this.determineMixedCardTypes(cluster.belowGroup.events);
        cluster.belowGroup.cards = this.createIndividualCards(
          cluster.belowGroup,
          mixedTypes // Can use mixed card types
        );
      }

      // Update metrics
      this.trackDegradation(cluster, null, 'mixed');
    }
  }

  return groups;
}

/**
 * Determine mixed card types with chronological priority
 * Earlier events get full cards, later events degrade
 */
private determineMixedCardTypes(events: Event[]): CardType[] {
  const cardTypes: CardType[] = [];

  for (let i = 0; i < events.length; i++) {
    if (i === 0) {
      cardTypes.push('full');      // First event: full card
    } else if (i <= 2) {
      cardTypes.push('compact');   // Events 2-3: compact cards
    } else {
      cardTypes.push('title-only'); // Events 4+: title-only
    }
  }

  return cardTypes;
}
```

#### Step 4: Add Telemetry for Cluster Coordination

Extend `DegradationMetrics` interface:

```typescript
interface DegradationMetrics {
  // Existing metrics...
  totalGroups: number;
  fullCardGroups: number;
  compactCardGroups: number;
  titleOnlyCardGroups: number;

  // New cluster coordination metrics
  totalClusters: number;           // Total spatial clusters identified
  clustersWithOverflow: number;    // Clusters requiring uniform degradation
  clustersWithMixedTypes: number;  // Clusters using mixed card types
  clusterCoordinationEvents: Array<{
    clusterId: string;
    hasOverflow: boolean;
    aboveCardType: CardType | 'mixed';
    belowCardType: CardType | 'mixed';
    coordinationApplied: boolean;  // True if below was forced to match above
  }>;
}
```

#### Step 5: Testing Strategy

**Unit Tests** (`DegradationEngine.spec.ts`):
```typescript
describe('Cluster Coordination', () => {
  test('overflow above forces degradation below', () => {
    // Setup: above has 6 events (overflow), below has 2 events (no overflow)
    // Expected: both use title-only due to cluster coordination
  });

  test('no overflow allows mixed types', () => {
    // Setup: above has 3 events (no overflow), below has 0 events
    // Expected: above uses 1 full + 2 compact (mixed types)
  });

  test('orphan below group degrades independently', () => {
    // Setup: below group with no matching above group
    // Expected: below makes independent degradation decision
  });
});
```

**E2E Tests** (`tests/v5/67-mixed-card-types.spec.ts`):
```typescript
test('French Revolution timeline shows cluster coordination', async ({ page }) => {
  // Load dense timeline with multiple spatial clusters
  // Verify that X-regions with overflow show uniform degradation
  // Verify that X-regions without overflow can use mixed types
});
```

#### Step 6: Feature Flag Implementation

Add feature flag to `src/layout/config.ts`:

```typescript
export const FEATURE_FLAGS = {
  ENABLE_CLUSTER_COORDINATION: false, // Default: disabled
  ENABLE_MIXED_CARD_TYPES: false,     // Default: disabled
} as const;
```

Use feature flag in `DegradationEngine.ts`:

```typescript
import { FEATURE_FLAGS } from '../config';

applyDegradationAndPromotion(groups: ColumnGroup[]): ColumnGroup[] {
  if (FEATURE_FLAGS.ENABLE_CLUSTER_COORDINATION) {
    // New cluster-coordinated algorithm
    return this.applyClusterCoordinatedDegradation(groups);
  } else {
    // Original production algorithm (fallback)
    return this.applyLegacyDegradation(groups);
  }
}
```

#### Step 7: Gradual Rollout Plan

**Phase A: Implementation & Testing**
1. Implement cluster identification (Step 2)
2. Add unit tests for cluster coordination
3. Add E2E tests for visual validation
4. Ensure 100% test pass rate

**Phase B: Feature Flag Rollout**
1. Deploy with `ENABLE_CLUSTER_COORDINATION: false`
2. Enable flag in development environment
3. Run full test suite + manual QA
4. Monitor telemetry for unexpected behavior

**Phase C: Mixed Card Types**
1. Enable `ENABLE_CLUSTER_COORDINATION: true` in production
2. Monitor for 1 week, validate no regressions
3. Enable `ENABLE_MIXED_CARD_TYPES: true` in development
4. Repeat testing cycle
5. Enable in production after validation

**Phase D: Cleanup**
1. Remove feature flags after stable rollout
2. Remove legacy degradation code
3. Update documentation to reflect production algorithm

#### Common Pitfalls & Solutions

**Pitfall 1: X-Threshold Too Large**
- **Problem**: Unrelated half-columns incorrectly grouped as same cluster
- **Solution**: Tune `X_THRESHOLD` based on card width (start with 50px, adjust if needed)

**Pitfall 2: Orphan Groups Not Handled**
- **Problem**: Below groups without matching above groups cause crashes
- **Solution**: Always handle orphan groups as independent clusters (see Step 2)

**Pitfall 3: Overflow Calculation Timing**
- **Problem**: Checking overflow before `createIndividualCards()` misses promoted overflow events
- **Solution**: Run cluster identification AFTER initial overflow assignment in DispatchEngine

**Pitfall 4: Mixed Types Without Space Validation**
- **Problem**: Mixed card types overflow vertical space despite no event overflow
- **Solution**: Always validate available vertical space before allowing mixed types

**Pitfall 5: Telemetry Doesn't Track Coordination**
- **Problem**: Can't debug or monitor cluster coordination behavior
- **Solution**: Add comprehensive metrics (Step 4) and log coordination decisions

## 7. Performance Considerations

### 7.1 Degradation Metrics Tracking

**Overhead**: Minimal - metrics updated once per layout pass
**Optimization**: Metrics calculated incrementally during degradation decisions

### 7.2 View Window Filtering

**Complexity**: O(n) where n = overflow events per group
**Optimization**: Filter applied only to groups with overflow events
**Caching**: View window parameters cached to avoid repeated calculations

### 7.3 Badge Merging Algorithm

**Complexity**: O(n²) worst case for proximity checks
**Optimization**: Early exit when badge count is low (<10)
**Practical Performance**: Negligible impact - typical timelines have <20 overflow badges

### 7.4 Memory Management

**Overflow Events**: Stored as references, not copies
**Card Objects**: Created only for visible events
**Metrics Objects**: Single object per layout pass, garbage collected after render

## 8. Design Rationale

### 8.1 Why Fixed Thresholds?

**Decision**: Use fixed event count thresholds (2, 4, 9) instead of dynamic calculation

**Rationale:**
- **Predictability**: Users can learn the system behavior
- **Consistency**: Same event count always produces same card type
- **Simplicity**: No complex heuristics or edge cases
- **Testability**: Easy to validate with deterministic tests

### 8.2 Why Independent Above/Below Sections?

**Decision**: Allow different card types above vs below timeline

**Rationale:**
- **Flexibility**: Dense cluster above doesn't force degradation below
- **Space Optimization**: Each section uses space optimally
- **Visual Balance**: Prevents forced symmetry that wastes space

### 8.3 Why Badge Merging?

**Decision**: Merge nearby overflow badges into single indicator

**Rationale:**
- **Visual Clarity**: Prevents badge clutter in dense timelines
- **Readability**: Single "+15" easier to parse than three "+5" badges
- **Scalability**: System remains usable even with many overflow events

### 8.4 Why View Window Filtering?

**Decision**: Filter overflow events by visible time range

**Rationale:**
- **Correctness**: Prevents "leftover" badges when panning to empty regions
- **User Expectations**: Badge count should reflect what's hidden "here and now"
- **Performance**: Reduces unnecessary overflow calculations for off-screen events

## 9. Future Enhancements

### Potential Improvements

1. **Adaptive Thresholds**: Adjust degradation thresholds based on viewport size
2. **Progressive Degradation**: Smooth transitions between card types during zoom
3. **User Preferences**: Allow users to override default degradation behavior
4. **Smart Badge Placement**: Position badges to avoid overlapping with cards
5. **Overflow Preview**: Show overflow event titles on badge hover

### Extension Points

- `DegradationEngine.determineCardType()`: Add custom degradation strategies
- `Badge merging threshold`: Make configurable via layout config
- `Card dimensions`: Support custom card sizes per timeline

## Notes & Change History

- 2025-10-01 — Initial design specification document created
- 2025-10-01 — Extracted design details from ARCHITECTURE.md and codebase
- 2025-10-01 — Documented current implementation: Compact cards 92px (not 78px)
- 2025-10-01 — Added overflow badge merging strategy documentation
- 2025-10-01 — Added view window filtering design rationale
- 2026-07-04 — Card heights now derived from the typography contract in `src/layout/cardMetrics.ts` (full 132px, compact 90px, title-only 32px; guarded by `cardMetrics.test.ts`); date is top-aligned directly under description (bottom spacer removed); §1.1–1.3 and §2.3 updated accordingly
