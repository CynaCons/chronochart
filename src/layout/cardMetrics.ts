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
