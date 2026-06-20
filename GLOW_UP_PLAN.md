# PowerTimeline — GLOW-UP PLAN

> **Purpose:** A prioritized, iteration-based plan to lift PowerTimeline's UI/UX from "unfinished internal tool" to a credible, shareable product ready for relaunch and growth (anchored on the **Iran War** current-events timeline).
> **Format:** Mirrors `PLAN.md` — themed iterations (G1…Gn) with goals + task checklists. Each task tagged `[severity · effort · dimension]`.
> **Status:** 🟡 **v0.4** — Rounds 0–3 complete (recon → 6-lens audit → verify + authed deep-dive → design directions + independent assessment). Independently assessed by a separate agent (**graded 7/10**); this revision folds in its critical-path, scope, and rigor fixes. Evidence in `audit/`.

---

## Quick Summary

**What this is:** A production UI/UX audit of https://powertimeline.com, conducted as an anonymous visitor AND a newly-registered user, across desktop + mobile, light + dark, on the real public timelines.

**The verdict:** Every audited dimension scored **3/10**. The product *works* but reads as an unfinished tool assembled from two unrelated design systems, and — critically — **the exact channels a relaunch depends on (creating, sharing, search) are broken at the root.** A brand-new user cannot create a timeline at all; most timeline links bounce to the homepage; shared/embedded links don't render; the discovery page leads with false stats.

**The opportunity:** The content is strong (295-event Iran War, 289-event French Revolution) and unleveraged. Most high-impact fixes are **S/M effort** — this is plumbing, plus a coherent brand, not a rewrite.

### Maturity Scorecard (baseline → target)
| Dimension | Now | Target | Headline problem |
|-----------|:---:|:------:|------------------|
| Visual Design & Brand | 3 | 8 | Two disconnected design systems; no consistent accent; generic-AI persona cards |
| Core Product (Timeline UX) | 3 | 8 | Unreadable canvas is default; readable Stream View buried in a modal |
| IA, Navigation & Flow | 3 | 8 | Nav model swaps between pages; funnel leaks at every stage |
| Content, Copy & Positioning | 3 | 8 | Hero fails 5-sec test; stale roadmap undersells maturity; no proof |
| Mobile & Responsive | 3 | 8 | The make-or-break share surface (mobile Stream View) is visibly broken |
| Accessibility, Technical & SEO | 3 | 8 | Deep-link redirect + missing OG meta = un-indexable, un-shareable |
> Scores are subjective audit opinions — see **G7.5 (metrics)** for the measurable targets (bounce, share-CTR, sign-up conversion, indexed-page count, Lighthouse) that actually define "done."

---

## North Star (relaunch thesis)

> **"Paste a link to a PowerTimeline and people instantly get a credible, readable, mobile-first story they want to share — and a new visitor can start their own in two minutes."**

Non-negotiables, in order: (1) a new user can **create**; (2) every public timeline has a **stable, shareable, crawlable** URL; (3) the default view is **readable in 5 seconds on mobile**; (4) it looks like **one coherent, trustworthy brand**.

---

## 🎯 Minimum Relaunch-Ready (the critical path)

Everything in the plan is valuable, but only this subset **blocks a safe relaunch**. Ship these first; the rest is high-value fast-follow.

| # | Item | Why it blocks relaunch |
|---|------|------------------------|
| **G1.0** | New users can't create timelines (+ import + fork) | The creator funnel is dead for new accounts |
| **G1.1** | Deep-link redirect (also breaks embed + fork) | Sharing, SEO, bookmarks all dead for most of the catalog |
| **G1.2** | False Platform Statistics ("2 timelines / 0 users") | Discovery page reads as abandoned/broken |
| **G1.3** | Mobile Stream View visibly broken (timestamp overlap) | The surface social taps land on |
| **G1.8** | Closing-CTA dead-end (lands on Browse, not Create) | Landing-page funnel dead-end |
| **G2.1** | Per-route OG/Twitter meta (hardest item — own spike) | Every shared link previews as a generic homepage |
| **G2.5** | Heading h1/h2 semantics | Cheap, outsized on-page SEO; prerequisite for the SEO thesis |
| **G5.2 / G5.5** | Stale roadmap, BETA badge, personal Gmail, © 2025 (S-effort trust) | First-impression credibility, all tiny edits |
| **G7.1** | Privacy Policy + ToS | GDPR / Google OAuth effectively require it (legal) |
| **G7.2** | Sourcing disclaimer + "report an error" on the live war feed | Credibility/liability for unverified current-events claims |

