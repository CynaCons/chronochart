/**
 * Card metrics — single source of truth for card heights.
 *
 * Canvas event card heights are DERIVED from the typography contract defined
 * in src/styles/index.css, not chosen by eyeballing. If you change font-size
 * or line-height for `.card-title`, `.card-description`, or `.card-date`,
 * update the constants below to match — a mismatch here means cards render
 * with either clipped text (too short) or dead empty space (too tall).
 *
 * Typography contract (src/styles/index.css, 1rem = 16px):
 *   .card-title:       font-size 0.875rem (14px), line-height 1.25 -> 17.5px/line
 *   .card-description: font-size 0.75rem  (12px), line-height 1.4  -> 16.8px/line
 *   .card-date:        font-size 0.75rem  (12px), line-height 1.2  -> 14.4px (single line)
 *
 * Card content stacks (see DeterministicLayoutComponent.tsx FullCardContent /
 * CompactCardContent): title block -> mt-0.5 gap -> description block ->
 * date block, top-aligned (no spacer). Card box-sizing is border-box (Tailwind
 * preflight), so the height budget must cover content + padding + 1px borders.
 *
 * Viewport scaling note: the editor is desktop-only by product decision
 * (PLAN.md 2026-01-18 viewport strategy). The old getAdaptiveCardConfigs path,
 * which scaled card BOXES by 0.7-1.2x without scaling fonts, was removed
 * 2026-07-04 (it reintroduced clipping/waste by construction). If a mobile
 * editor ever returns, card scaling MUST scale typography AND box heights
 * together via a single factor applied to the line-height constants below,
 * so derived heights stay consistent with rendered text.
 */

import type { CardType } from './types';
import { measureLineCount, CARD_FONT_FAMILY, type FontSpec } from './textMeasure';

/** Line height of `.card-title` (0.875rem * 1.25), in px. */
export const TITLE_LINE_HEIGHT = 17.5;

/** Line height of `.card-description` (0.75rem * 1.4), in px. */
export const DESC_LINE_HEIGHT = 16.8;

/** Height of `.card-date` (0.75rem * 1.2, single line, no clamping), in px. */
export const DATE_LINE_HEIGHT = 14.4;

/** Gap between stacked text blocks (Tailwind `mt-0.5` = 0.125rem), in px. */
export const BLOCK_GAP = 2;

/** Card border width, one side, in px (see `borderWidth` in card style). */
export const BORDER_WIDTH = 1;

/** Number of clamped lines per card type, per text block. */
const LINE_CLAMPS: Record<CardType, { title: number; desc: number }> = {
  full: { title: 2, desc: 3 },
  compact: { title: 2, desc: 1 },
  'title-only': { title: 1, desc: 0 },
};

/** Padding (all sides) per card type, in px — matches `cardTypeClass` (p-3 / p-2 / p-1). */
export const CARD_PADDING: Record<CardType, number> = {
  full: 12,       // p-3
  compact: 8,     // p-2
  'title-only': 4 // p-1
};

/** Uniform vertical gap between stacked cards in a column (px). */
export const CARD_SPACING = 12;

/**
 * Final card heights, in px. Derived from the typography contract above,
 * rounded up to a whole px, plus a small (1-2px) safety margin against
 * sub-pixel rendering rounding in different browsers/zoom levels:
 *
 * full:       2*17.5 (title) + 2 (gap) + 3*16.8 (desc) + 2 (gap) + 14.4 (date)
 *             = 103.8 content -> + 24 padding + 2 border = 129.8 -> ceil 130 -> +2 margin -> 132
 * compact:    2*17.5 (title) + 2 (gap) + 1*16.8 (desc) + 2 (gap) + 14.4 (date)
 *             = 70.2 content -> + 16 padding + 2 border = 88.2 -> ceil 89 -> +1 margin -> 90
 * title-only: single centered title line, no description/date block -> fixed at 32
 *             (not derived from the stack formula above; see `deriveCardHeight`)
 *
 * The drift guard test (cardMetrics.test.ts) asserts these values stay within
 * a small margin of `deriveCardHeight(type)` (the bare minimum required by
 * the typography contract) — if a font-size/line-height change pushes the
 * minimum above the value here, the test fails before cards start clipping.
 */
export const CARD_HEIGHTS: Record<CardType, number> = {
  full: 132,
  compact: 90,
  'title-only': 32,
};

/**
 * Computes the content height (title + gap + description + gap + date,
 * excluding padding/border) for a card type from the typography constants
 * above. Exposed for the drift-guard test.
 */
