/**
 * HomePage - Landing page with search, user workspace, and discovery feeds
 * Implements requirements from docs/SRS_HOME_PAGE.md (v0.4.0)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { browseUrl, OG_IMAGE_URL } from '../utils/urls';
import { webSiteSchema } from '../utils/jsonLd';
import { formatDateSafe } from '../lib/time';
import type { TimelineMetadata, User } from '../types';
import {
  getTimeline,
  getTimelines,
  getUser,
  getPlatformStats,
  getUserTimelinesPage,
  searchUsersByUsername,
  type TimelinePageCursor,
} from '../services/firestore';
import { signOutUser } from '../services/auth';
import { downloadTimelineAsYaml } from '../services/timelineImportExport';
import { NavigationRail, ThemeToggleButton } from '../components/NavigationRail';
import { BottomNavigation } from '../components/BottomNavigation';
import { useNavigationConfig } from '../app/hooks/useNavigationConfig';
import { UserProfileMenu } from '../components/UserProfileMenu';
import { useAuth } from '../contexts/AuthContext';
import { CreateTimelineDialog } from '../components/CreateTimelineDialog';
import { ImportTimelineDialog } from '../components/ImportTimelineDialog';
import { EditTimelineDialog } from '../components/EditTimelineDialog';
import { DeleteTimelineDialog } from '../components/DeleteTimelineDialog';
import { TimelineCardMenu } from '../components/TimelineCardMenu';
import { UserAvatar } from '../components/UserAvatar';
import { useToast } from '../contexts/ToastContext';
import { SkeletonCard } from '../components/SkeletonCard';
import { ErrorState } from '../components/ErrorState';
import { TourProvider, HomePageTour, useTour } from '../components/tours';
import { useDebounce } from '../hooks/useDebounce';

const MY_TIMELINES_PAGE_SIZE = 12;

// Inner component that uses the tour context
function HomePageContent() {
  const navigate = useNavigate();
  const { user: firebaseUser } = useAuth();
  const { startTour } = useTour();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [myTimelines, setMyTimelines] = useState<TimelineMetadata[]>([]);
  const [myTimelinesCursor, setMyTimelinesCursor] = useState<TimelinePageCursor | null>(null);
  const [myTimelinesHasMore, setMyTimelinesHasMore] = useState(false);
  const [loadingMoreMyTimelines, setLoadingMoreMyTimelines] = useState(false);
  const [recentlyEdited, setRecentlyEdited] = useState<TimelineMetadata[]>([]);
  const [popular, setPopular] = useState<TimelineMetadata[]>([]);
  const [featured, setFeatured] = useState<TimelineMetadata[]>([]);
  const [stats, setStats] = useState({
    timelineCount: 0,
    userCount: 0,
    eventCount: 0,
    viewCount: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    timelines: TimelineMetadata[];
    users: User[];
    hasMore: boolean;
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTimelineId, setEditTimelineId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTimelineId, setDeleteTimelineId] = useState<string | null>(null);

  // Toast notifications
  const { showSuccess, showError } = useToast();

  // Search input ref for keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Help handler - starts the home page tour
  const handleHelpClick = useCallback(() => {
    startTour('home-tour');
  }, [startTour]);

  // Get navigation configuration
  const { sections } = useNavigationConfig(currentUser?.id, undefined, currentUser, handleHelpClick);

  // Loading state for timeline data
  const [loadingTimelines, setLoadingTimelines] = useState(true);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not already in an input/textarea
      if (e.key === '/' &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter out private timelines from discovery feeds (only show public)
  const filterPublicTimelines = useCallback(
    (timelines: TimelineMetadata[]) => timelines.filter(t => (t.visibility ?? 'public') === 'public'),
    []
  );

  const searchResultButtonStyle: CSSProperties = {
    backgroundColor: 'transparent',
    '--pt-button-bg': 'transparent',
    '--pt-button-bg-hover': 'var(--page-bg)',
    '--pt-button-bg-active': 'color-mix(in srgb, var(--page-bg) 88%, var(--page-text-secondary) 12%)',
    '--pt-button-border': 'transparent',
    '--pt-button-border-hover': 'var(--card-border)',
    '--pt-button-color': 'var(--page-text-primary)',
    '--pt-button-color-hover': 'var(--page-text-primary)',
    '--pt-button-shadow-hover': 'none',
    '--pt-button-shadow-active': 'none',
  } as CSSProperties;

  const accentButtonStyle: CSSProperties = {
    '--pt-button-bg': 'var(--page-accent)',
    '--pt-button-bg-hover': 'var(--page-accent-hover)',
    '--pt-button-bg-active': 'var(--page-accent-hover)',
    '--pt-button-border': 'var(--page-accent)',
    '--pt-button-border-hover': 'var(--page-accent-hover)',
    '--pt-button-color': '#ffffff',
    '--pt-button-color-hover': '#ffffff',
  } as CSSProperties;

  const secondaryButtonStyle: CSSProperties = {
    '--pt-button-bg': 'var(--card-bg)',
    '--pt-button-bg-hover': 'color-mix(in srgb, var(--page-accent) 8%, var(--card-bg))',
    '--pt-button-bg-active': 'color-mix(in srgb, var(--page-accent) 12%, var(--card-bg))',
    '--pt-button-border': 'var(--card-border)',
    '--pt-button-border-hover': 'var(--card-border-hover)',
    '--pt-button-color': 'var(--page-text-primary)',
    '--pt-button-color-hover': 'var(--page-accent)',
    '--pt-button-shadow-hover': 'none',
    '--pt-button-shadow-active': 'none',
  } as CSSProperties;

  const refreshMyTimelines = useCallback(async () => {
    if (!firebaseUser) {
      setMyTimelines([]);
      setMyTimelinesCursor(null);
      setMyTimelinesHasMore(false);
      return;
    }

    const { timelines, cursor } = await getUserTimelinesPage({
      ownerId: firebaseUser.uid,
      orderByField: 'updatedAt',
      orderDirection: 'desc',
      limitCount: MY_TIMELINES_PAGE_SIZE,
    });

    setMyTimelines(timelines);
    setMyTimelinesCursor(cursor);
    setMyTimelinesHasMore(timelines.length === MY_TIMELINES_PAGE_SIZE);
  }, [firebaseUser]);

  const loadData = useCallback(async () => {
    setLoadingTimelines(true);
    setError(null);
    try {
      // v0.8.12 - Two-batch loading pattern for mobile network reliability
      // Batch 1: Critical user data (fast, low bandwidth)
      const [userProfile, platformStats] = await Promise.all([
        // 1. Load current user profile from Firestore if authenticated
        firebaseUser ? getUser(firebaseUser.uid) : Promise.resolve(null),
        // 2. Load platform statistics (cached, fast)
        getPlatformStats(),
      ]);

      // Batch 2: Discovery feeds (can wait, reduces connection pressure on mobile)
      const [recentTimelines, popularTimelines] = await Promise.all([
        // 3. Load recently edited timelines for discovery
        getTimelines({
          orderByField: 'updatedAt',
          orderDirection: 'desc',
          limitCount: 12,
        }),
        // 4. Load popular timelines for discovery
        getTimelines({
          orderByField: 'viewCount',
          orderDirection: 'desc',
          limitCount: 12,
        }),
      ]);

      // Update state with parallel results
      setCurrentUser(userProfile);
      setStats({
        timelineCount: platformStats.totalTimelines,
        userCount: platformStats.totalUsers,
        eventCount: platformStats.totalEvents,
        viewCount: platformStats.totalViews,
      });
      setRecentlyEdited(filterPublicTimelines(recentTimelines).slice(0, 6));
      setPopular(filterPublicTimelines(popularTimelines).slice(0, 6));

      // Load user's timelines (separate call - depends on firebaseUser being valid)
      await refreshMyTimelines();

      // Note: Featured timelines functionality to be removed per PLAN.md known issues
      setFeatured([]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error : new Error('Failed to load timelines'));
      showError('Error loading timelines');
    } finally {
      setLoadingTimelines(false);
    }
  }, [firebaseUser, filterPublicTimelines, refreshMyTimelines, showError]);

  // Load data on mount and when firebaseUser changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLoadMoreMyTimelines = useCallback(async () => {
    if (!firebaseUser || loadingMoreMyTimelines || !myTimelinesHasMore) {
      return;
    }

    setLoadingMoreMyTimelines(true);
    try {
      const { timelines, cursor } = await getUserTimelinesPage({
        ownerId: firebaseUser.uid,
        orderByField: 'updatedAt',
        orderDirection: 'desc',
        limitCount: MY_TIMELINES_PAGE_SIZE,
        startAfterDoc: myTimelinesCursor,
      });

      setMyTimelines(prev => [...prev, ...timelines]);
      setMyTimelinesCursor(cursor);
      setMyTimelinesHasMore(timelines.length === MY_TIMELINES_PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more timelines:', error);
      showError('Error loading more timelines');
    } finally {
      setLoadingMoreMyTimelines(false);
    }
  }, [firebaseUser, loadingMoreMyTimelines, myTimelinesCursor, myTimelinesHasMore, showError]);

  const handleCreateTimeline = () => {
    setCreateDialogOpen(true);
  };

  const handleImportTimeline = () => {
    setImportDialogOpen(true);
  };

  const handleCreateSuccess = async (timelineId: string) => {
    showSuccess('Timeline created successfully!');

    // Refresh timeline lists
    if (firebaseUser) {
      try {
        await refreshMyTimelines();
      } catch (error) {
        console.error('Error refreshing timelines after create:', error);
        showError('Error refreshing timelines');
      }
    }

    const recentTimelines = await getTimelines({
      orderByField: 'updatedAt',
      orderDirection: 'desc',
      limitCount: 12,
    });
    setRecentlyEdited(filterPublicTimelines(recentTimelines).slice(0, 6));

    // Navigate to the new timeline using username-based URL
    // Note: URL pattern is /:username/timeline/:id (no @ prefix - React Router v7 bug)
    const timeline = await getTimeline(timelineId);
    if (timeline && currentUser) {
      navigate(`/${currentUser.username}/timeline/${timeline.id}`);
    }
  };

  const handleEditTimeline = (timelineId: string) => {
    setEditTimelineId(timelineId);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = async () => {
    showSuccess('Timeline updated successfully!');

    // Refresh timeline lists
    if (firebaseUser) {
      try {
        await refreshMyTimelines();
      } catch (error) {
        console.error('Error refreshing timelines after edit:', error);
        showError('Error refreshing timelines');
      }
    }

    const recentTimelines = await getTimelines({
      orderByField: 'updatedAt',
      orderDirection: 'desc',
      limitCount: 12,
    });
    setRecentlyEdited(filterPublicTimelines(recentTimelines).slice(0, 6));
  };

  const handleDeleteTimeline = (timelineId: string) => {
    setDeleteTimelineId(timelineId);
    setDeleteDialogOpen(true);
  };

  // v0.5.27: Export timeline to YAML
  const handleExportTimeline = async (timelineId: string) => {
    try {
      const timeline = await getTimeline(timelineId);
      if (timeline) {
        downloadTimelineAsYaml(timeline);
        showSuccess('Timeline exported as YAML');
      } else {
        showError('Failed to load timeline for export');
      }
    } catch (error) {
      console.error('Export failed:', error);
      showError('Export failed. Please try again.');
    }
  };

  const handleDeleteSuccess = async () => {
    showSuccess('Timeline deleted successfully!');

    // Refresh timeline lists
    if (firebaseUser) {
      try {
        await refreshMyTimelines();
      } catch (error) {
        console.error('Error refreshing timelines after delete:', error);
        showError('Error refreshing timelines');
      }
    }

    const recentTimelines = await getTimelines({
      orderByField: 'updatedAt',
      orderDirection: 'desc',
      limitCount: 12,
    });
    setRecentlyEdited(filterPublicTimelines(recentTimelines).slice(0, 6));

    const popularTimelines = await getTimelines({
      orderByField: 'viewCount',
      orderDirection: 'desc',
      limitCount: 12,
    });
    setPopular(filterPublicTimelines(popularTimelines).slice(0, 6));
  };

  const handleTimelineClick = (timeline: TimelineMetadata) => {
    // v0.5.14: Use username-based URL with fallback to legacy URL
    // v0.8.11: Use denormalized ownerUsername from timeline
    // Note: URL pattern is /:username/timeline/:id (no @ prefix - React Router v7 bug)
    if (timeline.ownerUsername) {
      navigate(`/${timeline.ownerUsername}/timeline/${timeline.id}`);
    } else {
      // Fallback: use legacy URL pattern (EditorPage will handle redirect)
      console.warn(`Owner username not set for timeline ${timeline.id}, using legacy URL`);
      navigate(`/user/${timeline.ownerId}/timeline/${timeline.id}`);
    }
  };

  const handleUserClick = (user: User) => {
    // Note: URL pattern is /:username (no @ prefix - React Router v7 bug)
    navigate(`/${user.username}`);
  };

  // Debounce search query to avoid filtering on every keystroke (P1-2)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Compute timeline search results using debounced query (P1-2)
  // v0.8.11 - User search moved to async Firestore query
  const computedSearchResults = useMemo(() => {
    if (debouncedSearchQuery.trim().length < 2) {
      return null;
    }

    const lowerQuery = debouncedSearchQuery.toLowerCase();

    // Search in already loaded timelines (recently edited + popular)
    const allLoadedTimelines = [...recentlyEdited, ...popular, ...myTimelines];
    const uniqueTimelines = allLoadedTimelines.filter((t, i, arr) =>
      arr.findIndex(x => x.id === t.id) === i
    );

    const matchingTimelines = uniqueTimelines.filter(t =>
      t.title.toLowerCase().includes(lowerQuery) ||
      (t.description && t.description.toLowerCase().includes(lowerQuery))
    );

    return {
      timelines: matchingTimelines.slice(0, 10),
      users: [] as User[],  // Populated by async Firestore search
      hasMore: matchingTimelines.length > 10,
    };
  }, [debouncedSearchQuery, recentlyEdited, popular, myTimelines]);

  // Update search results state when computed results change
  useEffect(() => {
    setSearchResults(computedSearchResults);
  }, [computedSearchResults]);

  // v0.8.11 - Async user search via Firestore (replaces loading all users)
  // This is how major platforms like GitHub/X handle user search
  useEffect(() => {
    if (debouncedSearchQuery.trim().length >= 2) {
      searchUsersByUsername(debouncedSearchQuery, 5).then(users => {
        setSearchResults(prev => prev ? { ...prev, users, hasMore: prev.hasMore || users.length >= 5 } : null);
      }).catch(err => {
        console.error('Error searching users:', err);
      });
    }
  }, [debouncedSearchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  return (
    <>
      <Helmet>
        <title>Browse Timelines | PowerTimeline</title>
        <meta name="description" content="Explore public timelines, discover historical events, and find timelines created by the PowerTimeline community." />
        <link rel="canonical" href={browseUrl()} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={browseUrl()} />
        <meta property="og:title" content="Browse Timelines | PowerTimeline" />
        <meta property="og:description" content="Explore public timelines and discover historical events." />
        <meta property="og:image" content={OG_IMAGE_URL} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={browseUrl()} />
        <meta name="twitter:title" content="Browse Timelines | PowerTimeline" />
        <meta name="twitter:description" content="Explore public timelines and discover historical events." />
        <meta name="twitter:image" content={OG_IMAGE_URL} />

        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify(webSiteSchema())}</script>
      </Helmet>

    <div data-testid="browse-page" className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)' }}>
        <div className="flex">
      {/* Navigation Rail - hidden on mobile, shown on md+ screens */}
      <aside data-tour="nav-rail" className="fixed left-0 top-0 bottom-0 w-14 border-r z-50 hidden md:flex flex-col items-center py-2" role="navigation" aria-label="Main navigation" style={{ borderColor: 'var(--nav-border)', backgroundColor: 'var(--nav-bg)' }}>
        {/* PowerTimeline logo at top - clickable to go home */}
        <button
          onClick={() => navigate('/browse')}
          className="mb-4 p-1 text-center hover:opacity-80 transition-opacity cursor-pointer"
          title="Go to Home"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '28px', color: '#8b5cf6' }}>timeline</span>
        </button>

        {/* Navigation sections */}
        <NavigationRail sections={sections} />

        {/* Bottom utilities */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <ThemeToggleButton />
        </div>
      </aside>

      {/* Main Content Area - full width on mobile, offset on md+ */}
      <div className="flex-1 md:ml-14">
        {/* Header - with mobile logo and navigation */}
        <header className="border-b sticky top-0 z-40" style={{ backgroundColor: 'var(--page-bg-elevated)', borderColor: 'var(--page-border)' }}>
          <div className="px-4 md:px-8 py-3 md:py-4">
            <div className="flex items-center justify-between">
              {/* Brand: Logo + PowerTimeline BETA */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/')}
                  className="p-1 hover:opacity-80 transition-opacity flex items-center gap-2"
                  title="Go to Landing Page"
                  data-testid="logo-button"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '24px', color: '#8b5cf6' }}>timeline</span>
                  <span className="font-bold text-lg" style={{ color: 'var(--page-text-primary)' }}>
                    PowerTimeline
                  </span>
                  <span
                    className="px-2 py-0.5 text-xs font-bold rounded"
                    style={{ backgroundColor: 'rgba(91, 91, 214, 0.12)', color: '#5b5bd6', letterSpacing: '0.05em' }}
                  >
                    BETA
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* Mobile: Theme toggle (since nav rail is hidden) */}
                <div className="md:hidden">
                  <ThemeToggleButton />
                </div>
                {firebaseUser ? (
                  <UserProfileMenu
                    onLogout={async () => {
                      await signOutUser();
                      navigate('/');
                    }}
                  />
                ) : (
                  <button
                    onClick={() => navigate('/login')}
                    className="pt-button px-3 py-1.5 text-sm font-medium rounded-lg"
                    style={accentButtonStyle}
                  >
                    Sign In
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - has-bottom-nav adds padding for mobile bottom navigation */}
        <main className="px-4 md:px-8 py-6 md:py-8 has-bottom-nav">
        <h1 className="sr-only">Browse and Search Timelines</h1>
        {/* Search Bar */}
        <div className="mb-8 relative">
          <div className="relative">
            <label htmlFor="timeline-search" className="sr-only">Search timelines and users</label>
            <span className="absolute left-5 top-1/2 transform -translate-y-1/2 material-symbols-rounded" aria-hidden="true" style={{ color: 'var(--page-text-secondary)' }}>
              search
            </span>
            <input
              id="timeline-search"
              ref={searchInputRef}
              data-testid="browse-search-input"
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search timelines and users..."
              aria-label="Search timelines and users"
              className="w-full pl-14 pr-20 py-4 text-lg border rounded-xl outline-none transition-all shadow-inner"
              style={{
                backgroundColor: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
                color: 'var(--page-text-primary)',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--page-accent)';
                e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.06), 0 0 0 3px var(--input-focus-shadow)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--input-border)';
                e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.06)';
              }}
            />
            {/* Keyboard shortcut hint - hidden on mobile */}
            {!searchQuery && (
              <span
                className="absolute right-12 top-1/2 transform -translate-y-1/2 px-2 py-1 rounded text-xs font-mono hidden md:block"
                style={{
                  backgroundColor: 'var(--page-bg)',
                  color: 'var(--page-text-secondary)',
                  border: '1px solid var(--page-border)',
                }}
              >
                /
              </span>
            )}
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 material-symbols-rounded pt-icon-button"
                aria-label="Clear search"
              >
                close
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults && (
            <div data-testid="browse-search-dropdown" className="absolute top-full mt-2 w-full rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto" style={{ backgroundColor: 'var(--card-bg)', border: '2px solid var(--card-border)' }}>
              {searchResults.timelines.length === 0 && searchResults.users.length === 0 ? (
                <div className="p-6 text-center" style={{ color: 'var(--page-text-secondary)' }}>
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <>
                  {/* Timeline Results */}
                  {searchResults.timelines.length > 0 && (
                    <div className="p-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--page-text-secondary)' }}>
                        Timelines ({searchResults.timelines.length})
                      </h3>
                      <div className="space-y-2">
                        {searchResults.timelines.map(timeline => (
                          <button
                            key={`search-${timeline.id}`}
                            onClick={() => {
                              handleTimelineClick(timeline);
                              clearSearch();
                            }}
                            className="pt-button w-full text-left px-4 py-3 rounded-lg"
                            style={searchResultButtonStyle}
                          >
                            <div className="font-medium" style={{ color: 'var(--page-text-primary)' }}>{timeline.title}</div>
                            <div className="text-sm mt-1" style={{ color: 'var(--page-text-secondary)' }}>
                              {timeline.eventCount} events • by {timeline.ownerId}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Results */}
                  {searchResults.users.length > 0 && (
                    <div className="p-4" style={{ borderTop: '1px solid var(--card-border)' }}>
                      <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--page-text-secondary)' }}>
                        Users ({searchResults.users.length})
                      </h3>
                      <div className="space-y-2">
                        {searchResults.users.map(user => (
                          <button
                            key={user.id}
                            onClick={() => {
                              handleUserClick(user);
                              clearSearch();
                            }}
                            className="pt-button w-full text-left px-4 py-3 rounded-lg flex items-center gap-3"
                            style={searchResultButtonStyle}
                          >
                            <UserAvatar user={user} size="medium" />
                            <div>
                              <div className="font-medium" style={{ color: 'var(--page-text-primary)' }}>@{user.username}</div>
                              <div className="text-sm mt-1" style={{ color: 'var(--page-text-secondary)' }}>{user.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Has More Indicator */}
                  {searchResults.hasMore && (
                    <div className="p-4 text-center text-sm" style={{ borderTop: '1px solid var(--card-border)', color: 'var(--page-text-secondary)' }}>
                      More results available. Continue typing to refine search.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {error ? (
          <div className="py-12">
            <ErrorState
              message="Failed to load timelines"
              description={error.message}
              onRetry={loadData}
            />
          </div>
        ) : (
        <>
        {/* My Timelines Section - Only show when authenticated */}
        {firebaseUser && (
        <section data-testid="my-timelines-section" className="mb-16">
          <div data-tour="my-timelines" className="flex items-center justify-between mb-4">
            <h2 data-testid="my-timelines-heading" className="text-xl font-semibold" style={{ color: 'var(--page-text-primary)' }}>
              My Timelines ({loadingTimelines ? '...' : myTimelines.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                data-testid="import-timeline-button"
                onClick={handleImportTimeline}
                className="pt-button px-4 py-2 rounded-lg font-medium border flex items-center gap-2"
                style={secondaryButtonStyle}
              >
                <span className="material-symbols-rounded text-base">upload_file</span>
                Import
              </button>
              <button
                data-testid="create-timeline-button"
                onClick={handleCreateTimeline}
                className="pt-button px-4 py-2 text-white rounded-lg font-medium"
                style={accentButtonStyle}
              >
                + Create New
              </button>
            </div>
          </div>

          {loadingTimelines ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:justify-items-start">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={`my-timelines-skeleton-${index}`} />
              ))}
            </div>
          ) : myTimelines.length === 0 ? (
            <div
              data-testid="empty-state-cta"
              className="rounded-2xl p-12 md:p-16 text-center relative overflow-hidden"
              style={{
                backgroundColor: 'var(--card-bg)',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
                border: '2px solid var(--card-border)'
              }}
            >
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--page-accent)',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '40px', color: '#ffffff' }}>timeline</span>
                </div>
              </div>

              {/* Heading */}
              <h3
                className="text-2xl md:text-3xl font-bold mb-3"
                style={{ color: 'var(--page-text-primary)' }}
              >
                Create your first timeline
              </h3>

              {/* Subheading */}
              <p
                className="text-base md:text-lg mb-8 max-w-md mx-auto"
                style={{ color: 'var(--page-text-secondary)' }}
              >
                Start telling your story visually.
              </p>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleCreateTimeline}
                  className="pt-button px-6 py-3 text-white rounded-lg font-medium flex items-center gap-2 w-full sm:w-auto"
                  style={accentButtonStyle}
                >
                  <span className="material-symbols-rounded text-base">add</span>
                  Create Timeline
                </button>
                <button
                  onClick={() => startTour('home-tour')}
                  className="pt-button px-6 py-3 rounded-lg font-medium border w-full sm:w-auto"
                  style={secondaryButtonStyle}
                >
                  Take a Tour
                </button>
              </div>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:justify-items-start">
              {myTimelines.map((timeline, index) => (
                <div
                  key={`my-${timeline.id}`}
                  data-tour={index === 0 ? 'timeline-card' : undefined}
                  className="timeline-card card-animate p-5 relative w-full max-w-sm"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                >
                  {/* Kebab menu - always visible */}
                  <div className="absolute top-2 right-2 z-20">
                    <TimelineCardMenu
                      timelineId={timeline.id}
                      ownerId={timeline.ownerId}
                      ownerUsername={currentUser?.username || ''}
                      currentUserId={firebaseUser?.uid}
                      onEdit={handleEditTimeline}
                      onDelete={handleDeleteTimeline}
                      onExport={handleExportTimeline}
                    />
                  </div>

                  {/* Card content - clickable to navigate */}
                  <div
                    onClick={() => handleTimelineClick(timeline)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleTimelineClick(timeline);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    className="cursor-pointer relative flex flex-col h-full min-h-[140px] focus:outline-none focus:ring-2 focus:ring-[var(--page-accent)] focus:ring-offset-2"
                  >
                    <h3 className="font-semibold mb-2 pr-10" style={{ color: 'var(--page-text-primary)' }}>{timeline.title}</h3>
                    <p className="text-sm mb-3 line-clamp-2 flex-grow" style={{ color: 'var(--page-text-secondary)' }}>
                      {timeline.description || 'No description'}
                    </p>
                    <div className="flex items-center justify-between text-sm mt-auto pb-8" style={{ color: 'var(--page-text-secondary)' }}>
                      <span>{timeline.eventCount} events</span>
                      <span>{formatDateSafe(timeline.updatedAt)}</span>
                    </div>
                    {/* Visibility badge - absolutely positioned at bottom-right */}
                    <div className="absolute bottom-2 right-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        timeline.visibility === 'public'
                          ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                          : timeline.visibility === 'private'
                          ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                      }`}>
                        {timeline.visibility === 'public' ? 'Public' :
                         timeline.visibility === 'private' ? 'Private' : 'Unlisted'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {loadingMoreMyTimelines && Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={`my-timelines-loadmore-skeleton-${index}`} />
              ))}
              </div>
              {myTimelinesHasMore && !loadingTimelines && (
                <div className="flex justify-center mt-6">
                  <button
                    data-testid="my-timelines-load-more"
                    onClick={handleLoadMoreMyTimelines}
                    disabled={loadingMoreMyTimelines}
                    className="pt-button px-4 py-2 rounded-lg font-medium border"
                    style={secondaryButtonStyle}
                  >
                    {loadingMoreMyTimelines ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
        )}

        {/* Popular Timelines Section - First for engagement */}
        <section data-tour="browse-public" data-testid="popular-timelines-section" className="mb-16">
          <h2 data-testid="popular-timelines-heading" className="text-xl font-semibold mb-4" style={{ color: 'var(--page-text-primary)' }}>⭐ Popular Timelines</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:justify-items-start">
            {loadingTimelines ? (
              Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={`skeleton-popular-${index}`} />
              ))
            ) : popular.map(timeline => (
              <div
                key={`popular-${timeline.id}`}
                className="timeline-card card-animate p-5 relative w-full max-w-sm"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                {/* Kebab menu */}
                <div className="absolute top-2 right-2 z-20">
                  <TimelineCardMenu
                    timelineId={timeline.id}
                    ownerId={timeline.ownerId}
                    ownerUsername={timeline.ownerUsername || ''}
                    currentUserId={firebaseUser?.uid}
                    onEdit={handleEditTimeline}
                    onDelete={handleDeleteTimeline}
                    onExport={handleExportTimeline}
                  />
                </div>

                {/* Card content - clickable to navigate */}
                <div
                  onClick={() => handleTimelineClick(timeline)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleTimelineClick(timeline);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  className="cursor-pointer relative flex flex-col h-full min-h-[140px] focus:outline-none focus:ring-2 focus:ring-[var(--page-accent)] focus:ring-offset-2"
                >
                  <h3 className="font-semibold mb-2 pr-8" style={{ color: 'var(--page-text-primary)' }}>{timeline.title}</h3>
                  <p className="text-sm mb-3 line-clamp-2 flex-grow" style={{ color: 'var(--page-text-secondary)' }}>
                    {timeline.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between text-sm mt-auto pb-8" style={{ color: 'var(--page-text-secondary)' }}>
                    <span>{timeline.viewCount} views</span>
                    <span>{timeline.eventCount} events</span>
                  </div>
                  {/* Owner badge - absolutely positioned at bottom-left */}
                  {timeline.ownerUsername ? (
                      <div className="absolute bottom-2 left-2" title={`Owner: @${timeline.ownerUsername}`}>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            color: 'var(--page-text-secondary)',
                            border: '1px solid var(--card-border)',
                          }}
                        >
                          @{timeline.ownerUsername}
                        </span>
                      </div>
                    ) : null}
                  {/* Visibility badge - absolutely positioned at bottom-right */}
                  <div className="absolute bottom-2 right-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      timeline.visibility === 'public'
                        ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                        : timeline.visibility === 'private'
                        ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                    }`}>
                      {timeline.visibility === 'public' ? 'Public' :
                       timeline.visibility === 'private' ? 'Private' : 'Unlisted'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Statistics Section - Second for credibility */}
        <section data-testid="platform-stats-section" className="mb-16">
          <h2 data-testid="platform-stats-heading" className="text-xl font-semibold mb-4" style={{ color: 'var(--page-text-primary)' }}>Platform Statistics</h2>
          <div className="flex flex-wrap gap-6">
            <div className="border rounded-xl p-5 md:p-6 w-40 md:w-48" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-rounded text-lg" style={{ color: '#06b6d4' }}>timeline</span>
                <div className="text-2xl md:text-3xl font-bold" style={{ color: '#06b6d4' }}>{stats.timelineCount}</div>
              </div>
              <div className="text-sm" style={{ color: 'var(--page-text-secondary)' }}>Timelines</div>
            </div>
            <div className="border rounded-xl p-5 md:p-6 w-40 md:w-48" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-rounded text-lg" style={{ color: '#8b5cf6' }}>event</span>
                <div className="text-2xl md:text-3xl font-bold" style={{ color: '#8b5cf6' }}>{stats.eventCount}</div>
              </div>
              <div className="text-sm" style={{ color: 'var(--page-text-secondary)' }}>Events</div>
            </div>
            <div className="border rounded-xl p-5 md:p-6 w-40 md:w-48" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-rounded text-lg" style={{ color: '#10b981' }}>group</span>
                <div className="text-2xl md:text-3xl font-bold" style={{ color: '#10b981' }}>{stats.userCount}</div>
              </div>
              <div className="text-sm" style={{ color: 'var(--page-text-secondary)' }}>Users</div>
            </div>
            <div className="border rounded-xl p-5 md:p-6 w-40 md:w-48" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-rounded text-lg" style={{ color: '#5b5bd6' }}>visibility</span>
                <div className="text-2xl md:text-3xl font-bold" style={{ color: '#5b5bd6' }}>{stats.viewCount}</div>
              </div>
              <div className="text-sm" style={{ color: 'var(--page-text-secondary)' }}>Total Views</div>
            </div>
          </div>
        </section>

        {/* Recently Edited Section - Third for freshness */}
        <section data-testid="recently-edited-section" className="mb-16">
          <h2 data-testid="recently-edited-heading" className="text-xl font-semibold mb-4" style={{ color: 'var(--page-text-primary)' }}>🔥 Recently Edited</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:justify-items-start">
            {loadingTimelines ? (
              Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={`skeleton-recent-${index}`} />
              ))
            ) : recentlyEdited.map(timeline => (
              <div
                key={`recent-${timeline.id}`}
                className="timeline-card card-animate p-5 relative w-full max-w-sm"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                {/* Kebab menu */}
                <div className="absolute top-2 right-2 z-20">
                  <TimelineCardMenu
                    timelineId={timeline.id}
                    ownerId={timeline.ownerId}
                    ownerUsername={timeline.ownerUsername || ''}
                    currentUserId={firebaseUser?.uid}
                    onEdit={handleEditTimeline}
                    onDelete={handleDeleteTimeline}
                    onExport={handleExportTimeline}
                  />
                </div>

                {/* Card content - clickable to navigate */}
                <div
                  onClick={() => handleTimelineClick(timeline)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleTimelineClick(timeline);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  className="cursor-pointer relative flex flex-col h-full min-h-[140px] focus:outline-none focus:ring-2 focus:ring-[var(--page-accent)] focus:ring-offset-2"
                >
                  <h3 className="font-semibold mb-2 pr-8" style={{ color: 'var(--page-text-primary)' }}>{timeline.title}</h3>
                  <p className="text-sm mb-3 line-clamp-2 flex-grow" style={{ color: 'var(--page-text-secondary)' }}>
                    {timeline.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between text-sm mt-auto pb-8" style={{ color: 'var(--page-text-secondary)' }}>
                    <span>{timeline.eventCount} events</span>
                    <span>{formatDateSafe(timeline.updatedAt)}</span>
                  </div>
                  {/* Owner badge - absolutely positioned at bottom-left */}
                  {timeline.ownerUsername ? (
                      <div className="absolute bottom-2 left-2" title={`Owner: @${timeline.ownerUsername}`}>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            color: 'var(--page-text-secondary)',
                            border: '1px solid var(--card-border)',
                          }}
                        >
                          @{timeline.ownerUsername}
                        </span>
                      </div>
                    ) : null}
                  {/* Visibility badge - absolutely positioned at bottom-right */}
                  <div className="absolute bottom-2 right-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      timeline.visibility === 'public'
                        ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                        : timeline.visibility === 'private'
                        ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                    }`}>
                      {timeline.visibility === 'public' ? 'Public' :
                       timeline.visibility === 'private' ? 'Private' : 'Unlisted'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Timelines Section */}
        {featured.length > 0 && (
          <section className="mb-16">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--page-text-primary)' }}>✨ Featured</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:justify-items-start">
              {featured.map(timeline => (
                <div
                  key={`featured-${timeline.id}`}
                  className="timeline-card card-animate p-5 relative w-full max-w-sm"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                >
                  {/* Kebab menu */}
                  <div className="absolute top-2 right-2 z-20">
                    <TimelineCardMenu
                      timelineId={timeline.id}
                      ownerId={timeline.ownerId}
                      ownerUsername={timeline.ownerUsername || ''}
                      currentUserId={firebaseUser?.uid}
                      onEdit={handleEditTimeline}
                      onDelete={handleDeleteTimeline}
                      onExport={handleExportTimeline}
                    />
                  </div>

                  {/* Card content - clickable to navigate */}
                  <div
                    onClick={() => handleTimelineClick(timeline)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleTimelineClick(timeline);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    className="cursor-pointer relative flex flex-col h-full min-h-[140px] focus:outline-none focus:ring-2 focus:ring-[var(--page-accent)] focus:ring-offset-2"
                  >
                    <div className="flex items-center gap-2 mb-2 pr-8">
                      <span className="text-yellow-500">⭐</span>
                      <h3 className="font-semibold flex-1" style={{ color: 'var(--page-text-primary)' }}>{timeline.title}</h3>
                    </div>
                    <p className="text-sm mb-3 line-clamp-2 flex-grow" style={{ color: 'var(--page-text-secondary)' }}>
                      {timeline.description || 'No description'}
                    </p>
                    <div className="flex items-center justify-between text-sm mt-auto pb-8" style={{ color: 'var(--page-text-secondary)' }}>
                      <span>{timeline.eventCount} events</span>
                      <span>{timeline.viewCount} views</span>
                    </div>
                    {/* Owner badge - absolutely positioned at bottom-left */}
                    {timeline.ownerUsername ? (
                        <div className="absolute bottom-2 left-2" title={`Owner: @${timeline.ownerUsername}`}>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: 'var(--card-bg)',
                              color: 'var(--page-text-secondary)',
                              border: '1px solid var(--card-border)',
                            }}
                          >
                            @{timeline.ownerUsername}
                          </span>
                        </div>
                      ) : null}
                    {/* Visibility badge - absolutely positioned at bottom-right */}
                    <div className="absolute bottom-2 right-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        timeline.visibility === 'public'
                          ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                          : timeline.visibility === 'private'
                          ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                      }`}>
                        {timeline.visibility === 'public' ? 'Public' :
                         timeline.visibility === 'private' ? 'Private' : 'Unlisted'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        </>
        )}
        </main>
      </div>

      {/* Timeline CRUD Dialogs */}
      <CreateTimelineDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      <ImportTimelineDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      <EditTimelineDialog
        open={editDialogOpen}
        timelineId={editTimelineId}
        onClose={() => {
          setEditDialogOpen(false);
          setEditTimelineId(null);
        }}
        onSuccess={handleEditSuccess}
      />

      <DeleteTimelineDialog
        open={deleteDialogOpen}
        timelineId={deleteTimelineId}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteTimelineId(null);
        }}
        onSuccess={handleDeleteSuccess}
      />

      {/* Mobile Bottom Navigation - hidden on md+ screens */}
      <BottomNavigation />

      </div>
    </div>
    </>
  );
}

// Wrapper component that provides tour context
export function HomePage() {
  return (
    <TourProvider>
      <HomePageTour />
      <HomePageContent />
    </TourProvider>
  );
}
