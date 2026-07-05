# PowerTimeline Implementation Plan

## Quick Summary

**Current Version:** v0.8.15
**Next Milestone:** v1.0.0 - Version History & Collaboration

### Key Metrics
- **Total Iterations:** 200+ completed (v0.2.0 → v0.8.0)
- **Requirements:** ~352 total ([SRS Index](docs/SRS_INDEX.md))
- **Implementation:** ~200 requirements (57%)
- **Test Coverage:** ~119 requirements verified (34%)
- **Test Suite:** See [docs/TESTS.md](docs/TESTS.md) for current counts

### Recent Achievements (v0.5.x)
- ✅ Firebase Authentication & public browsing (v0.5.1-v0.5.7)
- ✅ Documentation, test organization, vision update (v0.5.8-v0.5.10)
- ✅ Test stabilization & legacy code cleanup (v0.5.11)
- ✅ Firestore schema cleanup (v0.5.12)
- ✅ Multi-agent orchestration MCP server (v0.5.13)
- ✅ Username-based URLs & navigation fixes (v0.5.14)
- ✅ MCP server hardening & Codex write access (v0.5.15)
- ✅ Stats caching & visibility fixes (v0.5.17)
- ✅ Timeline Card Menu & Landing Page (v0.5.18)
- ✅ Landing Page Roadmap section (v0.5.19)
- ✅ Editor Dark Theme fixes (v0.5.20-v0.5.21)
- ✅ Cloud Functions for platform stats (v0.5.22)
- ✅ Event Editor read-only mode & visual rework (v0.5.23)
- ✅ Dev Panel removal & test migration (v0.5.24)
- ✅ PowerSpawn standalone extraction & submodule (v0.5.25)
- ✅ PowerSpawn landing page (powerspawn.com) with GitHub Pages (v0.5.25)
- ✅ New branding: PT logo, hero banner, favicon (v0.5.25)
- ✅ Stream Editor: Mobile Timeline Viewer (v0.5.26)
- ✅ Stream Viewer: Search, sync, focus fixes (v0.5.26.1)
- ✅ Stream Viewer: Minimap, breadcrumbs, scroll fix, E2E tests (v0.5.26.3)
- ✅ Stream Viewer: Expandable cards, search in header, wheel fix (v0.5.26.4)
- ✅ Home Page: Reordered sections (Popular → Stats → Recent) (v0.5.26.4)
- ✅ Stream Viewer: Visual polish, softer edges, backdrop blur (v0.5.26.5)
- ✅ Import/Export: YAML format, ImportTimelineDialog, Export menu (v0.5.27)
- ✅ PowerSpawn Copilot CLI fix with `-p` flag (v0.5.27.1)
- ✅ Test Sweep: Env config, anchor alignment fixes (v0.5.28)
- ✅ Technical Debt: Version sync script, docs drift fixes (v0.5.29)
- ✅ PowerSpawn Test Suite: 22+ pytest tests (v0.5.30)
- ✅ UX Polish: Skeletons, Toasts, Error Recovery, Accessibility (v0.5.31)
- ✅ Navigation Icons: Stream View hover icons, Event Editor navigation (v0.5.34)
- ✅ Bug Fixes + Settings NavRail: Fixed event editor, added Settings to NavRail (v0.5.35)
- ✅ Full-Width Layout Trial: HomePage, SettingsPage, UserProfilePage (v0.5.36)
- ✅ Dark Mode Season Background Colors: Fixed timeline axis season colors for dark mode (v0.5.36.1)
- ✅ Dashed Connector Line Fix: Fixed SVG width (1px → 10px), replaced CSS vars with hex colors (v0.5.36.2)
- ✅ Stream View Minimap Hover: Added hover effect to Stream View events that highlights them in minimap (v0.8.3.3)
- ✅ Test Fixes: Fixed anchor selectors (#57) and scale alignment viewport detection (#62) - all 16 tests PASS (v0.8.15)
- ✅ Zoom Fixes: Added 10% right padding to timeline range, fixed cursor anchoring tolerance (v0.8.15)
- ✅ Events Panel Removal: Removed OutlinePanel, consolidated functionality into Stream View (v0.8.3.4)
- ✅ Mobile/Responsive Testing Infrastructure: 4 viewport projects (desktop/desktop-xl/tablet/mobile), 11 test files, SRS_RESPONSIVE_TESTING.md (v0.8.4)
- ✅ PWA & Offline Support: vite-plugin-pwa, service worker, offline indicator with retry (v0.8.5)
- ✅ Test Stability: Admin panel test fixes, selector updates (v0.8.6)
- ✅ UX Polish: Home pagination, API key storage, account deletion (GDPR), accessibility fixes, SEO meta tags (v0.8.7)
- ✅ Timeline Axis Visual Redesign: 20% thinner axis (3px), removed dashed lines, triangle anchors (v0.5.37)
- ✅ Timeline Visual Polish: Reverted anchor shape to diamond/milestone (rotated square) with rounded edges (v0.5.37)
- ✅ User Onboarding: Empty State CTA, React Joyride tours (Editor 8-step, Home 5-step), NavRail Help button (v0.5.38)
- ✅ Share Links: Copy Link menu in timeline cards, toast feedback (v0.6.0)
- ✅ Editor UX Polish: Navigation fixes, compact hover-expandable profile button, event panel improvements (v0.6.1)
- ✅ Error Handling: GitHub issues link in ErrorState, ErrorBoundary, Toast; SRS_TIMELINE_EDITOR.md (v0.6.2)
- ✅ Event Sources: sources field on events, SourcesEditor component, Stream View indicator, drag-and-drop reordering, E2E tests (v0.6.3)
- ✅ Bug Fixes: Editor panel click, view on canvas zoom, Editor-to-Stream navigation (v0.6.4)
- ✅ AI Chat Assistant: Gemini 2.5 Flash integration with Google Search (v0.7.0)
- ✅ AI UX Polish: Cost tracking, preview events, editor behavior fixes (v0.7.1-v0.7.2)
- ✅ Event Persistence & Cleanup: Fixed AI events saving to Firestore subcollection, console cleanup, overflow indicator polish, rejected events restore (v0.7.3)
- ✅ Production Bug Fixes: Firestore event ID fix, minimap glow fix, overlay view mode (v0.7.4)
- ✅ Default Light Theme: Changed default theme to light with fixed component styles (v0.7.5)
- ✅ Critical Accessibility Fixes: Focus traps, keyboard navigation, ARIA labels (v0.7.6)
- ✅ Firebase Data Consistency: Optional chaining, safe fallbacks, timeline loading fixes (v0.7.7)
- ✅ Offline Support: Connection monitoring, retry logic, error recovery (v0.7.8)
- ✅ AI Metadata Preview: Diff view for title/description changes in ChatPanel (v0.7.9)
- ✅ AI Partial Import: Preview and review mode with selective confirmation (v0.7.10)
- ✅ Code Quality: Removed `any` types, TypeScript strict checks (v0.7.11)
- ✅ Unit Testing: Set up Vitest with 58 unit tests (v0.7.12)
- ✅ Documentation: Fixed consistency and updated metrics (v0.7.13)
- ✅ YAML Schema API: JSON Schema endpoint for AI discovery (v0.7.14)
- ✅ Documentation & SRS Cleanup: Format standardization, code refs, metrics update (v0.8.0)
- ✅ Visual Audit & Z-Index Fixes: Automated overlap detection, layer system standardization (v0.8.2.1)
- ✅ Visual Audit Test Infrastructure: 46 tests (T87-T96) in 10 files, dense area testing, theme validation (v0.8.2.2)
- ✅ Visual Audit Test Coherency: Eliminated audit theater, 39 tests with real assertions, new T97 high-density tests (v0.8.2.3)
- ✅ AuthoringOverlay Z-Index Fix: Moved z-[500] to dialog element for T96 test detection (v0.8.2.4)
- ✅ T97 Dense Spot Algorithm: Telemetry-based detection using `window.__ccTelemetry`, breadcrumb overlap test (T97.6) (v0.8.2.5)
- ✅ T97 Mathematical Capacity Algorithm: Complete rewrite with `calculateViewportCapacity()`, 8 tests (T97.1-T97.8), 195.5% density ratio achieved (v0.8.2.6)
- ✅ T97 Temporal Density: Added `eventDates` and `timelineRange` to telemetry, finds 1793-1794 (The Terror) as densest period (v0.8.2.7)
- ✅ T97 Visual Fill Algorithm: Bucket-based density scoring, optimizes for horizontal card spread, screenshots now show properly filled screens (v0.8.2.8)
- ✅ Rubber-band Panning: Drag-to-pan mode with elastic boundaries, snap-back animation, cursor states (grab/grabbing) (v0.8.3.0)
- ✅ Layout Performance: Spatial hashing O(n) collisions, Map lookup, virtualization, layout caching (v0.8.3)
- ✅ UX Polish: Hover lift effect, zoom toward cursor, hover card preview for degraded cards (v0.8.3)
- ✅ Interaction Keybind Swap: Default click+drag = selection zoom (crosshair), Space+drag = pan (grab) (v0.8.3.1)
- ✅ Test Suite Stabilization: Fixed Shift+scroll stale closure bug (race-free immediate ref updates), migrated tests to public timelines, added data-testid attrs, deleted diagnostic tests, documented in TESTS.md (v0.8.3.2)
- ✅ Safari/WebKit Firebase Fix: Long-polling + memoryLocalCache to avoid IndexedDB hangs, mobile overflow fixes, Stream View auto-open fix (v0.8.8)
- ✅ Performance Optimization: StreamViewer virtualization, parallel data loading, Firebase chunking, zoom fix (v0.8.9)
- ✅ ownerUsername Denormalization: Eliminated getUsers() fetch, O(users)→O(timelines) improvement (v0.8.11)
- ✅ Performance Optimization: Collision resolution caching, minimap/axis rect caching, spatial hash optimization (v0.8.14)
- ✅ UX Polish: Breadcrumb z-index fix, Stream View hover buttons, show more calculation, mobile tap behavior (v0.8.15)
- ✅ Visual Audit Implementation: 32-item comprehensive polish - design tokens, bottom nav, WCAG accessibility, keyboard navigation, ARIA labels, animations (v0.8.16)
- ✅ Import Review System: Session-based YAML import with ReviewPanel, per-event decisions, localStorage persistence, E2E tests (v0.9.0-v0.9.3)
- ✅ Anchor System Fix: Removed incorrect post-filtering, fixed coordinate system to use view window, implemented proper clustering validation in tests (v0.9.4)
- ✅ Import Modes: Merge vs Overwrite mode selection with confirmation dialog, 19 unit tests, 10 E2E tests (v0.9.6)
- ✅ UX Polish: Import tab default, source indicator icons on cards, YAML paste in Browse page import (v0.9.6.1)
- ✅ Bug Fix: YAML import/export now preserves event sources field (v0.9.6.2)
- ✅ Layout Robustness + Repo Cleanup: compact card sizing, minimap-safe positioning, T105/T106 E2E coverage, archived legacy docs (v0.9.6.3)
- ✅ Source Indicator: Subtle theme-aware icon on cards with sources, 3-method E2E test (CC-REQ-CARD-SOURCE-001)
- ✅ Anchor Visibility Fix: All event anchors now visible regardless of zoom/overflow, E2E tests (CC-REQ-ANCHOR-004)
- ✅ Event Diff View: Word-level diff modal for UPDATE events using react-diff-viewer-continued, E2E tests (v0.9.4)
- ✅ Skip Identical Events: Import now skips events with matching ID AND identical content, 14 new unit tests (v0.9.4)
- ✅ Skipped Events Feedback: ReviewPanel shows "X skipped (no changes)" count for user feedback (v0.9.4)
- ✅ AI Chat Migration: AI event actions route through ImportSession with ReviewPanel approval, delete action support, 16 new unit tests (v0.9.5)
- ✅ Critical Test Fixes: Overflow dependencies (viewStart/viewEnd), zoom handler synthetic event fallback, verified with focused tests (2026-01-18)
- ✅ Viewport Strategy: Timeline editor restricted to desktop-only (mobile/tablet skip editor tests), Stream View is mobile experience (2026-01-18)
- ✅ SEO & Social Sharing: Centralized URL builders (urls.ts), canonical URLs on all pages, JSON-LD structured data, robots.txt, sitemap cloud function, ShareMenu component (Twitter/X, Facebook, Reddit, Copy Link, Embed), embeddable timelines with EmbedPage, EmbedCodeDialog, embed route (v0.9.7)
- ✅ Layout Card Overlap Fix: Viewport-aware capacity in DegradationEngine, density-aware collision passes, recompaction overlap guard, cache invalidation with event count (2026-03-15)
- ✅ App Theme Redesign "Warm Neutral": rich charcoal palette (#111110), gold/amber accent (#e2a336), Inter heading font, card gradient+glow, feature cards with colored top borders, hero text gradient (gold→amber→terracotta), LandingPage de-hardcoded to CSS variables, light mode warm cream-white (#faf8f5), MUI theme synced (2026-03-16)
- ✅ Card Text Clipping Fix: Added overflow-hidden on card containers, flex-shrink-0 on title/date rows, min-h-0 on description for graceful line-clamp truncation, multi-resolution tests at 4 viewport sizes (1366x768, 1440x900, 1920x1080, 2560x1440) (2026-03-16)
- ✅ Stream Highlight Overlap Fix: Added z-index elevation on hovered/selected stream cards to prevent box-shadow bleeding under adjacent cards, 2 new E2E tests (T82.16, T82.17) (2026-03-16)
- ✅ Timeline Automation API: Token-authenticated REST API for programmatic event management (create/update/delete/list/bulk), API token generation/revocation in Settings, SHA-256 hashed token storage, rate limiting (60 req/min), Cloud Functions HTTP endpoints, Firestore security rules (2026-03-24)
- ✅ Card Text Fitting Phase 1: Card heights derived from typography contract in new `src/layout/cardMetrics.ts` (full 184→132px, compact 120→90px), removed card-body-spacer (date top-aligned under description), unified CARD_SPACING constant across engines, deduplicated CARD_HEIGHT_CELLS, drift-guard unit test; SDS/SRS/problem doc synced; verified via build + 64 unit tests + Playwright 104/36/67 suites (2026-07-04)
- ✅ Layout Plan B2: budget-driven card packing (`DegradationEngine.packHalfColumn`) replaces fixed event-count recipes — shows `min(N, cellBudget)` events (visibility first), then upgrades earliest events title-only→compact→full into a non-increasing staircase; title-only cap dropped (legacy physics), full≤2/compact≤4 kept as soft caps; above/below pack independently. Distribution improved (compact 2→5 on french-revolution). SDS §2.1/2.2 + SRS CC-REQ-DEGRADATION-001 rewritten; tests 39 (pre-existing nav bug) + 70 (recipe→invariants) repaired; verified build + 133 unit + Playwright 104/48/67/36/39/70 + smoke (2026-07-05)
- ✅ Layout Plan B1: new `src/layout/layoutBudget.ts` unifies the vertical half-column budget math (was 3 disagreeing copies in DegradationEngine/CapacityModel/PositioningEngine) into one `getHalfColumnBudget(config, side)` with per-side margins; no-behavior-change refactor (degradation value identical, CapacityModel +2px no boundary crossed); 15 new unit tests; verified build + 79 unit tests + Playwright 104/48/67/36 (17/17, identical distribution) + smoke. Foundation for B2 (2026-07-05)
- ✅ Layout Plan Phase A (A1–A5): removed dead slot-system code (`SlotGrid`/`useSlotLayout`/`SlotGridVisualizer` + 3 config fns + `rowSpacing`), repaired stale test 48 (auth+french-revolution flow), cleared eslint noise (~15k→28 problems, 0 errors), fixed stale doc commands (added `test:prod`/`test:smoke` scripts), hardened T104 with gap-ratio/ellipsis/compact-tier blocks. Surfaced F9-residual finding: full/compact cards carry 26–34% uniform internal dead space from 1-line titles in a 2-line budget → C1 decision. All §2 gates green (2026-07-04)

### Next Up
- **Layout & Cards Improvement Plan — Phase B** (after commit): budget-driven degradation packing (B2), above/below decoupling (B3), capacity math unification (B1), positioning robustness (B4). Reworks card UI — commit Phase A first. See [docs/LAYOUT_IMPROVEMENT_PLAN.md](docs/LAYOUT_IMPROVEMENT_PLAN.md) §5 for open decisions (per-type caps, cluster-coord requirement rewrite, quantized-heights fill).
- **X Post Embeds**: Rich preview of X/Twitter posts in Event Details — embed cards showing tweet text, author, media, and engagement metrics (similar to Telegram link previews). Renders inside the event description or sources section when a source URL is an X post.
- **v1.0.x**: Collaboration and Versioning (fork/merge/diff)

### Test Status
See [docs/TESTS.md](docs/TESTS.md) for detailed test coverage, categories, and run instructions.

### Quick Links
- [Implementation History](docs/PLAN_HISTORY.md) - Completed iterations (v0.0.x - v0.4.x)
- [Requirements Dashboard](docs/SRS_INDEX.md) - Complete requirements overview
- [Product Requirements](PRD.md) - Product vision and user stories
- [Architecture](ARCHITECTURE.md) - Technical design decisions
- [README](README.md) - Getting started guide

---

## 📝 Format Rules

**Format Rules:**
- Iterations: Version number + brief title
- Goal: One-line objective statement (optional)
- Status: Complete/In Progress (only if in progress)
- Tasks: Simple checkbox items only (no sub-bullets, no implementation details)
- NO "Files Modified" sections (use git for that)
- NO "Impact" sections (tasks describe the work)
- NO "Key Accomplishments" or verbose summaries
- Known Issues: Brief bullet points only
- Close iterations chronologically - don't skip ahead
- Move incomplete tasks to future iterations, don't leave them in closed ones

---


# Phase 2: Backend & Authentication (v0.5.x)

### v0.5.0 - Firebase Backend Setup
**Goal:** Set up Firebase Firestore as the persistence layer

- [x] Set up Firebase Firestore database (powertimeline-860f1)
- [x] Install Firebase SDK and create configuration
- [x] Design Firestore collections schema
- [x] Create Firestore service layer (CRUD, real-time subscriptions)
- [x] Create data migration utilities (localStorage to Firestore)
- [x] Migrate to nested timeline structure
- [x] Fix collection group query permissions and indexes

### v0.5.0.1 - Event Persistence Optimization
**Goal:** Separate events from timeline metadata for better performance

- [x] Update Timeline type to separate metadata from events
- [x] Create EventDocument type for event subcollection
- [x] Update Firestore service to handle events subcollection
- [x] Update security rules for events subcollection
- [x] Create migration script (371 events migrated)
- [x] Update pages to use getTimelineMetadata for lists
- [x] Create smoke tests for HomePage and UserProfilePage

### v0.5.0.2 - Home & User Page Enhancements
**Goal:** Improve user experience and functionality on HomePage and UserProfilePage

- [x] Fix view counting (skip owner views)
- [x] Add user profile editing (EditUserProfileDialog)
- [x] Create initials avatar system (UserAvatar component)
- [x] Add user statistics display to UserProfilePage
- [x] Add "Create Timeline" button on profile page
- [x] Add timeline sorting dropdown (4 options)
- [x] Add admin reset statistics feature
- [x] Fix Firestore permission errors
- [x] Create tests for profile editing and admin stats

### v0.5.0.3 - Test Suite Modernization & Data Cleanup
**Goal:** Update test suite to work with new routing architecture

- [x] Create user-agnostic test utilities (loginAsTestUser, loadTestTimeline)
- [x] Update all 66 test files to use new utilities
- [x] Fix timeline ID references for Firestore
- [x] Migrate to `domcontentloaded` instead of `networkidle`
- [x] Move tests to organized directories (home/, admin/, editor/)
- [x] Fix React duplicate key bugs in HomePage/UserProfilePage
- [x] Clean up duplicate Firestore data

### v0.5.0.4 - Development Environment & Production Infrastructure
- [x] Create separate Firebase project for development
- [x] Configure environment-specific Firebase credentials
- [x] Install Firebase Admin SDK
- [x] Create production database cleanup script
- [x] Clean production Firestore database
- [x] Create production smoke tests

### v0.5.1 - Firebase Authentication Foundation
- [x] Install Firebase Authentication SDK
- [x] Create auth service layer and LoginPage
- [x] Create validation utilities
- [x] Create AuthContext and ProtectedRoute
- [x] Add VITE_ENFORCE_AUTH feature flag
- [x] Integrate Firebase Auth with UserProfileMenu

### v0.5.2 - Landing Page Redesign
- [x] Apply dark theme color palette
- [x] Redesign hero with gradient headline effect
- [x] Add Sign In button and search bar to hero
- [x] Create timeline examples gallery
- [x] Verify WCAG AA contrast compliance

### v0.5.3 - Public Timeline Access & Navigation Redesign
- [x] Create TopNavBar for unauthenticated users
- [x] Redesign NavigationRail with dark theme
- [x] Enable public timeline viewing without auth
- [x] Add read-only mode to EditorPage
- [x] Keep ProtectedRoute for /admin and profile routes

### v0.5.4 - Authentication Security & Demo User Removal
**Goal:** Secure Firestore rules and remove localStorage demo system

- [x] Fix Firestore security rules for events subcollection
- [x] Move test user password to environment variable
- [x] Remove localStorage demo user system
- [x] Enable public timeline browsing without authentication
- [x] Complete E2E journey test coverage

### v0.5.5 - Public Browsing & Dark Theme
**Goal:** Unified dark theme and public browsing experience

- [x] Fix public browsing on HomePage (/browse)
- [x] Apply unified dark theme to all pages
- [x] Update TopNavBar with Microsoft-style auth pattern

### v0.5.6 - Landing Page & Public Browsing Polish
**Goal:** Improve landing page messaging, navigation, and public browsing experience

- [x] Remove legacy getCurrentUser() calls (use AuthContext)
- [x] Fix breadcrumb and nav rail navigation
- [x] Add BETA indicator badge
- [x] Redesign navigation rail (global + contextual items)
- [x] Add light/dark theme support with CSS variables
- [x] Fix LandingPage timeline navigation (Firestore)
- [x] Improve hero section messaging
- [x] Add mobile responsiveness and loading skeletons

### v0.5.7 - Authentication Production Deployment
**Goal:** Enable authentication enforcement in production

- [x] Enable VITE_ENFORCE_AUTH=true in production
- [x] Re-enable Firestore security rules requiring authentication
- [x] Deploy auth-enabled Firestore rules
- [x] Add auth migration documentation

### v0.5.8 - Documentation Improvements
**Goal:** Improve documentation navigation and developer experience

- [x] Update PLAN.md Quick Summary and SRS_INDEX.md
- [x] Update TESTS.md with production test results
- [x] Document naming conventions in CONTRIBUTING.md

### v0.5.9 - Test Organization
**Goal:** Clean up test suite organization

- [x] Rename tests/v5/ to tests/editor/ for clarity
- [x] Update all test imports and playwright.config.ts
- [x] Create manual test workflow (.github/workflows/tests.yml)
- [x] Verify tests pass locally

### v0.5.10 - Vision & Positioning Update
**Goal:** Communicate product vision and improve SEO/discoverability

- [x] Rewrite landing page messaging with "connect the dots" vision
- [x] Add "The Problem" and "Who It's For" sections
- [x] Update features section
- [x] Add Open Graph meta tags and Twitter cards
- [x] Create custom 404 page

### v0.5.11 - Test Stabilization & Legacy Code Cleanup
- [x] Create Firebase Auth test utilities
- [x] Update all admin/home test files with Firebase Auth
- [x] Remove legacy getCurrentUser() calls and UserSwitcherModal
- [x] Migrate dialogs and panels to useAuth hook
- [x] Fix admin tests (82-86) and home tests (T71-T73)

### v0.5.11.1 - UI Polish & Theme Defaults
- [x] Add "PowerTimeline BETA" branding
- [x] Set dark mode as default theme with localStorage persistence

### v0.5.12 - Firestore Schema Cleanup
- [x] Remove unused fields from User type (avatar, bio, name)
- [x] Remove unused fields from Event type (order, priority, category, excerpt)
- [x] Run migration on dev and production databases
- [x] Create SRS_DB.md schema validation tests

### v0.5.13 - Multi-Agent Orchestration Tooling
- [x] Create agents/ module with spawner, logger, context_loader
- [x] Implement MCP server with spawn_claude, spawn_codex tools
- [x] Auto-logging to IAC.md and CONTEXT.md
- [x] Create .mcp.json configuration for Claude Code

### v0.5.14 - Timeline Navigation & URL Fixes
- [x] Remove deprecated fields from types and components
- [x] Implement username-based URLs (/:username/timeline/:id)
- [x] Create UsernameSelectionDialog for first-time users
- [x] Legacy UID-based URLs auto-redirect to username URLs
- [x] Update all test utilities and navigation links

### v0.5.14.1 - MCP Agent Server Improvements
- [x] Add threading locks and concurrency safety
- [x] Redesign IAC.md format with in-place status updates

### v0.5.14.2 - Production Bug Fixes
- [x] Fix timeline navigation fallbacks
- [x] Add visibility filter to discovery feeds

### v0.5.14.3 - URL Structure & Test Fixes
- [x] Change route pattern from /@:username to /:username
- [x] Update test files with correct URL patterns

### v0.5.14.4 - Navigation Bug Fix
- [x] Fix 11 navigate() calls to use /:username pattern

---

### v0.5.15 - Test & Bug Fix Backlog
- [x] MCP agent server improvements (threading, logging, cost tracking)
- [x] Fix admin tests (T82-T86) and Codex write access
- [x] Filter private timelines from discovery feeds
- [x] Create strict smoke tests requiring event loading

### v0.5.15.1 - Stabilization & Test Health
- [x] Fix admin test suite (T82-T86 selectors and testids)
- [x] Add E2E tests for search, feeds, and visibility filtering
- [x] Fix multi-event layout bug in DegradationEngine
- [x] Create .env.test.example and update CONTRIBUTING.md

### v0.5.15.2 - MCP Server Optimization & Test Fixes
- [x] Implement compact list() and wait_for_agents() tools
- [x] Fix test selectors and optimize seeding with Firestore Admin SDK

### v0.5.16 - Firestore Data Refinement
- [x] Clean up deprecated User field references
- [x] Seed French Revolution and Napoleon timelines
- [x] Pass SRS_DB.md compliance tests

### v0.5.17 - Platform Statistics Aggregation
- [x] Create stats/platform Firestore document with caching
- [x] Add cache invalidation on timeline create/delete

### v0.5.18 - Timeline Card Menu Implementation
- [x] Add Open, Edit, Delete, Go to Owner menu options
- [x] Enhance DeleteTimelineDialog with name confirmation
- [x] Landing page and user page improvements

### v0.5.19 - Landing Page Roadmap Section
- [x] Create git-style roadmap visualization with vertical line
- [x] Show completed and upcoming phases with responsive design

### v0.5.20 - Editor Dark Theme Contrast Fixes
- [x] Fix Timeline Axis and Breadcrumb dark theme contrast
- [x] Use CSS variables for theme-aware colors

### v0.5.21 - Event Editor Dark Mode Fix
- [x] Fix AuthoringOverlay dark theme (container, panels, inputs, text)
- [x] Fix EventPreviewList theme colors

### v0.5.19.1 - Timeline Axis Date Alignment & Labels Fix
- [x] Fix time range calculation to match LayoutEngine logic
- [x] Fix axis label colors for dark theme

### v0.5.21.1 - Modern Rectangle Scrollbar Styling
- [x] Add scrollbar CSS variables for dark/light themes
- [x] Implement Webkit and Firefox scrollbar styling

### v0.5.22 - Cloud Functions for Platform Statistics
- [x] Set up Firebase Cloud Functions with Blaze plan
- [x] Implement user/timeline/event triggers for atomic counter updates
- [x] Simplify client getPlatformStats() with caching

### v0.5.23 - Event Editor & Viewer Rework
- [x] Add isOwner prop for read-only viewing
- [x] Enhanced visual design and EventPreviewList UX

### v0.5.24 - Dev Panel Removal
- [x] Migrate 17 test files from Dev Panel to loadTestTimeline()
- [x] Remove DevPanel.tsx and all 96 references
- [x] Deprecate CC-REQ-PANELS-DEV-001

### v0.5.25 - PowerSpawn: Universal Multi-Agent MCP Server
- [x] Create standalone PowerSpawn repository with git submodule
- [x] Implement spawn_claude, spawn_codex, spawn_copilot tools
- [x] Create landing page with GitHub Pages deployment
- [x] New branding: PT logo, hero banner, favicon

### v0.5.26 - Stream Editor: Mobile Timeline Viewer
- [x] Create StreamViewer with git-style vertical layout
- [x] StreamViewerOverlay for desktop/mobile
- [x] Update MobileNotice with Stream View option
- [x] Add design tokens for stream viewer

### v0.5.26.1 - Stream Viewer Enhancements
- [x] Fix overlay focus, escape key, and mouse interaction
- [x] Add search bar, event click zoom, hover sync with minimap
- [x] Move Stream View button to NavRail with slide-up transition

### v0.5.26.3 - Stream Viewer Polish
- [x] Add minimap, breadcrumbs, fix mouse wheel scrolling
- [x] Create SRS_STREAM_VIEW.md and comprehensive E2E tests

### v0.5.26.4 - Stream Viewer UX & Home Reorder
- [x] Move search to header, add expandable cards, keyboard navigation
- [x] Reorder Home: Popular → Statistics → Recently Edited

### v0.5.26.5 - Stream Viewer Visual Polish
- [x] Softer edges, backdrop blur, refined shadows

### v0.5.27 - Timeline Import/Export
- [x] YAML v1 format with merge-by-ID import
- [x] ImportExportOverlay in NavRail with validation
- [x] E2E tests (T-IMEX-01 through T-IMEX-05)

### v0.5.27.1 - PowerSpawn Copilot CLI Fix
- [x] Fixed Copilot CLI invocation with `-p` flag

### v0.5.28 - Test Sweep Corrective Actions
- [x] Fix .env.test and CONTRIBUTING.md documentation
- [x] Fix anchor alignment tests with waitForSelector
- [x] Add auth-tests CI job

### v0.5.29 - Technical Debt & Codebase Hygiene
- [x] Create sync-version.cjs script
- [x] Root directory cleanup and README updates
- [x] Code cleanup (console checks, dead code, skipped tests)

### v0.5.30 - PowerSpawn Test Suite
- [x] Copilot CLI permissions work correctly (investigation complete)
- [x] Unit tests: test_imports.py, test_parser.py, test_logger.py
- [x] Integration tests: test_mcp_server.py (11 tests)

### v0.5.31 - UX Polish & Resilience
- [x] Dark mode scrollbar styling
- [x] My Timelines 2-row layout
- [x] Code cleanup (console checks, dead code)
- [x] Test infrastructure (skipIfNoCredentials helper)
- [x] Loading Skeletons (SkeletonCard component)
- [x] Micro-interactions: Hover states, transitions, card animations
- [x] Error Recovery: ErrorState component with retry
- [x] Toast Notifications: ToastContext, ToastContainer, useToast hook
- [x] Accessibility: Focus states, ARIA labels, reduced-motion support

### v0.5.32 - User Settings & Public Profiles
**Goal:** Fix profile access and add user account management
**Status:** Deferred

**Documentation:**
- [x] Create `SRS_USER_PAGE.md` - User profile page requirements (30 reqs)
- [x] Create `SRS_USER_SETTINGS_PAGE.md` - Settings page requirements (23 reqs)

**Implementation:**
- [x] **Public Profile Access:** Remove ProtectedRoute from `/:username`, allow public viewing
- [x] **User Settings Page:** Create `/settings` route with profile info, password, preferences
- [x] **Password Management:** Firebase Auth password reset/change flow
- [x] **Nav Icon Fix:** Replace nav-rail user icon with standard person icon
- [ ] **Account Deletion:** Allow users to delete their account (GDPR compliance)

**Testing:**
- [ ] E2E tests for public profile access (dev + prod)
- [ ] E2E tests for settings page functionality

### v0.5.33 - Stream Editor Mobile Editing
**Goal:** Make Stream Editor a full mobile editing experience
**Status:** Deferred

**Documentation:**
- [x] Update `SRS_STREAM_VIEW.md` with editing requirements (13 new reqs)

**Implementation:**
- [x] **Slide-up Edit Panel:** StreamEditPanel component for mobile inline editing
- [x] **Quick Add Button:** [+] button in header to create new event
- [x] **Swipe Actions:** Swipe left/right to reveal edit/delete actions
- [x] **Mobile Event Form:** Simplified form optimized for touch
- [x] **Mobile Auto-open:** Stream View auto-opens on mobile viewport
- [x] **Desktop Edit UX:** Click event closes Stream View, navigates to editor

**Testing:**
- [ ] E2E tests for stream view editing
- [ ] Mobile viewport tests

### v0.5.34 - Navigation Icons (Stream ↔ Editor ↔ Canvas)
**Goal:** Add explicit navigation icons for quick switching between views

**Stream View (hover on event card):**
- [x] Show icons only on hovered event card (upper-right boundary)
- [x] Eye icon: Close stream view, zoom to event on canvas
- [x] Edit icon: Close stream view, open event editor panel

**Event Editor Panel (header icons):**
- [x] Add Eye icon: Close editor, zoom to event on canvas
- [x] Add Stream icon: Switch to stream view
- [x] Group 4 icons with modern UI (drawer/menu if space-constrained)

**Error Handling:**
- [x] Add GitHub Issues link to ErrorBoundary component

### v0.5.35 - Bug Fixes + Settings NavRail
**Goal:** Fix event editor bug and improve NavRail layout

- [x] BUG FIX: "Add new event" in existing timeline doesn't load existing events in Event Editor navigation panels
- [x] Change "My Timelines" icon from `person` to `collections` (distinct from Sign In)
- [x] Move Settings to bottom utilities section (above theme toggle)
- [x] Create utilities section type in NavigationRail for bottom-positioned items
- [x] BUG FIX: Settings icon position - pin to bottom instead of floating mid-way

### v0.5.36 - Full-Width Layout Trial
**Goal:** Experiment with full-width page layouts

- [x] Expand Home, Settings, User pages to full horizontal width
- [x] Remove max-width constraints from HomePage (header + main content)
- [x] Remove max-width constraints from SettingsPage (header + main content, keep max-w-5xl for readability)
- [x] Remove max-width constraints from UserProfilePage (header + profile + timelines)
- [x] Remove max-width constraints from AdminPage (header + tabs + content)
- [x] BUG FIX: Dark mode timeline axis "halo" effect - made container transparent
- [x] FIX: Keep original card sizes but fit more cards per row on wide screens
- [x] FIX: Statistics section cards now use fixed widths (flex-wrap) instead of stretching
- [x] BUG FIX: "My Timelines" card size mismatch - now matches Popular/Recent sections
- [x] Evaluate UX: Compare current centered layout vs full-width expansion (User decided: keep wide layout)

**Known Issues / Feedback:**
- [x] BUG: Admin page dark mode not actually dark - FIXED
- [x] Admin page wide layout applied
- [x] My Timelines card sizing fixed to match other sections
- [x] BUG: Card menu (sandwich) poor contrast in dark mode - FIXED
- [x] DESIGN: Timeline axis & event anchors - git-style circular dots with dashed connector lines - FIXED
- [x] TRIAL: Landing page - use PowerTimeline banner as full-width background
- [x] Landing page: Increased section/card transparency, glassmorphism orange button
- [x] Unify logo: Replace custom logo.png with MUI TimelineIcon across NavRail/headers
- [x] Landing page: Update Product Roadmap section to reflect v0.5.36 progress
- [x] BUG FIX: Minimap viewport indicator poor contrast in dark mode - now purple accent
- [x] BUG: Minimap events barely visible in dark mode (blue on dark) - switched to orange

### v0.5.37 - Timeline Visual Polish
**Goal:** Refine timeline anchor appearance

- [x] **Anchor Shape:** Revert anchors from triangles back to diamond/milestone shape (rotated square)
- [x] **Keep Size:** Maintain smaller size (w-2.5 h-3) from v0.5.37 changes
- [x] **Border Radius:** Add rounded-sm for softer edges
- [x] **Remove clip-path:** Simplify CSS with transform rotate-45deg

### v0.5.38 - User Onboarding Experience
**Goal:** Guide new users from "blank slate" to their first successful timeline

- [x] **Empty States:** Actionable empty states for "My Timelines" with prompts
- [x] **Starter Templates:** "Use Template" option (Biography, Project Plan, Historical Era)
- [x] **Guided Tour:** Interactive walkthrough for the Editor
- [x] **Contextual Help:** Tooltips for complex features

---

## Phase 3: Sharing (v0.6.x)

### v0.6.0 - Share Links
**Goal:** Allow users to easily share timeline links

- [x] **Editor Share Button:** Add share/copy link button in editor (top-right)
- [x] **Card Menu Share:** Add "Copy Link" option to timeline card menu (HomePage/UserProfilePage)
- [x] **Toast Feedback:** Show "Link copied!" toast confirmation

### v0.6.1 - Editor UX Polish
**Goal:** Fix navigation bugs and improve editor discoverability

**Bug Fixes:**
- [x] **Breadcrumb Navigation Bug:** Clicking username in breadcrumb goes to landing page instead of user profile (fix: `/@username` → `/${username}`)
- [x] **Share Button Position:** Move share button lower to avoid minimap overlap

**Editor Enhancements:**
- [x] **User Profile Icon:** Add profile icon below share button (opens UserProfileMenu dropdown)
- [x] **Compact User Profile Button:** Hover-expandable profile button (circular → pill with username on hover)
- [x] **Events Panel Click-Outside:** Collapse panel when clicking outside on timeline
- [x] **Events Panel Action Buttons:** Add edit (pencil) and view (eye) icons on hover for each event item

### v0.6.2 - Error Handling & Documentation
**Goal:** Help users report issues and document editor requirements

- [x] **GitHub Issues Link:** Add link to GitHub issues page in error messages (ErrorState, ErrorBoundary, Toast)
- [x] **SRS_TIMELINE_EDITOR.md:** Created per-page requirements doc (28 requirements for editor controls)
- [x] **Firebase Error Messages:** Improve Firebase error messages with actionable guidance (deferred)

### v0.6.3 - Event Sources
**Goal:** Allow users to cite sources for timeline events

**Data Model:**
- [x] **Event.sources Field:** Add optional `sources: string[]` field to Event type
- [x] **Firestore Schema:** Update Event document schema to include sources
- [x] **Migration:** Backward compatible (existing events have no sources)

**Editor View:**
- [x] **Sources Section:** Collapsible section in AuthoringOverlay for viewing/editing sources
- [x] **SourcesEditor Component:** New component with add/edit/delete functionality
- [x] **Add Source:** Button to add new source with Enter to save, icon button for validation
- [x] **Edit/Delete Source:** Inline editing and removal of individual sources
- [x] **URL Detection:** Auto-detect URLs (http/https) vs plain text for display styling
- [x] **Drag-and-Drop Reordering:** HTML5 drag-and-drop for source reordering

**Stream View:**
- [x] **Sources Indicator:** Badge with source icon + count if event has sources
- [x] **Navigate to Editor:** Clicking sources badge opens Editor with that event selected
- [x] **Escape Key Fix:** stopPropagation to prevent overlay closing when canceling source input

**Testing & Documentation:**
- [x] **SRS Documentation:** docs/SRS_EVENT_SOURCES.md with 37 requirements
- [x] **E2E Tests:** 4 Stream View tests (indicator visibility, count, no-sources, click-to-edit)

### v0.6.4 - Bug Fixes
**Goal:** Address reported bugs

- [x] **Editor Panel Click Bug:** Clicking events/edit buttons in Editor panels was closing the overlay (fix: check e.target === e.currentTarget)
- [x] **View on Canvas Bug:** Eye icon in Editor wasn't zooming to event (fix: call handleStreamEventClick before closing)

## Phase 4: AI Integration & Git-Style Workflows (v0.7.x)
> **Vision:** AI assistance + review workflows that lay groundwork for future collaboration (fork/merge/diff)

### v0.7.0 - AI Integration (Chat Assistant)

**Status:** ✅ Complete

#### Completed Tasks:
- [x] SRS_AI_INTEGRATION.md (125 requirements)
- [x] TypeScript types (`src/types/ai.ts`)
- [x] AI Service for Gemini API (`src/services/aiService.ts`)
- [x] useAISession hook (`src/hooks/useAISession.ts`)
- [x] ChatPanel component (`src/app/panels/ChatPanel.tsx`)
- [x] Context builder (`src/lib/aiContextBuilder.ts`)
- [x] Action handlers (`src/lib/aiActionHandlers.ts`)
- [x] App.tsx integration
- [x] E2E tests (`tests/ai/chat-panel.spec.ts`)
- [x] RightPanelShell component for right-side panels (`src/app/RightPanelShell.tsx`)

#### Features:
- AI chat panel in editor sidebar
- Google Gemini API integration
- Session-only API key storage (secure)
- Create/update/delete events via natural language
- Action confirmation before applying changes
- Conversation history (session-only)

#### Files Added:
- `docs/SRS_AI_INTEGRATION.md` - 125 requirements
- `src/types/ai.ts` - Type definitions
- `src/services/aiService.ts` - Gemini API wrapper
- `src/hooks/useAISession.ts` - Session management
- `src/app/panels/ChatPanel.tsx` - Chat UI
- `src/lib/aiContextBuilder.ts` - Context preparation
- `src/lib/aiActionHandlers.ts` - Action execution
- `tests/ai/chat-panel.spec.ts` - E2E tests

### v0.7.1 - AI Chat UX & Google Search Integration
**Goal:** Improve AI chat experience with web search and preview events

**API & Search:**
- [x] **Two-Step Search Approach:** Separate google_search and function_declarations calls (REST API limitation workaround)
- [x] **Google Search Grounding:** Gemini 2.5 Flash with google_search tool for researching historical facts
- [x] **Source URL Filtering:** Filter out invalid sources (googleapis.com, cloud.google.com, etc.)
- [x] **Model Upgrade:** Using gemini-2.5-flash with google_search capability

**Chat Widget UX:**
- [x] **Floating Chat Widget:** Intercom-style bottom-right floating button with popup
- [x] **Enter Key to Send:** Enter sends message, Shift+Enter creates newline
- [x] **Scroll Containment:** Added `overscrollBehavior: 'contain'` to prevent timeline scroll

**Preview Events System:**
- [x] **Preview Events:** Show pending AI-created events on timeline before applying
- [x] **Eye Button (👁):** Click to zoom/navigate to preview event on timeline
- [x] **Dashed Red Borders:** Preview events styled with dashed red borders and glow effect
- [x] **Preview Event Editing:** Double-click preview events to open in editor, edits update pending action payload

**AI Reliability:**
- [x] **Intent Detection:** Added `wantsToCreateEvents()` to detect when user wants to create events vs get information
- [x] **Dedicated Prompts:** `CREATE_EVENTS_PROMPT` for event creation requests, `GENERAL_ACTION_PROMPT` for informational queries
- [x] **Function Call Enforcement:** Using Gemini `tool_config.mode: 'ANY'` to force function calls when creating events
- [x] **Scroll Containment Fix:** Added `onWheel` handler to stop event propagation in chat panel

**Known Limitations:**
- REST API doesn't support google_search + function_declarations in same request (hence two-step approach)
- Gemini 3 Pro Preview doesn't support this combination at all

### v0.7.2 - Preview Events UX Polish & Input Refinement
**Goal:** Fix preview event display and editing behavior, reduce input placeholder font size
**Status:** ✅ Complete

**Chat Panel:**
- [x] **Scrollable Content:** Make entire chat content scrollable including pending actions section
- [x] **Overflow Fix:** Ensure "Approve All" / "Apply" buttons are always visible (moved inside scrollable area)

**Preview Event Styling:**
- [x] **Consistent Highlighting:** Preview events have distinct body coloring (amber background) + boundary styling (dashed border + glow)
- [x] **CSS Variables:** Theme-aware colors for preview styling (dark/light mode support)
- [ ] **Pending vs Approved:** Pending events show preview styling, approved events show normal styling

**Editor Behavior:**
- [x] **Normal Editor View:** Double-clicking preview event shows normal editor (not "New Event")
- [x] **Read-only Default:** Preview events open in read-only view, user clicks Edit to modify
- [x] **Payload Sync:** Edits to preview events update the AI action payload
- [x] **No Delete Button:** Preview events hide delete button (reject via chat instead)

**Input Refinement:**
- [x] **Smaller Placeholder Font:** Reduce placeholder text font size (0.75rem) with reduced opacity (0.7) for better visual hierarchy

### v0.7.3 - Bug Fixes & Code Cleanup
**Goal:** Fix AI event persistence and clean up development artifacts
**Status:** ✅ Complete

**Critical Bugs:**
- [x] **AI Event Persistence:** Root cause identified - events stored in subcollection, not field. Fixed to use `addEvent()`, `updateEvent()`, `deleteEvent()` properly
- [x] **Owner Permission Check:** ChatPanel only shows for owners; AI actions check `isOwner` before saving

**Console Cleanup:**
- [x] **Console.log Cleanup:** Removed debugging console.log statements (kept logger.ts, migration logs, activity logs)
- [x] **DegradationEngine Warnings:** Silenced "Card type mismatch" and other verbose warnings

**UX Polish:**
- [x] **Overflow Indicators:** Restyled to be smaller, centered on axis, with rose outline instead of red fill
- [x] **Rejected Events Re-enable:** Added `restoreActions` - rejected suggestions show visibility_off icon to restore

### v0.7.4 - Production Bug Fixes
**Status:** ✅ Complete

- [x] **Firestore Event ID Fix:** Events loaded from Firestore were missing `id` field (doc.data() doesn't include doc.id)
- [x] **Minimap Glow Fix:** Added undefined check to prevent all markers appearing highlighted
- [x] **Side Panels Fix:** Fixed undefined === undefined comparison causing all events to show as "current"
- [x] **Overlay View Mode:** AuthoringOverlay now opens for all users in view-only mode
- [x] **API Key Hint:** Added security reminder in ChatPanel that API key is session-only
- [x] **Favicon Cache-Bust:** New favicon with cache-busting query parameter

### v0.7.5 - Default Light Theme & Theme Fixes
**Goal:** Change default theme to light and fix theme-related issues

- [x] Change default theme from dark to light
- [x] Update ThemeContext to default `isDarkMode: false`
- [x] Update localStorage initialization to prefer light mode
- [x] Update index.html theme-color meta tag to light (#FAFAFA)
- [x] Verify all pages render correctly in light mode by default

### v0.7.6 - Critical Accessibility Fixes
**Goal:** Address WCAG compliance gaps identified in codebase audit

- [x] Add landmark regions (`<main>`, `<nav>`, `<aside>`) to key layouts
- [x] Implement `prefers-reduced-motion` media query support
- [x] Audit and fix gray-on-gray contrast issues (WCAG AA)
- [x] Ensure all touch targets are minimum 44px
- [x] Add `aria-hidden` to decorative Material Symbols icons

### v0.7.7 - Firebase Data Consistency Fixes
**Goal:** Fix race conditions and N+1 query problems

- [x] Fix race condition in `addEvent()` - use `increment(1)` instead of read-count-write
- [x] Fix race condition in `deleteEvent()` - use `increment(-1)`
- [x] Use serverTimestamp() for consistent timestamps
- [x] Fix N+1 query in `getTimelineMetadata()` - reduce fallback from 500 to 50 docs
- [x] Fix sequential user fetches in UserProfilePage - use `Promise.all`
- [x] Consolidate event CRUD patterns (App.tsx now uses atomic operations)

### v0.7.8 - Offline Support & Error Recovery
**Goal:** Enable Firebase offline persistence and improve error handling

- [x] Enable `enableIndexedDbPersistence()` in Firebase config
- [x] Add offline status indicator in UI (OfflineIndicator component)
- [x] Add retry logic with exponential backoff (src/utils/retry.ts)
- [x] Improve error messages with actionable guidance (getFirestoreErrorMessage)
- [x] Add connection status monitoring (online/offline event listeners)

### v0.7.9 - AI Metadata Preview ✅
**Goal:** Allow users to preview and review timeline metadata changes proposed by AI

- [x] **Metadata Preview UI:** Show current vs proposed title/description in ChatPanel
- [x] **Diff View:** Side-by-side or inline diff for text changes
- [x] **Approve/Reject Metadata:** Same workflow as events (approve, reject, restore)
- [x] **Apply Confirmation:** Clear feedback when metadata is updated

### v0.7.10 - Partial Import (Preview & Review)
**Goal:** Import events with review workflow - foundation for git-style fork/merge/diff

- [x] Preview imported events with per-event status tracking
- [x] Per-event approve/reject controls with visual feedback
- [x] Selective apply - approve individual events or all at once
- [x] Conflict detection for duplicate IDs and overlapping dates

### v0.7.11 - Code Quality & TypeScript Cleanup
**Goal:** Address code quality issues from codebase audit

- [x] Remove `any` types from critical service files (firestore.ts, AuthoringOverlay, StatisticsDashboard)
- [x] Audit console.log statements (most are intentionally gated by debug flags)
- [x] Analyze homePageStorage.ts (still needed for migration support and slug utility)
- [ ] Split App.tsx into smaller components (deferred - risk of breaking changes)
- [ ] Split AuthoringOverlay into sub-components (deferred - risk of breaking changes)
- [ ] Fix axis tick TODO (deferred - enhancement, not bug)

### v0.7.12 - Unit Testing Infrastructure
**Goal:** Add unit tests for business logic (currently 0 unit tests)

- [x] Set up Vitest for unit testing (vitest.config.ts, npm scripts)
- [x] Add unit tests for emailValidation.ts (7 tests)
- [x] Add unit tests for clustering.ts (15 tests)
- [x] Add unit tests for CapacityModel.ts (36 tests)
- [x] Total: 58 unit tests passing

### v0.7.13 - Documentation Consistency Fix
**Goal:** Resolve documentation drift and contradictions

- [x] Deduplicate 25 duplicate requirement IDs across SRS files
- [x] Update README.md metrics (177 → 340 requirements, 287 → 378 tests)
- [x] Re-audit SRS_INDEX.md against v0.7.x codebase
- [x] Update PLAN.md metrics to match SRS_INDEX.md
- [x] Create DOCUMENTATION_FIXES_v0.7.13.md analysis report

### v0.7.14 - YAML Schema API ✅
**Goal:** Publish schema for AI agents to discover and use

- [x] Create JSON Schema file at `/schema/timeline.schema.json`
- [x] Add comprehensive documentation with examples (README.md)
- [x] Include field descriptions, validation rules, and format requirements
- [x] Verify schema is served in production build

---

## Phase 5: Production Polish & Stability (v0.8.x)
> **Vision:** Make PowerTimeline production-ready - clean, fast, and reliable

### v0.8.0 - Documentation and SRS Cleanup ✅
- [x] SRS audit and format standardization
- [x] Update metrics in SRS_INDEX.md, README.md, ARCHITECTURE.md
- [x] Fix SRS_CARDS_SYSTEM.md compact card height (92px → 82px)

### v0.8.1 - UI Audit ✅
- [x] Canvas/Editor, Navigation, Pages audit
- [x] 59 issues documented in docs/archive/audits/UI_AUDIT_FINDINGS.md

### v0.8.2 - UI Visual Bug Fixes ✅
- [x] Theme system fixes (Node, Minimap, TopNavBar, LoginPage)
- [x] Z-index standardization (tokens.css layer system)
- [x] Focus states and accessibility improvements

### v0.8.2.1 - Visual Audit & Z-Index Fixes ✅
- [x] Automated overlap detection tests
- [x] Fix zoom controls, breadcrumbs, AuthoringOverlay z-index
- [x] Navigation Rail and Minimap z-index fixes

### v0.8.2.2 - Visual Audit Test Infrastructure ✅
- [x] Authentication support in visual tests
- [x] Smart overlap detection (T87-T93)
- [x] Boundary and coherency tests

### v0.8.2.3 - Test Coherency Analysis ✅
- [x] Eliminate audit theater (89% fake assertions → 100% real)
- [x] Create T97 high-density stress tests
- [x] Fix pan tests (wheel → drag)

### v0.8.2.4-v0.8.2.8 - T97 Algorithm Iterations ✅
- [x] Dense spot detection via telemetry
- [x] Mathematical capacity algorithm
- [x] Temporal density (finds 1793-1794 as densest)
- [x] Visual fill algorithm (bucket-based scoring)

### v0.8.2.9 - Safe Zones & Breadcrumb UX ✅
**Goal:** Fix card/minimap/breadcrumb overlap with unified safe zones

- [x] Add HEADER_SAFE_ZONE (100px) to config.ts
- [x] Shift timelineY down to clear minimap/breadcrumb
- [x] Add left safe zone (200px) for breadcrumb protection
- [x] Transparent breadcrumb (visible text, card on hover)
- [x] Breadcrumb z-index: behind cards normally, above on hover
- [x] Increase card-to-axis spacing (40→48px above, 20→28px below)

### v0.8.3 - Layout Performance & UX Polish
**Goal:** Performance optimizations and UX micro-interactions

**Performance:**
- [x] Spatial hashing for O(n) collision detection (PositioningEngine.ts)
- [x] Virtualization - render only visible cards with 200px buffer
- [x] Map lookup for O(1) anchor→card association (cardsByEventId)
- [x] Layout caching across pan/zoom when events unchanged
- [x] Fix layout cache invalidation to track viewStart/viewEnd changes
- [x] Remove dead connector code from CardRenderer.tsx

**UX:**
- [x] Hover card preview for degraded cards (CardHoverPreview.tsx)
- [x] Hover lift effect (scale 1.02, shadow elevation)
- [x] Zoom toward cursor position (Google Maps style)
- [x] New interaction model: Click+drag=pan, Ctrl+click=selection zoom, Shift+scroll=horizontal pan

**Documentation:**
- [x] Update SRS_CARDS_SYSTEM.md with v0.8.3 performance & UX requirements (6 new requirements)

**Backlog (deferred):**
- [ ] Mobile bottom sheet for event details

### v0.8.3.1 - Interaction Keybind Swap ✅
**Goal:** Swap keybinds to make selection zoom the default interaction

**Interaction Model:**
- [x] Swap click+drag = selection zoom (default, crosshair cursor)
- [x] Swap Space+drag = pan (grab/grabbing cursor)
- [x] Keep Shift+scroll = horizontal pan
- [x] Keep plain wheel = zoom toward cursor
- [x] Update SRS_ZOOM.md with new keybind model

**Testing:**
- [x] Create T98 test file (tests/editor/98-interaction-model-v083.spec.ts)
- [x] T98.1: Selection zoom (click+drag creates blue overlay, zooms on release)
- [x] T98.2: Space+drag pan (grab/grabbing cursors)
- [x] T98.3: Shift+scroll horizontal pan
- [x] T98.4: Plain wheel zoom toward cursor
- [x] T98.5: Boundary constraints (pan stops at 0 and 1)
- [x] T98.6: Small selection (<20px) does not trigger zoom
- [x] T98.7: Cursor styles update correctly for each mode

### v0.8.3.4 - Events Panel Removal ✅
**Goal:** Remove OutlinePanel (Events Panel) - functionality consolidated into Stream View

**Code Removal:**
- [x] Remove OutlinePanel lazy import and rendering from App.tsx
- [x] Remove 'events' from overlay state handling in App.tsx
- [x] Remove openEvents/closeEvents functions from App.tsx
- [x] Remove Events button from NavRail configuration in App.tsx
- [x] Remove Events Panel command from Command Palette in App.tsx
- [x] Delete src/app/panels/OutlinePanel.tsx
- [x] Check if src/app/OverlayShell.tsx is used elsewhere (kept - used by EditorPanel, ImportExportOverlay)

**Documentation Updates:**
- [x] Update docs/SRS_TIMELINE_EDITOR.md - remove Events Panel section
- [x] Update docs/SRS_STREAM_VIEW.md - note it replaces Events Panel
- [x] Update keyboard shortcut references (Alt+E removed)

**Test Updates:**
- [x] Delete tests/editor/66-panel-hover-highlighting.spec.ts (covered by T82.13)
- [x] Update tests/editor/50-panels-visibility.spec.ts - remove Events Panel tests
- [x] Update tests/editor/55-navigation-enhancements.spec.ts - remove Alt+E tests
- [x] Update tests/editor/51-authoring-overlay.spec.ts - use Stream View instead
- [x] Update visual audit tests (94, 96) - deprecate Events Panel tests

**Verification:**
- [x] Run npm run build - no errors
- [x] Run npm run lint - no errors (warnings only)
- [x] Core tests pass (22/24 in affected files)

### v0.8.4 - Mobile and Responsive Testing Infrastructure ✅
**Goal:** Establish multi-viewport testing and ensure mobile reliability

**Playwright Multi-Viewport Setup:**
- [x] Add projects to playwright.config.ts (desktop, desktop-xl, tablet, mobile)
- [x] Configure device emulation (iPhone 14, iPad Mini)
- [x] Add desktop-xl project (2560x1440) for large screen testing
- [x] Add npm scripts: test:mobile, test:responsive, test:all
- [x] Document test categories in tests/README.md

**Test Directory Structure:**
- [x] Create tests/responsive/ for cross-viewport tests
- [x] Create tests/mobile/ for mobile-only tests
- [x] Add viewport metadata to test descriptions

### v0.8.5 - Mobile Performance and Offline ✅
**Goal:** Fast loading and offline resilience for mobile users

**Stream View Mobile Editing:**
- [x] Swipe left/right to reveal edit/delete actions (already implemented)
- [x] Quick add button in Stream View header (already implemented)
- [x] Touch gesture refinements

**Offline Support:**
- [x] Service worker for static asset caching (vite-plugin-pwa)
- [x] Offline indicator with retry action
- [x] Workbox configuration for runtime caching

### v0.8.6 - Test Coverage and Stability ✅
**Goal:** Fill critical test gaps and fix flaky tests

**Admin Panel Fix:**
- [x] Fix T83, T84, T86 selector issues
- [x] Verify admin test infrastructure

### v0.8.7 - UX Polish and Final Touches ✅
**Goal:** Production-ready visual polish and user experience

**Home Page:**
- [x] Pagination for My Timelines (load 12, then "Load More")

**API Key Storage:**
- [x] Add "Remember on this device" checkbox to ChatPanel
- [x] Store key in localStorage when checkbox enabled
- [x] Add trust disclaimer text below API key input
- [x] Add "Clear stored key" button

**Settings Page Enhancements:**
- [x] Account Deletion with confirmation (GDPR compliance)

**Final Checks:**
- [x] Accessibility audit (WCAG AA compliance verification)
- [x] SEO meta tags on all public pages (react-helmet-async)

### v0.8.8 - Safari/WebKit & Mobile Fixes ✅
**Goal:** Fix critical Safari/WebKit loading issues and mobile test infrastructure

**Safari/WebKit:**
- [x] Firebase IndexedDB persistence fix (use long-polling + memoryLocalCache)
- [x] Safari browser detection in firebase.ts
- [x] WebKit Firebase diagnostics test

**Mobile Fixes:**
- [x] LandingPage horizontal overflow (overflowX: hidden)
- [x] EditorPage horizontal overflow (overflowX: hidden)
- [x] Stream View auto-open blocking MobileNotice fix
- [x] Mobile test selectors and assertions updated

**Documentation:**
- [x] SRS_PWA_OFFLINE.md (14 requirements)
- [x] SRS_SEO.md (12 requirements)
- [x] SRS_HOME_PAGE.md pagination requirements

### v0.8.9 - Performance Optimization ✅
**Goal:** Improve load times, reduce bundle size, optimize rendering

**Completed (2026-01-03):**

**Wave 1 - Data Loading & Quick Wins:**
- [x] P0-1: Parallel data loading with Promise.all() in HomePage
- [x] P0-2: Removed redundant getUsers() call, fetch only visible timeline owners
- [x] P1-2: Added useDebounce hook (300ms) for search filtering
- [x] P1-4: Map-based O(1) lookup for user data instead of Array.find()
- [x] P1-5: Fire-and-forget pattern for view count increment
- [x] P0-6: WebKit/Safari persistence disabled (IndexedDB hangs fix)
- [x] P1-6, P1-7: Firebase Analytics lazy-loaded
- [x] P0-3: Font preconnect hints and display=swap

**Wave 2 - Rendering & Virtualization:**
- [x] P0-5: StreamViewer virtualization with react-window (FixedSizeList + AutoSizer)
- [x] P2-7: CSS-only line clamping (removed JS truncation detection)
- [x] P2-8: Ref-based swipe animation (no state updates during touchmove)
- [x] P0-4: Layout useMemo deps optimized (removed viewStart/viewEnd)
- [x] P1-3: Card content components memoized (React.memo)
- [x] P2-1: Vertical virtualization check added to card filter
- [x] P2-3: Telemetry throttled to 500ms

**Wave 3 - Bundle & Polish:**
- [x] P1-8: Firebase chunk splitting (main bundle: 1544KB → 990KB)
- [x] P1-1: SkeletonCard polish (icon placeholder, 24px title, 3 badge placeholders)

**Bug Fixes (2026-01-03):**
- [x] Fixed zoom cache invalidation (restored viewWindowUnchanged check)
- [x] Fixed React hook order violation in StreamViewer.tsx
- [x] Skip zoom tests on mobile/tablet (uses Stream View)

### v0.8.10 - State Architecture Refactor
**Goal:** Extract timeline state from App.tsx (~1430 lines) into 4 custom hooks
**Status:** In Progress (Phases 1-3 Complete, Phase 4 Deferred)

**Phases:**
- [x] Phase 1: `useEventEditForm` - Form state for event editing (editDate, editTime, editTitle, editDescription)
- [x] Phase 2: `useTimelineUI` - Overlay and panel visibility state
- [x] Phase 3: `useEventSelection` - Selection state and navigation
- [ ] Phase 4: `useTimelineEvents` - Core events data layer with Firestore sync (DEFERRED - highest risk)

**Completed:**
- Created `src/app/hooks/useEventEditForm.ts` with form state extraction (18 tests)
- Created `src/app/hooks/useTimelineUI.ts` with overlay/panel state extraction (18 tests)
- Created `src/app/hooks/useEventSelection.ts` with selection/navigation (15 tests)
- Integrated hooks into App.tsx, removed duplicate effects
- Build passes, 109 unit tests pass, E2E tests pass

**Deferred:**
- Phase 4 deferred as it involves complex Firestore sync, optimistic updates, and rollback logic
- Current refactoring already achieves significant organization improvement

### v0.8.11 - ownerUsername Denormalization ✅
**Goal:** Eliminate expensive `getUsers()` fetch on HomePage by denormalizing username onto timeline documents

**Performance Issue:**
- HomePage fetched ALL users just to display ~24 owner usernames on timeline cards
- O(total users) → O(displayed timelines) improvement

**Implementation:**
- [x] Add optional `ownerUsername` field to `TimelineMetadata` type
- [x] Update `createTimeline()` to fetch owner and set `ownerUsername`
- [x] Add `migrateTimelineOwnerUsernames()` for backfilling existing timelines
- [x] Add `searchUsersByUsername()` for on-demand Firestore prefix queries
- [x] Remove `getUsers()` call from HomePage data loading
- [x] Replace in-memory user search with async Firestore query (like GitHub/X)
- [x] Update SRS_DB.md (DB-TL-011) and SRS_HOME_PAGE.md

**Testing:**
- [x] Update test schema allowlists (dev-srs-db.spec.ts, prod-srs-db.spec.ts)
- [x] Build passes, 109 unit tests pass, 20/20 smoke tests pass

**Migration Complete:**
- [x] Dev: 259 timelines updated (5 orphaned timelines skipped)
- [x] Prod: 12 timelines updated
- [x] Legacy data cleanup: removed `events` field from 1 timeline (both envs), fixed 289 events missing `id` field (prod)
- [x] Test fix: added `sources` to ALLOWED_EVENT_FIELDS (Event Sources feature from v0.6.3)

### v0.8.12 - Performance Improvements ✅
**Goal:** Targeted performance fixes for Safari memory constraints and data loading patterns
**Status:** Complete (Phases 1-2 implemented, Phases 3-4 deferred to v0.8.13)

**Completed (2026-01-04):**
- [x] Phase 1.1: Safari memory cache 40MB limit (src/lib/firebase.ts:40-42)
  - Reduced Firestore memory cache from unlimited to 40MB for Safari/WebKit
  - Prevents memory crashes on iOS devices with limited cache quota
- [x] Phase 1.2: Navigation memoization (src/app/hooks/useEventSelection.ts:41-47,67-79)
  - Added useMemo for sorted events array in useEventSelection hook
  - Prevents re-sorting on every navigation callback invocation
- [x] Phase 2: Firebase request batching (src/pages/HomePage.tsx:76-93)
  - Two-batch data loading: critical data first (timelines, stats), then secondary (featured, popular)
  - Improves perceived load time with progressive enhancement

**Deferred to v0.8.13:**
- [ ] Phase 3: Callback optimization (StreamViewerContext, Row component memoization)
  - Caused test failures in 82-stream-viewer.spec.ts (T82.6, T82.7, T82.S1-S3)
  - Test failures related to scroll functionality and event selection
  - Reverted to maintain stability

**Impact:**
- Safari/WebKit: Improved stability with controlled memory usage
- Navigation: Reduced redundant sorting operations
- HomePage: Better perceived load time with batched requests

### v0.8.13 - VariableSizeList Implementation ✅
**Goal:** Implement dynamic item heights for StreamViewer expandable cards
**Status:** Complete (2026-01-04)

**Completed:**
- [x] Phase 4: VariableSizeList for expandable event cards
  - Changed from FixedSizeList to VariableSizeList (react-window)
  - Dynamic heights: collapsed (120px) vs expanded (200px)
  - Added listRef and getItemSize callback
  - Reset list after index on expandedEvents changes
  - Updated SRS_STREAM_VIEW.md: CC-REQ-STREAM-PERF-001

**Impact:**
- Expanded event cards no longer clip
- Smooth height transitions when toggling expand/collapse
- Maintains 17/23 test passing baseline (same test failures as before)

### v0.8.14 - Performance Optimization ✅
**Goal:** Reduce layout reflows and optimize collision detection
**Status:** Complete (2026-01-05)

**Completed:**
- [x] TimelineMinimap.tsx: Cache rect on mousedown, reuse during drag
- [x] EnhancedTimelineAxis.tsx: Cache axis rect for mouse events
- [x] PositioningEngine.ts: Build spatial hash ONCE before collision loop, not per pass
- [x] PositioningEngine.ts: Sort cards ONCE before collision loop, not per pass
- [x] ~75% reduction in collision resolution overhead (4 rebuilds → 1)

**Reverted (caused test failures):**
- useViewWindow.ts batch setState changes
- useTimelineZoom.ts caching changes
- useElementSize.ts ResizeObserver changes
- DeterministicLayoutComponent.tsx changes

**Impact:**
- Collision resolution: 75% overhead reduction
- Max long task: ~8-12% improvement
- Layout reflows in stress test: Maintained

### Performance Test Suite ✅
**Goal:** Comprehensive performance measurement infrastructure
**Status:** Complete (2026-01-05)

**Added:**
- tests/performance/98-performance-profiling.spec.ts - CDP profiling with .cpuprofile output
- tests/performance/99-performance-baseline.spec.ts - Pass/fail regression tests
- tests/performance/100-advanced-metrics.spec.ts - Memory, FPS, layout thrashing, INP, long tasks
- tests/performance/README.md - Documentation

**Fixes (2026-01-05):**
- T98/T100: Skip on non-Chromium (CDP requires Chromium, was failing on mobile/tablet WebKit)
- 98-interaction-model-v083.spec.ts: Fixed telemetry wait (500ms throttle required polling instead of fixed waits)

**Baselines (dev mode):**
| Metric | Target | Threshold |
|--------|--------|-----------|
| Layout Reflows | <20 | Single operation |
| Long Tasks | <600ms | Max duration |
| INP | <800ms | Max interaction |

### v0.8.15 - UX Polish ✅
**Goal:** Fix breadcrumb visibility, Stream View buttons, and mobile interaction
**Status:** Complete (2026-01-05)

**Completed:**
- [x] Breadcrumbs: z-[30] base so hover triggers above cards (was z-[5], below cards)
- [x] Stream View hover buttons: Added 16px top padding for icon space above cards
- [x] Stream View "show more": Threshold now `lineClamp * 70` chars (was 150, too aggressive)
- [x] Mobile tap behavior: Tap selects event, swipe-right to edit (was tap-to-edit)

**Impact:**
- Breadcrumbs visible on hover in editor
- Eye/edit buttons appear on Stream View card hover
- "Show more" only appears when text is actually truncated
- Mobile users can browse without accidentally editing

### v0.8.16 - Visual Audit Implementation ✅
**Goal:** Implement all 32 action items from docs/archive/audits/VISUAL_AUDIT_REPORT.md for public release polish
**Status:** Complete (2026-01-05)

**Phase 1: Design System Foundation**
- [x] Design tokens: Typography scale (`--text-xs` through `--text-3xl`)
- [x] Design tokens: Spacing scale (`--space-1` through `--space-20`)
- [x] Design tokens: Shadow elevation scale (`--shadow-xs` through `--shadow-xl`)
- [x] Design tokens: Transition tokens, brand tokens
- [x] Premium card styles: `.timeline-card` with shadow and hover lift
- [x] Premium button styles: `.pt-button` with hover lift and glow

**Phase 2: P0 Accessibility**
- [x] WCAG 2.1 AA contrast fixes in LandingPage (22 color replacements)
- [x] Skip-to-content link in LandingPage
- [x] Keyboard accessible cards with `tabIndex`, `role="link"`, `onKeyDown`
- [x] ARIA labels on icon-only buttons (AdminPage, NavigationRail)
- [x] NotFoundPage: Replaced 16+ hardcoded colors with CSS variables

**Phase 3: P0 Mobile Navigation**
- [x] Created `BottomNavigation.tsx` (iOS/Android-style fixed bottom bar)
- [x] Mobile nav shows on `md:hidden`, hides NavigationRail on mobile
- [x] Auth-aware nav items with active state indication
- [x] Safe area support for iOS devices

**Phase 4-5: P1 Visual Polish**
- [x] Card shadows with hover lift effect
- [x] Border radius: `rounded-lg` → `rounded-xl` on cards
- [x] Border weight: `border-2` → `border` (less heavy)
- [x] Section spacing increased (`mb-12` → `mb-16`)
- [x] Button hover states with lift and glow
- [x] Replaced inline `onMouseEnter`/`onMouseLeave` with CSS `:hover`

**Phase 6: P1 Icon Standardization**
- [x] Replaced MUI icons with Material Symbols in TopNavBar, HomePage
- [x] Standardized icon size to 24px

**Phase 7: P2 Form/Dialog Fixes**
- [x] Form loading states with `CircularProgress` on submit buttons
- [x] Label associations via `htmlFor`/`id` attributes
- [x] Dialog focus trap with ARIA, Escape key handling
- [x] LoginPage width: `maxWidth: 340` → `400, width: '100%'`

**Phase 8: P2 Responsive Fixes**
- [x] Profile header mobile stacking
- [x] Stats section responsive grid
- [x] Search bar refinement with inset shadow
- [x] Landing CTA: Primary filled with shadow, secondary ghost

**Phase 9: P3 Enhancements**
- [x] Shimmer animation for skeleton cards
- [x] Card stagger animations for grid loading
- [x] `prefers-reduced-motion` support for all animations

**Phase 10: Documentation**
- [x] Created `docs/SRS_DESIGN_TOKENS.md` with token specifications
- [x] Created `docs/SRS_MOBILE_NAVIGATION.md` with mobile nav requirements
- [x] Created `docs/DESIGN_SYSTEM.md` with component documentation

**Files Created:**
- `src/components/BottomNavigation.tsx`
- `docs/SRS_DESIGN_TOKENS.md`
- `docs/SRS_MOBILE_NAVIGATION.md`
- `docs/DESIGN_SYSTEM.md`

**Files Modified (36 total):**
- `src/styles/tokens.css` - Design token foundation
- `src/pages/*.tsx` - All page components updated
- `src/components/*.tsx` - Multiple component updates

**Impact:**
- 2,648 insertions, 1,366 deletions
- WCAG 2.1 AA accessibility compliance
- Mobile-first navigation pattern
- Consistent design token system
- Professional visual polish for public release

---

## Phase 6: Unified Import Review System (v0.9.x)
> **Vision:** Session-based review for all incoming events (YAML import, AI chat, future PR/merge)

### v0.9.0 - Import Session Infrastructure ✅
**Goal:** Core session management with localStorage persistence
**Status:** Complete

**Files Created:**
- `src/types/importSession.ts` - ImportSession, SessionEvent, ImportMode types
- `src/hooks/useImportSession.ts` - Session management hook
- `src/contexts/ImportSessionContext.tsx` - React context

**Tasks:**
- [x] Define ImportSession, SessionEvent types
- [x] Create useImportSession hook with: startSession, updateDecision, updateEventData, commitSession, discardSession
- [x] localStorage persistence (auto-save on change)
- [x] Restore session on page reload
- [x] Unit tests for hook (19 test cases)

### v0.9.1 - Review Panel UI ✅
**Goal:** Panel to review and manage session events
**Status:** Complete

**Files Created:**
- `src/app/panels/ReviewPanel.tsx` - Main review UI

**Tasks:**
- [x] Event list with decision indicators (pending/accepted/rejected)
- [x] Per-event: Accept / Reject / Edit buttons
- [x] Progress indicator showing review status
- [x] "Accept All Remaining" / "Commit" / "Discard" buttons
- [x] NavRail button with badge showing pending count
- [x] E2E tests (tests/review/98-import-review-demo.spec.ts)

### v0.9.2 - Timeline Preview
**Goal:** Show session events on timeline with visual distinction
**Status:** Partial (CSS exists, layout merge needed)

**Tasks:**
- [ ] Merge session events with real events for render
- [x] Visual distinction CSS (dashed borders, status badges)
- [ ] Click session event → edit in AuthoringOverlay
- [ ] Save edits to session (not Firestore)

### v0.9.3 - YAML Import Integration ✅
**Goal:** Route YAML import through session system
**Status:** Complete

**Tasks:**
- [x] Parse YAML → detect CREATE vs UPDATE (by event ID)
- [x] Start import session with classified events
- [x] Close ImportExportOverlay → open ReviewPanel
- [x] Remove direct Firestore write from import

### v0.9.4 - Diff View for Updates ✅
**Goal:** Word-level diff comparison for UPDATE actions in ReviewPanel
**Status:** Complete

**Libraries Added:**
- `react-diff-viewer-continued` - GitHub-style diff component with word-level highlighting
- `diff` - jsdiff for array comparison (sources field)

**Files Created:**
- `src/app/panels/EventDiffView.tsx` - Diff modal component

**Files Modified:**
- `src/app/panels/ReviewPanel.tsx` - Wired View Diff button and modal

**Tasks:**
- [x] Install `react-diff-viewer-continued` and `diff` packages
- [x] Create EventDiffView component with inline unified diff view
- [x] Word-level diff highlighting for title/description (green/red)
- [x] Simple arrow format for date/time changes (old → new)
- [x] Array diff with +/- indicators for sources field
- [x] Only show changed fields in diff view
- [x] "Keep Existing" button (sets decision to rejected)
- [x] "Take Imported" button (sets decision to accepted)
- [x] Close button and Escape key dismissal
- [x] Theme-aware styling (light/dark mode support)
- [x] E2E tests (tests/review/102-event-diff-view.spec.ts)
- [x] Update SRS_IMPORT_REVIEW.md Section 8 (9 requirements)
- [x] Skip identical events in merge mode (areEventsIdentical comparison)
- [x] Track skippedCount in ImportSession (CC-REQ-REVIEW-SESSION-003b)
- [x] Display "X skipped (no changes)" in ReviewPanel for user feedback

### v0.9.5 - AI Chat Migration ✅
**Goal:** Migrate AI integration to unified session system
**Status:** Complete

**Tasks:**
- [x] Add delete action support to useImportSession.ts commitSession
- [x] Create aiActionsToSession.ts converter utility (convertAIActionsToSessionEvents)
- [x] Refactor useAISession to route event actions via onEventActionsReceived callback
- [x] Simplify ChatPanel - remove event action UI, add "Review Events" button
- [x] Wire up AIEventBridge in App.tsx inside ImportSessionProvider
- [x] Update ReviewPanel for delete actions (trash icon, warning, hide edit)
- [x] Add 16 unit tests for aiActionsToSession.ts
- [x] Update SRS_IMPORT_REVIEW.md Section 9 (6 requirements)

### v0.9.6 - Import Modes (Merge vs Overwrite) ✅
**Goal:** Allow users to choose between merging imports or fully replacing timeline
**Status:** Complete

**Files Modified:**
- `src/types/importSession.ts` - Added ImportMode type
- `src/hooks/useImportSession.ts` - Mode-aware startSession/commitSession
- `src/contexts/ImportSessionContext.tsx` - Pass importMode parameter
- `src/app/overlays/ImportExportOverlay.tsx` - Mode toggle UI, confirmation dialog
- `src/app/panels/ReviewPanel.tsx` - Mode indicator, deletion warning

**Tasks:**
- [x] Add `ImportMode` type ('merge' | 'overwrite') to importSession.ts
- [x] Add mode toggle UI in ImportExportOverlay
- [x] Modify startSession() to handle overwrite mode (all events = 'create')
- [x] Update commitSession() to delete existing events in overwrite mode
- [x] Add confirmation dialog for overwrite mode
- [x] Show mode indicator and warnings in ReviewPanel
- [x] Unit tests for both modes (9 new tests in useImportSession.test.ts)
- [x] E2E tests for mode selection and behavior (10 tests in 100-import-modes.spec.ts)
- [x] Update SRS_IMPORT_REVIEW.md with new requirements (CC-REQ-REVIEW-MODE-001 to 007)

### v0.9.6.3 - Layout Robustness and Repository Cleanup ✅
**Goal:** Harden dense editor rendering behavior and reduce repository noise
**Status:** Complete

**Tasks:**
- [x] Increase compact card height to 120px and align layout capacity math to actual card footprints
- [x] Clamp dense card positioning to the minimap safe zone and use top-based coordinates consistently
- [x] Add robust text rendering stress coverage (T105) for zoom, panning, and minimap-overlap regression detection
- [x] Add horizontal space optimization coverage (T106) for cluster spread, edge margins, and ultrawide scaling
- [x] Improve overlap/high-density visual audit assertions and requirement annotations
- [x] Archive historical audits, plans, and reports under `docs/archive/`
- [x] Remove one-off markdown analysis notes and deprecated theme docs from the repo root
- [x] Simplify `tests/README.md` to point at canonical test documentation in `docs/TESTS.md`

### v0.9.6.4 - Overflow Badge Boundary Investigation and Test Hardening
**Goal:** Reproduce reported ghost overflow badges at timeline boundaries and close the audit/assertion gaps in boundary stress coverage

**Tasks:**
- [ ] Reproduce the reported ghost overflow badge failures from `screenshots/visual-audit/t92-1-pan-far-left.png`, `t92-2-pan-far-right.png`, and `t92-3-scroll-bottom.png`
- [ ] Trace whether the failures come from stale overflow state, boundary panning/scrolling logic, or badge-to-anchor positioning drift
- [ ] Update `tests/visual-audit/92-boundary-pan-stress.spec.ts` so T92.1-T92.4 verify real overflow badge conditions instead of only taking screenshots
- [ ] Add explicit T92 assertions that empty boundary views do not show overflow badges on the left, right, top, or bottom edges
- [ ] Add T92 assertions for sparse boundary views so any remaining overflow badges stay attached to visible anchors and remain within valid viewport bounds
- [ ] Align T92 boundary checks with the ghost badge expectations already covered by T93.3 and editor tests 30, 31, and 32
- [ ] Remove or replace audit-only/no-op checks in the boundary scenarios wherever deterministic pass/fail assertions are feasible
- [ ] Run the focused visual-audit and editor overflow suites after the fix and resolve any newly exposed regressions

---

## Phase 7: Collaboration & Versioning (v1.0.x)
> **Future:** Git-style workflows for timeline collaboration

### v1.0.0 - Version History
- [ ] Timeline version snapshots on save
- [ ] Version history browser
- [ ] Diff viewer for comparing versions
- [ ] Revert to previous version

### v1.0.1 - Forking System
- [ ] Fork button and confirmation flow
- [ ] Fork relationship tracking
- [ ] Attribution for original authors
- [ ] Fork network visualization

### v1.0.2 - Merge Requests (Optional)
- [ ] Merge request workflow
- [ ] Side-by-side diff viewer
- [ ] Comment system for review
- [ ] Merge conflict resolution

---

## Milestone: v1.1.0 - Full Platform Launch

- [ ] All core platform features implemented and tested
- [ ] Scalable infrastructure supporting thousands of users
- [ ] Comprehensive documentation and API
- [ ] Mobile-responsive design verified
- [ ] Community moderation tools
- [ ] Analytics and reporting dashboard

---

## Backlog (Deferred)

### Layout Engine Enhancements
- [ ] Web Worker for layout computation (offload heavy calculation)
- [ ] Swim lanes for concurrent events (horizontal card layout)
- [ ] Two-pass bin packing with lookahead (better space utilization)
- [ ] Global card type optimization (coordinate neighboring groups)

### Requirements Standardization & Traceability
**Goal:** Standardize SRS format and create automated traceability tooling

**Analysis:**
- [ ] Audit current SRS formats (compare SRS_STREAM_VIEW vs SRS_USER_SETTINGS_PAGE)
- [ ] Document pros/cons of each format
- [ ] Decide on unified format and apply consistently

**Tooling:**
- [ ] Create `// @req SRS_XXX::CC-REQ-XXX-NNN` comment tag convention
- [ ] Build npm script to extract requirement tags from code
- [ ] Auto-generate traceability matrix and append to SRS files
- [ ] Integrate with CI to ensure requirements are linked

**Migration:**
- [ ] Update all SRS files to unified format
- [ ] Add requirement tags to existing implementations

### Test Gap Analysis & E2E Coverage
**Goal:** Identify and fill testing gaps from recent features

**Analysis:**
- [ ] Inventory all v0.5.31-33 features lacking tests
- [ ] Map features to SRS requirements
- [ ] Prioritize critical paths for testing

**Implementation:**
- [ ] E2E tests for Settings page (login, display, password reset)
- [ ] E2E tests for public profile access (non-auth viewing)
- [ ] E2E tests for Stream View editing (mobile viewport)
- [ ] E2E tests for Stream View swipe actions
- [ ] Update test coverage tables in SRS files

### Admin Panel Statistics
**Goal:** Implement proper statistics dashboard in Admin page

- [ ] Display platform-wide metrics (total users, timelines, events)
- [ ] Activity charts (signups over time, timeline creation trends)
- [ ] User engagement metrics
- [ ] System health indicators
