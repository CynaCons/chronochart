import { test, expect } from '@playwright/test';
import { loginAsTestUser, loadTestTimeline } from '../utils/timelineTestUtils';

/**
 * Test 71: Positioning robustness (B4)
 *
 * Guards two structural properties that B1's shared budget + B2's packing should
 * make impossible to violate, at the tightest desktop viewport (1280x720):
 *   - No two cards overlap (the minimap safe-zone clamp must demote to overflow,
 *     never stack cards at the same Y).
 *   - No card intrudes into the minimap safe zone (top of screen, y < 100).
 *   - Cards in the same half-column stack with a uniform ~CARD_SPACING gap.
 *
 * @requirement CC-REQ-CARDS-BOUNDS-001
 */

const MINIMAP_SAFE_ZONE = 100;
const CARD_SPACING = 12;

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Positioning robustness', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await loadTestTimeline(page, 'french-revolution'); // dense
    await expect(page.locator('[data-testid="event-card"]').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('T71.1: no overlaps, no minimap intrusion, uniform column gaps', async ({ page }) => {
    test.info().annotations.push({ type: 'req', description: 'CC-REQ-CARDS-BOUNDS-001' });

    const timelineY = await page.evaluate(() => {
      const axis = document.querySelector('[data-testid="timeline-axis"]') as HTMLElement | null;
      const r = axis?.getBoundingClientRect();
      return r ? r.top + r.height / 2 : window.innerHeight / 2;
    });

    const cards = await page.locator('[data-testid="event-card"]').evaluateAll((els: HTMLElement[]) =>
      els.map(el => {
        const r = el.getBoundingClientRect();
        return {
          left: Math.round(r.left), right: Math.round(r.right),
          top: Math.round(r.top), bottom: Math.round(r.bottom),
          type: el.getAttribute('data-card-type'),
        };
      })
    );

    console.log(`\n📐 T71.1 — ${cards.length} cards at 1280x720, timelineY=${Math.round(timelineY)}`);
    expect(cards.length).toBeGreaterThan(0);

    // (1) No two cards overlap (strict AABB intersection).
    const overlaps: string[] = [];
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i], b = cards[j];
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
          overlaps.push(`(${a.left},${a.top})[${a.type}] ∩ (${b.left},${b.top})[${b.type}]`);
        }
      }
    }
    if (overlaps.length) console.log(`❌ overlaps:\n  ${overlaps.slice(0, 8).join('\n  ')}`);
    expect(overlaps.length, `Found ${overlaps.length} overlapping card pairs`).toBe(0);

    // (2) No card intrudes into the minimap safe zone.
    const intruders = cards.filter(c => c.top < MINIMAP_SAFE_ZONE - 1);
    if (intruders.length) console.log(`❌ minimap intrusions: ${intruders.map(c => c.top).join(', ')}`);
    expect(intruders.length, `${intruders.length} cards intrude into the minimap safe zone (top < ${MINIMAP_SAFE_ZONE})`).toBe(0);

    // (3) Uniform gaps within each half-column (grouped by left edge + side).
    const groups = new Map<string, typeof cards>();
    for (const c of cards) {
      const side = (c.top + c.bottom) / 2 < timelineY ? 'above' : 'below';
      const key = `${Math.round(c.left / 6)}:${side}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    const gaps: number[] = [];
    const badGaps: string[] = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      group.sort((a, b) => a.top - b.top);
      for (let i = 1; i < group.length; i++) {
        const gap = group[i].top - group[i - 1].bottom;
        gaps.push(gap);
        // Strict floor (no overlap); generous ceiling to allow legitimate recompaction.
        if (gap < CARD_SPACING - 2 || gap > CARD_SPACING + 24) {
          badGaps.push(`gap=${gap}px between [${group[i - 1].type}] and [${group[i].type}]`);
        }
      }
    }
    if (gaps.length) {
      const min = Math.min(...gaps), max = Math.max(...gaps);
      const avg = (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1);
      console.log(`   column gaps (n=${gaps.length}): min=${min} avg=${avg} max=${max}px`);
    }
    if (badGaps.length) console.log(`⚠️ non-uniform gaps:\n  ${badGaps.slice(0, 8).join('\n  ')}`);
    expect(badGaps.length, `${badGaps.length} intra-column gaps outside [${CARD_SPACING - 2}, ${CARD_SPACING + 24}]px`).toBe(0);
  });
});
