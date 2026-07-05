import { test, expect } from '@playwright/test';
import { loginAsTestUser, loadTestTimeline } from '../utils/timelineTestUtils';

/**
 * Test 72: Fill-efficiency analysis (C1)
 *
 * Measurement harness for the quantized-heights decision. For each timeline it
 * reports, per card type, the internal dead-space gap ratio
 *   (cardBottom − lastContentBottom) / cardHeight
 * and the share of cards whose gap is under the 15% "acceptable" threshold.
 * No production code is exercised — this only gathers evidence for
 * docs/analysis/quantized-heights-decision.md.
 */

const TIMELINES = ['french-revolution', 'napoleon-bonaparte', 'jfk-presidency'];

test.describe('Fill efficiency analysis (C1)', () => {
  for (const timeline of TIMELINES) {
    test(`C1 gap-ratio distribution — ${timeline}`, async ({ page }) => {
      await loginAsTestUser(page);
      await loadTestTimeline(page, timeline);
      await expect(page.locator('[data-testid="event-card"]').first()).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      const rows = await page.locator('[data-testid="event-card"]').evaluateAll((cards: HTMLElement[]) => {
        const out: Array<{ type: string; ratio: number; titleLines: number }> = [];
        cards.forEach(card => {
          const type = card.getAttribute('data-card-type');
          if (type !== 'full' && type !== 'compact') return;
          const descEl = card.querySelector('.card-description') as HTMLElement | null;
          const dateEl = card.querySelector('.card-date') as HTMLElement | null;
          const titleEl = card.querySelector('.card-title') as HTMLElement | null;
          if (!descEl || (descEl.textContent || '').trim().length === 0) return;
          const last = dateEl || descEl;
          const cardRect = card.getBoundingClientRect();
          const gap = cardRect.bottom - last.getBoundingClientRect().bottom;
          const titleLH = titleEl ? parseFloat(getComputedStyle(titleEl).lineHeight) : 0;
          const titleLines = titleEl && titleLH ? Math.round(titleEl.clientHeight / titleLH) : 0;
          out.push({ type, ratio: gap / cardRect.height, titleLines });
        });
        return out;
      });

      const summarize = (type: string) => {
        const rs = rows.filter(r => r.type === type).map(r => r.ratio);
        if (!rs.length) return `${type.toUpperCase()}: no cards`;
        const min = Math.min(...rs), max = Math.max(...rs);
        const avg = rs.reduce((a, b) => a + b, 0) / rs.length;
        const underTarget = rs.filter(r => r < 0.15).length;
        const oneLineTitles = rows.filter(r => r.type === type && r.titleLines <= 1).length;
        return `${type.toUpperCase()} (n=${rs.length}): gap min=${min.toFixed(3)} avg=${avg.toFixed(3)} max=${max.toFixed(3)} | `
          + `<0.15: ${underTarget}/${rs.length} (${(100 * underTarget / rs.length).toFixed(0)}%) | `
          + `1-line titles: ${oneLineTitles}/${rs.length}`;
      };

      console.log(`\n📊 C1 fill efficiency — ${timeline}`);
      console.log(`   ${summarize('full')}`);
      console.log(`   ${summarize('compact')}`);

      expect(rows.length).toBeGreaterThan(0);
    });
  }
});
