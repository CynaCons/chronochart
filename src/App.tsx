import { useEffect, useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DeterministicLayoutComponent } from './layout/DeterministicLayoutComponent';
import { NavigationRail, ThemeToggleButton } from './components/NavigationRail';
import { UserProfileMenu } from './components/UserProfileMenu';
import { useNavigationShortcuts, useCommandPaletteShortcuts } from './hooks/useKeyboardShortcuts';
import { useNavigationConfig, type NavigationItem } from './app/hooks/useNavigationConfig';
import { useAuth } from './contexts/AuthContext';
import { ImportSessionProvider, useImportSessionContext } from './contexts/ImportSessionContext';
import { getTimeline, updateTimeline, getUser, addEvent, updateEvent as updateEventFirestore, deleteEvent as deleteEventFirestore } from './services/firestore';
import type { User } from './types';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { useTheme } from './contexts/ThemeContext';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import TimelineIcon from '@mui/icons-material/Timeline';
import type { Event, Timeline } from './types';
import type { EventDecision } from './types/importSession';
import type { Command } from './components/CommandPalette';

// Lazy load panels, overlays and heavy components for better bundle splitting
const AuthoringOverlay = lazy(() => import('./app/overlays/AuthoringOverlay').then(m => ({ default: m.AuthoringOverlay })));
const ImportExportOverlay = lazy(() => import('./app/overlays/ImportExportOverlay').then(m => ({ default: m.ImportExportOverlay })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));
const TimelineMinimap = lazy(() => import('./components/TimelineMinimap').then(m => ({ default: m.TimelineMinimap })));
const StreamViewerOverlay = lazy(() => import('./components/StreamViewerOverlay').then(m => ({ default: m.StreamViewerOverlay })));
const ChatPanel = lazy(() => import('./app/panels/ChatPanel').then(m => ({ default: m.ChatPanel })));
const ReviewPanel = lazy(() => import('./app/panels/ReviewPanel').then(m => ({ default: m.ReviewPanel })));
import { useAISession } from './hooks/useAISession';
import { buildAIContext } from './lib/aiContextBuilder';
import { executeActions } from './lib/aiActionHandlers';
import { convertAIActionsToSessionEvents } from './lib/aiActionsToSession';
import type { AIAction, AIContext } from './types/ai';
import { EventStorage } from './lib/storage';
import { seedRFKTimeline } from './lib/devSeed';
import { useViewWindow } from './app/hooks/useViewWindow';
import { useAnnouncer } from './app/hooks/useAnnouncer';
import { useTimelineZoom } from './app/hooks/useTimelineZoom';
import { useTimelineSelection } from './app/hooks/useTimelineSelection';
import { useEventEditForm } from './app/hooks/useEventEditForm';
import { useTimelineUI } from './app/hooks/useTimelineUI';
import { useEventSelection } from './app/hooks/useEventSelection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { usePerformanceMonitoring } from './app/hooks/usePerformanceMonitoring';
import { ErrorState } from './components/ErrorState';
import { TourProvider, useTour } from './components/tours/TourProvider';
import { EditorTour } from './components/tours/EditorTour';
import { ShareMenu } from './components/ShareMenu';
import { EmbedCodeDialog } from './components/EmbedCodeDialog';
import { embedUrl as buildEmbedUrl } from './utils/urls';

const DEV_FLAG_KEY = 'powertimeline-dev';

interface AppProps {
  timelineId?: string;  // Optional timeline ID to load from home page storage
  readOnly?: boolean;   // Read-only mode: hide authoring overlay, show lock icon on nav rail
  embed?: boolean;      // Embed mode: hide all chrome except timeline + minimap
  initialStreamViewOpen?: boolean;  // Open stream view on mount (for mobile first experience)
  onStreamViewChange?: (isOpen: boolean) => void;  // Callback when stream view opens/closes
}

type EventWithSessionDecision = Event & { _sessionDecision?: EventDecision };

interface SessionEventMergeProps {
  events: Event[];
  children: (mergedEvents: EventWithSessionDecision[]) => ReactNode;
}

function SessionEventMerge({ events, children }: SessionEventMergeProps) {
  const { session } = useImportSessionContext();

  const sessionEventsForDisplay = useMemo<EventWithSessionDecision[]>(() => {
    if (!session?.events?.length) {
      return [];
    }

    return session.events
      .filter(sessionEvent => sessionEvent.decision !== 'rejected')
      .map(sessionEvent => ({
        ...sessionEvent.eventData,
        id: sessionEvent.eventData.id || sessionEvent.id,
        _sessionDecision: sessionEvent.decision,
      }) as EventWithSessionDecision);
  }, [session]);

  const mergedEvents = useMemo(() => {
    // Deduplicate by ID - session events override existing events (for preview during import)
    const eventMap = new Map(events.map(e => [e.id, e as EventWithSessionDecision]));
    sessionEventsForDisplay.forEach(se => {
      eventMap.set(se.id, se);
    });
    return Array.from(eventMap.values());
  }, [events, sessionEventsForDisplay]);

  return <>{children(mergedEvents)}</>;
}

interface ReviewPanelContainerProps {
  onClose: () => void;
  onOpenReviewEvent: (eventData: Event, onSaveEdits: (edits: Partial<Event>) => void) => void;
  onCommit?: () => void; // Called after successful commit to refresh events
  onFocusEvent?: (eventId: string) => void; // Scroll to event on timeline
}

function ReviewPanelContainer({ onClose, onOpenReviewEvent, onCommit, onFocusEvent }: ReviewPanelContainerProps) {
  const { session, updateEventData } = useImportSessionContext();

  const handleReviewEventClick = useCallback((sessionEventId: string) => {
    const sessionEvent = session?.events.find(event => event.id === sessionEventId);

    if (!sessionEvent) {
      return;
    }

    const mergedEventData = { ...sessionEvent.eventData, ...sessionEvent.userEdits };
    const reviewEvent: Event = {
      id: mergedEventData.id ?? `review-${sessionEvent.id}`,
      date: mergedEventData.date ?? '',
      time: mergedEventData.time,
      title: mergedEventData.title ?? '',
      description: mergedEventData.description,
      endDate: mergedEventData.endDate,
      sources: mergedEventData.sources,
    };

    onOpenReviewEvent(reviewEvent, (edits) => updateEventData(sessionEventId, edits));
  }, [session, updateEventData, onOpenReviewEvent]);

  return <ReviewPanel onClose={onClose} onEventClick={handleReviewEventClick} onCommit={onCommit} onFocusEvent={onFocusEvent} />;
}

/**
 * Bridge component that processes AI event actions and sends them to ImportSession.
 * Must be rendered inside ImportSessionProvider to have access to startSession.
 */
interface AIEventBridgeProps {
  aiActions: AIAction[];
  existingEvents: Event[];
  onProcessed: () => void;
}

/**
 * Hook to get AI chat session info for ChatPanel.
 * Returns whether there are AI events to review and the count.
 */
function useAIChatSessionInfo() {
  const { session } = useImportSessionContext();
  const hasEventActionsToReview = session?.source === 'ai-chat' && session.events.length > 0;
  const eventActionCount = session?.source === 'ai-chat' ? session.events.length : 0;
  return { hasEventActionsToReview, eventActionCount };
}

/**
 * ChatPanel container that provides ImportSession info.
 */
interface ChatPanelContainerProps {
  aiSession: ReturnType<typeof useAISession>;
  timelineTitle?: string;
  timelineDescription?: string;
  onOpenReviewPanel: () => void;
  onClose: () => void;
}

