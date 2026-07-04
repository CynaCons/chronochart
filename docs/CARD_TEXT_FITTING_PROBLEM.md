# Problem Formulation: Canvas Event Card Text Fitting

> **Status:** Open problem statement (not a design decision)  
> **Scope:** Timeline **canvas** event cards rendered by `DeterministicLayoutComponent` — not Stream View list cards, browse cards, or legacy `Node.tsx`.  
> **Related docs:** [SDS_CARDS_SYSTEM.md](./SDS_CARDS_SYSTEM.md), [SRS_CARDS_SYSTEM.md](./SRS_CARDS_SYSTEM.md), [SRS_LAYOUT.md](./SRS_LAYOUT.md)  
> **Related tests:** `tests/editor/104-card-text-rendering.spec.ts`, degradation tests under `tests/editor/36-*`, `67-*`, `48-*`

---

## 1. Summary

PowerTimeline places historical events on a zoomable timeline canvas as **fixed-size cards** stacked in columns above and below the axis. Each card must display a **variable-length** title, optional description, and date/time inside a **predetermined pixel box** whose size is chosen by a **degradation** system based on local event density.

We have a **text fitting problem**: the content does not reliably fill the allocated card area, truncation (`...`) does not always appear at the semantic end of the text, and the degradation tiers (`full` / `compact` / `title-only`) do not always match what users see. These issues affect readability, trust in the product, and the perceived quality of dense timelines (e.g. Iran War, French Revolution).

This document describes the problem neutrally — symptoms, constraints, current architecture, known failure modes, and the solution space — without prescribing a single fix.

---

## 2. Context

### 2.1 What canvas cards are

On the editor canvas, each visible event is rendered as one card in a half-column (`above` or `below` the timeline axis). Cards are positioned by:

| Stage | Module | Responsibility |
|-------|--------|----------------|
| Dispatch | `DispatchEngine` | Group events into half-columns by horizontal proximity |
| Degradation | `DegradationEngine` | Choose card type(s) per half-column; cap visible events; overflow → `+N` badges |
| Positioning | `PositioningEngine` | Assign `x`, `y`, `width`, `height`; collision resolution; anchor placement |
| Render | `DeterministicLayoutComponent` | DOM: title, description, date, source icon, selection/hover states |

Three **card types** exist (`src/layout/types.ts`):

| Type | Config size (`config.ts`) | Intended content (SRS / SDS) |
|------|---------------------------|------------------------------|
| `full` | 260 × 184 px | Title (≤2 lines) + description (≤3 lines) + date/time |
| `compact` | 260 × 120 px | Title (≤2 lines) + description (≤1 line) + date/time |
| `title-only` | 260 × 32 px | Title (≤1 line) + source icon only |

Card **height is fixed per type** before render. The layout engine uses these heights for vertical stacking, capacity accounting (`CapacityModel`, cell footprints), and collision detection.

### 2.2 What canvas cards are not

- **Stream View** uses a separate list-card component (full width, expandable) — different layout rules.
- **`CardRenderer.tsx`** mirrors card content markup but is **not** the live canvas path; the editor uses inline content in `DeterministicLayoutComponent.tsx`.
- **Legacy `Node.tsx`** uses a separate density model (`full` / `compact` / `minimal`) and is not wired to the main editor canvas.

### 2.3 User-facing goal

From product positioning and NN/g-style card guidance: a card should act as a **scannable summary** — enough text to understand the event at a glance, with truncation only when necessary, and ellipsis at the **end of the last visible line** of each text block. Wasted empty space inside a fixed card reduces information density and makes degradation (smaller card types) feel arbitrary.

---

## 3. Problem statement

**Given** a fixed-width, fixed-height card box assigned by the layout engine, and event fields of unpredictable length (title, description, date),

**we need** to display as much readable text as the box and card type allow, such that:

1. Text does not clip **outside** the card (no pixels drawn beyond the border).
2. Truncation ellipsis (`...`) appears only when content exceeds the allowed lines, and only at the **end of the last displayed line** of that block.
3. Vertical space inside the card is **used efficiently** — no large intentional empty regions between content and the card bottom (unless the card type explicitly omits fields, e.g. no description on `title-only`).
4. The visible card type (`data-card-type`) is **consistent** with what degradation selected and with what the user expects from density (e.g. `compact` cards should appear in medium-density columns, not skip straight from `title-only` to `full` when zooming).

**We do not** currently satisfy (2)–(4) reliably in production-like timelines.