export function deriveContentHeight(type: CardType): number {
  const { title, desc } = LINE_CLAMPS[type];

  if (type === 'title-only') {
    // Single title line only, no description or date rows.
    return title * TITLE_LINE_HEIGHT;
  }

  return (
    title * TITLE_LINE_HEIGHT +
    BLOCK_GAP +
    desc * DESC_LINE_HEIGHT +
    BLOCK_GAP +
    DATE_LINE_HEIGHT
  );
}

/**
 * Computes the bare-minimum card height (content + padding + border, ceiled
 * to the nearest px) required by the typography contract for a card type —
 * i.e. the smallest height that does not clip text. `CARD_HEIGHTS` above
 * should always be >= this value (with only a small margin), which is what
 * the drift-guard test enforces.
 *
 * `title-only` is a fixed height, not derived from the title/desc/date
 * stack formula (it renders a single centered line with no description or
 * date block) — it is returned as-is from `CARD_HEIGHTS`.
 */
export function deriveCardHeight(type: CardType): number {
  if (type === 'title-only') {
    return CARD_HEIGHTS['title-only'];
  }

  const contentHeight = deriveContentHeight(type);
  const padding = CARD_PADDING[type] * 2;
  const border = BORDER_WIDTH * 2;
  return Math.ceil(contentHeight + padding + border);
}

// ---------------------------------------------------------------------------
// Quantized (per-instance) heights — C1 Option C.
//
// Instead of every card of a type using CARD_HEIGHTS[type] (sized for the worst
// case), each card is measured and sized to its ACTUAL content lines, which
// eliminates the internal dead space documented in
// docs/analysis/quantized-heights-decision.md. The rendered card's clamp is set
// to the same line counts, so text can never overflow the shrunk box.
// ---------------------------------------------------------------------------

/** Card width in px (matches DEFAULT_CARD_CONFIGS width in config.ts). */
export const CARD_WIDTH = 260;

/** Font used to measure titles (matches `.card-title`: 0.875rem, weight 600). */
export const TITLE_FONT: FontSpec = { size: 14, weight: 600, family: CARD_FONT_FAMILY };
/** Font used to measure descriptions (matches `.card-description`: 0.75rem, weight 400). */
export const DESC_FONT: FontSpec = { size: 12, weight: 400, family: CARD_FONT_FAMILY };

/** Usable text width inside a card of the given type (px). */
export function contentWidthFor(type: CardType): number {
  return CARD_WIDTH - 2 * CARD_PADDING[type] - 2 * BORDER_WIDTH;
}

export interface ContentLines {
  titleLines: number;
  descLines: number;
}

/**
 * Predicted rendered line counts for an event at a card type, each clamped to
 * that type's `-webkit-line-clamp` limit. `descLines` is 0 for title-only cards
 * and for events with no description.
 */
export function contentLinesFor(
  title: string,
  description: string | undefined,
  type: CardType
): ContentLines {
  const clamp = LINE_CLAMPS[type];
  const width = contentWidthFor(type);
  const titleLines = Math.min(clamp.title, Math.max(1, measureLineCount(title ?? '', width, TITLE_FONT)));
  const descLines =
    clamp.desc === 0 ? 0 : Math.min(clamp.desc, measureLineCount(description ?? '', width, DESC_FONT));
  return { titleLines, descLines };
}

/** Small safety margin (px) against sub-pixel rounding, as with CARD_HEIGHTS. */
const QUANTIZED_MARGIN = 2;

/**
 * Height (px) for a card of `type` rendering exactly `titleLines`/`descLines`.
 * Never exceeds CARD_HEIGHTS[type] (the worst case) and never clips (the render
 * clamp is set to the same line counts). title-only stays at its fixed height.
 */
export function heightForLines(type: CardType, titleLines: number, descLines: number): number {
  if (type === 'title-only') return CARD_HEIGHTS['title-only'];

  const content =
    titleLines * TITLE_LINE_HEIGHT +
    (descLines > 0 ? BLOCK_GAP + descLines * DESC_LINE_HEIGHT : 0) +
    BLOCK_GAP +
    DATE_LINE_HEIGHT;

  const height = Math.ceil(content + 2 * CARD_PADDING[type] + 2 * BORDER_WIDTH) + QUANTIZED_MARGIN;
  return Math.min(height, CARD_HEIGHTS[type]);
}

/** Convenience: measured, content-fitted height for an event at a card type. */
export function quantizedCardHeight(
  title: string,
  description: string | undefined,
  type: CardType
): number {
  const { titleLines, descLines } = contentLinesFor(title, description, type);
  return heightForLines(type, titleLines, descLines);
}