### ✅ Post-implementation validation gate (run before declaring relaunch-ready)
- [ ] Cold/incognito load of **all 8 timelines** renders the timeline (no redirect to `/`).
- [ ] A **fresh account** can create a timeline AND import one.
- [ ] Share an Iran War link → correct rich card in **Slack/Discord + Facebook Debugger + X Validator**.
- [ ] Platform Statistics match reality (or the card is hidden).
- [ ] Mobile Stream View at **390px**: no timestamp/title overlap, no clipped header, no stray horizontal scroll.
- [ ] **Lighthouse** (mobile) perf + a11y baseline captured and above an agreed threshold.
- [ ] Privacy Policy + ToS reachable; war-feed disclaimer visible.

---

## Cross-cutting CRITICAL findings
These appeared independently across multiple audit lenses (both root-caused share one cause — the **Firestore timeline data/rules model**: the `id` field, uniqueness checks, collection-group lookups, path-vs-field permission gating):

0. 🚨 **New users cannot create timelines** (Create dialog + YAML Import + Fork all fail). `isTimelineIdUnique()` (`src/services/firestore.ts:510`) reads `/users/{uid}/timelines/{id}`; the rule (`firestore.rules:51-54`) gates on `resource.data.ownerId`/`visibility`, which don't exist for a not-yet-created doc → denied. *Scope: blocks **interactive new-user creation**; the server-side Timeline Automation API (Admin SDK) likely bypasses rules, so the owner's own Iran-War ingestion is probably unaffected — verify.* User sees a generic "An unexpected error occurred." (raw `FirebaseError` only in console). → **G1.0**
1. **Deep-link redirect** — direct/shared links to most timelines (RFK, JFK, Napoleon confirmed) redirect to `/`. `src/pages/EditorPage.tsx:127-131` does `navigate('/')` when `getTimeline()` returns `null`; `getTimelineMetadata()` resolves by `where('id'==…)` then a 50-doc recency fallback, missing timelines whose stored id ≠ url slug. Same cause breaks `/embed` (RFK embed = "Timeline not found") and Fork. → **G1.1**

---

## Iterations

> Tags: severity `CRIT/HIGH/MED/LOW` · effort `S(<½d)/M(1–3d)/L(multi-day)`. ⭐ = on the Minimum Relaunch-Ready critical path.

### G1 — Stop the bleeding (launch-blocker bug fixes)
- [~] ⭐ **G1.0** ✅ **FIXED & VERIFIED ON DEV — pending prod deploy.** Added owner-by-path read (`request.auth.uid == userId`) to the timeline subcollection rule in `firestore.rules`; deployed to `powertimeline-dev`; a brand-new account (`devtest1`) created a timeline with **no permission error** (`audit/screenshots/CM-07`). Events subcollection rule confirmed unaffected. **⚠️ PROD deploy is a deliberate owner-confirmed step — NOT done in the autonomous loop.** Still TODO: surface the real error instead of the generic "An unexpected error occurred." `[CRIT · S · product/auth]`
- [ ] ⭐ **G1.1** Fix deep-link redirect: resolve the timeline by `{username, doc-id}` directly from Firestore (the doc-id *is* the slug — this likely avoids needing any `id`-field backfill; treat the migration as *optional/contingent*); replace silent `navigate('/')` with a real "Timeline not found" 404. **Also fixes `/embed` and Fork** (same `getTimeline()→null`). Citation: `src/pages/EditorPage.tsx:127`. Verify all 8 timelines cold/incognito. `[CRIT · M→L · seo/ia]`
- [ ] ⭐ **G1.2** Fix or remove Platform Statistics. **First confirm where stats are computed** — rules suggest *client-side* aggregation, not necessarily a Cloud Function — then correct to reality (8/836/1/302) or hide any null-valued metric. `[CRIT · S · ia/seo]`
- [ ] ⭐ **G1.3** Fix mobile Stream View **internal layout** (the dialog is already full-screen — do NOT rebuild its bounds): move the per-event time into the left date rail so it stops overprinting titles; eliminate the inner horizontal overflow + bottom empty gap; stop the header clipping to "Strea". Verify at **true 390px** (prior test was clamped to 500px). `[CRIT · M · mobile/product]`
- [ ] **G1.4** Fix "Invalid Date" rendering (Greenland, Janus) — defensive parse, fall back to "—". `[MED · S · seo]` *(see also G7.9 data-integrity)*
- [ ] **G1.5** Remove edit affordances from the read-only viewer ("Double-click to edit"). `[MED · S · product]`
- [ ] **G1.6** Dynamic copyright year; fix favicon/manifest "size not correct" console error. *(Manifest also gates share-icons — see G7.8.)* `[LOW · S · seo]`
- [ ] **G1.7** Suppress per-card kebab (⋮) menu for anonymous/read-only users. `[LOW · S · ia]`
- [ ] ⭐ **G1.8** *(pulled from G6.2)* Make the landing's closing "Ready to connect the dots?" CTA actually start creation, and give the hero a visible sign-up/Create CTA — today it routes to Browse, a funnel dead-end. `[MED · S · ia/content]`

