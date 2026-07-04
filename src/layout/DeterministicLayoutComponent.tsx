import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import type { CSSProperties } from 'react';
import type { Event } from '../types';
import type { EventDecision } from '../types/importSession';
import type { LayoutConfig, PositionedCard, Anchor, EventCluster } from './types';

// Telemetry types now defined in vite-env.d.ts Window interface
import { CARD_FOOTPRINTS, LAYOUT_CONSTANTS } from './CapacityModel';
import { createLayoutConfig } from './config';
import { DeterministicLayoutV5, type DispatchMetrics } from './LayoutEngine';
import { useAxisTicks, type Tick } from '../timeline/hooks/useAxisTicks';
import { EnhancedTimelineAxis } from '../components/EnhancedTimelineAxis';
import { getEventTimestamp, formatEventDateTime } from '../lib/time';
import { environment } from '../config/environment';
import { performanceMonitor } from '../utils/performanceMonitor';
import CardHoverPreview from '../components/CardHoverPreview';

const monitoringEnabled = environment.flags.enableTelemetry || environment.isDevelopment;

interface DeterministicLayoutProps {
  events: Event[];
  showInfoPanels?: boolean;
  viewStart?: number;
  viewEnd?: number;
  hoveredEventId?: string;
  isPanning?: boolean;
  onCardDoubleClick?: (id: string) => void;
  onCardMouseEnter?: (id: string) => void;
  onCardMouseLeave?: () => void;
  selectedEventId?: string;
  onEventSelect?: (eventId: string) => void;
}

// Custom comparison function for React.memo - ignore hoveredEventId since we handle it via DOM
function arePropsEqual(
  prevProps: DeterministicLayoutProps,
  nextProps: DeterministicLayoutProps
): boolean {
  // If hoveredEventId changed, we DON'T want to re-render (handled via DOM)
  // Compare all other props
  return (
    prevProps.events === nextProps.events &&
    prevProps.showInfoPanels === nextProps.showInfoPanels &&
    prevProps.viewStart === nextProps.viewStart &&
    prevProps.viewEnd === nextProps.viewEnd &&
    prevProps.isPanning === nextProps.isPanning &&
    prevProps.onCardDoubleClick === nextProps.onCardDoubleClick &&
    prevProps.onCardMouseEnter === nextProps.onCardMouseEnter &&
    prevProps.onCardMouseLeave === nextProps.onCardMouseLeave &&
    prevProps.selectedEventId === nextProps.selectedEventId &&
    prevProps.onEventSelect === nextProps.onEventSelect
    // Explicitly NOT comparing hoveredEventId - handled via useEffect + DOM
  );
}

