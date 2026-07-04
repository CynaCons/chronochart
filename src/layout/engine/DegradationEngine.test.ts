import { describe, it, expect, beforeEach } from 'vitest';
import { DegradationEngine } from './DegradationEngine';
import { createLayoutConfig } from '../config';
import type { ColumnGroup } from '../LayoutEngine';
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