### G2 — Be findable & shareable (SEO + social) — *depends on G1.1*
- [ ] ⭐ **G2.1** Per-route prerendered/SSR Open Graph + Twitter Card meta per timeline (unique title/description/generated preview image) + canonical URLs. **This is the single hardest item** — a client-rendered Vite SPA needs prerender/SSR/edge functions + a dynamic OG-image generator; **scope it as its own spike, likely `L`.** `[CRIT · L · seo]`
- [ ] **G2.2** Valid `Event`/structured-data JSON-LD per timeline (needs G1.4 + G7.9 valid dates; draws description from G3.3). `[HIGH · M · seo]`
- [ ] **G2.3** Verify with Facebook Sharing Debugger, X Card Validator, real Slack/Discord paste; confirm JS-rendered Googlebot reaches 200 + content. `[HIGH · S · seo]`
- [ ] **G2.4** Sitemap includes all public timelines **with a freshness mechanism** for the rolling feed (not a one-time static file — see G7.10). `[MED · M · seo]`
- [ ] ⭐ **G2.5** *(pulled forward from G6.3)* Heading semantics: demote the value-prop paragraph from `h2` to `p`; reserve `h1/h2` for keyword-bearing titles ("Iran War timeline", "historical timeline maker"); make event-title level consistent across canvas & stream. Cheap, outsized SEO payoff. `[HIGH · S · seo/a11y]`

### G3 — Make the core product readable (Stream View as front door)
- [ ] **G3.1** Promote Stream View to a first-class, deep-linkable view (*proposed:* `?view=stream` URL state); make it the **default** for dense/current-events timelines; canvas becomes opt-in "Explore". `[CRIT · M · product]`
- [ ] **G3.2** Replace the buried "Stream View" button + modal with a persistent top-level **List ⇄ Canvas** segmented toggle. `[HIGH · M · product/ia]`
- [ ] **G3.3** Add a timeline **intro/summary header** (title, 1–2 sentence description, event count, date span, last-updated). **Doubles as the source text for G2.1 OG + G2.2 JSON-LD — link these.** `[HIGH · M · product/seo]`
- [ ] **G3.4** Add a **"Key moments"/Highlights** filter (curated 8–12 events for newcomers). `[HIGH · M · product]`
- [ ] **G3.5** ⏸️ *Deferred to post-relaunch.* Uniform canvas card spec / inline-expandable clusters. **Contradicts demoting the canvas (G3.1)** — once Stream View is the front door, the canvas only needs to be *not-broken*, not perfected. `[MED · L · product · DEFER]`
- [ ] **G3.6** Scale-aware minimap & axis (month/week labels for sub-annual spans; viewport indicator). `[MED · M · product]`