---

## 4. Observed symptoms

Reports and manual inspection (2026) include:

| Symptom | Description |
|---------|-------------|
| **Mid-card ellipsis** | `...` appears on a line that is not the last line of the paragraph, or truncates before the natural end of the text block. |
| **Wasted interior space** | Large empty band between description and date (or below title on short content), while the card still uses a tall fixed height (`full` / `compact`). |
| **Bottom clipping** | On some viewports, the last line of description or date is cut off; only the top few pixels of a line may be visible (historically linked to overlap/clamp issues in positioning as well as text layout). |
| **Missing `compact` tier** | At some zoom levels, columns show only `title-only` cards; zooming in jumps to multiple `full` cards with no `compact` in between. |
| **Under-used columns** | A semi-column with three `title-only` cards may occupy ~30–40% of available vertical space above the axis, suggesting degradation is more aggressive than the physical budget requires. |

These symptoms may have **multiple independent causes** (degradation logic vs. CSS layout vs. positioning). They should not be assumed to share a single root fix.

---

## 5. Architectural decomposition

The fitting problem splits into **two coupled sub-problems**. Treating them as one leads to incorrect CSS-only or spacer-based fixes.

### 5.1 Sub-problem A — Column capacity & card type (layout / degradation)

**Question:** How many events can this half-column show, and at which card type(s)?

**Inputs:** Event count in column (and optionally paired above/below cluster), viewport height, `timelineY`, minimap safe zone, horizontal overflow from dispatch.

**Outputs:** `PositionedCard[]` with `cardType`, `width`, `height`; `overflowEvents` for `+N` badges.

**Mechanisms today:**

- Uniform thresholds: e.g. ≤2 events → `full`, 3 → `compact` or mixed, 4+ → `title-only` (see `DegradationEngine`, `SDS_CARDS_SYSTEM.md`).
- Mixed card types when `ENABLE_MIXED_CARD_TYPES` is on and overflow flags allow (e.g. 3 events → `full` + `compact` + `compact` chronologically).
- `getMaxCardsPerHalfColumn(cardType)` caps visible cards by **physical** height above/below the axis.
- Cluster coordination can still couple above/below semi-columns in telemetry and (historically) in type selection.

**Known tension:** Card type is chosen from **event count** and **cluster overflow flags**, not from measuring whether a **specific title/description** fits in the pixel box. A `full` card is always 184px tall even when the text needs only 90px.

### 5.2 Sub-problem B — Text layout inside the box (render / typography)

**Question:** Given `width`, `height`, and `cardType`, how are title, description, and date laid out inside the DOM?

**Inputs:** Fixed card dimensions, typography tokens (`.card-title`, `.card-description`, `.card-date`), padding, border, optional source icon row.

**Outputs:** Visible lines per field; ellipsis placement; whether date row is visible.

**Mechanisms today (canvas path):**

- Flex column: `h-full flex flex-col overflow-hidden`.
- Tailwind/CSS `-webkit-line-clamp` on title and description (`line-clamp-1` … `line-clamp-3`).
- Variants tried in development: `flex-1 min-h-0` on description (causes clamp box shrink); fixed `max-height` in `em` on clamp zones; `card-body-spacer` with `flex-1` to pin date to the bottom.

**Known tension:** CSS `line-clamp` ellipsis is applied at the bottom of the **clamped element's layout box**. If flex or incorrect `max-height` shrinks that box below the natural height of *N* lines, ellipsis appears **early** (not at the semantic end of the text). A bottom spacer **reserves** empty space by design, which conflicts with efficient fitting when card outer height is already fixed.

---

## 6. Constraints & non-goals

### 6.1 Hard constraints

- **Collision layout:** Card `height` from `config.ts` is an input to `PositioningEngine` stacking and recompaction; changing heights per card instance affects column math unless the engine is updated.
- **Performance:** Hundreds of cards may exist; only a subset is virtualized in the viewport. Per-card DOM measurement must be bounded (cache, measure once per layout pass, or compute off-screen).
- **Determinism:** Layout tests and Playwright rely on `data-card-type`, fixed heights in inline styles, and telemetry (`__ccTelemetry`).
- **Accessibility:** Truncated text should remain available in full via `title` attribute, hover preview (`CardHoverPreview` for degraded types), or focusable detail panel.
- **Spec traceability:** Requirements in `SRS_CARDS_SYSTEM.md` (e.g. `CC-REQ-CARDS-TEXT-001`, compact/title-only card reqs) define line limits and ellipsis behavior.

