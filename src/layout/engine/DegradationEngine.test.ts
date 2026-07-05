import { describe, it, expect, beforeEach } from 'vitest';
import { DegradationEngine } from './DegradationEngine';
import { createLayoutConfig } from '../config';
import { quantizedCardHeight, CARD_SPACING } from '../cardMetrics';
import type { ColumnGroup } from '../LayoutEngine';
import type { CardType } from '../types';
import type { Event } from '../../types';

function makeEvent(id: string, date = '2020-01-01'): Event {
  return {
    id,
    title: `Event ${id}`,
    description: 'Description text',
    date,
    time: '12:00',
  };
}

/**
 * Build an engine whose ABOVE half-column budget is exactly `px` pixels.
 * getHalfColumnBudget(above).pixels = timelineY − 148, so timelineY = px + 148.
 * (C3 packing is pixel/height-based, not cell-based.)
 */
function engineForPixels(px: number): DegradationEngine {
  const config = createLayoutConfig(1440, 900);
  config.timelineY = px + 148;
  return new DegradationEngine(config);
}

const RICHNESS: Record<CardType, number> = { full: 3, compact: 2, 'title-only': 1 };

// Measured heights of the uniform test event at each tier (short title + short
// description → 1-line title, 1-line description). Used to assert the packed
// stack fits its pixel budget.
const SAMPLE = makeEvent('e0');
const H: Record<CardType, number> = {
  'title-only': quantizedCardHeight(SAMPLE.title, SAMPLE.description, 'title-only'),
  compact: quantizedCardHeight(SAMPLE.title, SAMPLE.description, 'compact'),
  full: quantizedCardHeight(SAMPLE.title, SAMPLE.description, 'full'),
};
const stackHeight = (types: CardType[]) =>
  types.reduce((sum, t, i) => sum + H[t] + (i > 0 ? CARD_SPACING : 0), 0);
/** How many title-only cards (the shortest) fit in a pixel budget. */
const maxTitleOnly = (px: number) =>
  Math.max(1, Math.floor((px + CARD_SPACING) / (H['title-only'] + CARD_SPACING)));

function packedTypes(engine: DegradationEngine, n: number): CardType[] {
  const events = Array.from({ length: n }, (_, i) => makeEvent(`e${i}`));
  const group = makeGroup('above-K', 'above', events);
  const result = engine.applyDegradationAndPromotion([group]);
  return result[0].cards.map(c => c.cardType);
}

function makeGroup(id: string, side: 'above' | 'below', events: Event[], overflow?: Event[]): ColumnGroup {
  return {
    id,
    events,
    overflowEvents: overflow,
    startX: 100,
    endX: 360,
    centerX: 230,
    side,
    anchor: {
      id: `anchor-${id}`,
      x: 230,
      y: 400,
      eventIds: events.map(e => e.id),
      eventCount: events.length,
      visibleCount: events.length,
      overflowCount: overflow?.length ?? 0,
    },
    cards: [],
    capacity: {
      above: { used: 0, total: 2 },
      below: { used: 0, total: 2 },
    },
  };
}

describe('DegradationEngine', () => {
  let engine: DegradationEngine;

  beforeEach(() => {
    const config = createLayoutConfig(1440, 900);
    engine = new DegradationEngine(config);
  });

  it('uses mixed card types for 3 events in a half-column (full + compact)', () => {
    const group = makeGroup('above-1', 'above', [
      makeEvent('e1'),
      makeEvent('e2'),
      makeEvent('e3'),
    ]);

    const result = engine.applyDegradationAndPromotion([group]);
    const cards = result[0].cards;

    expect(cards.length).toBeGreaterThan(0);
    const types = cards.map(c => c.cardType);
    expect(types).toContain('full');
    expect(types).toContain('compact');
    expect(types).not.toEqual(['title-only', 'title-only', 'title-only']);
  });

  it('does not apply combined above+below counts to a single half-column', () => {
    const above = makeGroup('above-1', 'above', [makeEvent('a1'), makeEvent('a2')]);
    const below = makeGroup('below-1', 'below', [makeEvent('b1'), makeEvent('b2'), makeEvent('b3')]);

    const result = engine.applyDegradationAndPromotion([above, below]);
    const aboveCards = result.find(g => g.id === 'above-1')!.cards;
    const belowCards = result.find(g => g.id === 'below-1')!.cards;

    // Above has only 2 events — must not be title-only just because below has 3
    expect(aboveCards.every(c => c.cardType === 'title-only')).toBe(false);
    expect(aboveCards.some(c => c.cardType === 'full')).toBe(true);
    // Below has 3 events — mixed full+compact, not all title-only
    expect(belowCards.every(c => c.cardType === 'title-only')).toBe(false);
    expect(belowCards.some(c => c.cardType === 'full' || c.cardType === 'compact')).toBe(true);
  });

  it('produces compact cards for 4 events when space allows mixed compact stack', () => {
    const group = makeGroup('above-2', 'above', [
      makeEvent('e1'),
      makeEvent('e2'),
      makeEvent('e3'),
      makeEvent('e4'),
    ]);

    const result = engine.applyDegradationAndPromotion([group]);
    const types = result[0].cards.map(c => c.cardType);

    expect(types.some(t => t === 'compact')).toBe(true);
  });
});