### G4 — One coherent brand & design system — *(see Round 3 design directions below)*
- [ ] **G4.1** Unify to ONE token-based design system across all routes. **Reframed as FAST-FOLLOW, not relaunch-blocking** — it's CRIT for *credibility* but not *function*. Ship the relaunch on a *tightened current system* (G4.2 + G4.5), then do full unification. Direction TBD from the 3 mockups (`audit/mockups/`). `[HIGH(credibility) · L · visual · fast-follow]`
- [ ] ⭐-ish **G4.2** Single primary-action color everywhere; fix the green "Sign in", green avatar, blue "Create Timeline", and unstyled Google button (the create dialog alone shows 3 button colors). Cheap, ships at relaunch. `[HIGH · S · visual]`
- [ ] **G4.3** Redesign persona cards (icons, real surface, body ≥4.5:1) or cut to 3–4. `[HIGH · M · visual]`
- [ ] **G4.4** Deliberate type scale & hierarchy; raise low-contrast subheads. `[HIGH · M · visual]`
- [ ] ⭐-ish **G4.5** Fix hero legibility in both themes (darkened backdrop), remove ghosted watermark, mute helmet/eagle decoration, fix mobile wordmark overflow. Cheap, ships at relaunch. `[HIGH · M · visual/mobile]`
- [ ] **G4.6** Dark-mode parity pass (card elevation, contrast) across browse/profile/viewer. `[MED · M · visual]`
- [ ] **G4.7** Browse/profile card visual hooks (density sparkline / era band / cover); drop redundant author pills on own profile. `[MED · M · visual]`

### G5 — Sharpen positioning & messaging
- [ ] **G5.1** Rewrite hero around a concrete promise + current-events angle; add a product preview; cut "Fork. Merge." jargon from the hero. `[CRIT · M · content]`
- [ ] ⭐ **G5.2** Replace the version-numbered roadmap with customer-facing "What's here today / Coming next" (no semver in marketing). `[CRIT · S · content]`
- [ ] **G5.3** "See it in action" featured-timeline band (Iran War + French Revolution) with real stats. `[HIGH · M · content]`
- [ ] **G5.4** Pick a beachhead persona (current-events readers/creators); demote the six-persona grid; drop "Anyone Seeking Clarity." `[HIGH · M · content]`
- [ ] ⭐ **G5.5** Trust signals: remove/replace BETA badge, branded contact email (drop personal Gmail), remove "Built with PowerSpawn" from public footer, fix © year. `[HIGH · S · content]`
- [ ] **G5.6** Curated **Featured** rail in Browse (owner-controlled) so Iran War leads; rewrite card descriptions as hooks. `[MED · M · content/ia]`

### G6 — Onboarding, conversion & accessibility polish
- [ ] **G6.1** Unify navigation model across marketing + app (labeled nav everywhere). `[HIGH · M · ia]`
- [ ] **G6.3** Accessibility pass: automated contrast (axe/Lighthouse) light+dark, focus rings, 44px tap targets, dark-mode input borders, ARIA. *(Heading semantics moved to G2.5; the CI outline-linter is deferred gold-plating.)* `[MED · M · a11y]`
- [ ] **G6.5** First-run onboarding for new users (welcome + "create your first timeline" w/ a template/example). Today sign-up dumps you on the landing page; the empty state is bare and the tour doesn't trigger. `[MED · M · onboarding]`
- [ ] **G6.6** *(blocked by G1.0)* Audit + polish the **editor, AI chat, and event authoring** — unreachable as a new user until create is fixed. Settings is clean (Profile / Change Password / API token / Theme / GDPR Delete); Import flow (YAML → Review → confirm) has good UX but dies at the write step (G1.0). `[— · — · product]`

