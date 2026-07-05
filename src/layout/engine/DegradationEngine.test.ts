import { describe, it, expect, beforeEach } from 'vitest';
import { DegradationEngine } from './DegradationEngine';
import { createLayoutConfig, CARD_HEIGHT_CELLS } from '../config';
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
 * Build an engine whose ABOVE half-column budget is exactly K cells.
 * getHalfColumnBudget(above).cells = floor((timelineY − 136) / 44), so setting
 * timelineY = 136 + 44K + 10 lands squarely on K.
 */
function engineForK(K: number): DegradationEngine {
  const config = createLayoutConfig(1440, 900);
  config.timelineY = 136 + 44 * K + 10;
  return new DegradationEngine(config);
}

const RICHNESS: Record<CardType, number> = { full: 3, compact: 2, 'title-only': 1 };

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

describe('DegradationEngine — B2 budget-driven packing', () => {
  const Ks = [4, 8, 12, 16];
  const Ns = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12

  describe.each(Ks)('budget K=%i cells', (K) => {
    it.each(Ns)('N=%i respects budget, visibility, staircase and caps', (N) => {
      const engine = engineForK(K);
      const types = packedTypes(engine, N);

      const usedCells = types.reduce((s, t) => s + CARD_HEIGHT_CELLS[t], 0);
      const fullCount = types.filter(t => t === 'full').length;
      const compactCount = types.filter(t => t === 'compact').length;

      // (a) never exceeds the cell budget
      expect(usedCells).toBeLessThanOrEqual(K);
      // (b) visible count is maximized (everyone starts title-only, cost 1)
      expect(types.length).toBe(Math.min(N, K));
      // (c) tiers are non-increasing in chronological order (earliest = richest)
      for (let i = 1; i < types.length; i++) {
        expect(RICHNESS[types[i]]).toBeLessThanOrEqual(RICHNESS[types[i - 1]]);
      }
      // (d) soft density caps hold
      expect(fullCount).toBeLessThanOrEqual(2);
      expect(compactCount).toBeLessThanOrEqual(4);
    });
  });

  it('N=2, K=8 → uniform full (richest tier both cards can share)', () => {
    expect(packedTypes(engineForK(8), 2)).toEqual(['full', 'full']);
  });

  it('N=3, K=9 → uniform compact (full would exceed the full cap of 2)', () => {
    expect(packedTypes(engineForK(9), 3)).toEqual(['compact', 'compact', 'compact']);
  });

  it('N=1 → a single event is a full card whenever it fits', () => {
    expect(packedTypes(engineForK(4), 1)).toEqual(['full']);
    expect(packedTypes(engineForK(16), 1)).toEqual(['full']);
  });

  it('dense cluster (N ≥ K) maximizes visibility with all title-only, overflowing the rest', () => {
    // K=16, N=20: the budget is fully spent showing 16 events; none can be
    // upgraded (visibility wins over richness), and 4 events overflow.
    const engine = engineForK(16);
    const events = Array.from({ length: 20 }, (_, i) => makeEvent(`e${i}`));
    const group = makeGroup('above-dense', 'above', events);
    const [packed] = engine.applyDegradationAndPromotion([group]);
    const types = packed.cards.map(c => c.cardType);

    expect(types.length).toBe(16); // min(N, K)
    expect(packed.overflowEvents?.length ?? 0).toBe(4); // remainder overflows
    expect(types.every(t => t === 'title-only')).toBe(true); // no budget left to upgrade
  });

  it('slack (N < K) spends leftover budget on a full→title staircase', () => {
    // K=16, N=6: 6 title-only (6 cells) leaves 10 cells; earliest cards upgrade
    // to the caps → [full, full, compact, compact, title, title] = 16 cells.
    const types = packedTypes(engineForK(16), 6);
    expect(types).toEqual(['full', 'full', 'compact', 'compact', 'title-only', 'title-only']);
  });

  it('is deterministic — identical inputs yield identical packing', () => {
    expect(packedTypes(engineForK(12), 7)).toEqual(packedTypes(engineForK(12), 7));
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