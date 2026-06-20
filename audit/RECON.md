# PowerTimeline Production Audit — Round 0 Recon (Evidence Base)

**Audited site:** https://powertimeline.com (Firebase project `powertimeline-860f1`)
**Audited as:** anonymous first-time visitor (NOT signed in). The authenticated editor/creation flow is NOT covered here (no credentials) and must be audited separately.
**Date of audit:** 2026-06-20
**Viewports captured:** Desktop 1440×900, Mobile 390×844. Themes: light (default) + dark.

---

## 1. Surface map (routes)
| Route | Page | Notes |
|-------|------|-------|
| `/` | Landing / marketing | Hero, personas, features, **stale roadmap**, footer |
| `/browse` | Browse & search timelines | Popular, Platform Statistics (BROKEN), Recently Edited |
| `/login` | Sign in | Auth |
| `/{username}` | User profile | e.g. `/cynacons` — stats + timeline grid |
| `/{username}/timeline/{id}` | Timeline viewer | Canvas (desktop default) + Stream View modal |
| `/{username}/timeline/{id}/embed` | Embeddable timeline | Not yet captured |

## 2. Timeline catalog (owner: @cynacons — the only user)
| Title | id | events | views | Notes |
|-------|----|--------|-------|-------|
| The Iran War | timeline-iran-war | 295 | ~10 | Growth driver, current events, rolling OSINT. Deep-link WORKS. |
| French Revolution | timeline-french-revolution | 289 | ~235 | Flagship/densest. Deep-link WORKS. Content spans 1748–1835 (title says "1789-1799"). |
| Janus Cosmological Model | timeline-janus... | 100 | 9 | "Invalid Date" on profile/browse |
| Napoleon Bonaparte | timeline-napoleon | 63 | — | Deep-link BROKEN (redirects to /). Metadata 'id' fallback warning. |
| Charles de Gaulle | timeline-charles-de-gaulle | 38 | 28 | Metadata 'id' fallback warning. |
| The Greenland Drama | timeline-greenland... | 25 | 7 | "Invalid Date" on profile/browse |
| John F. Kennedy | timeline-jfk | 16 | — | Deep-link BROKEN (redirects to /). |
| Robert F. Kennedy | timeline-rfk | 10 | 8 | Deep-link BROKEN (redirects to /). Metadata 'id' fallback warning. |

## 3. Screenshot manifest (audit/screenshots/)
| File | Surface | Viewport | Theme |
|------|---------|----------|-------|
| 01-landing-desktop.png | Landing (full page) | desktop | light |
| 02-browse-desktop.png | Browse (full page) | desktop | light |
| 03-iranwar-canvas-desktop.png | Iran War timeline canvas | desktop | light |
| 04-iranwar-streamview-desktop.png | Iran War Stream View modal | desktop | light |
| 06-frenchrev-canvas-desktop.png | French Rev canvas (dense) | desktop | light |
| 07-profile-desktop.png | @cynacons profile (full page) | desktop | light |
| 08-login-dark.png | Sign in page | desktop | dark |
| 09-landing-dark.png | Landing (full page) | desktop | dark |
| 10-frenchrev-canvas-dark.png | French Rev canvas | desktop | dark |
| 11-landing-mobile.png | Landing (full page) | mobile | light |
| 12-browse-mobile.png | Browse (full page) | mobile | light |
| 13-iranwar-streamview-mobile.png | Iran War Stream View (auto-open) | mobile | light |
| 14-iranwar-canvas-mobile.png | Iran War canvas behind stream | mobile | light |

## 4. Confirmed bugs found during recon (high confidence, reproduced)
1. **[CRITICAL] Deep-link redirect.** Direct navigation / shared links to most timelines (confirmed: RFK, Napoleon, JFK) redirect to `/` (landing) instead of rendering the timeline. Reproduced in a cold isolated browser context (no cache). Only the high-view "popular" timelines (French Revolution, Iran War) deep-link correctly. **Impact:** breaks social sharing, SEO indexing, bookmarks, embeds for most of the catalog — the core growth channels. Likely cause (to verify in code): timeline route resolves id from a preloaded "popular" list and redirects home on miss, instead of fetching the specific timeline by `{username,id}`.
2. **[HIGH] Platform Statistics wrong.** Browse page shows "2 Timelines, 465 Events, 0 Users" while reality is 8 timelines / 836 events / 1 user (correct numbers shown on the profile page). The stats cloud function is stale/broken. "Total Views" shows no number.
3. **[MED] "Invalid Date".** Greenland Drama and Janus Cosmological Model render "Invalid Date" as their last-updated on profile + browse.
4. **[MED] Read-only viewer leaks editing affordances.** Public read-only timeline shows "Double-click to edit" hint text and an edit tooltip on event cards.
5. **[MED] Stale public roadmap.** Landing "Product Roadmap" claims "Current: v0.5.37 User Onboarding" and lists AI Integration / version control as *future*, but AI Chat, API, SEO, embeds, Iran War rolling timeline have all shipped (app is v0.8.15+). Misrepresents maturity for a relaunch.
6. **[LOW] Footer "© 2025"** (should be 2026).
7. **[LOW] Manifest favicon error** in console ("Resource size is not correct" for favicon.png).
8. **[LOW] Personal Gmail** (cynako@gmail.com) is the public Contact on the landing page.
9. **[LOW] Heading hierarchy misuse** on landing (h2 used for body paragraph; h5/h6 used for styling not document structure) — SEO + a11y concern. Event titles are h3 on canvas but h6 in Stream View (inconsistent).

## 5. Key UX observations (to be expanded by analysis)
- **The readable mode is hidden.** The default desktop timeline view is the *canvas*, which at "fit all" with 200–300 events is a wall of tiny, unreadable cards. The genuinely readable mode (Stream View — a chronological list with full descriptions) is buried behind a button and rendered as a *modal*, not a first-class view. The information hierarchy is inverted: hard-to-read is default, easy-to-read is secondary.
- **Mobile auto-opens Stream View** (good) — the canvas is effectively desktop-only.
- **First impression of a 295-event timeline** is overwhelming, with no guided entry point (no "start here", no summary, no key-moments filter).

## 6. Constraints / not-yet-covered (for later rounds)
- Authenticated experience: timeline creation, editor, AI chat, import/export, settings, API tokens — NOT audited (needs login).
- Event detail / sources panel, "Toggle info panels", Help/onboarding tour — not yet captured.
- Embed page, share menu output — not yet captured.
- Performance metrics (Lighthouse), network waterfall — not yet captured.
