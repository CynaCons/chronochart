# C1 — Quantized card heights: decision brief

> **Status:** Analysis complete — **awaiting product decision** (see §5 of `LAYOUT_IMPROVEMENT_PLAN.md`).
> **Owner of the call:** user (product trade-off: visual coherence vs. space efficiency).
> **Measured:** 2026-07-05, post-B2, desktop (1920×1080), via `tests/editor/72-fill-efficiency-analysis.spec.ts`.

## 1. The question

Full and compact cards use fixed heights sized for their *worst case* (a 2-line
title + a full description). When real content is shorter, the unused space
pools as dead space at the bottom of the card (failure mode **F9-residual**).
Should we reclaim it with quantized (per-content) heights, or accept it as the
price of coherent fixed sizes?

Acceptance threshold proposed in the plan: **close as acceptable** if internal
gap is `< 15%` on `≥ 90%` of cards.

## 2. Measured data

Internal gap ratio = `(cardBottom − lastContentBottom) / cardHeight`. Dead-space
px shown for the fixed heights (full 132px, compact 90px).

| Timeline | Full gap (px) | Compact gap (px) | 1-line titles | Cards under 15% |
|----------|---------------|------------------|---------------|-----------------|
| french-revolution | 0.263 (~35px), n=5 | 0.337 (~30px), n=5 | 5/5 full, 5/5 compact | 0 / 10 |
| napoleon-bonaparte | 0.390 (~52px), n=6 | 0.337 (~30px), n=3 | 6/6, 3/3 | 0 / 9 |
| jfk-presidency | 0.390 (~52px), n=6 | 0.337 (~30px), n=8 | 6/6, 8/8 | 0 / 14 |

**The 15% target is met by 0% of cards.** The measurement is reproducible: re-run
test 72.

## 3. What the numbers mean

The waste has two independent, additive sources:

1. **The 2-line title budget is never used (~17px, universal).** Every one of
   the 33 sampled full/compact cards rendered a **1-line title**, yet the box
   reserves two title lines. This ~17px is wasted on *every* card, on every
   timeline. It is the single largest, most consistent contributor.
2. **Short descriptions (variable, ~0–17px more).** Where descriptions fill the
   clamp (french-revolution full = 0.263), waste is lower; where they are
   shorter (napoleon/jfk full = 0.390), the extra ~17px pushes the gap to ~52px
   — nearly 40% of the card.

Because source 1 is universal and quantized to a line, the gap ratios cluster at
a few discrete values rather than spreading — a strong signal that this is
**structural**, not a content-distribution tail.

## 4. Options

| Option | What | Reclaims | Cost / risk |
|--------|------|----------|-------------|
| **A. Accept** | Keep fixed heights as-is. | Nothing. | None. But the app's stated goal is to *maximize used space*; 26–39% dead space on every rich card works against it. |
| **B. Re-derive heights for a 1-line title** | Change the title clamp/derivation so full/compact heights assume 1 line (their empirical reality). Still fixed heights, still cell-based. | ~17px/card, universal (source 1). | Medium. Changes `CARD_HEIGHTS` → changes `CARD_HEIGHT_CELLS` and every budget/capacity number (touches B1's model). Rare 2-line titles would truncate to 1 line — the 2-line budget is currently a *safety margin* for long titles that these samples never hit. Needs a truncation-safety check. |
| **C. Quantized per-instance heights** | Measure each card's real content (title lines × description lines), pick a snapped height per card. | Nearly all waste (both sources). | High. Heights become per-instance → capacity, collision, and the clean cell model all need per-card reasoning. Needs a measure + cache pass. Biggest change to the layout engine. |
| **D. Hybrid: a few quantized variants** | 2–3 pre-baked height variants per type (e.g. compact-desc vs full-desc), each snapped to whole cells. | Most waste, in discrete steps. | Medium-high. Keeps the cell model (variants are whole-cell) but adds branching to packing and telemetry. |

## 5. Recommendation

**Do not adopt Option A (accept).** 0% of cards meet the target and the worst
case is ~40% dead space on exactly the richest, most-important cards — this is
the app's core "maximize used space" goal being missed on every timeline.

**Recommended: start with Option B, gated on a truncation-safety check.** The
data is unusually clean: one line of title budget, wasted on 100% of cards, is
most of the problem. Re-deriving heights for a 1-line title reclaims ~17px per
card *while keeping the fixed-size coherence and the whole-cell capacity model*
that B1/B2 depend on. The only real risk is truncating a genuinely long title;
before committing, measure the true distribution of title lengths across the
production timelines (Iran War included, once it exists in the test DB) and
confirm that 2-line titles are rare enough to clamp with an ellipsis — or keep a
single "tall" variant for them (this is where Option D earns its keep).

**Defer Option C (full per-instance quantization)** unless B/D prove
insufficient — its cost to the capacity/collision model is high and the data
does not yet justify it.

### If we proceed (sketch for a follow-up implementation item)

1. Add title-length telemetry to test 72 (already reports `titleLines`); confirm
   the ≥2-line title rate on all production timelines.
2. If 2-line titles are rare: reduce the derived full/compact height by one
   title line in `cardMetrics.ts`, regenerate `CARD_HEIGHTS`/`CARD_HEIGHT_CELLS`,
   and re-run the full gate — the drift-guard test and B1 budget tests will
   catch any inconsistency. Keep the title clamp at 2 lines OR add one "tall"
   variant (Option D) for the rare long title.
3. Re-run test 72; target avg gap `< 0.15` on the description-filled cards.

## 6. Decision

- [ ] **A** — accept as-is
- [ ] **B** — re-derive for 1-line title (recommended, pending truncation check)
- [ ] **C** — full per-instance quantization
- [ ] **D** — few quantized variants

_Recorded for the user's call; no production code changed by C1._