function ChatPanelContainer({
  aiSession,
  timelineTitle,
  timelineDescription,
  onOpenReviewPanel,
  onClose,
}: ChatPanelContainerProps) {
  const { hasEventActionsToReview, eventActionCount } = useAIChatSessionInfo();

  return (
    <ChatPanel
      apiKey={aiSession.apiKey}
      isKeyValid={aiSession.isKeyValid}
      messages={aiSession.messages}
      isLoading={aiSession.isLoading}
      error={aiSession.error}
      usage={aiSession.usage}
      pendingActions={aiSession.pendingActions}
      timelineTitle={timelineTitle}
      timelineDescription={timelineDescription}
      hasEventActionsToReview={hasEventActionsToReview}
      eventActionCount={eventActionCount}
      onSetApiKey={aiSession.setApiKey}
      onClearApiKey={aiSession.clearApiKey}
      onSendMessage={aiSession.sendMessage}
      onClearHistory={aiSession.clearHistory}
      onApproveActions={aiSession.approveActions}
      onRejectActions={aiSession.rejectActions}
      onApplyActions={aiSession.applyActions}
      onOpenReviewPanel={onOpenReviewPanel}
      onClose={onClose}
    />
  );
}

function AIEventBridge({ aiActions, existingEvents, onProcessed }: AIEventBridgeProps) {
  const { startSession } = useImportSessionContext();
  const processedRef = useRef(false);

  useEffect(() => {
    if (aiActions.length > 0 && !processedRef.current) {
      processedRef.current = true;
      const { events } = convertAIActionsToSessionEvents(aiActions, existingEvents);
      if (events.length > 0) {
        startSession('ai-chat', events, existingEvents, 'merge');
      }
      onProcessed();
    }
  }, [aiActions, existingEvents, startSession, onProcessed]);

  // Reset processed flag when aiActions is cleared
  useEffect(() => {
    if (aiActions.length === 0) {
      processedRef.current = false;
    }
  }, [aiActions]);

  return null;
}

