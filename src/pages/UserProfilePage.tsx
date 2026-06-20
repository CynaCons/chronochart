/**
 * UserProfilePage - Display user information and their timelines
 * v0.5.14 - SRS_DB.md compliant with username-based URLs
 */

import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties as ReactCSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { TimelineMetadata, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { signOutUser } from '../services/auth';
import { getUser, getUserByUsername, getTimelines, getTimeline } from '../services/firestore';
import { downloadTimelineAsYaml } from '../services/timelineImportExport';
import { NavigationRail, ThemeToggleButton } from '../components/NavigationRail';
import { BottomNavigation } from '../components/BottomNavigation';
import { useNavigationConfig } from '../app/hooks/useNavigationConfig';
import { UserProfileMenu } from '../components/UserProfileMenu';
import { TimelineCardMenu } from '../components/TimelineCardMenu';
import { EditTimelineDialog } from '../components/EditTimelineDialog';
import { DeleteTimelineDialog } from '../components/DeleteTimelineDialog';
import { CreateTimelineDialog } from '../components/CreateTimelineDialog';
import { ImportTimelineDialog } from '../components/ImportTimelineDialog';
import { UserAvatar } from '../components/UserAvatar';
import { useToast } from '../contexts/ToastContext';
import { SkeletonCard } from '../components/SkeletonCard';
import { ErrorState } from '../components/ErrorState';
import TimelineIcon from '@mui/icons-material/Timeline';
import { Helmet } from 'react-helmet-async';
import { userProfileUrl, OG_IMAGE_URL } from '../utils/urls';
import { profilePageSchema, breadcrumbSchema } from '../utils/jsonLd';
import { browseUrl } from '../utils/urls';

export function UserProfilePage() {
  // Support both /@:username (preferred) and /user/:userId (legacy) routes
  const { username, userId } = useParams<{ username?: string; userId?: string }>();
  const navigate = useNavigate();
  const { user: firebaseUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [timelines, setTimelines] = useState<TimelineMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTimelineId, setEditTimelineId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTimelineId, setDeleteTimelineId] = useState<string | null>(null);
  const [createTimelineDialogOpen, setCreateTimelineDialogOpen] = useState(false);
  const [importTimelineDialogOpen, setImportTimelineDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'events' | 'views'>('updated');
  const [error, setError] = useState<Error | null>(null);
  const [userCache, setUserCache] = useState<Map<string, User>>(new Map());

  // Toast notifications
  const { showSuccess, showError } = useToast();

  // Get navigation configuration
  const { sections } = useNavigationConfig(currentUser?.id, undefined, currentUser);

  // Load current user profile from Firestore
  useEffect(() => {
    async function loadCurrentUser() {
      if (firebaseUser) {
        const userProfile = await getUser(firebaseUser.uid);
        setCurrentUser(userProfile);
      } else {
        setCurrentUser(null);
      }
    }
    loadCurrentUser();
  }, [firebaseUser]);

  const loadUserProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Support both username and userId params
    if (!username && !userId) {
      navigate('/');
      setLoading(false);
      return;
    }

    try {
      let userData: User | null = null;

      if (username) {
        // New URL format: /@username
        userData = await getUserByUsername(username);
      } else if (userId) {
        // Legacy URL format: /user/:userId
        userData = await getUser(userId);
        // If found, redirect to the new username-based URL
        // Note: URL pattern is /:username (no @ prefix - React Router v7 bug)
        if (userData) {
          navigate(`/${userData.username}`, { replace: true });
          return;
        }
      }

      if (!userData) {
        // User not found - redirect to home
        navigate('/');
        return;
      }

      setUser(userData);

      const isOwner = firebaseUser?.uid === userData.id;
      const userTimelines = await getTimelines({
        ownerId: userData.id,
        ...(isOwner ? {} : { visibility: 'public' }),
        orderByField: 'updatedAt',
        orderDirection: 'desc',
      });
      setTimelines(userTimelines);

      // Build user cache from timeline owners (parallel fetching)
      const cache = new Map<string, User>();
      const ownerIds = Array.from(new Set(userTimelines.map(t => t.ownerId)));
      const owners = await Promise.all(
        ownerIds.map(id => getUser(id))
      );
      owners.forEach((owner, index) => {
        if (owner) {
          cache.set(ownerIds[index], owner);
        }
      });
      setUserCache(cache);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setError(error instanceof Error ? error : new Error('Failed to load profile'));
      setUser(null);
      setTimelines([]);
      setUserCache(new Map());
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, navigate, userId, username]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const isViewingOwnProfile = firebaseUser?.uid === user?.id;

  const handleTimelineClick = (timeline: TimelineMetadata) => {
    // v0.5.14: Use username-based URL (no @ prefix - React Router v7 bug)
    const owner = userCache.get(timeline.ownerId) || user;
    if (owner) {
      navigate(`/${owner.username}/timeline/${timeline.id}`);
    }
  };

  // Sort timelines based on selected criteria
  const sortedTimelines = [...timelines].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'events':
        return (b.eventCount || 0) - (a.eventCount || 0);
      case 'views':
        return (b.viewCount || 0) - (a.viewCount || 0);
      case 'updated':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  const accentButtonStyle: ReactCSSProperties = {
    '--pt-button-bg': 'var(--page-accent)',
    '--pt-button-bg-hover': 'var(--page-accent-hover)',
    '--pt-button-bg-active': 'var(--page-accent-hover)',
    '--pt-button-border': 'var(--page-accent)',
    '--pt-button-border-hover': 'var(--page-accent-hover)',
    '--pt-button-color': '#ffffff',
    '--pt-button-color-hover': '#ffffff',
  } as ReactCSSProperties;

  const secondaryButtonStyle: ReactCSSProperties = {
    '--pt-button-bg': 'var(--card-bg)',
    '--pt-button-bg-hover': 'color-mix(in srgb, var(--page-accent) 8%, var(--card-bg))',
    '--pt-button-bg-active': 'color-mix(in srgb, var(--page-accent) 12%, var(--card-bg))',
    '--pt-button-border': 'var(--card-border)',
    '--pt-button-border-hover': 'var(--card-border-hover)',
    '--pt-button-color': 'var(--page-text-primary)',
    '--pt-button-color-hover': 'var(--page-accent)',
    '--pt-button-shadow-hover': 'none',
    '--pt-button-shadow-active': 'none',
  } as ReactCSSProperties;

  const handleEditTimeline = (timelineId: string) => {
    setEditTimelineId(timelineId);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = async () => {
    showSuccess('Timeline updated successfully!');
    // Refresh timelines
    if (user) {
      const userTimelines = await getTimelines({
        ownerId: user.id,
        ...(isViewingOwnProfile ? {} : { visibility: 'public' }),
        orderByField: 'updatedAt',
        orderDirection: 'desc',
      });
      setTimelines(userTimelines);
    }
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
    // Refresh timelines
    if (user) {
      const userTimelines = await getTimelines({
        ownerId: user.id,
        ...(isViewingOwnProfile ? {} : { visibility: 'public' }),
        orderByField: 'updatedAt',
        orderDirection: 'desc',
      });
      setTimelines(userTimelines);
    }
  };


  const handleCreateTimeline = () => {
    setCreateTimelineDialogOpen(true);
  };

  const handleImportTimeline = () => {
    setImportTimelineDialogOpen(true);
  };

  const handleCreateTimelineSuccess = async () => {
    showSuccess('Timeline created successfully!');
    // Refresh timelines
    if (user) {
      const userTimelines = await getTimelines({
        ownerId: user.id,
        ...(isViewingOwnProfile ? {} : { visibility: 'public' }),
        orderByField: 'updatedAt',
        orderDirection: 'desc',
      });
      setTimelines(userTimelines);
    }
  };

  // Dynamic page title and meta tags
  const pageTitle = user ? `@${user.username}'s Timelines | PowerTimeline` : 'PowerTimeline';
  const pageDescription = user ? `Explore timelines by @${user.username}. ${timelines.length} timeline${timelines.length !== 1 ? 's' : ''} with ${timelines.reduce((sum, t) => sum + (t.eventCount || 0), 0)} total events.` : 'Explore timelines on PowerTimeline';
  const pageUrl = user ? userProfileUrl(user.username) : '';

  return (
    <>
      {user && (
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={pageDescription} />
          <link rel="canonical" href={pageUrl} />

          {/* Open Graph */}
          <meta property="og:type" content="profile" />
          <meta property="og:url" content={pageUrl} />
          <meta property="og:title" content={pageTitle} />
          <meta property="og:description" content={pageDescription} />
          <meta property="og:image" content={OG_IMAGE_URL} />
          <meta property="profile:username" content={user.username} />

          {/* Twitter Card */}
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:url" content={pageUrl} />
          <meta name="twitter:title" content={pageTitle} />
          <meta name="twitter:description" content={pageDescription} />
          <meta name="twitter:image" content={OG_IMAGE_URL} />

          {/* JSON-LD */}
          <script type="application/ld+json">{JSON.stringify([
            profilePageSchema(user),
            breadcrumbSchema([
              { name: 'Home', url: browseUrl() },
              { name: `@${user.username}` },
            ]),
          ])}</script>
        </Helmet>
      )}

      <div data-testid="user-profile-page" className="min-h-screen flex" style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* Navigation Rail - hidden on mobile, shown on md+ screens */}
      <aside className="fixed left-0 top-0 bottom-0 w-14 border-r z-50 hidden md:flex flex-col items-center py-2" role="navigation" aria-label="Main navigation" style={{ borderColor: 'var(--nav-border)', backgroundColor: 'var(--nav-bg)' }}>
        {/* PowerTimeline logo at top - clickable to go home */}
        <button
          onClick={() => navigate('/browse')}
          className="mb-4 p-1 text-center hover:opacity-80 transition-opacity cursor-pointer"
          title="Go to Home"
        >
          <TimelineIcon sx={{ fontSize: 28, color: 'var(--page-accent)' }} />
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
        {/* Header */}
        <header className="border-b sticky top-0 z-40" style={{ backgroundColor: 'var(--page-bg-elevated)', borderColor: 'var(--page-border)' }}>
          <div className="px-4 md:px-8 py-3 md:py-4">
            <div className="flex items-center justify-between">
              {/* Brand: Logo + PowerTimeline BETA */}
              <button
                onClick={() => navigate('/')}
                className="p-1 hover:opacity-80 transition-opacity flex items-center gap-2"
                title="Go to Landing Page"
                data-testid="logo-button"
              >
                <TimelineIcon sx={{ fontSize: 24, color: 'var(--page-accent)' }} />
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
              <div className="flex items-center gap-2">
                {/* Mobile: Theme toggle (since nav rail is hidden) */}
                <div className="md:hidden">
                  <ThemeToggleButton />
                </div>
                {firebaseUser && (
                  <UserProfileMenu
                    onLogout={async () => {
                      await signOutUser();
                      navigate('/');
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* User Profile Header */}
        <div className="border-b" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <div className="px-4 md:px-8 py-6 md:py-8">
            {error ? (
              <div className="py-6 text-center" style={{ color: 'var(--page-text-secondary)' }}>
                Unable to load this profile. Please try again below.
              </div>
            ) : loading || !user ? (
              <div className="flex items-center gap-6">
                <div className="skeleton-circle skeleton-block" style={{ width: '64px', height: '64px' }} />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-block skeleton-title" style={{ width: '220px', height: '28px' }} />
                  <div className="skeleton-block" style={{ width: '320px' }} />
                  <div className="flex gap-6 pt-1">
                    <div className="skeleton-block" style={{ width: '90px' }} />
                    <div className="skeleton-block" style={{ width: '90px' }} />
                    <div className="skeleton-block" style={{ width: '90px' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6">
                <UserAvatar user={user} size="xlarge" />
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--page-text-primary)' }}>@{user.username}</h1>
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm max-w-md mx-auto md:mx-0 md:flex md:gap-6">
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--page-text-primary)' }}>{timelines.length}</span>
                      <span className="ml-1" style={{ color: 'var(--page-text-secondary)' }}>Timelines</span>
                    </div>
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--page-text-primary)' }}>
                        {timelines.reduce((sum, t) => sum + (t.eventCount || 0), 0)}
                      </span>
                      <span className="ml-1" style={{ color: 'var(--page-text-secondary)' }}>Events</span>
                    </div>
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--page-text-primary)' }}>
                        {timelines.reduce((sum, t) => sum + (t.viewCount || 0), 0)}
                      </span>
                      <span className="ml-1" style={{ color: 'var(--page-text-secondary)' }}>Views</span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm" style={{ color: 'var(--page-text-secondary)' }}>
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User Timelines - has-bottom-nav adds padding for mobile bottom navigation */}
        <main className="px-4 md:px-8 py-6 md:py-8 has-bottom-nav">
        {error ? (
          <div className="py-12">
            <ErrorState
              message="Failed to load timelines"
              description={error.message}
              onRetry={loadUserProfile}
            />
          </div>
        ) : (
        <>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--page-text-primary)' }}>
              Timelines ({loading ? '...' : timelines.length})
            </h2>
            {!loading && timelines.length > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="sort-select" className="text-sm" style={{ color: 'var(--page-text-secondary)' }}>
                  Sort by:
                </label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'updated' | 'title' | 'views')}
                  className="px-3 py-1 text-sm border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--page-text-primary)'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--input-focus-border)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px var(--input-focus-shadow)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--input-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="updated">Last Updated</option>
                  <option value="title">Title (A-Z)</option>
                  <option value="events">Event Count</option>
                  <option value="views">Views</option>
                </select>
              </div>
            )}
          </div>
          {firebaseUser && user && firebaseUser.uid === user.id && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleImportTimeline}
                className="pt-button px-4 py-2 rounded-lg font-medium border flex items-center gap-2"
                style={secondaryButtonStyle}
              >
                <span className="material-symbols-rounded text-base">upload_file</span>
                Import
              </button>
              <button
                onClick={handleCreateTimeline}
                className="pt-button px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2"
                style={accentButtonStyle}
              >
                <span className="text-xl">+</span>
                Create Timeline
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:justify-items-start">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`user-timeline-skeleton-${index}`} />
            ))}
          </div>
        ) : timelines.length === 0 ? (
          <div className="border border-dashed rounded-xl p-12 text-center" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <p style={{ color: 'var(--page-text-secondary)' }}>
              {isViewingOwnProfile
                ? `@${user?.username || 'User'} hasn't created any timelines yet`
                : `@${user?.username || 'User'} hasn't published any public timelines yet`}
            </p>
          </div>
        ) : (
          <div
            data-testid="user-timelines-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pr-2 sm:justify-items-start"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--page-border) transparent'
            }}
          >
            {sortedTimelines.map(timeline => (
              <div
                key={`user-profile-${timeline.id}`}
                data-testid={`timeline-card-${timeline.id}`}
                className="timeline-card card-animate p-5 relative w-full max-w-sm"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                {/* Kebab menu - only show if current user is the owner */}
                {firebaseUser && firebaseUser.uid === timeline.ownerId && (
                  <div className="absolute top-2 right-2 z-20">
                    <TimelineCardMenu
                      timelineId={timeline.id}
                      ownerId={timeline.ownerId}
                      ownerUsername={userCache.get(timeline.ownerId)?.username || user?.username || ''}
                      currentUserId={firebaseUser.uid}
                      onEdit={handleEditTimeline}
                      onDelete={handleDeleteTimeline}
                      onExport={handleExportTimeline}
                    />
                  </div>
                )}

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
                    <span>{new Date(timeline.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {/* Owner badge - absolutely positioned at bottom-left */}
                  {(() => {
                    const owner = userCache.get(timeline.ownerId);
                    return owner ? (
                      <div className="absolute bottom-2 left-2" title={`Owner: @${owner.username}`}>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            color: 'var(--page-text-secondary)',
                            border: '1px solid var(--card-border)',
                          }}
                        >
                          @{owner.username}
                        </span>
                      </div>
                    ) : null;
                  })()}
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
        )}
        </>
        )}
        </main>
      </div>

      {/* Timeline Edit/Delete Dialogs */}
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

      {/* Create Timeline Dialog */}
      <CreateTimelineDialog
        open={createTimelineDialogOpen}
        onClose={() => setCreateTimelineDialogOpen(false)}
        onSuccess={handleCreateTimelineSuccess}
      />

      {/* Import Timeline Dialog */}
      <ImportTimelineDialog
        open={importTimelineDialogOpen}
        onClose={() => setImportTimelineDialogOpen(false)}
        onSuccess={handleCreateTimelineSuccess}
      />

      {/* Mobile Bottom Navigation - hidden on md+ screens */}
      <BottomNavigation />
    </div>
    </>
  );
}
