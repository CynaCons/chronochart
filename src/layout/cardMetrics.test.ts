import { describe, it, expect } from 'vitest';
import {
  CARD_HEIGHTS,
  CARD_SPACING,
  deriveCardHeight,
  deriveContentHeight,
  TITLE_LINE_HEIGHT,
  DESC_LINE_HEIGHT,
  DATE_LINE_HEIGHT,
  BLOCK_GAP,
  CARD_PADDING,
  BORDER_WIDTH,
} from './cardMetrics';
import { createLayoutConfig, CARD_HEIGHT_CELLS } from './config';
import type { CardType } from './types';

const CARD_TYPES: CardType[] = ['full', 'compact', 'title-only'];

describe('cardMetrics drift guard', () => {
  it('typography constants match src/styles/index.css', () => {
    // .card-title: 0.875rem (14px) * line-height 1.25
    expect(TITLE_LINE_HEIGHT).toBeCloseTo(14 * 1.25, 5);
    // .card-description: 0.75rem (12px) * line-height 1.4
    expect(DESC_LINE_HEIGHT).toBeCloseTo(12 * 1.4, 5);
    // .card-date: 0.75rem (12px) * line-height 1.2
    expect(DATE_LINE_HEIGHT).toBeCloseTo(12 * 1.2, 5);
  });

  it('CARD_HEIGHTS never falls below the typography-derived minimum (no clipping)', () => {
    for (const type of CARD_TYPES) {
      const minimum = deriveCardHeight(type);
      expect(CARD_HEIGHTS[type]).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('CARD_HEIGHTS stays within a small safety margin of the minimum (no dead space regression)', () => {
    // Guards against silently reverting to the old, ~25-30% oversized heights
    // (full 184px, compact 120px) — a large gap here means empty bands are back.
    const MAX_MARGIN_PX = 6;
    for (const type of CARD_TYPES) {
      const minimum = deriveCardHeight(type);
      expect(CARD_HEIGHTS[type] - minimum).toBeLessThanOrEqual(MAX_MARGIN_PX);
    }
  });

  it('full card content height matches the documented derivation (103.8px)', () => {
    expect(deriveContentHeight('full')).toBeCloseTo(
      2 * TITLE_LINE_HEIGHT + BLOCK_GAP + 3 * DESC_LINE_HEIGHT + BLOCK_GAP + DATE_LINE_HEIGHT,
      5
    );
    expect(deriveCardHeight('full')).toBe(
      Math.ceil(deriveContentHeight('full') + CARD_PADDING.full * 2 + BORDER_WIDTH * 2)
    );
  });

  it('compact card content height matches the documented derivation (70.2px)', () => {
    expect(deriveContentHeight('compact')).toBeCloseTo(
      2 * TITLE_LINE_HEIGHT + BLOCK_GAP + 1 * DESC_LINE_HEIGHT + BLOCK_GAP + DATE_LINE_HEIGHT,
      5
    );
    expect(deriveCardHeight('compact')).toBe(
      Math.ceil(deriveContentHeight('compact') + CARD_PADDING.compact * 2 + BORDER_WIDTH * 2)
    );
  });

  it('title-only height is fixed, not derived from the stack formula', () => {
    expect(deriveCardHeight('title-only')).toBe(CARD_HEIGHTS['title-only']);
    expect(CARD_HEIGHTS['title-only']).toBe(32);
  });

  it('DEFAULT_CARD_CONFIGS (via createLayoutConfig) matches CARD_HEIGHTS', () => {
    const config = createLayoutConfig(1440, 900);
    for (const type of CARD_TYPES) {
      expect(config.cardConfigs[type].height).toBe(CARD_HEIGHTS[type]);
    }
  });

  it('CARD_HEIGHT_CELLS matches ceil((height + CARD_SPACING) / 44) for every card type', () => {
    const CELL_UNIT = 44;
    for (const type of CARD_TYPES) {
      const expectedCells = Math.ceil((CARD_HEIGHTS[type] + CARD_SPACING) / CELL_UNIT);
      expect(CARD_HEIGHT_CELLS[type]).toBe(expectedCells);
    }
  });

  it('exposes the expected final height values', () => {
    expect(CARD_HEIGHTS.full).toBe(132);
    expect(CARD_HEIGHTS.compact).toBe(90);
    expect(CARD_HEIGHTS['title-only']).toBe(32);
    expect(CARD_SPACING).toBe(12);
  });
});