describe('DegradationEngine — C3 height-based packing', () => {
  const pxBudgets = [150, 300, 500, 800];
  const Ns = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12

  describe.each(pxBudgets)('budget %ipx', (px) => {
    it.each(Ns)('N=%i respects budget, visibility, staircase and caps', (N) => {
      const types = packedTypes(engineForPixels(px), N);

      const fullCount = types.filter(t => t === 'full').length;
      const compactCount = types.filter(t => t === 'compact').length;

      // (a) the packed stack never exceeds the pixel budget
      expect(stackHeight(types)).toBeLessThanOrEqual(px);
      // (b) visible count is maximized (everyone starts title-only, the shortest)
      expect(types.length).toBe(Math.min(N, maxTitleOnly(px)));
      // (c) tiers non-increasing chronologically (earliest = richest)
      for (let i = 1; i < types.length; i++) {
        expect(RICHNESS[types[i]]).toBeLessThanOrEqual(RICHNESS[types[i - 1]]);
      }
      // (d) soft density caps hold
      expect(fullCount).toBeLessThanOrEqual(2);
      expect(compactCount).toBeLessThanOrEqual(4);
    });
  });

  it('N=1 → a single event is a full card whenever it fits', () => {
    expect(packedTypes(engineForPixels(300), 1)).toEqual(['full']);
    expect(packedTypes(engineForPixels(800), 1)).toEqual(['full']);
  });

  it('sparse events upgrade to full readily, capped at 2 full', () => {
    // With quantized heights a sparse full ≈ compact in height, so upgrades are
    // cheap: earliest events reach full up to the cap, the rest compact.
    const types = packedTypes(engineForPixels(500), 3);
    expect(types.filter(t => t === 'full').length).toBe(2);
    expect(types[2]).toBe('compact');
  });

  it('dense cluster (budget-full) maximizes visibility with all title-only, overflowing the rest', () => {
    // 150px fits 3 title-only (44px cells) with no room to upgrade.
    const engine = engineForPixels(150);
    const events = Array.from({ length: 20 }, (_, i) => makeEvent(`e${i}`));
    const group = makeGroup('above-dense', 'above', events);
    const [packed] = engine.applyDegradationAndPromotion([group]);
    const types = packed.cards.map(c => c.cardType);

    expect(types.length).toBe(maxTitleOnly(150));
    expect(packed.overflowEvents?.length ?? 0).toBe(20 - types.length);
    expect(types.every(t => t === 'title-only')).toBe(true);
  });

  it('slack spends leftover budget on a full→compact→title staircase', () => {
    const types = packedTypes(engineForPixels(500), 6);
    // Non-increasing, budget-respecting, with a rich head and title-only tail.
    expect(types[0]).toBe('full');
    expect(types[types.length - 1]).toBe('title-only');
    expect(types.filter(t => t === 'full').length).toBeLessThanOrEqual(2);
    expect(types.filter(t => t === 'compact').length).toBeLessThanOrEqual(4);
    expect(stackHeight(types)).toBeLessThanOrEqual(500);
  });

  it('is deterministic — identical inputs yield identical packing', () => {
    expect(packedTypes(engineForPixels(500), 7)).toEqual(packedTypes(engineForPixels(500), 7));
  });

  it('B3: a sparse below is not degraded by a crowded above (independent per-side)', () => {
    const engine = new DegradationEngine(createLayoutConfig(1440, 900));
    const above = makeGroup('above-1', 'above', Array.from({ length: 8 }, (_, i) => makeEvent(`a${i}`)));
    const below = makeGroup('below-1', 'below', [makeEvent('b1')]);

    const result = engine.applyDegradationAndPromotion([above, below]);
    const belowCards = result.find(g => g.id === 'below-1')!.cards.map(c => c.cardType);
    const aboveCards = result.find(g => g.id === 'above-1')!.cards;

    // The lone below event stays a full card — the crowded above does not drag it down.
    expect(belowCards).toEqual(['full']);
    // The above half-column packs its own budget independently (many cards).
    expect(aboveCards.length).toBeGreaterThan(1);
  });
});