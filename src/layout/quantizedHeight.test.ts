import { describe, it, expect } from 'vitest';
import { measureLineCount } from './textMeasure';
import {
  contentLinesFor,
  heightForLines,
  quantizedCardHeight,
  contentWidthFor,
  CARD_HEIGHTS,
  TITLE_FONT,
} from './cardMetrics';

// Space-separated so greedy word-wrap can actually break it across lines
// (a single unbreakable token always counts as one line).
const LONG_TITLE = 'word '.repeat(60).trim();
const LONG_DESC = 'lorem ipsum dolor '.repeat(40).trim();

describe('textMeasure.measureLineCount', () => {
  it('returns 0 for empty/whitespace text', () => {
    expect(measureLineCount('', 234, TITLE_FONT)).toBe(0);
    expect(measureLineCount('   ', 234, TITLE_FONT)).toBe(0);
  });

  it('returns 1 for a short phrase and more for a long one', () => {
    const short = measureLineCount('Tennis Court Oath', 234, TITLE_FONT);
    const long = measureLineCount(
      'A very long historical event title that clearly cannot fit on a single narrow card line',
      234,
      TITLE_FONT
    );
    expect(short).toBe(1);
    expect(long).toBeGreaterThan(1);
  });

  it('is deterministic', () => {
    const t = 'Estates-General Convenes at Versailles in May';
    expect(measureLineCount(t, 234, TITLE_FONT)).toBe(measureLineCount(t, 234, TITLE_FONT));
  });
});

describe('cardMetrics quantized heights', () => {
  it('clamps predicted lines to each type limit', () => {
    const longTitle = LONG_TITLE;
    const longDesc = LONG_DESC;

    const full = contentLinesFor(longTitle, longDesc, 'full');
    expect(full.titleLines).toBeLessThanOrEqual(2);
    expect(full.descLines).toBeLessThanOrEqual(3);

    const compact = contentLinesFor(longTitle, longDesc, 'compact');
    expect(compact.titleLines).toBeLessThanOrEqual(2);
    expect(compact.descLines).toBeLessThanOrEqual(1);

    const titleOnly = contentLinesFor(longTitle, longDesc, 'title-only');
    expect(titleOnly.titleLines).toBeLessThanOrEqual(1);
    expect(titleOnly.descLines).toBe(0);
  });

  it('never exceeds the worst-case fixed height', () => {
    for (const type of ['full', 'compact', 'title-only'] as const) {
      const h = quantizedCardHeight(LONG_TITLE, LONG_DESC, type);
      expect(h).toBeLessThanOrEqual(CARD_HEIGHTS[type]);
    }
  });

  it('a sparse full card is much shorter than a dense one', () => {
    const sparse = quantizedCardHeight('Short title', undefined, 'full'); // 1-line title, no desc
    const dense = quantizedCardHeight(LONG_TITLE, LONG_DESC, 'full'); // 2-line title, 3-line desc
    expect(sparse).toBeLessThan(dense);
    expect(dense).toBe(CARD_HEIGHTS.full); // worst case reaches the fixed height
  });

  it('height grows monotonically with content lines', () => {
    const h10 = heightForLines('full', 1, 0);
    const h11 = heightForLines('full', 1, 1);
    const h21 = heightForLines('full', 2, 1);
    const h23 = heightForLines('full', 2, 3);
    expect(h10).toBeLessThan(h11);
    expect(h11).toBeLessThan(h21);
    expect(h21).toBeLessThan(h23);
  });

  it('title-only stays at its fixed height regardless of content', () => {
    expect(heightForLines('title-only', 1, 0)).toBe(CARD_HEIGHTS['title-only']);
  });

  it('content width shrinks with padding (full < compact < title-only)', () => {
    expect(contentWidthFor('full')).toBeLessThan(contentWidthFor('compact'));
    expect(contentWidthFor('compact')).toBeLessThan(contentWidthFor('title-only'));
  });
});