### G7 — Trust, Safety, Data Integrity & Measurement *(NEW — from independent assessment)*
These are relaunch obligations for a **live, named war feed**, plus the measurement that makes "done" definable.
- [ ] ⭐ **G7.1** Publish a **Privacy Policy + Terms of Service** (GDPR + Google OAuth effectively require it). `[CRIT · M · legal]`
- [ ] ⭐ **G7.2** Live-feed **sourcing/AI disclaimer** ("auto-ingested OSINT, may contain errors"), per-event "last verified"/provenance, a **"report an error"** affordance, and a disputed-claim/correction policy. `[CRIT · M · trust/safety]`
- [ ] **G7.3** Audit the **OSINT ingestion pipeline**: failure handling, dedup, false-event protection, review gate. (The "Mar 1 density" is a pipeline symptom, not just display.) `[HIGH · M · data/pipeline]`
- [ ] **G7.4** Capture a **Lighthouse / Core Web Vitals** baseline (mobile, the 295-event canvas SPA) — CWV is a ranking factor the G2 SEO thesis depends on. `[HIGH · S · perf]`
- [ ] **G7.5** Define **success metrics + acceptance criteria**: instrument bounce, share-CTR, sign-up conversion, indexed-page count; set baseline→target. `[HIGH · M · measurement]`
- [ ] **G7.6** Email verification + basic abuse/auth hardening on open sign-up. `[MED · M · auth/safety]`
- [ ] **G7.7** Systematic **error/loading/empty states** (loading 295 events; network failure; private/deleted timeline) — beyond the single 404. `[MED · M · product]`
- [ ] **G7.8** PWA/favicon/manifest: fix the manifest size error, add Apple touch icons, theme-color, OG fallback image (gates G2.1 share icons). `[MED · S · technical]`
- [ ] **G7.9** **Data-integrity audit of all 8 timelines** (e.g., French Rev title "1789–1799" vs content 1748–1835) so JSON-LD (G2.2) doesn't publish wrong dates. `[MED · M · data]`
- [ ] **G7.10** Sitemap **freshness mechanism** for the rolling feed (regenerate on update). `[MED · S · seo]`

---

## Round 3 — Design directions (for G4.1 decision)
Three full HTML mockups (landing hero + a real Iran-War reading view) authored & rendered — see `audit/mockups/` (`render-1/2/3*.png`):
1. **Editorial Authority** (`direction-1`) — refined LIGHT, serious-publication credibility; serif display + crimson accent. *Best for "trustworthy / citable."*
2. **Intelligence Terminal** (`direction-2`) — intentional DARK + amber/cyan "situation room"; monospace metadata. *Leans into the OSINT/current-events angle; evolves the existing dark/orange.*
3. **Calm Modern** (`direction-3`) — clean neutral + indigo, Linear/Notion clarity. *Most broadly approachable / lowest cognitive load.*
**→ Owner to choose one (or a blend) before G4.1.**

---

## Findings verification log (Round 2)
- ❌ **REFUTED:** "Every Iran War event = Mar 1 / axis 2026→2026" — axis spans **Mar→May 2026**; "2026↔2026" is only minimap endpoints. Dropped.
- ✅ **CONFIRMED (critical):** mobile Stream View timestamps overprint titles (10 collisions), header clipped to "Strea", inner horizontal scroll, bottom empty gap. → G1.3 (note: dialog *is* full-screen; bug is internal).
- ✅ **CONFIRMED:** embed broken for affected timelines (RFK embed = "Timeline not found"); fork would hit the create bug. → G1.1 / G1.0.
- ⏳ Open for a later pass: desktop Stream View date-rail overlap; measured contrast ratios; true-390px mobile.

## Independent assessment (Round 3) — graded 7/10
A separate agent reviewed the plan + evidence + verified both root-caused fixes in source. Full report: `audit/findings/round3-assessment.md`. Its fixes are folded into this v0.4: the **Minimum Relaunch-Ready critical path**, the **validation gate**, the new **G7** (legal/safety/perf/metrics/data), re-prioritization (pulled G2.5/G1.8 forward; deferred G3.5; reframed G4.1 as fast-follow), and the contradiction/over-claim corrections (G1.3 internal-not-bounds, G1.2 confirm layer, G1.0 scope to interactive new users, G1.1 migration optional, citation `src/pages/EditorPage.tsx`).

---