export const DeterministicLayoutComponent = memo(function DeterministicLayoutComponent({
  events,
  showInfoPanels = false,
  viewStart = 0,
  viewEnd = 1,
  hoveredEventId,
  isPanning = false,
  onCardDoubleClick,
  onCardMouseEnter,
  onCardMouseLeave,
  selectedEventId,
  onEventSelect
}: DeterministicLayoutProps) {
  // Container ref for proper sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 600 });

  // Refs for direct DOM updates to avoid React re-renders on hover
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const anchorsContainerRef = useRef<HTMLDivElement>(null);

  // Layout cache to avoid recalculating when only view window changes
  const layoutCacheRef = useRef<{
    events: Event[];
    eventCount: number;
    config: LayoutConfig;
    result: {
      positionedCards: PositionedCard[];
      anchors: Anchor[];
      clusters: EventCluster[];
      utilization: { totalSlots: number; usedSlots: number; percentage: number; cellsPerSide?: number };
      telemetryMetrics?: any;
    };
    viewWindow: { viewStart: number; viewEnd: number };
  } | null>(null);

  // State for anchor-card pair highlighting
  const [hoveredPairEventId, setHoveredPairEventId] = useState<string | null>(null);

  // State for card hover preview
  const [previewCard, setPreviewCard] = useState<{
    event: Event;
    x: number;
    y: number;
  } | null>(null);

  // Timer for preview delay
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // P2-3: Timer for throttled telemetry updates
  const telemetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setViewportSize({
        width: rect.width,
        height: rect.height
      });
    }
  }, []);

  // Card hover handlers for preview
  const handleCardMouseEnter = useCallback((card: PositionedCard, e: React.MouseEvent) => {
    // Only show for degraded cards (compact or title-only)
    if (card.cardType === 'full') return;

    const rect = e.currentTarget.getBoundingClientRect();
    previewTimerRef.current = setTimeout(() => {
      setPreviewCard({
        event: card.event,
        x: rect.right,
        y: rect.top
      });
    }, 300); // 300ms delay to avoid flashing on quick hovers
  }, []);

  const handleCardMouseLeave = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewCard(null);
  }, []);
  
  useEffect(() => {
    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateSize]);

  // Cleanup preview timer on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  // Helper function for direct DOM hover updates - shared between event listener and React effect
  const updateHoverDOM = useCallback((eventId: string | null) => {
    // Update cards
    const cardsContainer = cardsContainerRef.current;
    if (cardsContainer) {
      const prevHovered = cardsContainer.querySelector('[data-event-id].card-hovered');
      if (prevHovered) {
        prevHovered.classList.remove('card-hovered');
      }
      if (eventId) {
        const newHovered = cardsContainer.querySelector(`[data-event-id="${eventId}"]`);
        if (newHovered) {
          newHovered.classList.add('card-hovered');
        }
      }
    }

    // Update anchors
    const anchorsContainer = anchorsContainerRef.current;
    if (anchorsContainer) {
      const prevHovered = anchorsContainer.querySelectorAll('.anchor-hovered');
      prevHovered.forEach(el => el.classList.remove('anchor-hovered'));
      if (eventId) {
        const anchors = anchorsContainer.querySelectorAll(`[data-anchor-event-ids]`);
        anchors.forEach(anchor => {
          const eventIds = anchor.getAttribute('data-anchor-event-ids')?.split(',') || [];
          if (eventIds.includes(eventId)) {
            anchor.classList.add('anchor-hovered');
          }
        });
      }
    }
  }, []);

  // Listen for custom timeline:hover events for instant DOM updates (bypasses React)
  useEffect(() => {
    const handleHoverEvent = (evt: globalThis.Event) => {
      const customEvent = evt as CustomEvent<{ eventId: string | null }>;
      const eventId = customEvent.detail?.eventId;
      updateHoverDOM(eventId);
    };

    document.addEventListener('timeline:hover', handleHoverEvent);
    return () => document.removeEventListener('timeline:hover', handleHoverEvent);
  }, [updateHoverDOM]);

  // Direct DOM manipulation for card/anchor hover via React props (fallback)
  // This handles hoveredEventId prop changes from canvas card hovers
  useEffect(() => {
    updateHoverDOM(hoveredEventId || null);
  }, [hoveredEventId, updateHoverDOM]);

  // Calculate timeline date range for axis ticks
  const timelineRange = useMemo(() => {
    if (events.length === 0) return null;

    const dates = events.map(event => getEventTimestamp(event));
    const rawMinDate = Math.min(...dates);
    const rawMaxDate = Math.max(...dates);
    let rawDateRange = rawMaxDate - rawMinDate;

    // For single-event timelines, apply a minimum duration to ensure
    // proper scale generation and event positioning
    const MIN_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
    if (rawDateRange < MIN_DURATION_MS) {
      rawDateRange = MIN_DURATION_MS;
    }

    // Add 2% padding to match LayoutEngine's time range calculation
    // This ensures hover dates align with anchor positions
    const padding = rawDateRange * 0.02;

    // Only center for single-event timelines; multi-event timelines use natural range
    // This matches LayoutEngine.ts:303-308 logic
    const isSingleEvent = events.length === 1;
    const fullMinDate = isSingleEvent
      ? rawMinDate - (rawDateRange / 2) - padding  // Center single event
      : rawMinDate - padding;                      // Natural range for multi-event
    const fullMaxDate = isSingleEvent
      ? rawMaxDate + (rawDateRange / 2) + padding  // Center single event
      : rawMaxDate + padding;                      // Natural range for multi-event
    const fullDateRange = rawDateRange + (padding * 2);

    // If zoomed (viewStart and viewEnd are not 0,1), calculate the visible time window
    if (viewStart !== 0 || viewEnd !== 1) {
      const visibleMinDate = fullMinDate + (viewStart * fullDateRange);
      const visibleMaxDate = fullMinDate + (viewEnd * fullDateRange);
      const visibleDateRange = visibleMaxDate - visibleMinDate;

      return {
        minDate: visibleMinDate,
        maxDate: visibleMaxDate,
        dateRange: visibleDateRange,
        fullMinDate,
        fullMaxDate,
        fullDateRange,
        isZoomed: true
      };
    }

    return {
      minDate: fullMinDate,
      maxDate: fullMaxDate,
      dateRange: fullDateRange,
      fullMinDate,
      fullMaxDate,
      fullDateRange,
      isZoomed: false
    };
  }, [events, viewStart, viewEnd]);

  // Create function for useAxisTicks
  const timestampToPixel = useMemo(() => {
    if (!timelineRange) return () => 0;

    const navRailWidth = 56;
    const additionalMargin = 80;
    const leftMargin = navRailWidth + additionalMargin; // 136px total
    const rightMargin = 40;
    const usableWidth = Math.max(1, viewportSize.width - leftMargin - rightMargin);
    const effectiveRange = timelineRange.dateRange > 0 ? timelineRange.dateRange : 1;

    return (timestamp: number): number => {
      if (!Number.isFinite(timestamp)) return leftMargin;
      const ratio = (timestamp - timelineRange.minDate) / effectiveRange;
      return leftMargin + ratio * usableWidth;
    };
  }, [timelineRange, viewportSize.width]);

  // Use the enhanced useAxisTicks hook - this must be at component level
  const timelineTicks = useAxisTicks(
    timelineRange?.minDate || 0,
    timelineRange?.maxDate || 1,
    timelineRange?.dateRange || 1,
    timestampToPixel
  );

  // Responsive timeline ticks based on actual viewport width - using margined coordinate system
  const fallbackTicks: Tick[] = timelineRange && viewportSize.width > 200 ? (() => {
    const navRailWidth = 56;
    const additionalMargin = 80;
    const leftMargin = navRailWidth + additionalMargin; // 136px total
    const rightMargin = 40;
    const usableWidth = viewportSize.width - leftMargin - rightMargin;

    const makeYearTick = (time: number, x: number): Tick => ({
      t: time,
      label: new Date(time).getFullYear().toString(),
      x,
      scale: 'year'
    });

    return [
      makeYearTick(timelineRange.minDate, leftMargin + usableWidth * 0.05),
      makeYearTick(timelineRange.minDate + timelineRange.dateRange * 0.25, leftMargin + usableWidth * 0.25),
      makeYearTick(timelineRange.minDate + timelineRange.dateRange * 0.5, leftMargin + usableWidth * 0.5),
      makeYearTick(timelineRange.minDate + timelineRange.dateRange * 0.75, leftMargin + usableWidth * 0.75),
      makeYearTick(timelineRange.maxDate, leftMargin + usableWidth * 0.95)
    ];
  })() : [];

  // Timeline scales use responsive positioning based on viewport width
  
  // Timeline scales now working with proper pixel-based coordinates
  // Convert percentage-based ticks to pixel coordinates using the SAME coordinate system as cards/anchors
  const finalTicks = timelineTicks.length > 0 ? timelineTicks : fallbackTicks;


  // Debug function for browser console
  const DEBUG_LAYOUT = typeof window !== 'undefined' && (window.__CC_DEBUG_LAYOUT || import.meta.env?.DEV);

  useEffect(() => {
    window.debugTimelineScales = () => {
      const container = document.querySelector('[data-testid="timeline-scales-container"]') as HTMLElement;
      const svg = document.querySelector('[data-testid="timeline-scales-svg"]') as SVGElement;
      const texts = document.querySelectorAll('[data-testid="timeline-scales-svg"] text');
      
      if (DEBUG_LAYOUT) {
        console.log('Timeline Scales Debug Results:');
        console.log('1. Container exists:', !!container);
        console.log('2. Container position:', container?.getBoundingClientRect());
        console.log('3. Container styles:', container ? getComputedStyle(container) : 'N/A');
        console.log('4. SVG exists:', !!svg);
        console.log('5. SVG position:', svg?.getBoundingClientRect());
        console.log('6. Text elements found:', texts.length);
      }
      texts.forEach((text, i) => {
        const rect = text.getBoundingClientRect();
        if (DEBUG_LAYOUT) console.log(`   Text ${i}:`, text.textContent, 'Position:', rect, 'Visible:', rect.width > 0 && rect.height > 0);
      });
      if (DEBUG_LAYOUT) {
        console.log('7. Current viewport size:', viewportSize);
        console.log('8. Timeline ticks data:', finalTicks);
      }
      
      return {
        containerExists: !!container,
        svgExists: !!svg,
        textCount: texts.length,
        viewport: viewportSize,
        ticks: finalTicks
      };
    };
  }, [viewportSize, finalTicks, DEBUG_LAYOUT]);

  // TODO: Fix useAxisTicks hook - currently using fallback system



  // Create layout configuration for deterministic layout
  const config: LayoutConfig = useMemo(() => {
    // Pass full viewport width to LayoutEngine - it will handle sidebar margins internally
    const baseConfig = createLayoutConfig(viewportSize.width, viewportSize.height);
    
    // Add time range calculation for proper X positioning
    if (events.length > 0) {
      const dates = events.map(e => getEventTimestamp(e));
      const minTime = Math.min(...dates);
      const maxTime = Math.max(...dates);
      const padding = (maxTime - minTime) * 0.1; // 10% padding
      
      return {
        ...baseConfig,
        startTime: minTime - padding,
        endTime: maxTime + padding
      };
    }
    
    return baseConfig;
  }, [viewportSize.width, viewportSize.height, events]);

  // P0-4: Apply deterministic layout algorithm - DECOUPLED from view window
  // NOTE: Removed viewTimeWindow useMemo - layout now calculates all cards once,
  // and viewport filtering is done separately in the render phase
  // Layout is calculated once for all events, then filtered by viewport separately
  // This prevents expensive O(n) recalculation on every pan/zoom
  const layoutResult = useMemo(() => {
    if (events.length === 0) {
      return {
        positionedCards: [],
        anchors: [],
        clusters: [],
        utilization: { totalSlots: 0, usedSlots: 0, percentage: 0 }
      };
    }

    // Check cache: reuse layout if events, viewport, AND view window are unchanged
    // viewStart/viewEnd must be checked - cards need recalculation when zooming
    // Reference equality plus cheap structural check to catch cases where
    // the same array reference is reused but contents changed
    const eventsUnchanged = layoutCacheRef.current?.events === events
      && layoutCacheRef.current?.eventCount === events.length;
    const configUnchanged = layoutCacheRef.current?.config.viewportWidth === config.viewportWidth
      && layoutCacheRef.current?.config.viewportHeight === config.viewportHeight;
    const viewWindowUnchanged = layoutCacheRef.current?.viewWindow?.viewStart === viewStart
      && layoutCacheRef.current?.viewWindow?.viewEnd === viewEnd;

    if (eventsUnchanged && configUnchanged && viewWindowUnchanged && layoutCacheRef.current) {
      return layoutCacheRef.current.result;
    }

    // Cache miss - recalculate layout for ALL events (not filtered by view window)
    const deterministicLayout = new DeterministicLayoutV5(config);

    const shouldMeasureLayout = monitoringEnabled && typeof performance !== 'undefined';

    if (shouldMeasureLayout) {
      performanceMonitor.startLayoutMeasurement();
    }

    let layoutResult;
    try {
      // Pass viewWindow for zoom-aware card positioning
      // Cards need viewStart/viewEnd to calculate correct X positions when zoomed
      layoutResult = deterministicLayout.layout(events, { viewStart, viewEnd });
    } finally {
      if (shouldMeasureLayout) {
        performanceMonitor.endLayoutMeasurement();
      }
    }

    // Update cache with current view window
    layoutCacheRef.current = {
      events,
      eventCount: events.length,
      config,
      result: layoutResult,
      viewWindow: { viewStart, viewEnd }
    };

    return layoutResult;
  }, [events, config, viewStart, viewEnd]); // Restored viewStart/viewEnd for zoom-aware positioning

  const cardsByEventId = useMemo(() => {
    const map = new Map<string, PositionedCard[]>();
    layoutResult.positionedCards.forEach(card => {
      const existing = map.get(card.event.id) || [];
      map.set(card.event.id, [...existing, card]);
    });
    return map;
  }, [layoutResult.positionedCards]);

  // CC-REQ-ANCHOR-004: Create anchors for events within the visible time window
  // Anchors persist regardless of card degradation (overflow), providing timeline reference
  const anchors = useMemo(() => {
    if (!timelineRange || events.length === 0) return [];

    // Calculate pixel positions using VIEW WINDOW coordinates (same as axis)
    // This ensures anchors align with axis labels when zoomed
    const navRailWidth = 56;
    const additionalMargin = 80;
    const leftMargin = navRailWidth + additionalMargin; // 136px total
    const rightMargin = 40;
    const usableWidth = Math.max(1, viewportSize.width - leftMargin - rightMargin);
    const viewRange = timelineRange.dateRange;
    const viewMin = timelineRange.minDate;
    const viewMax = timelineRange.maxDate;

    // Filter events to visible time window to prevent ghost overflow badges.
    // Events outside the view window have no positioned cards, so they would
    // all be counted as "overflow" and their clamped X positions would create
    // phantom badges at the viewport edges.
    const viewWindowEvents = events.filter(event => {
      const timestamp = getEventTimestamp(event);
      return timestamp >= viewMin && timestamp <= viewMax;
    });

    // Create a set of event IDs that have visible cards
    const visibleEventIds = new Set(layoutResult.positionedCards.map(c => c.event.id));

    // Group events by similar X positions (within 10px = same anchor position)
    const CLUSTER_THRESHOLD = 10;
    const anchorGroups: Map<number, { events: Event[], x: number }> = new Map();

    viewWindowEvents.forEach(event => {
      const timestamp = getEventTimestamp(event);
      const ratio = (timestamp - viewMin) / viewRange;
      const rawX = leftMargin + ratio * usableWidth;
      // Clamp to viewport bounds to prevent off-screen anchors at extreme zoom levels
      const x = Math.max(leftMargin, Math.min(viewportSize.width - rightMargin, rawX));

      // Find existing group within threshold
      let foundGroup = false;
      for (const [groupX, group] of anchorGroups) {
        if (Math.abs(x - groupX) < CLUSTER_THRESHOLD) {
          group.events.push(event);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        anchorGroups.set(x, { events: [event], x });
      }
    });

    // Convert groups to anchors
    const anchorsList: Anchor[] = [];
    anchorGroups.forEach((group) => {
      const visibleCount = group.events.filter(e => visibleEventIds.has(e.id)).length;
      const overflowCount = group.events.length - visibleCount;
      const primaryEvent = group.events[0];

      anchorsList.push({
        id: `anchor-${primaryEvent.id}`,
        x: group.x,
        y: config?.timelineY ?? viewportSize.height / 2,
        eventIds: group.events.map(e => e.id),
        eventCount: group.events.length,
        visibleCount,
        overflowCount,
        eventId: primaryEvent.id,
        clusterPosition: 'above' // Default, actual position determined during render
      });
    });

    return anchorsList.sort((a, b) => a.x - b.x);
  }, [events, timelineRange, viewportSize.width, viewportSize.height, layoutResult.positionedCards, config?.timelineY]);

  // Merge nearby overflow badges to prevent overlaps (Badge Merging Strategy)
  const mergedOverflowBadges = useMemo(() => {
    // anchors are already filtered to view window, no need for additional filtering
    if (!anchors || anchors.length === 0) return [];

    const MERGE_THRESHOLD = 200; // Merge anchors within 200px for aggressive spacing
    const navRailWidth = 56;
    const additionalMargin = 80;
    const leftMargin = navRailWidth + additionalMargin; // 136px total
    const rightMargin = 40;

    const overflowAnchors = anchors.filter((anchor: Anchor) => anchor.overflowCount > 0);
    const mergedBadges: Array<{
      x: number;
      y: number;
      totalOverflow: number;
      anchorIds: string[];
    }> = [];
    const processedAnchors = new Set<string>();

    // Sort anchors by X position for left-to-right processing
    const sortedAnchors = [...overflowAnchors].sort((a: Anchor, b: Anchor) => a.x - b.x);

    for (const anchor of sortedAnchors) {
      if (processedAnchors.has(anchor.id)) continue;

      // Find all nearby anchors within merge threshold (including current anchor)
      const nearbyAnchors = sortedAnchors.filter((other: Anchor) =>
        !processedAnchors.has(other.id) &&
        Math.abs(other.x - anchor.x) <= MERGE_THRESHOLD
      );

      if (nearbyAnchors.length > 1) {
        // Merge overflow counts from multiple anchors
        const totalOverflow = nearbyAnchors.reduce((sum: number, a: Anchor) => sum + a.overflowCount, 0);
        // Clamp centroid to viewport bounds to prevent badges from going off-screen
        const centroidX = Math.max(leftMargin, Math.min(viewportSize.width - rightMargin,
          nearbyAnchors.reduce((sum: number, a: Anchor) => sum + a.x, 0) / nearbyAnchors.length
        ));
        
        mergedBadges.push({
          x: centroidX,
          y: config.timelineY,
          totalOverflow,
          anchorIds: nearbyAnchors.map((a: Anchor) => a.id)
        });
        
        // Mark all anchors in group as processed
        nearbyAnchors.forEach((a: Anchor) => processedAnchors.add(a.id));
      } else if (nearbyAnchors.length === 1) {
        // Single anchor - keep individual badge but mark as processed
        processedAnchors.add(anchor.id);
      }
    }
    
    return mergedBadges;
  }, [anchors, config?.timelineY, viewportSize.width]);

  // Telemetry: expose dispatch/capacity/placements for tests and overlays
  // P2-3: Throttled to max once per 500ms to avoid wasted CPU during pan/zoom
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Only set telemetry when there are actual events to avoid setting empty/zero telemetry
    if (events.length === 0) return;

    // Clear previous timeout to debounce rapid updates
    if (telemetryTimeoutRef.current) {
      clearTimeout(telemetryTimeoutRef.current);
    }

    // Throttle telemetry calculation with 500ms delay
    telemetryTimeoutRef.current = setTimeout(() => {
    const { positionedCards, anchors, clusters, utilization } = layoutResult;

    const calculateDispatchFallback = (): DispatchMetrics => {
      const groupsCount = clusters.length;
      const clusterSizes = clusters.map((c: EventCluster) => c.events.length || 0);
      const avgEventsPerCluster = groupsCount > 0 ? (clusterSizes.reduce((a: number, b: number) => a + b, 0) / groupsCount) : 0;
      const largestCluster = Math.max(0, ...clusterSizes);
      const xs = anchors.map((a: Anchor) => a.x).sort((a: number, b: number) => a - b);
      const pitches = xs.length > 1 ? xs.slice(1).map((x: number, i: number) => Math.abs(x - xs[i])) : [];

      return {
        groupCount: groupsCount,
        avgEventsPerCluster,
        largestCluster,
        groupPitchPx: {
          min: pitches.length ? Math.min(...pitches) : 0,
          max: pitches.length ? Math.max(...pitches) : 0,
          avg: pitches.length ? pitches.reduce((a: number, b: number) => a + b, 0) / pitches.length : 0
        },
        horizontalSpaceUsage: 0 // Placeholder
      };
    };

    // Use telemetry from layout engine if available, fallback to manual calculation
    const engineMetrics = layoutResult.telemetryMetrics;
    const dispatchMetrics: DispatchMetrics = engineMetrics?.dispatch
      ? engineMetrics.dispatch
      : calculateDispatchFallback();

    // Use CapacityModel's calculated cells per side (single source of truth)
    const cellsPerSide = layoutResult.utilization?.cellsPerSide ??
      Math.max(LAYOUT_CONSTANTS.MIN_CELLS_PER_SIDE,
        Math.floor(((viewportSize.height / 2) - LAYOUT_CONSTANTS.TIMELINE_MARGIN) / 44));

    const derivedTotalCells = clusters.length > 0 ? clusters.length * cellsPerSide * 2 : 0;
    const derivedUsedCells = positionedCards.reduce((sum: number, card: PositionedCard) => {
      const footprint = CARD_FOOTPRINTS[card.cardType] ?? 0;
      return sum + footprint;
    }, 0);

    const totalCells = Math.max(0, utilization.totalSlots || 0, derivedTotalCells, derivedUsedCells);
    const usedCells = Math.min(totalCells || derivedTotalCells, Math.max(0, utilization.usedSlots || derivedUsedCells));
    const utilPct = totalCells > 0 ? Math.max(0, Math.min(100, (usedCells / totalCells) * 100)) : 0;

    // Placements for stability
    const placements = positionedCards.map((p: PositionedCard) => ({
      id: String(p.event?.id ?? p.id),
      x: Math.round(p.x),
      y: Math.round(p.y),
      clusterId: String(p.clusterId ?? ''),
      isAbove: Boolean(p.y < (config?.timelineY ?? viewportSize.height / 2))
    }));

    // Compare with previous snapshot to compute migrations
    const prev = window.__ccTelemetry;
    let migrations = 0;
    if (prev && Array.isArray(prev.placements?.items)) {
      const prevMap = new Map(prev.placements!.items!.map(it => [String(it.id), it]));
      for (const cur of placements) {
        const old = prevMap.get(String(cur.id));
        if (!old) continue;
        const movedFar = Math.abs((old.x ?? 0) - cur.x) > 40 || Math.abs((old.y ?? 0) - cur.y) > 32;
        const clusterChanged = String(old.clusterId) !== String(cur.clusterId);
        if (movedFar || clusterChanged) migrations++;
      }
    }

    // Card type counts and degradation metrics
    const byTypeCounts: Record<string, number> = positionedCards.reduce((acc: Record<string, number>, c: PositionedCard) => {
      const t = String(c.cardType);
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    const totalAggregations = 0;
    const eventsAggregated = 0;
    const singleEventsShown = positionedCards.length;
    const summaryContained = 0;
    const degradationsCount = (byTypeCounts['compact'] || 0) + (byTypeCounts['title-only'] || 0);
    const promotionsCount = 0; // Placeholder: promotion logic not implemented yet

    // Half-column analysis for Stage 3 telemetry
    const timelineY = config?.timelineY ?? viewportSize.height / 2;
    const aboveCards = positionedCards.filter((c: PositionedCard) => c.y < timelineY);
    const belowCards = positionedCards.filter((c: PositionedCard) => c.y >= timelineY);
    
    // Group cards by cluster/column for half-column analysis
    const clusterMap = new Map<string, { above: PositionedCard[], below: PositionedCard[] }>();
    positionedCards.forEach((card: PositionedCard) => {
      const clusterId = String(card.clusterId ?? 'default');
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, { above: [], below: [] });
      }
      const cluster = clusterMap.get(clusterId)!;
      if (card.y < timelineY) {
        cluster.above.push(card);
      } else {
        cluster.below.push(card);
      }
    });

    // Calculate half-column metrics
    const aboveHalfColumns = Array.from(clusterMap.values()).filter(c => c.above.length > 0);
    const belowHalfColumns = Array.from(clusterMap.values()).filter(c => c.below.length > 0);
    
    const aboveEventsPerHalfColumn = aboveHalfColumns.map(c => c.above.length);
    const belowEventsPerHalfColumn = belowHalfColumns.map(c => c.below.length);
    
    // Calculate temporal distribution (percentage of timeline width used)
    const viewportWidth = viewportSize.width;
    const temporalDistribution = anchors.length > 1 ? (() => {
      const positions = anchors.map((a: Anchor) => a.x).sort((a: number, b: number) => a - b);
      const minX = Math.min(...positions);
      const maxX = Math.max(...positions);
      return ((maxX - minX) / viewportWidth) * 100;
    })() : 0;

    // Placement pattern validation
    const sortedEvents = events.slice().sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));
    const sortedPlacements = sortedEvents.map(event => 
      positionedCards.find(card => 
        card.event?.id === event.id
      )
    ).filter(Boolean);
    
    // Check alternating pattern: Event 1→above, Event 2→below, etc.
    let alternatingPattern = true;
    for (let i = 0; i < sortedPlacements.length && alternatingPattern; i++) {
      const card = sortedPlacements[i];
      if (!card) continue;
      const shouldBeAbove = (i % 2) === 0; // Even index (0,2,4...) should be above
      const isAbove = card.y < timelineY;
      if (shouldBeAbove !== isAbove) {
        alternatingPattern = false;
      }
    }

    // Check spatial clustering (events are clustered based on horizontal overlap, not artificial limits)
    const spatialClustering = clusterMap.size > 1 || (clusterMap.size === 1 && positionedCards.length <= 4);

    const telemetry = {
      version: 'v5',
      events: { total: events.length },
      groups: { count: dispatchMetrics?.groupCount || clusters.length },
      dispatch: {
        ...(dispatchMetrics || {}),
        targetAvgEventsPerClusterBand: [4, 6] as [number, number]
      },
      clusters: {
        count: clusters.length
      },
      capacity: {
        totalCells,
        usedCells,
        utilization: utilPct,
        cellsPerSide
      },
      promotions: {
        count: promotionsCount
      },
      degradations: {
        count: degradationsCount,
        byType: {
          compact: byTypeCounts['compact'] || 0,
          'title-only': byTypeCounts['title-only'] || 0
        }
      },
      aggregation: {
        totalAggregations: totalAggregations,
        eventsAggregated: eventsAggregated,
        clustersAffected: 0
      },
      cards: {
        single: singleEventsShown,
        multiContained: eventsAggregated,
        summaryContained
      },
      placements: {
        items: placements,
        migrations
      },
      halfColumns: {
        above: {
          count: aboveHalfColumns.length,
          totalSlots: aboveHalfColumns.length * 2, // 2 slots per half-column
          usedSlots: aboveCards.length,
          utilization: aboveHalfColumns.length > 0 ? (aboveCards.length / (aboveHalfColumns.length * 2)) * 100 : 0,
          events: aboveCards.length,
          eventsPerHalfColumn: aboveEventsPerHalfColumn
        },
        below: {
          count: belowHalfColumns.length,
          totalSlots: belowHalfColumns.length * 2, // 2 slots per half-column
          usedSlots: belowCards.length,
          utilization: belowHalfColumns.length > 0 ? (belowCards.length / (belowHalfColumns.length * 2)) * 100 : 0,
          events: belowCards.length,
          eventsPerHalfColumn: belowEventsPerHalfColumn
        }
      },
      placement: {
        alternatingPattern,
        spatialClustering,
        temporalDistribution
      },
      viewport: {
        width: viewportSize.width,
        height: viewportSize.height,
        timelineY: config?.timelineY ?? viewportSize.height / 2
      },
      adaptive: layoutResult.telemetryMetrics?.adaptive,
      degradation: layoutResult.telemetryMetrics?.degradation,
      // Event dates for temporal density analysis (T97)
      eventDates: events.map(event => ({
        id: event.id,
        date: event.date,  // ISO date string YYYY-MM-DD
      })),
      // Timeline date range for temporal analysis
      timelineRange: events.length > 0 ? (() => {
        const dates = events.map(e => e.date).filter(Boolean).sort();
        return {
          minDate: dates[0] || '',
          maxDate: dates[dates.length - 1] || '',
        };
      })() : { minDate: '', maxDate: '' },
      // View window for interaction testing (pan/zoom verification)
      viewWindow: { start: viewStart, end: viewEnd }
    };

    window.__ccTelemetry = telemetry as unknown as typeof window.__ccTelemetry;
    }, 500); // 500ms throttle delay

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (telemetryTimeoutRef.current) {
        clearTimeout(telemetryTimeoutRef.current);
      }
    };
  }, [layoutResult, events, viewportSize.width, viewportSize.height, config, viewStart, viewEnd]);


  return (
    <div
      key={`vw-${Number.isFinite(viewStart) ? viewStart.toFixed(3) : '0.000'}-${Number.isFinite(viewEnd) ? viewEnd.toFixed(3) : '1.000'}`}
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      {/* Enhanced Timeline Axis with multi-level labels and visual improvements */}
      {events.length > 0 && timelineRange && finalTicks && finalTicks.length > 0 && (
        <EnhancedTimelineAxis
          timelineRange={timelineRange}
          viewportSize={viewportSize}
          timelineY={config?.timelineY ?? viewportSize.height / 2}
          baseTicks={finalTicks}
          onDateHover={() => {
            // Optional: Add date hover functionality
          }}
          onTimelineClick={() => {
            // Optional: Add timeline click functionality
          }}
        />
      )}

      {/* Fallback timeline axis when EnhancedTimelineAxis conditions aren't met but events exist */}
      {events.length > 0 && (!timelineRange || !finalTicks || finalTicks.length === 0) && (
        <div
          data-testid="timeline-axis"
          style={{
            position: 'absolute',
            top: config?.timelineY ?? viewportSize.height / 2,
            left: 0,
            width: viewportSize.width,
            height: 2,
            backgroundColor: '#374151',
            zIndex: 10
          }}
        />
      )}

      {/* Fallback timeline axis for tests when no events loaded */}
      {events.length === 0 && (
        <div
          data-testid="timeline-axis"
          style={{
            position: 'absolute',
            top: config?.timelineY ?? viewportSize.height / 2,
            left: 0,
            width: viewportSize.width,
            height: 2,
            backgroundColor: '#e5e7eb',
            zIndex: 10
          }}
        />
      )}

      {/* Anchors - one per event in view window (CC-REQ-ANCHOR-004) */}
      <div ref={anchorsContainerRef}>
      {anchors.map((anchor) => {
        // Check if this anchor is part of a merged badge group
        const isMerged = mergedOverflowBadges.some(badge => badge.anchorIds.includes(anchor.id));

        // Determine if anchor's events are above or below timeline
        const anchorEventIds = [
          ...(anchor.eventIds ?? []),
          ...(anchor.eventId ? [anchor.eventId] : [])
        ];
        const anchorCards = anchorEventIds.flatMap(eventId => cardsByEventId.get(eventId) || []);
        // Show anchors for all events, including those with only overflow (no visible cards)
        // Only the cards are hidden for overflow events - anchors should always be visible

        const primaryAnchorEventId = anchor.eventId ?? anchor.eventIds?.[0] ?? null;
        // Only check hoveredPairEventId (internal state) - external hover handled via DOM/CSS
        const isAnchorPairHovered = hoveredPairEventId ? anchorEventIds.includes(hoveredPairEventId) : false;
        const isAnchorSelected = selectedEventId ? anchorEventIds.includes(selectedEventId) : false;

        // Calculate connector line positions
        const timelineAxisY = config?.timelineY ?? viewportSize.height / 2;
        const ANCHOR_GAP = 12; // Gap between anchor dot and axis line

        // Determine if events are above or below
        // Use card position if available, otherwise use anchor.clusterPosition, default to above
        const isAboveAxis = anchorCards.length > 0
          ? anchorCards[0].y < timelineAxisY
          : anchor.clusterPosition === 'below' ? false : true;

        // Position anchor dot away from axis with gap
        const anchorCenterY = isAboveAxis
          ? timelineAxisY - ANCHOR_GAP
          : timelineAxisY + ANCHOR_GAP;

        // Line starts from anchor dot center, extends to timeline axis
        const lineStartY = anchorCenterY;
        const lineEndY = timelineAxisY;

        // Check if this anchor belongs to a session event
        const anchorEvent = anchorCards[0]?.event as Event & { _sessionDecision?: EventDecision };
        const anchorSessionDecision = anchorEvent?._sessionDecision;

        // Session-aware color styles
        const sessionPendingStyle = {
          background: 'linear-gradient(135deg, #fed7aa 0%, #fb923c 100%)',
          borderColor: '#f97316',
          boxShadow: '0 0 8px rgba(249, 115, 22, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        };
        const sessionAcceptedStyle = {
          background: 'linear-gradient(135deg, #bbf7d0 0%, #4ade80 100%)',
          borderColor: '#22c55e',
          boxShadow: '0 0 8px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        };

        // Base visual style - selected and pair-hovered handled here, external hover via CSS
        const anchorVisualStyle: CSSProperties = isAnchorSelected
          ? {
              background: 'linear-gradient(135deg, #7c7cf0 0%, #4a4ac8 100%)',
              borderColor: '#5b5bd6',
              boxShadow: '0 0 10px rgba(91, 91, 214, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.35)'
            }
          : isAnchorPairHovered
            ? {
                background: 'linear-gradient(135deg, var(--color-primary-400) 0%, var(--color-primary-600) 100%)',
                borderColor: 'var(--color-primary-400)',
                boxShadow: '0 0 8px rgba(91, 91, 214, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }
            : anchorSessionDecision === 'pending'
              ? sessionPendingStyle
              : anchorSessionDecision === 'accepted'
                ? sessionAcceptedStyle
                : {
                    background: 'linear-gradient(135deg, var(--color-neutral-700) 0%, var(--color-neutral-800) 50%, var(--color-neutral-700) 100%)',
                    borderColor: 'var(--color-neutral-600)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  };

        // Calculate badge position to center on timeline axis
        const outerContainerTop = Math.min(anchorCenterY, timelineAxisY) - 5;
        const badgeAxisOffset = timelineAxisY - outerContainerTop - 2; // -2 to center the h-4 badge

        return (
          <div
            key={anchor.id}
            data-testid={anchor.id}
            data-anchor-event-ids={anchorEventIds.join(',')}
            className="absolute anchor-wrapper"
            style={{ left: anchor.x - 5, top: outerContainerTop }}
          >
            <div
              data-testid="timeline-anchor"
              className="flex flex-col items-center cursor-pointer relative"
              style={{ top: isAboveAxis ? Math.abs(lineEndY - lineStartY) - 5 - ANCHOR_GAP : ANCHOR_GAP }}
              aria-selected={isAnchorSelected}
              data-selected={isAnchorSelected || undefined}
              onMouseEnter={() => {
                if (primaryAnchorEventId) {
                  setHoveredPairEventId(primaryAnchorEventId);
                  if (onCardMouseEnter) onCardMouseEnter(primaryAnchorEventId);
                }
              }}
              onMouseLeave={() => {
                setHoveredPairEventId(null);
                if (onCardMouseLeave) onCardMouseLeave();
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (primaryAnchorEventId && onEventSelect) {
                  onEventSelect(primaryAnchorEventId);
                }
              }}
            >
              {/* Diamond/Milestone anchor shape - external hover styling via .anchor-hovered CSS class */}
              <div
                className={`anchor-diamond w-3 h-3 border-2 shadow-md z-20 transition-all duration-200 transform rotate-45 rounded-sm ${
                  isAnchorSelected ? 'scale-125' : isAnchorPairHovered ? 'scale-110' : ''
                }`}
                style={anchorVisualStyle}
              />
            </div>

            {/* Individual overflow badge - positioned on axis, outside the offset anchor */}
            {anchor.overflowCount > 0 && !isMerged && (
              <div
                data-testid={`overflow-badge-${anchor.id}`}
                className="absolute bg-white/90 text-rose-600 text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-semibold border border-rose-400 z-30"
                style={{ left: 12, top: badgeAxisOffset }}
              >
                +{anchor.overflowCount}
              </div>
            )}
          </div>
        );
      })}
      </div>

      {/* Render merged overflow badges at centroids - centered on timeline axis */}
      {mergedOverflowBadges.map((badge, index) => (
        <div
          key={`merged-badge-${index}`}
          data-testid={`merged-overflow-badge-${index}`}
          className="absolute bg-white/90 text-rose-600 text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-semibold border border-rose-400 z-30"
          style={{
            left: badge.x - 4, // Convert CENTER to LEFT edge for 8px badge
            top: (config?.timelineY ?? viewportSize.height / 2) - 8
          }}
        >
          +{badge.totalOverflow}
        </div>
      ))}

      {/* Cards - virtualized to only render visible cards */}
      <div ref={cardsContainerRef}>
      {(() => {
        // Viewport bounds for card virtualization (P2-1: Added vertical virtualization)
        const BUFFER = 200; // pixels outside viewport to pre-render
        const viewportLeft = 0;
        const viewportRight = viewportSize.width;
        const viewportTop = 0;
        const viewportBottom = viewportSize.height;

        // Filter cards to only those within or near viewport (horizontal + vertical)
        // Use CENTER-based calculations: card.x is CENTER, not LEFT edge
        const visibleCards = layoutResult.positionedCards.filter(card =>
          card.x + card.width / 2 > viewportLeft - BUFFER &&
          card.x - card.width / 2 < viewportRight + BUFFER &&
          card.y + card.height > viewportTop - BUFFER &&
          card.y < viewportBottom + BUFFER
        );

        return visibleCards.map((card, cardIndex) => {
        const primaryCardEventId = card.event?.id ?? card.id;
        const isCardSelected = selectedEventId ? primaryCardEventId === selectedEventId : false;
        const isCardPairHovered = hoveredPairEventId ? primaryCardEventId === hoveredPairEventId : false;
        const isFirstCard = cardIndex === 0;

        const cardTypeClass =
          card.cardType === 'full'
            ? 'border-l-4 border-l-indigo-500 p-3'
            : card.cardType === 'compact'
            ? 'border-l-4 border-l-indigo-400 p-2'
            : 'border-l-4 border-l-indigo-300 p-1';

        const cardHighlightClasses = isCardSelected
          ? 'ring-2 ring-indigo-500 ring-opacity-80 outline outline-2 outline-offset-2 outline-indigo-300 shadow-xl'
          : isCardPairHovered
          ? 'ring-2 ring-indigo-400 ring-opacity-60 shadow-indigo-400/30 shadow-lg'
          : '';

        const sessionDecision = (card.event as Event & { _sessionDecision?: EventDecision })._sessionDecision;
        const sessionDecisionClass = sessionDecision ? `session-event-${sessionDecision}` : '';

        // Check if this is a preview event (AI-created temporary event)
        const isPreviewEvent = card.event.isPreview === true;

        const cardStyle: CSSProperties = {
          left: card.x - card.width / 2, // Convert CENTER to LEFT edge
          top: card.y,
          width: card.width,
          height: card.height,
          zIndex: isCardSelected ? 25 : isCardPairHovered ? 21 : 10,
          backgroundColor: isPreviewEvent
            ? 'var(--preview-bg)'
            : isCardSelected
            ? 'rgba(238, 238, 251, 0.75)'
            : 'var(--color-surface)',
          borderColor: isPreviewEvent ? 'var(--preview-border)' : 'var(--color-border-primary)',
          borderStyle: isPreviewEvent ? 'dashed' : 'solid',
          borderWidth: isPreviewEvent ? '2px' : '1px',
          boxShadow: isPreviewEvent
            ? '0 0 16px var(--preview-glow)'
            : isCardSelected
            ? '0 12px 24px rgba(91, 91, 214, 0.22)'
            : undefined,
          color: 'var(--color-text-primary)'
        };

        const content =
          card.cardType === 'compact'
            ? <CompactCardContent event={card.event} />
            : card.cardType === 'title-only'
            ? <TitleOnlyCardContent event={card.event} />
            : <FullCardContent event={card.event} />;

        return (
          <div
            key={card.id}
            data-testid="event-card"
            data-event-id={primaryCardEventId}
            data-card-type={card.cardType}
            data-cluster-id={card.clusterId}
            data-tour={isFirstCard ? 'event-card' : undefined}
            data-preview={isPreviewEvent || undefined}
            className={`absolute rounded-lg shadow-md border hover:shadow-lg transition-all cursor-pointer overflow-hidden ${cardTypeClass} ${cardHighlightClasses} ${isPreviewEvent ? 'card-preview' : ''} ${sessionDecisionClass} text-sm`}
            style={cardStyle}
            aria-selected={isCardSelected}
            data-selected={isCardSelected || undefined}
            onClick={event => {
              event.stopPropagation();
              if (primaryCardEventId && onEventSelect) {
                onEventSelect(primaryCardEventId);
              }
            }}
            onDoubleClick={() => {
              if (primaryCardEventId && onCardDoubleClick) {
                onCardDoubleClick(primaryCardEventId);
              }
            }}
            onMouseEnter={(e) => {
              if (primaryCardEventId) {
                setHoveredPairEventId(primaryCardEventId);
              }
              if (primaryCardEventId && onCardMouseEnter) {
                onCardMouseEnter(primaryCardEventId);
              }
              handleCardMouseEnter(card, e);
            }}
            onMouseLeave={() => {
              setHoveredPairEventId(null);
              if (onCardMouseLeave) {
                onCardMouseLeave();
              }
              handleCardMouseLeave();
            }}
          >
            {content}
          </div>
        );
      });
      })()}
      </div>

      {/* Info Panels - Only show when enabled */}
      {showInfoPanels && (
        <div
          className="absolute top-4 left-4 backdrop-blur-sm p-3 rounded-xl shadow-md max-w-sm transition-all duration-200 z-[5] pointer-events-auto"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          <h2 className="font-bold text-sm mb-1">Layout Summary</h2>
          <p className="text-xs text-gray-600">{layoutResult.positionedCards.length} events</p>
          <p className="text-xs text-gray-600">{layoutResult.clusters.length} column groups</p>
          <p className="text-xs text-gray-600">Slot utilisation {layoutResult.utilization.percentage.toFixed(1)}%</p>
        </div>
      )}

      {/* Card Hover Preview - hidden during Shift+scroll panning */}
      {previewCard && !isPanning && (
        <CardHoverPreview
          event={previewCard.event}
          position={{ x: previewCard.x, y: previewCard.y }}
          onClose={() => setPreviewCard(null)}
        />
      )}
    </div>
  );
}, arePropsEqual);

// Source indicator for events with sources (CC-REQ-CARD-SOURCE-001)
// Subtle, theme-aware icon that blends with card content
function SourceIndicator({ sources }: { sources?: string[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <span
      data-testid="source-indicator"
      data-source-count={sources.length}
      className="material-symbols-rounded flex-shrink-0"
      style={{
        fontSize: '14px',
        color: 'var(--color-text-tertiary)',
        opacity: 0.6,
      }}
      title={`${sources.length} source${sources.length > 1 ? 's' : ''}`}
    >
      link
    </span>
  );
}

// P1-3: Memoized card content components to prevent unnecessary re-renders
const FullCardContent = memo(function FullCardContent({ event }: { event: Event }) {
  return (
    <div className="card-body h-full flex flex-col overflow-hidden">
      <div className="flex items-start gap-1 flex-shrink-0">
        <h3
          className="card-title card-clamp-title-2 flex-1 min-w-0"
          style={{ color: 'var(--color-text-primary)' }}
          title={event.title}
        >
          {event.title}
        </h3>
        <SourceIndicator sources={event.sources} />
      </div>
      {event.description ? (
        <p
          className="card-description card-clamp-desc-3 flex-shrink-0 mt-0.5"
          style={{ color: 'var(--color-text-secondary)' }}
          title={event.description}
        >
          {event.description}
        </p>
      ) : null}
      <div className="card-date flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
        {formatEventDateTime(event)}
      </div>
    </div>
  );
});

const CompactCardContent = memo(function CompactCardContent({ event }: { event: Event }) {
  return (
    <div className="card-body h-full flex flex-col overflow-hidden">
      <div className="flex items-start gap-1 flex-shrink-0">
        <h3
          className="card-title card-clamp-title-2 flex-1 min-w-0"
          style={{ color: 'var(--color-text-primary)' }}
          title={event.title}
        >
          {event.title}
        </h3>
        <SourceIndicator sources={event.sources} />
      </div>
      {event.description ? (
        <p
          className="card-description card-clamp-desc-1 flex-shrink-0 mt-0.5"
          style={{ color: 'var(--color-text-secondary)' }}
          title={event.description}
        >
          {event.description}
        </p>
      ) : null}
      <div className="card-date flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
        {formatEventDateTime(event)}
      </div>
    </div>
  );
});

const TitleOnlyCardContent = memo(function TitleOnlyCardContent({ event }: { event: Event }) {
  return (
    <div className="h-full flex items-center gap-1 overflow-hidden">
      <h3
        className="card-title card-clamp-title-1 flex-1 min-w-0"
        style={{ color: 'var(--color-text-primary)' }}
        title={event.title}
      >
        {event.title}
      </h3>
      <SourceIndicator sources={event.sources} />
    </div>
  );
});