### 6.2 Soft constraints

- Prefer solutions that work in **light and dark** theme without duplicate math.
- Avoid large new dependencies unless CSS + light measurement is insufficient.
- Keep **Stream View** and canvas card behavior conceptually aligned where reasonable, but they may remain separate implementations.

### 6.3 Explicit non-goals (for this problem)

- Rewriting the entire layout engine to variable-height Pinterest-style cards (possible long-term direction, out of scope for a minimal fitting fix).
- Full TeX-quality paragraph layout (Knuth–Plass) across the whole canvas unless product requires it.
- Changing event **content** (shortening descriptions in Firestore) as the primary fix.

---

## 7. Current implementation snapshot

| Area | Location | Notes |
|------|----------|-------|
| Card dimensions | `src/layout/cardMetrics.ts` (consumed by `src/layout/config.ts`) | `full` 132px, `compact` 90px, `title-only` 32px — derived from the typography contract, guarded by `cardMetrics.test.ts` |
| Degradation | `src/layout/engine/DegradationEngine.ts` | Per-group mixed types; cluster overflow detection (recently narrowed to dispatch overflow) |
| Positioning | `src/layout/engine/PositioningEngine.ts` | Stacks from axis; minimap clamp; collision + recompact |
| Card DOM | `src/layout/DeterministicLayoutComponent.tsx` | `FullCardContent`, `CompactCardContent`, `TitleOnlyCardContent` |
| Global clamp utilities | `src/index.css` | `.line-clamp-1/2/3` |
| Card typography | `src/styles/index.css` | `.card-title`, `.card-description`, `.card-date`, `.card-clamp-*` (experimental) |
| Tests | `tests/editor/104-card-text-rendering.spec.ts` | Bounds overflow, line-clamp values; does not assert gap % or ellipsis line index |

**Documentation drift:** `SDS_CARDS_SYSTEM.md` lists compact height as 92px and degradation thresholds that may not match `config.ts` / `DegradationEngine` after recent changes. Any solution should update SDS/SRS together with code.

---

## 8. Failure modes (hypothesis list)

Unbiased list of mechanisms that **may** explain symptoms. Multiple can apply simultaneously.

| ID | Layer | Hypothesis |
|----|-------|------------|
| F1 | Render | `flex-1` + `min-h-0` on a `line-clamp` child shrinks the clamp container below *N* line heights → ellipsis mid-block. |
| F2 | Render | Fixed `max-height` in `em` without accounting for padding, border, icon row, and date row → wrong clamp box. |
| F3 | Render | `card-body-spacer` (`flex-1`) intentionally absorbs space → visible “half empty” card despite fixed outer height. |
| F4 | Layout | Degradation selects `title-only` when mixed `full`+`compact` would fit in the same vertical budget. |
| F5 | Layout | Combined above+below event counts (or aggressive predicted overflow) force uniform degradation across a cluster. |
| F6 | Layout | `getMaxCardsPerHalfColumn` uses viewport math that disagrees with `PositioningEngine` margins → too many or too few cards created vs. positioned. |
| F7 | Position | Minimap safe-zone clamp (`y = 100`) stacks cards on the same Y → overlap; user sees slivers of text. |
| F8 | Position | Collision resolution + recompact separates cards vertically, leaving gaps unrelated to text fitting. |
| F9 | Spec | Fixed card heights chosen for worst-case text (3-line desc) but content is often shorter → structural empty space even with a “correct” algorithm. |
| F10 | Content | Very long unbroken strings / rich text in descriptions break line wrapping assumptions. |

Each hypothesis is testable in isolation (see §10).

---

## 9. Solution space (options, not recommendations)

The following approaches appear in industry practice and academic typography literature. None is declared the winner here.

### 9.1 CSS-only refinement

- Remove flex growth on clamped nodes; use `shrink-0` and top-aligned stacks.
- Pin date with `margin-top: auto` **only if** the card is a flex column whose **minimum** height equals the layout engine height (still may leave gap when content is short).
- Use `text-wrap: balance` on titles (headings only, per CSS guidance) — does not solve box fitting.

**Trade-off:** Low implementation cost; unlikely to fully solve efficient fill or correct ellipsis when outer height is fixed and content is variable.

### 9.2 Measure-then-clamp (DOM or canvas)

- After knowing `cardWidth` and `cardHeight`, measure how many title/description lines fit (binary search on line count or font size).
- Set `-webkit-line-clamp` dynamically per instance.
- Ellipsis only if measured content exceeds allocated lines.