## Implementation Log (Calm Modern build — branch `glowup/calm-modern`)
> Self-paced loop. Constraint: timeline **engine logic untouched** — visual polish only. Tested on localhost:5173 (dev Firebase).
- **Iter 1** (`785ac6b`): Calm Modern token foundation — MUI primary blue→indigo (green Sign In→indigo); light theme rewritten to white/cool-gray/indigo incl. `--cc-*` canvas + `--stream-*`; softer cards; de-ambered shared accents. Browse/profile = Calm Modern; smoke clean.
- **Iter 2**: De-ambered LandingPage hardcoded oranges (hero CTA→indigo, feature-card accents→indigo/cyan/emerald, roadmap highlight→indigo) + unified Platform-stats "Total Views" amber→indigo. Landing now shares the indigo accent language; smoke clean.
- **Iter 3**: Trust + landing light conversion — dynamic `© {getFullYear()}` (was "© 2025"); softened orange BETA badge → quiet indigo tint (×4 pages); converted LandingPage dark bands + feature cards + footer + roadmap line/dots from hardcoded dark to theme tokens (`--page-bg-elevated`/`--card-bg`/`--page-border`). Landing body now coherent Calm Modern light; only the hero band remains dark (deliberate). Smoke clean.
- **Iter 4** (core product, VISUAL ONLY — engine untouched): unified `index.css` `--color-primary-*` blue→indigo (timeline card selection ring + gradient tint now indigo, no residual blue); softened canvas event-card corners (`rounded`→`rounded-lg`, ~12px) and refined card resting/hover shadows to the Calm Modern soft style. Verified on the JFK canvas; cards were already fairly clean so this is incremental polish + indigo unification. Smoke clean.
- **Iter 5** (FUNCTIONAL — critical-path bug fix): **G1.0 create-blocker fixed.** Added owner-by-path read to `firestore.rules` timeline subcollection; deployed to **dev** (`firebase deploy --only firestore:rules --project powertimeline-dev`); **verified end-to-end** — a brand-new account (`devtest1`) created a timeline with zero permission errors (`CM-07`). Prod deploy deliberately deferred to an owner-confirmed step. Editor now reachable as an owner → unblocks G6.6. Smoke clean.
- **Iter 6** (visual — completes G4.5): Converted the LandingPage dark HERO to Calm Modern LIGHT — replaced the fixed dark banner-PNG layer (helmet/eagle + ghosted "PowerTimeline" watermark) with a clean `--page-bg` base, swapped the dark overlay for a faint indigo halo, and made the headline solid near-black. **The whole landing now reads as one coherent light experience — the "two disconnected design systems" dark-island is gone.** Smoke clean. *Next: editor audit/polish (G6.6, now unblocked) or persona-card icons (G4.3).*

## Audit Log (the iterative method)
- **Round 0 — Recon (✅):** surface map, 8-timeline catalog, 13 screenshots, 9 bugs incl. deep-link redirect (root-caused). → `audit/RECON.md`
- **Round 1 — Broad 6-lens audit (✅):** 46 evidence-cited findings, all dimensions 3/10. → `audit/findings/round1.json`
- **Round 2 — Verify + authed deep-dive (✅):** refuted an over-claim; **solved auth** (prod user `glowupaudit`); found + root-caused the **create blocker**; captured authed surfaces; confirmed embed/fork breakage. Screenshots `audit/screenshots/R2-*`.
- **Round 3 — Design directions + independent assessment (✅):** 3 design-direction mockups (`audit/mockups/`); external agent graded the plan 7/10 and its fixes are folded in here (→ v0.4).
- **Round 4 — Finalize (⏳):** owner picks a design direction; optionally deploy G1.0/G1.1 to unblock the editor audit; sequence the relaunch sprint from the critical path.

### Authed audit evidence (Round 2)
Test account `glowupaudit` (`cynako+glowup@gmail.com`) created in prod; delete via Settings → Danger Zone when done.

## Open questions for the owner
1. **Design direction** (G4.1): Editorial Authority, Intelligence Terminal, or Calm Modern? (mockups rendered in `audit/mockups/`).
2. **Deploy the G1.0 + G1.1 fixes** now (one-line rules change + resolution fix) to unblock the editor/AI audit and ship the two biggest bugs?
3. **Relaunch sprint:** sequence strictly from the Minimum Relaunch-Ready critical path, or broaden?
