# Round 3 — Independent Plan Assessment (external agent)

**Grade: 7/10.** Strong diagnosis & root-causing; loses points on (1) scope blind spots specific to a live war feed, (2) no acceptance criteria / validation gate, (3) buried critical path. Both root-caused bugs were re-verified against source.

## Missing items (gaps)
- **M1 [CRIT] Legal: Privacy Policy + ToS + content disclaimer.** GDPR/Google OAuth effectively require a privacy policy; none in plan. Personal Gmail exposed.
- **M2 [CRIT] Content moderation + sourcing disclaimer + correction policy for the LIVE Iran War feed.** Automated, unverified casualty claims about an active war → credibility/liability. No "report an error", no "last verified", no disputed-claim handling. Biggest un-addressed risk.
- **M3 [HIGH] OSINT ingestion pipeline unaudited.** Failure/dedup/false-event/review-gate behavior unexamined. The "Mar 1 density" is a pipeline symptom, not just display.
- **M4 [HIGH] No performance/Lighthouse/CWV baseline.** 295-event canvas SPA = likely LCP/TBT risk; CWV is a ranking factor the G2 SEO thesis depends on.
- **M5 [HIGH] No analytics/success metrics/acceptance criteria.** "Done" is unfalsifiable; scorecard targets (3→8) are opinions, not measurable outcomes.
- **M6 [MED] Email verification + abuse/auth hardening** (open sign-up on a current-events product).
- **M7 [MED] Systematic error/loading/empty states** (only the 404 + new-user empty state are defined).
- **M8 [MED] PWA/favicon/manifest under-scoped** (G1.6 mis-sized as LOW; OG/share icons depend on it).
- **M9 [MED] Data-integrity audit** (French Rev title "1789–1799" vs content 1748–1835 → JSON-LD publishes wrong dates).
- **M10 [MED] Sitemap freshness mechanism** (static sitemap goes stale for a rolling feed).

## Prioritization fixes
- **Define an explicit Minimum Relaunch-Ready critical path:** G1.0, G1.1, G1.2, G1.3, G2.1 + M1 + M2. Everything else is fast-follow. "G1–G2 = blockers" over-includes (G1.5/1.6/1.7) and under-includes (only G2.1 is the real blocker).
- **Pull forward (cheap, high-leverage, currently parked):** G6.3 heading h1/h2 → into G2 (SEO prerequisite, not a11y polish); G6.2 closing-CTA dead-end → into G1 (same class as G1.1); the S-effort trust fixes in G5.5/G5.2 (first thing a visitor sees).
- **Defer / de-risk:** G3.5 uniform canvas re-spec (`HIGH·L`) — contradictory to demote the canvas (G3.1) AND perfect it; G6.3 CI outline-linter (gold-plating for solo founder); treat G4.1 full design-system unification as **fast-follow**, not relaunch-blocking (ship a tightened current system via the cheaper G4.2/G4.5).
- **Calibration:** G1.1 is M–L (bundles a data migration); G2.1 is likely **L** and the hardest item (per-route OG on a client-rendered SPA needs SSR/prerender/edge + dynamic OG-image — own spike); G1.3 spec not final (tested 500px not 390px).
- **Dependency gap:** G3.3 (summary header) is the content source for G2.1 OG + G2.2 JSON-LD — link them or pull a minimal summary field into G2.

## Evidence/rigor fixes
- Both fixes verified correct in source. G1.0 caveat: owner-by-path read also exposes owner's own private timelines (intended) — verify events subcollection rule (lines 80-83) unaffected.
- **Over-claims to fix:**
  1. G1.0 quotes raw `FirebaseError`; user actually sees "An unexpected error occurred." → also reveals an error-swallowing finding (ties M7).
  2. "kills the ENTIRE creator funnel" — unverified whether the server-side **Timeline Automation API** (Admin SDK, bypasses rules) is blocked. Owner's ingestion likely uses the API → scope claim to *interactive new users*, not the founder's growth engine.
  3. G1.2 assumes a "Cloud Function" but rules suggest **client-side** stats aggregation — confirm the layer before "fixing the Cloud Function."
  4. "v0.8.15+" maturity is asserted, not evidenced (no version screenshot).
  5. **G1.3 contradiction:** task says "make it full-screen" but the verification log says the dialog *already is* full-screen — retarget to inner horizontal overflow + bottom gap.
- **Altitude over-prescriptions:** G1.1 "backfill `id` on all docs" prescribes a migration before confirming it's needed (resolving by `{username, doc-id}` directly may avoid it — the doc-id *is* the slug); G3.1 `?view=stream` stated as decided. Mark both "proposed approach."
- **Citation:** `EditorPage.tsx` is at `src/pages/EditorPage.tsx`.

## Top 5 changes (priority order)
1. Add a "Minimum Relaunch-Ready" critical path + a post-implementation validation gate.
2. Add the missing legal/editorial/metrics items (M1, M2, M5).
3. Re-tag & re-sequence for a solo founder (pull forward cheap trust/SEO/CTA fixes; defer over-built items).
4. Fix the three evidence/spec contradictions (G1.3 full-screen, G1.2 layer, G1.1 migration-optional + path).
5. Audit the OSINT ingestion pipeline + data integrity (M3, M9).