// Inner component that uses tour context
function AppContent({ timelineId, readOnly = false, embed = false, initialStreamViewOpen = false, onStreamViewChange }: AppProps = {}) {
  // Ownership is inverse of readOnly (readOnly = false means user owns the timeline)
  const isOwner = !readOnly;
  usePerformanceMonitoring();
  const navigate = useNavigate();
  const { startTour } = useTour();

  // Storage
  const storageRef = useRef(new EventStorage());

  // Ref to always have current events (avoid stale closures)
  const eventsRef = useRef<Event[]>([]);

  // Helper function to save events to legacy EventStorage (non-Firestore timelines)
  // NOTE: For Firestore timelines, use atomic addEvent/updateEvent/deleteEvent instead
  const saveEventsToStorage = useCallback((events: Event[]) => {
    // Only for local/legacy storage (when no timelineId)
    if (!timelineId) {
      storageRef.current.writeThrough(events);
    }
  }, [timelineId]);

  const [events, setEvents] = useState<Event[]>(() => {
    // If timelineId is provided, we'll load from Firestore in useEffect (can't be async here)
    if (timelineId) {
      return [];
    }

    // Otherwise, load from legacy EventStorage
    const stored = storageRef.current.load();
    if (stored.length > 0) {
      return stored;
    }

    const defaultSeed = seedRFKTimeline();
    storageRef.current.writeThrough(defaultSeed);
    return defaultSeed;
  });

  // Keep eventsRef in sync with events (for callbacks that need current events)
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Event selection state (extracted to custom hook)
  const {
    selectedId,
    setSelectedId,
    hoveredEventId,
    setHoveredEventId,
    selectedEvent: selected,
    selectEvent,
    navigateToPreviousEvent,
    navigateToNextEvent,
  } = useEventSelection({ events });

  const [loadError, setLoadError] = useState<Error | null>(null);
  // Pending overlay ID - used to defer overlay opening until event data is ready
  const [pendingOverlayId, setPendingOverlayId] = useState<string | null>(null);

  // Use readOnly prop from EditorPage (which determines ownership via Firebase Auth)
  const isReadOnly = readOnly;

  // Get current Firebase user for auth-gated features (moved up for editorItems dependency)
  const { user: firebaseUser, signOut } = useAuth();

  // Current timeline metadata (for import/export)
  const [currentTimeline, setCurrentTimeline] = useState<Timeline | null>(null);
  const sessionTimelineId = currentTimeline?.id || timelineId || 'local-timeline';
  const sessionOwnerId = currentTimeline?.ownerId || firebaseUser?.uid || '';

  // Reload events when timelineId changes
  const loadTimelineEvents = useCallback(async () => {
    try {
      setLoadError(null);
      if (timelineId) {
        const timeline = await getTimeline(timelineId);
        if (timeline) {
          setEvents(timeline.events);
          setCurrentTimeline(timeline);
          return;
        }
      }

      // If no timelineId or timeline not found, load from EventStorage
      const stored = storageRef.current.load();
      if (stored.length > 0) {
        setEvents(stored);
      }
      // Create a minimal timeline object for local/legacy storage
      setCurrentTimeline({
        id: 'local-timeline',
        title: 'Local Timeline',
        description: '',
        ownerId: '',
        visibility: 'private',
        events: stored,
        eventCount: stored.length,
        viewCount: 0,
        featured: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to load timeline:', error);
      setLoadError(error instanceof Error ? error : new Error('Failed to load timeline'));
      setEvents([]);
      setCurrentTimeline(null);
    }
  }, [timelineId]);

  useEffect(() => {
    loadTimelineEvents();
  }, [loadTimelineEvents]);

  const [activeNavItem, setActiveNavItem] = useState<string | null>(null);
  // selected comes from useEventSelection hook

  // AI Context for chat
  const aiContext = useMemo<AIContext>(() => buildAIContext({
    timeline: currentTimeline,
    events,
    selectedEvent: selected,
  }), [currentTimeline, events, selected]);

  // Form state for event editing (extracted to custom hook)
  const {
    editDate,
    editTime,
    editTitle,
    editDescription,
    setEditDate,
    setEditTime,
    setEditTitle,
    setEditDescription,
  } = useEventEditForm({ selectedEvent: selected, selectedId });

  // View window controls via hook
  const { viewStart, viewEnd, setWindow, snapBackToBounds, nudge, zoom, animateTo } = useViewWindow(0,1);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const lastCursorRef = useRef<{ cursorX: number; containerLeft: number; containerWidth: number } | null>(null);

  const applyZoomWithAnchor = useCallback((zoomFactor: number, cursorX?: number, containerLeft?: number, containerWidth?: number) => {
    const rect = timelineContainerRef.current?.getBoundingClientRect();

    const resolvedCursorX = cursorX ?? lastCursorRef.current?.cursorX;
    const resolvedContainerLeft = containerLeft ?? rect?.left ?? lastCursorRef.current?.containerLeft;
    const resolvedContainerWidth = containerWidth ?? rect?.width ?? lastCursorRef.current?.containerWidth;

    if (
      resolvedCursorX === undefined ||
      resolvedContainerLeft === undefined ||
      resolvedContainerWidth === undefined ||
      resolvedContainerWidth <= 0
    ) {
      zoom(zoomFactor);
      return;
    }

    lastCursorRef.current = {
      cursorX: resolvedCursorX,
      containerLeft: resolvedContainerLeft,
      containerWidth: resolvedContainerWidth,
    };

    // Calculate actual timeline bounds accounting for padding
    // The Timeline component adds ~5% padding on left/right sides
    const sidePad = Math.max(16, Math.floor(resolvedContainerWidth * 0.05));
    const timelineLeft = sidePad;
    const timelineWidth = Math.max(1, resolvedContainerWidth - sidePad * 2);

    // Convert cursor position to ratio on the actual timeline axis
    const mouseX = resolvedCursorX - resolvedContainerLeft;
    const mouseXOnTimeline = Math.max(0, mouseX - timelineLeft);
    const cursorRatio = Math.max(0, Math.min(1, mouseXOnTimeline / timelineWidth));

    const currentRange = viewEnd - viewStart;
    const cursorTime = viewStart + cursorRatio * currentRange;

    const minRange = 0.00002;
    const newRange = Math.max(minRange, Math.min(1, currentRange * zoomFactor));
    let newStart = cursorTime - (cursorRatio * newRange);
    let newEnd = newStart + newRange;

    if (newStart < 0) {
      newStart = 0;
      newEnd = newRange;
    }
    if (newEnd > 1) {
      newEnd = 1;
      newStart = 1 - newRange;
    }

    setWindow(newStart, newEnd);
  }, [viewStart, viewEnd, zoom, setWindow]);

  const handleZoomAtCursor = useCallback((zoomFactor: number, cursorX: number, _windowWidth: number, containerLeft?: number, containerWidth?: number) => {
    applyZoomWithAnchor(zoomFactor, cursorX, containerLeft, containerWidth);
  }, [applyZoomWithAnchor]);

  // Timeline interaction hooks
  const { isPanning } = useTimelineZoom({ zoomAtCursor: handleZoomAtCursor, hoveredEventId, viewStart, viewEnd, setWindow });
  const { timelineSelection, handleTimelineMouseDown, spaceKeyHeld } = useTimelineSelection({ viewStart, viewEnd, setWindow, snapBackToBounds });

  const handleTimelineMouseDownWithSelection = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element | null;
    const interactedWithCard = target?.closest('[data-testid="event-card"]');
    const interactedWithAnchor = target?.closest('[data-testid="timeline-anchor"]');

    if (!interactedWithCard && !interactedWithAnchor) {
      setSelectedId(undefined);
    }

    handleTimelineMouseDown(e);
  }, [handleTimelineMouseDown, setSelectedId]);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = timelineContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    lastCursorRef.current = {
      cursorX: e.clientX,
      containerLeft: rect.left,
      containerWidth: rect.width,
    };
  }, []);

  const handleZoomIn = useCallback(() => {
    applyZoomWithAnchor(0.8);
  }, [applyZoomWithAnchor]);

  const handleZoomOut = useCallback(() => {
    applyZoomWithAnchor(1.25);
  }, [applyZoomWithAnchor]);

  // Stable callbacks for StreamViewerOverlay hover events
  const handleStreamEventMouseEnter = useCallback((eventId: string) => {
    setHoveredEventId(eventId);
  }, []);

  const handleStreamEventMouseLeave = useCallback(() => {
    setHoveredEventId(undefined);
  }, []);

  // UI state for overlays and panels (extracted to custom hook)
  const {
    overlay,
    setOverlay,
    streamViewerOpen,
    setStreamViewerOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    chatPanelOpen,
    setChatPanelOpen,
    showInfoPanels,
    setShowInfoPanels,
  } = useTimelineUI({ initialStreamViewOpen, onStreamViewChange });

  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewEvent, setReviewEvent] = useState<Event | null>(null);
  const [reviewEventSaveHandler, setReviewEventSaveHandler] = useState<((edits: Partial<Event>) => void) | null>(null);
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Dragging state (for disabling overlay pointer events)
  const [dragging] = useState(false);
  // Dev options (removed unused placeholder and force card mode for Stage 1)

  useEffect(() => {
    if (overlay !== 'editor') {
      setReviewEvent(null);
      setReviewEventSaveHandler(null);
    }
  }, [overlay]);

  // Announcer hook
  const { announce, renderLiveRegion } = useAnnouncer();

  // Navigation and theme hooks
  const { toggleTheme } = useTheme();
  // Theme: dark-only (no data-theme switch)
  useEffect(() => {
    try {
      localStorage.removeItem(DEV_FLAG_KEY);
    } catch (error) {
      console.warn('Failed to remove dev flag from localStorage:', error);
    }
  }, []);

  // Escape key handling is now in useTimelineUI hook

  // If opening Editor with exactly one event and nothing selected, auto-select it
  useEffect(() => {
    if (overlay === 'editor' && !selectedId && events.length === 1) {
      setSelectedId(events[0].id);
    }
  }, [overlay, selectedId, events]);

  // On overlay open, focus first focusable and enable simple focus trap
  useEffect(() => {
    if (!overlay || !overlayRef.current) return;
    const root = overlayRef.current;
    const focusable = root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    if (first) first.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const list = Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
      if (list.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const idx = list.indexOf(active || list[0]);
      if (e.shiftKey) {
        if (active === list[0] || idx === -1) { e.preventDefault(); list[list.length - 1].focus(); }
      } else {
        if (active === list[list.length - 1]) { e.preventDefault(); list[0].focus(); }
      }
    }
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [overlay]);

  // Persist events to localStorage for legacy/local timelines only
  // Firestore timelines use atomic operations (addEvent/updateEvent/deleteEvent)
  useEffect(() => {
    if (!timelineId) {
      storageRef.current.save(events);
    }
  }, [events, timelineId]);

  // Form sync with selection is now handled by useEventEditForm hook

  // Keyboard shortcuts (ignore when typing in inputs)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '+' || e.key === '=') { handleZoomIn(); }
      else if (e.key === '-' || e.key === '_') { handleZoomOut(); }
      else if (e.key === 'ArrowLeft') { nudge(-0.05); }
      else if (e.key === 'ArrowRight') { nudge(0.05); }
      else if (e.key === 'Home') { const w = Math.max(viewEnd - viewStart, 0.1); setWindow(0, w); }
      else if (e.key === 'End') { const w = Math.max(viewEnd - viewStart, 0.1); setWindow(Math.max(0, 1 - w), 1); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewStart, viewEnd, handleZoomIn, handleZoomOut, nudge, setWindow]);



  // CRUD handlers
  const saveAuthoring = useCallback(async (e: React.FormEvent, options?: { sources?: string[] }) => {
    e.preventDefault();
    const isEdit = !!selectedId;

    // Check if this is a preview event (AI-proposed event)
    if (selectedId?.startsWith('preview-')) {
      const actionId = selectedId.replace('preview-', '');

      // Update the pending action's payload instead of writing to Firestore
      updateActionPayloadRef.current(actionId, {
        date: editDate,
        time: editTime || undefined,
        title: editTitle,
        description: editDescription || undefined,
        sources: options?.sources,
      });

      try {
        announce(`Updated preview for ${editTitle || 'event'}`);
      } catch (error) {
        console.warn('Failed to announce preview update:', error);
      }
      setOverlay(null);
      return;
    }

    if (isEdit) {
      const updates = {
        date: editDate,
        time: editTime || undefined,
        title: editTitle,
        description: editDescription || undefined,
        sources: options?.sources,
      };

      // Update local state optimistically
      setEvents(prev => prev.map(ev => ev.id === selectedId ? { ...ev, ...updates } : ev));

      // Persist to Firestore if this is a Firestore timeline
      if (timelineId && currentTimeline?.ownerId) {
        try {
          await updateEventFirestore(timelineId, currentTimeline.ownerId, selectedId, updates);
        } catch (error) {
          console.error('Failed to update event in Firestore:', error);
          // Revert optimistic update on error
          setEvents(prev => prev.map(ev =>
            ev.id === selectedId
              ? events.find(e => e.id === selectedId) || ev
              : ev
          ));
          throw error;
        }
      } else {
        // Save to legacy storage for non-Firestore timelines
        setEvents(prev => {
          const next = prev.map(ev => ev.id === selectedId ? { ...ev, ...updates } : ev);
          saveEventsToStorage(next);
          return next;
        });
      }

      try {
        announce(`Saved changes to ${editTitle || 'event'}`);
      } catch (error) {
        console.warn('Failed to announce save:', error);
      }
    } else {
      if (!editDate || !editTitle) {
        return;
      }
      const newEvent: Event = {
        id: Date.now().toString(),
        date: editDate,
        time: editTime || undefined,
        title: editTitle,
        description: editDescription || undefined,
        sources: options?.sources,
      };

      // Update local state optimistically
      setEvents(prev => [...prev, newEvent]);

      // Persist to Firestore if this is a Firestore timeline
      if (timelineId && currentTimeline?.ownerId) {
        try {
          await addEvent(timelineId, currentTimeline.ownerId, newEvent);
        } catch (error) {
          console.error('Failed to add event to Firestore:', error);
          // Revert optimistic update on error
          setEvents(prev => prev.filter(ev => ev.id !== newEvent.id));
          throw error;
        }
      } else {
        // Save to legacy storage for non-Firestore timelines
        setEvents(prev => {
          const next = [...prev, newEvent];
          saveEventsToStorage(next);
          return next;
        });
      }

      try {
        announce(`Added event ${editTitle}`);
      } catch (error) {
        console.warn('Failed to announce add:', error);
      }
    }
    setOverlay(null);
  }, [selectedId, editDate, editTime, editTitle, editDescription, announce, timelineId, currentTimeline, events, saveEventsToStorage]);

  // saveAuthoring handles both edit and create flows

  const handleReviewSave = useCallback((event: React.FormEvent, options?: { sources: string[] }) => {
    event.preventDefault();

    if (!reviewEventSaveHandler) {
      return;
    }

    if (!editDate || !editTitle) {
      return;
    }

    reviewEventSaveHandler({
      date: editDate,
      time: editTime || undefined,
      title: editTitle,
      description: editDescription || undefined,
      sources: options?.sources,
    });

    setOverlay(null);
  }, [reviewEventSaveHandler, editDate, editTime, editTitle, editDescription, setOverlay]);

  const deleteSelected = useCallback(async () => {
    if (!selectedId) return;
    const toDelete = events.find(e => e.id === selectedId);

    // Update local state optimistically
    setEvents(prev => prev.filter(ev => ev.id !== selectedId));
    setSelectedId(undefined);
    setOverlay(null); // Close the authoring overlay after deletion

    // Persist to Firestore if this is a Firestore timeline
    if (timelineId && currentTimeline?.ownerId) {
      try {
        await deleteEventFirestore(timelineId, currentTimeline.ownerId, selectedId);
      } catch (error) {
        console.error('Failed to delete event from Firestore:', error);
        // Revert optimistic update on error
        if (toDelete) {
          setEvents(prev => [...prev, toDelete].sort((a, b) => a.date.localeCompare(b.date)));
        }
        throw error;
      }
    } else {
      // Save to legacy storage for non-Firestore timelines
      setEvents(prev => {
        const next = prev.filter(ev => ev.id !== selectedId);
        saveEventsToStorage(next);
        return next;
      });
    }

    try {
      announce(`Deleted ${toDelete?.title || 'event'}`);
    } catch (error) {
      console.warn('Failed to announce delete:', error);
    }
  }, [selectedId, events, announce, timelineId, currentTimeline, saveEventsToStorage]);

  const handleEventSave = useCallback(async (event: Event) => {
    const existing = events.find(ev => ev.id === event.id);
    const isUpdate = !!existing;

    // Update local state optimistically
    if (isUpdate) {
      setEvents(prev => prev.map(ev => (ev.id === event.id ? { ...ev, ...event } : ev)));
    } else {
      setEvents(prev => [...prev, event]);
    }

    // Persist to Firestore if this is a Firestore timeline
    if (timelineId && currentTimeline?.ownerId) {
      try {
        if (isUpdate) {
          await updateEventFirestore(timelineId, currentTimeline.ownerId, event.id, event);
        } else {
          await addEvent(timelineId, currentTimeline.ownerId, event);
        }
      } catch (error) {
        console.error('Failed to save event to Firestore:', error);
        // Revert optimistic update on error
        if (isUpdate && existing) {
          setEvents(prev => prev.map(ev => (ev.id === event.id ? existing : ev)));
        } else {
          setEvents(prev => prev.filter(ev => ev.id !== event.id));
        }
        throw error;
      }
    } else {
      // Save to legacy storage for non-Firestore timelines
      setEvents(prev => {
        const updatedList = isUpdate
          ? prev.map(ev => (ev.id === event.id ? { ...ev, ...event } : ev))
          : [...prev, event];
        saveEventsToStorage(updatedList);
        return updatedList;
      });
    }

    setSelectedId(event.id);
    try {
      announce(`${isUpdate ? 'Updated' : 'Added'} ${event.title}`);
    } catch (error) {
      console.warn('Failed to announce stream save:', error);
    }
  }, [events, timelineId, currentTimeline, announce, saveEventsToStorage]);

  const handleEventDelete = useCallback(async (eventId: string) => {
    const toDelete = events.find(ev => ev.id === eventId);
    const deletedTitle = toDelete?.title ?? '';

    // Update local state optimistically
    setEvents(prev => prev.filter(ev => ev.id !== eventId));
    setSelectedId(prev => (prev === eventId ? undefined : prev));

    // Persist to Firestore if this is a Firestore timeline
    if (timelineId && currentTimeline?.ownerId) {
      try {
        await deleteEventFirestore(timelineId, currentTimeline.ownerId, eventId);
      } catch (error) {
        console.error('Failed to delete event from Firestore:', error);
        // Revert optimistic update on error
        if (toDelete) {
          setEvents(prev => [...prev, toDelete].sort((a, b) => a.date.localeCompare(b.date)));
        }
        throw error;
      }
    } else {
      // Save to legacy storage for non-Firestore timelines
      setEvents(prev => {
        const next = prev.filter(ev => ev.id !== eventId);
        saveEventsToStorage(next);
        return next;
      });
    }

    try {
      announce(`Deleted ${deletedTitle || 'event'}`);
    } catch (error) {
      console.warn('Failed to announce stream delete:', error);
    }
  }, [events, timelineId, currentTimeline, announce, saveEventsToStorage]);

  // AI Action handlers
  const handleApplyAIActions = useCallback(async (actions: AIAction[]) => {
    // Use ref to get current events (avoid stale closure)
    let currentEvents = eventsRef.current;

    // Need ownerId for Firestore operations
    const ownerId = currentTimeline?.ownerId;
    if (!ownerId || !timelineId) {
      throw new Error('Cannot apply AI actions: missing timeline or owner info');
    }

    // Check ownership
    if (!isOwner) {
      throw new Error('Permission denied: only the timeline owner can apply AI actions');
    }

    const results = await executeActions(actions, {
      events: currentEvents,
      timeline: currentTimeline,
      onCreateEvent: async (eventData) => {
        const newId = Date.now().toString();
        const newEvent = { ...eventData, id: newId } as Event;

        // Add to Firestore events subcollection
        await addEvent(timelineId, ownerId, newEvent);

        // Update local state
        const nextEvents = [...currentEvents, newEvent];
        currentEvents = nextEvents;
        setEvents(nextEvents);
        return newId;
      },
      onUpdateEvent: async (id, changes) => {
        // Update in Firestore events subcollection
        await updateEventFirestore(timelineId, ownerId, id, changes);

        // Update local state
        const nextEvents = currentEvents.map(ev => ev.id === id ? { ...ev, ...changes } : ev);
        currentEvents = nextEvents;
        setEvents(nextEvents);
      },
      onDeleteEvent: async (id) => {
        // Delete from Firestore events subcollection
        await deleteEventFirestore(timelineId, ownerId, id);

        // Update local state
        const nextEvents = currentEvents.filter(ev => ev.id !== id);
        currentEvents = nextEvents;
        setEvents(nextEvents);
      },
      onUpdateTimeline: async (changes) => {
        if (currentTimeline && timelineId) {
          await updateTimeline(timelineId, changes);
          setCurrentTimeline(prev => prev ? { ...prev, ...changes } : null);
        }
      },
    });

    // Check for failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      throw new Error(`Failed to apply ${failures.length} action(s)`);
    }
  }, [currentTimeline, timelineId, isOwner]);

  // State to hold AI event actions that need to be sent to ImportSession
  // These are processed by AIEventBridge component which has access to ImportSessionContext
  const [pendingAIEventActions, setPendingAIEventActions] = useState<AIAction[]>([]);

  // Handler for when AI returns event actions (CREATE/UPDATE/DELETE)
  const handleAIEventActions = useCallback((actions: AIAction[]) => {
    setPendingAIEventActions(actions);
    setShowReviewPanel(true); // Open ReviewPanel to review AI events
  }, []);

  // Clear pending AI event actions after they've been processed by AIEventBridge
  const clearPendingAIEventActions = useCallback(() => {
    setPendingAIEventActions([]);
  }, []);

  // AI Session
  const aiSession = useAISession({
    context: aiContext,
    onApplyActions: handleApplyAIActions,
    onEventActionsReceived: handleAIEventActions,
  });

  // Ref to access updateActionPayload in saveAuthoring (declared earlier)
  const updateActionPayloadRef = useRef(aiSession.updateActionPayload);
  useEffect(() => {
    updateActionPayloadRef.current = aiSession.updateActionPayload;
  }, [aiSession.updateActionPayload]);

  // Preview events from pending AI actions
  const previewEvents = useMemo((): Event[] => {
    return aiSession.pendingActions
      .filter((a): a is import('./types/ai').CreateEventAction =>
        a.type === 'CREATE_EVENT' && (a.status === 'pending' || a.status === 'approved')
      )
      .map(action => ({
        id: `preview-${action.id}`,
        title: action.payload.title,
        date: action.payload.date,
        description: action.payload.description,
        endDate: action.payload.endDate,
        time: action.payload.time,
        sources: action.payload.sources,
        isPreview: true,
      }));
  }, [aiSession.pendingActions]);

  // Combine real events with preview events
  const eventsWithPreviews = useMemo(() => {
    return [...events, ...previewEvents];
  }, [events, previewEvents]);

  // Selected event including preview events (for editor)
  const selectedWithPreviews = useMemo(
    () => eventsWithPreviews.find((e) => e.id === selectedId),
    [eventsWithPreviews, selectedId]
  );

  const authoringSelected = reviewEvent ?? selectedWithPreviews;
  const isReviewEventActive = Boolean(reviewEvent);
  const isNewAuthoringEvent = isReviewEventActive ? true : !selectedWithPreviews;

  // Open overlay when pending and event data is ready
  // This ensures the overlay only opens after selectedWithPreviews is computed
  useEffect(() => {
    if (pendingOverlayId && selectedWithPreviews && selectedWithPreviews.id === pendingOverlayId) {
      setOverlay('editor');
      setPendingOverlayId(null);
    }
  }, [pendingOverlayId, selectedWithPreviews]);

  // Sync form fields when selecting a PREVIEW event
  // (regular events are handled by the earlier effect at line ~292)
  useEffect(() => {
    if (selectedId?.startsWith('preview-') && selectedWithPreviews) {
      setEditDate(selectedWithPreviews.date);
      setEditTime(selectedWithPreviews.time ?? '');
      setEditTitle(selectedWithPreviews.title);
      setEditDescription(selectedWithPreviews.description ?? '');
    }
  }, [selectedId, selectedWithPreviews]);

  useEffect(() => {
    if (reviewEvent) {
      setEditDate(reviewEvent.date ?? '');
      setEditTime(reviewEvent.time ?? '');
      setEditTitle(reviewEvent.title ?? '');
      setEditDescription(reviewEvent.description ?? '');
    }
  }, [reviewEvent, setEditDate, setEditTime, setEditTitle, setEditDescription]);

  // Navigation actions
  const openCreate = useCallback(() => {
    setSelectedId(undefined);
    setEditDate('');
    setEditTitle('');
    setEditDescription('');
    setOverlay('editor');
    setActiveNavItem('create');
  }, []);

  // Event navigation functions are now in useEventSelection hook

  const createNewEvent = useCallback(() => {
    setSelectedId(undefined);
    setEditDate('');
    setEditTime('');
    setEditTitle('');
    setEditDescription('');
    // Keep the overlay open so user can create the new event
  }, []);

  const closeOverlay = useCallback(() => {
    setOverlay(null);
    setActiveNavItem(null);
  }, []);

  // Import/Export overlay toggle
  const openImportExport = useCallback(() => {
    setOverlay(overlay === 'import-export' ? null : 'import-export');
    setActiveNavItem('import-export');
  }, [overlay]);

  const handleReviewEventClick = useCallback(
    (eventData: Event, onSaveEdits: (edits: Partial<Event>) => void) => {
      setReviewEvent(eventData);
      setReviewEventSaveHandler(() => onSaveEdits);
      setSelectedId(undefined);
      setPendingOverlayId(null);
      setOverlay('editor');
    },
    [setOverlay, setPendingOverlayId, setSelectedId]
  );

  const toggleReviewPanel = useCallback(() => {
    setShowReviewPanel(prev => !prev);
  }, []);

  const handleSessionStarted = useCallback(() => {
    setShowReviewPanel(true);
  }, []);

  // Stream View toggle
  const openStreamView = useCallback(() => {
    setStreamViewerOpen(true);
  }, []);

  // Handle Stream View event click - zoom to event on timeline
  const handleStreamEventClick = useCallback((event: Event) => {
    // Parse the event date and calculate normalized position
    const eventDate = new Date(event.date);
    const minDate = Math.min(...events.map(e => new Date(e.date).getTime()));
    const maxDate = Math.max(...events.map(e => new Date(e.date).getTime()));
    const range = maxDate - minDate || 1;
    const normalizedPos = (eventDate.getTime() - minDate) / range;

    // Zoom to a window around the event (20% of timeline centered on event)
    const windowSize = 0.2;
    const start = Math.max(0, normalizedPos - windowSize / 2);
    const end = Math.min(1, start + windowSize);
    animateTo(start, end);

    // Also select the event
    setSelectedId(event.id);
  }, [events, animateTo]);

  // Handle focus event from Review Panel - scroll to event on timeline
  const handleFocusEvent = useCallback((eventId: string) => {
    // Find the event in existing events or session events
    const event = events.find(e => e.id === eventId);
    if (!event) {
      console.warn('[handleFocusEvent] Event not found:', eventId);
      return;
    }

    // Parse the event date and calculate normalized position
    const eventDate = new Date(event.date);
    const minDate = Math.min(...events.map(e => new Date(e.date).getTime()));
    const maxDate = Math.max(...events.map(e => new Date(e.date).getTime()));
    const range = maxDate - minDate || 1;
    const normalizedPos = (eventDate.getTime() - minDate) / range;

    // Zoom to a window around the event (20% of timeline centered on event)
    const windowSize = 0.15;
    const start = Math.max(0, normalizedPos - windowSize / 2);
    const end = Math.min(1, start + windowSize);
    animateTo(start, end);

    // Also select the event to highlight it
    setSelectedId(eventId);
  }, [events, animateTo]);

  // Editor-specific navigation items (context section)
  // v0.5.6 - Simplified: Create (owner only), Lock indicator (read-only)
  const editorItems: NavigationItem[] = useMemo(() => {
    const items: NavigationItem[] = [];

    // Only show Create button if not in read-only mode
    if (!isReadOnly) {
      items.push({
        id: 'create',
        label: 'Create',
        icon: <AddIcon fontSize="small" />,
        shortcut: 'Alt+C',
        onClick: openCreate,
        color: 'primary.main',
        'data-tour': 'add-event',
      });
    }

    // Show Lock indicator for read-only mode (non-clickable visual indicator)
    if (isReadOnly) {
      items.push({
        id: 'read-only',
        label: 'View Only',
        icon: 'lock',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onClick: () => {}, // Indicator only - no action
        color: '#f97316', // Orange to indicate restriction
      });
    }

    // Stream View button - available in all modes
    items.push({
      id: 'stream-view',
      label: 'Stream View',
      icon: 'view_stream',
      shortcut: 'Alt+S',
      onClick: openStreamView,
      isActive: streamViewerOpen,
      'data-tour': 'stream-view',
    });

    // Import/Export button - available to any signed-in user
    if (firebaseUser) {
      items.push({
        id: 'import-export',
        label: 'Import/Export',
        icon: 'sync_alt',
        shortcut: 'Alt+I',
        onClick: openImportExport,
        isActive: overlay === 'import-export',
      });
    }

    return items;
  }, [overlay, openCreate, isReadOnly, openStreamView, streamViewerOpen, openImportExport, firebaseUser, chatPanelOpen]);

  // Current user profile from Firestore (firebaseUser already declared above)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Load user profile from Firestore
  useEffect(() => {
    async function loadUser() {
      if (firebaseUser) {
        const userProfile = await getUser(firebaseUser.uid);
        setCurrentUser(userProfile);
      } else {
        setCurrentUser(null);
      }
    }
    loadUser();
  }, [firebaseUser]);

  // Help handler - starts the editor tour
  const handleHelpClick = useCallback(() => {
    startTour('editor-tour');
  }, [startTour]);

  // Share URL for the current timeline
  const shareUrl = useMemo(() => {
    if (!currentTimeline) return '';
    const pathParts = window.location.pathname.split('/');
    const username = pathParts[1];
    return `${window.location.origin}/${username}/timeline/${currentTimeline.id}`;
  }, [currentTimeline]);

  // Get context-aware navigation configuration
  const { sections } = useNavigationConfig(currentUser?.id, editorItems, currentUser, handleHelpClick);

  // Command palette commands
  const commands: Command[] = useMemo(() => [
    {
      id: 'create-event',
      title: 'Create New Event',
      description: 'Add a new event to the timeline',
      icon: 'add_circle',
      shortcut: 'Alt+C',
      category: 'create',
      action: openCreate,
      aliases: ['new', 'add', 'create'],
    },
    {
      id: 'toggle-theme',
      title: 'Toggle Theme',
      description: 'Switch between light and dark themes',
      icon: 'palette',
      shortcut: 'Alt+T',
      category: 'theme',
      action: toggleTheme,
      aliases: ['theme', 'dark', 'light'],
    },
    {
      id: 'close-overlay',
      title: 'Close Panel',
      description: 'Close the currently open panel',
      icon: 'close',
      shortcut: 'Escape',
      category: 'navigation',
      action: closeOverlay,
      aliases: ['close', 'hide', 'dismiss'],
    },
  ], [openCreate, toggleTheme, closeOverlay]);

  // Keyboard shortcuts
  useNavigationShortcuts({
    openCreate,
    toggleTheme,
    closeOverlay,
    openAIChat: () => setChatPanelOpen(true),
  });

  useCommandPaletteShortcuts(() => setCommandPaletteOpen(true));

  // Update active nav item based on overlay
  useEffect(() => {
    if (showReviewPanel) {
      setActiveNavItem('review');
      return;
    }

    switch (overlay) {
      case 'editor':
        setActiveNavItem('create');
        break;
      case 'import-export':
        setActiveNavItem('import-export');
        break;
      default:
        setActiveNavItem(null);
    }
  }, [overlay, showReviewPanel]);

  return (
    <ImportSessionProvider timelineId={sessionTimelineId} ownerId={sessionOwnerId}>
      <>
        {/* Bridge component to process AI event actions via ImportSession */}
        <AIEventBridge
          aiActions={pendingAIEventActions}
          existingEvents={events}
          onProcessed={clearPendingAIEventActions}
        />
        <EditorTour />
      <div className="min-h-screen transition-theme" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}>
        {/* Full-bleed canvas area - no header, maximum space */}
        <div className="relative h-screen">
        {/* Enhanced Navigation Rail - Always visible (hidden in embed mode) */}
        {!embed && (
        <aside className="absolute left-0 top-0 bottom-0 w-14 border-r z-[60] flex flex-col items-center py-2" style={{ borderColor: 'var(--color-border-primary)', backgroundColor: 'var(--color-surface-elevated)' }}>
          {/* PowerTimeline logo at top - clickable to go home */}
          <button
            onClick={() => navigate('/browse')}
            className="mb-4 p-1 text-center hover:opacity-80 transition-opacity cursor-pointer"
            title="Go to Home"
          >
            <TimelineIcon sx={{ fontSize: 28, color: 'var(--page-accent)' }} />
          </button>

          {/* Read-only lock icon - shown in read-only mode */}
          {readOnly && (
            <Tooltip title="You are viewing in read-only mode. Sign in to edit your own timelines, or fork this timeline to make your own copy." placement="right">
              <div className="mb-4 p-2 text-gray-400" aria-label="Read-only mode">
                <span className="material-symbols-rounded text-xl" aria-hidden="true">lock</span>
              </div>
            </Tooltip>
          )}

          {/* Context-Aware Navigation */}
          <NavigationRail
            sections={sections}
            activeItemId={activeNavItem || undefined}
            onReviewClick={toggleReviewPanel}
          />

          {/* Bottom actions */}
          <div className="flex flex-col items-center gap-2 mt-auto">
            <button
              type="button"
              title={showInfoPanels ? 'Hide Info Panels' : 'Show Info Panels'}
              onClick={() => setShowInfoPanels(!showInfoPanels)}
              className={`material-symbols-rounded rounded-md p-2.5 min-w-11 min-h-11 transition-theme ${showInfoPanels ? 'bg-primary-50 text-primary-700' : ''}`}
              style={{ color: showInfoPanels ? undefined : 'var(--color-text-secondary)', backgroundColor: showInfoPanels ? undefined : 'transparent' }}
              onMouseEnter={(e) => !showInfoPanels && (e.currentTarget.style.backgroundColor = 'var(--color-surface-elevated)')}
              onMouseLeave={(e) => !showInfoPanels && (e.currentTarget.style.backgroundColor = 'transparent')}
              aria-pressed={showInfoPanels}
              aria-label="Toggle info panels"
            >
              <span aria-hidden="true">info</span>
            </button>
            <ThemeToggleButton />
          </div>
        </aside>
        )}

        {/* Overlays next to the sidebar, never covering it */}
        {overlay && !loadError && (
          <div ref={overlayRef} className="absolute top-0 right-0 bottom-0 left-14 z-[80]" onClick={(e) => { if (e.target === e.currentTarget) setOverlay(null); }}>
            <div className="absolute top-0 right-0 bottom-0 left-14 z-10 pointer-events-none" aria-hidden="true" />
            {overlay === 'editor' && (
              <ErrorBoundary>
                <Suspense fallback={<div className="fixed right-0 top-0 bottom-0 w-96 border-l flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-primary)' }}>Loading...</div>}>
                  <AuthoringOverlay
                    selected={authoringSelected}
                    isNewEvent={isNewAuthoringEvent}
                    editDate={editDate}
                    editTime={editTime}
                    editTitle={editTitle}
                    editDescription={editDescription}
                    setEditDate={setEditDate}
                    setEditTime={setEditTime}
                    setEditTitle={setEditTitle}
                    setEditDescription={setEditDescription}
                    onSave={isReviewEventActive ? handleReviewSave : saveAuthoring}
                    onDelete={deleteSelected}
                    onClose={() => setOverlay(null)}
                    allEvents={events}
                    onNavigatePrev={navigateToPreviousEvent}
                    onNavigateNext={navigateToNextEvent}
                    onSelectEvent={selectEvent}
                    onCreateNew={createNewEvent}
                    isOwner={isOwner}
                    onViewOnCanvas={() => {
                      // Close editor and zoom to the selected event on canvas
                      if (selectedWithPreviews) {
                        handleStreamEventClick(selectedWithPreviews);
                      }
                      setOverlay(null);
                    }}
                    onOpenStreamView={() => {
                      // Close editor and open stream view
                      setOverlay(null);
                      setStreamViewerOpen(true);
                    }}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
            {overlay === 'import-export' && currentTimeline && (
              <ErrorBoundary>
                <Suspense fallback={<div className="fixed left-14 top-0 bottom-0 w-80 border-r flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-primary)' }}>Loading...</div>}>
                  <ImportExportOverlay
                    timeline={currentTimeline}
                    events={events}
                    dragging={dragging}
                    onClose={() => setOverlay(null)}
                    onSessionStarted={handleSessionStarted}
                    onImport={async (importedEvents) => {
                      // Update local state optimistically
                      setEvents(importedEvents);

                      // Persist to Firestore if this is a Firestore timeline
                      if (timelineId && currentTimeline?.ownerId) {
                        try {
                          // Batch import: add each event individually
                          // Note: This replaces all events - first delete existing, then add new ones
                          // For now, we'll just set the events array and let the user know
                          // A proper implementation would need batch delete + batch add
                          console.warn('Import for Firestore timelines: implement batch operations');
                          // TODO: Implement proper batch import with deleteEvent + addEvent
                        } catch (error) {
                          console.error('Failed to import events to Firestore:', error);
                          throw error;
                        }
                      } else {
                        // Save to legacy storage for non-Firestore timelines
                        saveEventsToStorage(importedEvents);
                      }
                    }}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
        )}

        {showReviewPanel && (
          <div
            className="fixed left-14 top-0 bottom-0 w-96 border-r z-[90]"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-primary)' }}
          >
            <Suspense fallback={<div className="h-full flex items-center justify-center">Loading...</div>}>
              <ReviewPanelContainer
                onClose={() => setShowReviewPanel(false)}
                onOpenReviewEvent={handleReviewEventClick}
                onCommit={loadTimelineEvents}
                onFocusEvent={handleFocusEvent}
              />
            </Suspense>
          </div>
        )}

        <SessionEventMerge events={eventsWithPreviews}>
          {(mergedEvents) => (
            <>
              {/* Timeline minimap positioned fixed to ensure proper z-index layering above overlays */}
              {!loadError && mergedEvents.length > 0 && (
                <div className={`fixed top-1 left-20 right-4 pointer-events-auto ${streamViewerOpen ? 'z-[1400]' : 'z-[50]'}`} data-tour="minimap" data-testid="minimap-container">
                  <Suspense fallback={<div className="h-8 bg-gray-200 rounded animate-pulse"></div>}>
                    <TimelineMinimap
                      events={mergedEvents}
                      viewStart={viewStart}
                      viewEnd={viewEnd}
                      onNavigate={setWindow}
                      highlightedEventId={selectedId}
                      hoveredEventId={hoveredEventId}
                    />
                  </Suspense>
                </div>
              )}

              {/* Main timeline area shifts right to avoid sidebar overlap */}
              <div className="absolute inset-0 ml-14" data-testid="timeline-container">
          {loadError ? (
            <div className="w-full h-full flex items-center justify-center px-4">
              <ErrorState
                message="Failed to load timeline"
                description={loadError.message}
                onRetry={loadTimelineEvents}
              />
            </div>
          ) : (
            <div
              ref={timelineContainerRef}
              className="w-full h-full relative"
              onMouseDown={handleTimelineMouseDownWithSelection}
              onMouseMove={handleTimelineMouseMove}
              data-testid="timeline-canvas"
              style={{
                cursor: timelineSelection?.isPanning
                  ? 'grabbing'
                  : timelineSelection?.isSelecting
                    ? 'crosshair'
                    : spaceKeyHeld
                      ? 'grab'
                      : 'crosshair'
              }}
            >
              <ErrorBoundary>
                <DeterministicLayoutComponent
                  events={mergedEvents}
                  showInfoPanels={showInfoPanels}
                  viewStart={viewStart}
                  viewEnd={viewEnd}
                  hoveredEventId={hoveredEventId}
                  isPanning={isPanning}
                  onCardDoubleClick={(id) => {
                    // Allow ALL users to open overlay - AuthoringOverlay handles view vs edit mode
                    // Use pending pattern to ensure selectedWithPreviews is ready before overlay opens
                    setSelectedId(id);
                    setPendingOverlayId(id);
                  }}
                  onCardMouseEnter={handleStreamEventMouseEnter}
                  onCardMouseLeave={handleStreamEventMouseLeave}
                  selectedEventId={selectedId}
                  onEventSelect={setSelectedId}
                />
              </ErrorBoundary>

              {/* Empty-state guidance for owners of a 0-event timeline (G6.5).
                  Presentational overlay only — does not affect layout/positioning.
                  pointer-events pass through the container so panning still works. */}
              {!isReadOnly && events.length === 0 && (
                <div
                  data-testid="editor-empty-state"
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ zIndex: 15 }}
                >
                  <div className="pointer-events-auto text-center px-6" style={{ maxWidth: 360, transform: 'translateY(-8%)' }}>
                    <div
                      className="mx-auto mb-4 flex items-center justify-center"
                      style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(91,91,214,0.10)' }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 34, color: '#5b5bd6' }}>timeline</span>
                    </div>
                    <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--page-text-primary)', letterSpacing: '-0.01em' }}>
                      Your timeline is empty
                    </h2>
                    <p className="text-sm mb-5" style={{ color: 'var(--page-text-secondary)' }}>
                      Add your first event to start building the story.
                    </p>
                    <button
                      onClick={openCreate}
                      data-testid="empty-state-add-event"
                      className="inline-flex items-center gap-2 font-semibold rounded-xl px-5 py-2.5 text-white transition-colors"
                      style={{ background: '#5b5bd6', boxShadow: '0 6px 18px -6px rgba(91,91,214,0.5)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#4a4ac8')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#5b5bd6')}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 20 }}>add</span>
                      Add your first event
                    </button>
                    <div className="mt-3">
                      <button onClick={openImportExport} className="text-sm font-medium" style={{ color: 'var(--page-accent)' }}>
                        or import a timeline
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline selection overlay */}
              {timelineSelection?.isSelecting && (
                <div
                  className="absolute pointer-events-none z-30 transition-all duration-75 ease-out"
                  data-testid="selection-overlay"
                  style={{
                    left: Math.min(timelineSelection.startX, timelineSelection.currentX),
                    top: 0,
                    width: Math.abs(timelineSelection.currentX - timelineSelection.startX),
                    height: '100%',
                    background: 'linear-gradient(180deg, color-mix(in srgb, var(--page-accent) 25%, transparent) 0%, color-mix(in srgb, var(--page-accent) 15%, transparent) 100%)',
                    border: '2px solid var(--page-accent)',
                    borderRadius: '4px',
                    boxShadow: '0 0 15px color-mix(in srgb, var(--page-accent) 50%, transparent)'
                  }}
                >
                  {/* Left edge indicator */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-lg"
                    style={{ marginLeft: '-1px' }}
                  />
                  {/* Right edge indicator */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 shadow-lg"
                    style={{ marginRight: '-1px' }}
                  />
                  {/* Selection info overlay */}
                  <div className="absolute top-1 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-lg font-mono">
                    Select to Zoom
                  </div>
                </div>
              )}

              {/* Share button and user profile - top-right corner */}
              {currentTimeline && !embed && (
                <div
                  className="absolute top-20 right-4 z-20 flex flex-col items-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Share Menu - replaces single share button */}
                  <ShareMenu
                    url={shareUrl}
                    title={currentTimeline.title}
                    description={currentTimeline.description}
                    onEmbedClick={() => setEmbedDialogOpen(true)}
                  />

                  {/* User Profile Button - only when logged in */}
                  {firebaseUser && (
                    <UserProfileMenu
                      onLogout={async () => {
                        await signOut();
                        navigate('/');
                      }}
                    />
                  )}
                </div>
              )}

              {/* Icon-based control bar (hidden in embed mode) */}
              {!embed && <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[60] transition-opacity duration-200 opacity-20 hover:opacity-95" data-tour="zoom-controls" data-testid="zoom-controls">
                <div className="backdrop-blur-sm border rounded-xl shadow-xl px-3 py-2 flex gap-1 items-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-primary)', opacity: 0.95 }}>
                  <Tooltip title="Pan left" placement="top"><IconButton size="small" color="default" onClick={() => nudge(-0.1)} sx={{ minWidth: '44px', minHeight: '44px' }} aria-label="Pan left"><span className="material-symbols-rounded" aria-hidden="true">chevron_left</span></IconButton></Tooltip>
                  <Tooltip title="Pan right" placement="top"><IconButton size="small" color="default" onClick={() => nudge(0.1)} sx={{ minWidth: '44px', minHeight: '44px' }} aria-label="Pan right"><span className="material-symbols-rounded" aria-hidden="true">chevron_right</span></IconButton></Tooltip>
                  <div className="w-px h-6 mx-1" style={{ backgroundColor: 'var(--color-border-primary)' }}></div>
                  <Tooltip title="Zoom in" placement="top"><IconButton data-testid="btn-zoom-in" size="small" color="primary" onClick={handleZoomIn} sx={{ minWidth: '44px', minHeight: '44px' }} aria-label="Zoom in"><AddIcon fontSize="small" aria-hidden="true" /></IconButton></Tooltip>
                  <Tooltip title="Zoom out" placement="top"><IconButton data-testid="btn-zoom-out" size="small" color="default" onClick={handleZoomOut} sx={{ minWidth: '44px', minHeight: '44px' }} aria-label="Zoom out"><RemoveIcon fontSize="small" aria-hidden="true" /></IconButton></Tooltip>
                  <div className="w-px h-6 mx-1" style={{ backgroundColor: 'var(--color-border-primary)' }}></div>
                  <Tooltip title="Fit all" placement="top"><IconButton data-testid="btn-fit-all" size="small" color="info" onClick={() => { animateTo(0, 1); }} sx={{ minWidth: '44px', minHeight: '44px' }} aria-label="Fit all"><FitScreenIcon fontSize="small" aria-hidden="true" /></IconButton></Tooltip>
                </div>
              </div>}
            </div>
          )}
              </div>
            </>
          )}
        </SessionEventMerge>

        {/* Command Palette (hidden in embed mode) */}
        {!embed && (
          <Suspense fallback={null}>
            <CommandPalette
              isOpen={commandPaletteOpen}
              onClose={() => setCommandPaletteOpen(false)}
              commands={commands}
              placeholder="Search commands... (Ctrl+K)"
            />
          </Suspense>
        )}

        {/* Embed Code Dialog */}
        {currentTimeline && (
          <EmbedCodeDialog
            open={embedDialogOpen}
            onClose={() => setEmbedDialogOpen(false)}
            embedUrl={(() => {
              const pathParts = window.location.pathname.split('/');
              const username = pathParts[1];
              return buildEmbedUrl(username, currentTimeline.id);
            })()}
            title={currentTimeline.title}
          />
        )}

        {/* Stream Viewer Overlay (v0.5.26) - mobile-friendly timeline view */}
        <Suspense fallback={null}>
          <StreamViewerOverlay
            open={streamViewerOpen}
            onClose={() => setStreamViewerOpen(false)}
            events={events}
            timelineTitle=""
            onEventClick={handleStreamEventClick}
            isOwner={isOwner}
            onEventSave={handleEventSave}
            onEventDelete={handleEventDelete}
            onEditInEditor={(event) => {
              setSelectedId(event.id);
              setOverlay('editor');
            }}
            initialEventId={selectedId}
            onEventMouseEnter={handleStreamEventMouseEnter}
            onEventMouseLeave={handleStreamEventMouseLeave}
          />
        </Suspense>

        {/* AI Chat Widget (v0.7.0) - Floating bottom-right, only for timeline owners */}
        {firebaseUser && isOwner && (
          <div className="fixed bottom-4 right-4 z-[200] flex flex-col items-end gap-3">
            {/* Chat popup - appears above the button when open */}
            {chatPanelOpen && (
              <Suspense fallback={null}>
                <div
                  className="w-80 h-[500px] max-h-[70vh] rounded-xl shadow-2xl overflow-hidden border"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border-primary)'
                  }}
                >
                  <ChatPanelContainer
                    aiSession={aiSession}
                    timelineTitle={currentTimeline?.title}
                    timelineDescription={currentTimeline?.description}
                    onOpenReviewPanel={() => setShowReviewPanel(true)}
                    onClose={() => setChatPanelOpen(false)}
                  />
                </div>
              </Suspense>
            )}

            {/* Floating action button */}
            <Tooltip title={chatPanelOpen ? "Close AI Assistant" : "AI Assistant"} placement="left">
              <IconButton
                onClick={() => setChatPanelOpen(prev => !prev)}
                aria-label={chatPanelOpen ? 'Close AI chat' : 'Open AI chat'}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: chatPanelOpen ? 'var(--page-bg-elevated)' : 'var(--page-accent)',
                  color: chatPanelOpen ? 'var(--page-text-primary)' : '#ffffff',
                  boxShadow: '0 4px 20px color-mix(in srgb, var(--page-accent) 40%, transparent)',
                  '&:hover': {
                    bgcolor: chatPanelOpen ? 'var(--page-bg)' : 'var(--page-accent)',
                    filter: 'brightness(1.1)',
                    transform: 'scale(1.05)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 28 }} aria-hidden="true">
                  {chatPanelOpen ? 'close' : 'smart_toy'}
                </span>
              </IconButton>
            </Tooltip>
          </div>
        )}

        {/* Live region for announcements */}
        {renderLiveRegion()}
        </div>
      </div>
      </>
    </ImportSessionProvider>
  );
}

// Wrapper component that provides TourProvider
function App(props: AppProps) {
  return (
    <TourProvider>
      <AppContent {...props} />
    </TourProvider>
  );
}

export default App;




