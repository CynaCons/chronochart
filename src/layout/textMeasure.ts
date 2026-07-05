/**
 * Deterministic text measurement for quantized card heights (C1 Option C).
 *
 * The layout engine needs to know how many lines a title/description will wrap
 * to BEFORE the card renders, so it can size each card to its actual content
 * instead of the worst case. Because cards clamp with `-webkit-line-clamp` +
 * `max-height`, the only correctness rule is that a card's box and its clamp
 * agree (see DeterministicLayoutComponent) — this module decides that shared
 * line count.
 *
 * Measurement uses a shared 2D canvas when one is available (the live browser
 * path — accurate). In non-DOM contexts (vitest/jsdom, SSR) it falls back to a
 * deterministic average-character-width estimate so unit tests and the engine
 * stay runnable. Both paths bias slightly toward MORE lines (a small safety
 * inset) so we never truncate text that would actually fit.
 */

export interface FontSpec {
  /** px font size */
  size: number;
  /** CSS font-weight */
  weight: number;
  /** CSS font-family stack used for measurement */
  family: string;
}

/** Font family used across the card text (kept in one place for measurement). */
export const CARD_FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Safety inset (px) shaved off the usable width so we never under-count lines. */
const WIDTH_SAFETY_INSET = 4;

let sharedCanvas: { measure: (text: string, font: string) => number } | null | undefined;

function getMeasurer(): ((text: string, font: string) => number) | null {
  if (sharedCanvas !== undefined) return sharedCanvas ? sharedCanvas.measure : null;

  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx && typeof ctx.measureText === 'function') {
        // jsdom returns width 0 for everything; treat that as "no real canvas".
        ctx.font = '12px sans-serif';
        if (ctx.measureText('probe').width > 0) {
          sharedCanvas = {
            measure: (text: string, font: string) => {
              ctx.font = font;
              return ctx.measureText(text).width;
            },
          };
          return sharedCanvas.measure;
        }
      }
    }
  } catch {
    /* fall through to estimate */
  }

  sharedCanvas = null;
  return null;
}

/** Deterministic fallback: average glyph width as a fraction of font size. */
function estimateWidth(text: string, size: number): number {
  // ~0.52em average for Latin text in a humanist sans; wide enough to avoid
  // under-counting lines for typical historical titles/descriptions.
  return text.length * size * 0.52;
}

function fontString(font: FontSpec): string {
  return `${font.weight} ${font.size}px ${font.family}`;
}

/**
 * Number of lines `text` wraps to at `maxWidthPx`, via greedy word wrapping.
 * Always >= 1 for non-empty text. Long unbreakable words count as their own
 * line rather than overflowing.
 */
export function measureLineCount(text: string, maxWidthPx: number, font: FontSpec): number {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return 0;

  const usable = Math.max(1, maxWidthPx - WIDTH_SAFETY_INSET);
  const measurer = getMeasurer();
  const fs = fontString(font);
  const widthOf = (s: string) => (measurer ? measurer(s, fs) : estimateWidth(s, font.size));

  const words = trimmed.split(/\s+/);
  let lines = 1;
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (widthOf(candidate) <= usable || current === '') {
      current = candidate;
    } else {
      lines++;
      current = word;
    }
  }

  return lines;
}