**Trade-off:** Accurate per card; requires layout pass or `ResizeObserver`; must interact safely with virtualization.

### 9.3 Line-budget degradation (unify layout + render)

- Degradation outputs `{ titleLines, descLines }` per card, not only `full|compact|title-only`.
- Card height = function(line budget) + padding + date, capped by type maximum.
- Pixel height in `PositioningEngine` may need to become per-card or per-budget-tier.

**Trade-off:** Best alignment between density and pixels; larger change to capacity model and tests.

### 9.4 Variable intrinsic card heights

- Cards grow vertically to content (within min/max per type); columns reflow like Pinterest/NN/g card patterns.

**Trade-off:** Best space efficiency; conflicts with current fixed-height collision and degradation footprints.

### 9.5 Text layout engine library

- Use a paragraph layout library (e.g. `@react-pdf/textkit`, HarfBuzz/Minikin-style APIs) with `maxLines` and `truncateMode: 'ellipsis'`.

**Trade-off:** Typographically correct; dependency weight and integration cost.

### 9.6 Content-tier display only

- Keep fixed boxes; show title + date only in `compact`, drop description earlier; rely on hover preview for full text.

**Trade-off:** Simple mental model; reduces on-card information.

---

## 10. Verification & acceptance criteria (proposed)

Current tests (`104-card-text-rendering`) enforce:

- No text extending outside card bounding box.
- Expected `-webkit-line-clamp` values per `data-card-type`.

**Gaps** for this problem formulation:

| Criterion | Measurement idea |
|-----------|------------------|
| **No excessive internal gap** | `(cardBottom - lastContentBottom) / cardHeight < threshold` (e.g. 15%) for cards with non-empty description |
| **Ellipsis at last line only** | Compare `getClientRects()` line boxes for clamped element; ellipsis glyph only on final rect |
| **Degradation ↔ render consistency** | On a dense fixture timeline, distribution of `data-card-type` includes `compact` at medium density zoom levels |
| **No overlap clipping** | Paired with positioning tests: stacked cards in same `clusterId` have `y` gaps ≥ spacing |
| **Stable across zoom** | Same event IDs: line budgets change smoothly, not discontinuously title-only ↔ full only |

---

## 11. Open questions

1. Should **card outer height** remain fixed per type, or become **derived from line budget** (Sub-problem A and B merged)?
2. Is **bottom-aligned date** a product requirement, or is **top-aligned stack with date directly under description** acceptable (eliminates spacer)?
3. Should **compact** mean “1-line description” always, or “as many description lines as fit after title”?
4. How should **hover preview** interact with fitting — is on-card truncation allowed to be aggressive if preview is reliable?
5. Should SDS/SRS be updated to a single source of truth for pixel heights and line counts?

---

## 12. References

| Source | Relevance |
|--------|-----------|
| [Knuth & Plass — Breaking Paragraphs into Lines](http://www.eprg.org/G53DOC/pdfs/knuth-plass-breaking.pdf) | Line breaking and last-line ellipsis in professional layout |
| [NN/g — Cards UI component](https://www.nngroup.com/articles/cards-component/) | Variable card height, heterogenous content, scannability |
| [@react-pdf/textkit](https://www.npmjs.com/package/@react-pdf/textkit) | Container `maxLines`, `truncateMode: 'ellipsis'` API pattern |
| [Raph Levien — Text layout hierarchy](https://raphlinus.github.io/text/2020/10/26/text-layout.html) | Line breaking vs. shaping; ellipsize last line |
| Internal: `docs/SDS_CARDS_SYSTEM.md` | Degradation thresholds, intended dimensions |
| Internal: `docs/SRS_CARDS_SYSTEM.md` | Requirements IDs for card types and text |
| Internal: `tests/editor/104-card-text-rendering.spec.ts` | Current automated coverage |

---

## 13. Document history

| Date | Change |
|------|--------|
| 2026-07-04 | Initial problem formulation from canvas card fitting investigation (degradation, positioning, CSS clamp/spacer experiments, user reports). |
| 2026-07-04 | Phase 1 landed: card heights derived from typography contract in `src/layout/cardMetrics.ts` (full 184→132px, compact 120→90px), `card-body-spacer` removed (date top-aligned under description), `CARD_SPACING` unified, drift-guard unit test added. Addresses F2/F3/F9 and part of F6; degradation-side hypotheses (F4/F5) remain open for a later phase. |