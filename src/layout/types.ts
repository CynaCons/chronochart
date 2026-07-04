import type { Event } from '../types';
import type {
  DispatchMetrics,
  DegradationMetrics,
  AdaptiveMetrics
} from './LayoutEngine';

// Core slot-based positioning types
export interface Slot {
  x: number;        // Horizontal position (absolute pixels)
  y: number;        // Vertical position (absolute pixels)
  column: number;   // Column index (0=center, -1=left, +1=right, etc.)
  side: 'above' | 'below';  // Above or below timeline
  occupied: boolean;
  clusterId?: string;
}

export interface Anchor {
  id: string;
  x: number;        // Horizontal position on timeline (now at precise event date)
  y: number;        // Timeline y position
  eventIds: string[];
  eventCount: number;
  visibleCount: number;  // Number of visible cards
  overflowCount: number; // Number of hidden events (eventCount - visibleCount)
  // New fields for event-specific positioning
  eventId?: string;     // Single event this anchor represents (for event-specific anchors)
  clusterId?: string;   // ID of the cluster this anchor belongs to
  clusterPosition?: 'above' | 'below'; // Whether this anchor's events are above or below timeline
  isClusterGroup?: boolean; // Whether this is a cluster group anchor vs individual event anchor
}

export interface EventCluster {
  id: string;
  anchor: Anchor;
  events: Event[];
  slots?: Slot[];
}

export type CardType = 'full' | 'compact' | 'title-only';

export interface CardConfig {
  type: CardType;
  width: number;
  height: number;
}

export interface PositionedCard {
  id: string;
  event: Event;
  x: number;           // Card center x (horizontal coordinate)
  y: number;           // Card top y (vertical coordinate - TOP edge, not center)
  width: number;       // Card width (updated from cardWidth)
  height: number;      // Card height (updated from cardHeight)
  cardType: CardType;
  clusterId: string;
  overflowCount?: number; // Number of overflow events (for "+N more" display)
}

export interface LayoutConfig {
  viewportWidth: number;
  viewportHeight: number;
  timelineY: number;    // Timeline vertical position
  clusterThreshold: number; // Pixel distance for clustering
  cardConfigs: Record<CardType, CardConfig>;
  columnSpacing: number;    // Horizontal spacing between columns
  debugLayout?: boolean;    // Enable debug logging
}

export interface ColumnBounds {
  x: number;
  width: number;
  minY: number;
  maxY: number;
}

export interface LayoutResult {
  positionedCards: PositionedCard[];
  clusters: EventCluster[];
  anchors: Anchor[];
  columnBounds?: ColumnBounds[];
  utilization: {
    totalSlots: number;
    usedSlots: number;
    percentage: number;
    cellsPerSide?: number;
  };
  telemetryMetrics?: {
    dispatch?: DispatchMetrics;
    adaptive?: AdaptiveMetrics;
    degradation?: DegradationMetrics;
  };
}
