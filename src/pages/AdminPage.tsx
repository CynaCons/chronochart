/**
 * AdminPage - Site administration panel
 * Implements CC-REQ-ADMIN-004: Access control and admin UI
 * v0.4.4 - Admin Panel & Site Administration
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Tab } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { signOutUser } from '../services/auth';
import { getUser } from '../services/firestore';
import { canAccessAdmin } from '../lib/adminUtils';
import { NavigationRail, ThemeToggleButton } from '../components/NavigationRail';
import { useNavigationConfig } from '../app/hooks/useNavigationConfig';
import { UserProfileMenu } from '../components/UserProfileMenu';
import { UserManagementPanel } from '../components/admin/UserManagementPanel';
import { StatisticsDashboard } from '../components/admin/StatisticsDashboard';
import { ActivityLogPanel } from '../components/admin/ActivityLogPanel';
import type { User } from '../types';
import TimelineIcon from '@mui/icons-material/Timeline';

type AdminTab = 'users' | 'statistics' | 'activity';

export function AdminPage() {
  const navigate = useNavigate();
  const { user: firebaseUser } = useAuth();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // Get navigation configuration
  const { sections } = useNavigationConfig(currentUser?.id, undefined, currentUser);

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

  // Access control: redirect non-admins to home page
  useEffect(() => {
    if (currentUser !== null && !canAccessAdmin(currentUser)) {
      console.warn('Access denied: Admin access required');
      navigate('/');
    }
  }, [currentUser, navigate]);

  // Show loading while checking auth
  if (!firebaseUser) {
    return null; // Not logged in - redirect will happen
  }

  // Still loading user profile
  if (currentUser === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--page-bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--page-accent)]"></div>
          <span style={{ color: 'var(--page-text-secondary)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  // Not admin - redirect in progress
  if (!canAccessAdmin(currentUser)) {
    return null;
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: AdminTab) => {
    setActiveTab(newValue);
  };

  return (
    <div data-testid="admin-page" className="min-h-screen flex" style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* Navigation Rail */}
      <aside className="fixed left-0 top-0 bottom-0 w-14 border-r z-50 flex flex-col items-center py-2" role="navigation" aria-label="Main navigation" style={{ backgroundColor: 'var(--page-bg-elevated)', borderColor: 'var(--page-border)' }}>
        {/* PowerTimeline logo at top - clickable to go home */}
        <button
          onClick={() => navigate('/browse')}
          className="mb-4 p-1 text-center hover:opacity-80 transition-opacity cursor-pointer"
          title="Go to Home"
          aria-label="Go to Home"
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

      {/* Main Content Area */}
      <div className="flex-1 ml-14">
        {/* Header */}
        <header className="border-b sticky top-0 z-40" style={{ backgroundColor: 'var(--page-bg-elevated)', borderColor: 'var(--page-border)' }}>
          <div className="px-4 md:px-8 py-3">
            <div className="flex items-center justify-between">
              {/* Brand: Logo + PowerTimeline BETA */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/')}
                  className="p-1 hover:opacity-80 transition-opacity flex items-center gap-2"
                  title="Go to Landing Page"
                  aria-label="Go to Landing Page"
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
                <span
                  className="text-lg font-semibold"
                  style={{ color: 'var(--page-text-primary)' }}
                  data-testid="admin-heading"
                >
                  Admin Panel
                </span>
              </div>
              {currentUser && (
                <UserProfileMenu
                  onLogout={async () => {
                    await signOutUser();
                    navigate('/');
                  }}
                />
              )}
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="border-b" style={{ backgroundColor: 'var(--page-bg-elevated)', borderColor: 'var(--page-border)' }}>
          <div className="px-4 md:px-8">
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="Admin panel tabs">
              <Tab label="Users" value="users" />
              <Tab label="Statistics" value="statistics" />
              <Tab label="Activity Log" value="activity" />
            </Tabs>
          </div>
        </div>

        {/* Tab Content */}
        <main className="px-4 md:px-8 py-8">
          {activeTab === 'users' && (
            <div data-testid="admin-users-tab" className="space-y-4">
              <h2 data-testid="user-management-heading" className="text-xl font-semibold" style={{ color: 'var(--page-text-primary)' }}>User Management</h2>
              <UserManagementPanel />
            </div>
          )}

          {activeTab === 'statistics' && (
            <div data-testid="admin-statistics-tab" className="space-y-4">
              <h2 data-testid="platform-statistics-heading" className="text-xl font-semibold" style={{ color: 'var(--page-text-primary)' }}>Platform Statistics</h2>
              <StatisticsDashboard />
            </div>
          )}

          {activeTab === 'activity' && (
            <div data-testid="admin-activity-tab" className="space-y-4">
              <h2 data-testid="activity-log-heading" className="text-xl font-semibold" style={{ color: 'var(--page-text-primary)' }}>Admin Activity Log</h2>
              <ActivityLogPanel />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
