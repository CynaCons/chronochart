import type { LayoutConfig, CardConfig, CardType } from './types';
import { CARD_HEIGHTS } from './cardMetrics';

// Default card configurations
// Heights come from cardMetrics.ts, the single source of truth derived from
// the typography contract in src/styles/index.css (see cardMetrics.ts for
// the full derivation). Do not hardcode height numbers here.
const DEFAULT_CARD_CONFIGS: Record<CardType, CardConfig> = {
  full: {
    type: 'full',
    width: 260, // Reduced from 280px to 260px
    height: CARD_HEIGHTS.full
  },
  compact: {
    type: 'compact',
    width: 260,
    height: CARD_HEIGHTS.compact
  },
  'title-only': {
    type: 'title-only',
    width: 260,
    height: CARD_HEIGHTS['title-only']
  },
};

// Card height in cells for capacity tracking (mixed card type support)
// Used by DegradationEngine for greedy packing algorithm
// Cell size is 44px (32px title-only card + 12px CARD_SPACING). Each type's
// cell count is ceil((height + CARD_SPACING) / 44):
//   full:       ceil((132 + 12) / 44) = 4
//   compact:    ceil((90 + 12) / 44)  = 3
//   title-only: ceil((32 + 12) / 44)  = 1
export const CARD_HEIGHT_CELLS: Record<CardType, number> = {
  'full': 4,
  'compact': 3,
  'title-only': 1
} as const;

// Safe zone at top of screen to prevent overlap with minimap and breadcrumbs
const HEADER_SAFE_ZONE = 100; // minimap (50px) + breadcrumb (40px) + padding (10px)

export function createLayoutConfig(
  viewportWidth: number,
  viewportHeight: number,
  customConfig?: Partial<LayoutConfig>
): LayoutConfig {
  // Calculate timeline Y with safe zone at top
  const availableHeight = viewportHeight - HEADER_SAFE_ZONE;
  const timelineY = HEADER_SAFE_ZONE + (availableHeight / 2);

  return {
    viewportWidth,
    viewportHeight,
    timelineY,
    clusterThreshold: 120, // Pixel distance for clustering events
    cardConfigs: DEFAULT_CARD_CONFIGS,
    columnSpacing: 20,     // Space between dual columns
    ...customConfig
  };
}

export function updateLayoutConfigForViewport(
  config: LayoutConfig,
  newWidth: number,
  newHeight: number
): LayoutConfig {
  // Recalculate timeline Y with safe zone
  const availableHeight = newHeight - HEADER_SAFE_ZONE;
  const timelineY = HEADER_SAFE_ZONE + (availableHeight / 2);

  return {
    ...config,
    viewportWidth: newWidth,
    viewportHeight: newHeight,
    timelineY
  };
}

// Viewport breakpoints for different behaviors
export const VIEWPORT_BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1440,
  ultrawide: 2560
} as const;

export function getViewportCategory(width: number): keyof typeof VIEWPORT_BREAKPOINTS {
  if (width >= VIEWPORT_BREAKPOINTS.ultrawide) return 'ultrawide';
  if (width >= VIEWPORT_BREAKPOINTS.desktop) return 'desktop';
  if (width >= VIEWPORT_BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

/**
 * Feature Flags for gradual rollout of new features
 *
 * ENABLE_CLUSTER_COORDINATION: Enables spatial cluster coordination for degradation
 * ENABLE_MIXED_CARD_TYPES: Enables mixed card types within clusters
 *   - Compact card height is 90px (see cardMetrics.ts for the typography-derived math)
 *   - Compact cards use 3 cell footprint: 90px + 12px spacing = 102px, rounded up to 3×44px cells
 *   - Allows mixing full + compact + title-only with chronological priority
 *   - Only enabled when spatial cluster has NO overflow
 *
 * Can be disabled via environment variables:
 *   - VITE_ENABLE_CLUSTER_COORDINATION=false
 *   - VITE_ENABLE_MIXED_CARD_TYPES=false
 */
export const FEATURE_FLAGS = {
  ENABLE_CLUSTER_COORDINATION:
    import.meta.env.VITE_ENABLE_CLUSTER_COORDINATION !== 'false',
  ENABLE_MIXED_CARD_TYPES:
    import.meta.env.VITE_ENABLE_MIXED_CARD_TYPES !== 'false',
} as const;
