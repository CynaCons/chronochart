import { test, expect } from '@playwright/test';
import { loginAsTestUser, loadTestTimeline } from '../utils/timelineTestUtils';

/**
 * Test 48: Title-only degradation
 *
 * Verifies that dense timelines degrade some cards to the title-only tier
 * without overlaps, and that title-only cards never render a date.
 *
 * History: rewritten 2026-07-04. The original version seeded events into
 * localStorage and visited `/` anonymously, which stopped reaching the editor
 * after the Calm Modern relaunch (`/` now renders the marketing landing page
 * for signed-out users). It now authenticates and loads the high-density
 * `french-revolution` public timeline (250 events), which reliably produces
 * title-only cards at the default zoom.
 *
 * @requirement CC-REQ-CARD-TITLE-ONLY
 */

test.describe('v5/48 Title-only degradation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await loadTestTimeline(page, 'french-revolution'); // 250 events, high density
    await expect(page.locator('[data-testid="event-card"]').first())
      .toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000); // Stabilize rendering
  });

  test('dense clusters trigger title-only cards without overlaps', async ({ page }) => {
    test.info().annotations.push({ type: 'req', description: 'CC-REQ-CARD-TITLE-ONLY' });

    // Axis present
    await expect(page.locator('[data-testid="timeline-axis"]').first()).toBeVisible();

    // Read telemetry for debugging
    const telemetry = await page.evaluate(() => (window as unknown as { __ccTelemetry?: unknown }).__ccTelemetry);
    console.log('telemetry.degradation', (telemetry as { degradation?: unknown })?.degradation);

    // Ensure at least one title-only card is rendered
    const titleOnly = page.locator('[data-testid="event-card"][data-card-type="title-only"]');
    const titleOnlyCount = await titleOnly.count();
    console.log(`Rendered ${titleOnlyCount} title-only cards`);
    expect(titleOnlyCount).toBeGreaterThan(0);

    // VERIFY: Title-only cards display ONLY titles (no dates)
    console.log(`\n🔍 Verifying ${titleOnlyCount} title-only cards...`);
    for (let i = 0; i < Math.min(titleOnlyCount, 5); i++) {
      const card = titleOnly.nth(i);
      const cardText = await card.textContent();
      const cardHTML = await card.innerHTML();

      console.log(`  Card ${i}: "${cardText}"`);

      // Check for date patterns
      const hasDatePattern = /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w{3}\s+\d{1,2},\s+\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cardText || '');
      const hasDateElement = /<[^>]*class="[^"]*card-date[^"]*"/.test(cardHTML);

      if (hasDatePattern || hasDateElement) {
        console.log(`  ❌ Contains date (pattern: ${hasDatePattern}, element: ${hasDateElement})`);
      } else {
        console.log(`  ✅ No date found`);
      }

      // Title-only cards should NOT contain dates
      expect(hasDatePattern).toBe(false);
      expect(hasDateElement).toBe(false);
    }

    // No overlaps across all cards
    const overlaps = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="event-card"]')) as HTMLElement[];
      const rects = cards.map((el) => el.getBoundingClientRect());
      const collide = (a: DOMRect, b: DOMRect) => (
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
      );
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          if (collide(rects[i], rects[j])) return true;
        }
      }
      return false;
    });
    expect(overlaps).toBeFalsy();
  });
});
