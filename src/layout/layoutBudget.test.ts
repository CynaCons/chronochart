import { describe, it, expect } from 'vitest';
import { createLayoutConfig } from './config';
import { CARD_SPACING } from './cardMetrics';
import {
  getHalfColumnBudget,
  computeTimelineY,
  CELL_SIZE,
  MINIMAP_SAFE_ZONE,
  AXIS_MARGIN_ABOVE,
  AXIS_MARGIN_BELOW,
} from './layoutBudget';

const VIEWPORTS: Array<[number, number]> = [
  [1280, 720],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];

describe('layoutBudget', () => {
  it('CELL_SIZE is one title-only card + one gap (44px)', () => {
    expect(CELL_SIZE).toBe(44);
  });

  it('computeTimelineY matches createLayoutConfig for every viewport', () => {
    for (const [w, h] of VIEWPORTS) {
      expect(computeTimelineY(h)).toBe(createLayoutConfig(w, h).timelineY);
    }
  });

  describe.each(VIEWPORTS)('viewport %ix%i', (w, h) => {
    const config = createLayoutConfig(w, h);

    it('degradation path and capacity path produce identical budgets', () => {
      // DegradationEngine passes the full config (config.timelineY);
      // CapacityModel derives timelineY from the viewport height. Both must agree.
      const viaConfig = getHalfColumnBudget(config, 'above');
      const viaViewport = getHalfColumnBudget(
        { viewportHeight: h, timelineY: computeTimelineY(h) },
        'above'
      );
      expect(viaViewport).toEqual(viaConfig);
    });

    it('cells === floor((pixels + CARD_SPACING) / CELL_SIZE) for both sides', () => {
      for (const side of ['above', 'below'] as const) {
        const b = getHalfColumnBudget(config, side);
        expect(b.cells).toBe(Math.floor((b.pixels + CARD_SPACING) / CELL_SIZE));
      }
    });

    it('above and below budgets differ by the axis-margin gap', () => {
      const above = getHalfColumnBudget(config, 'above');
      const below = getHalfColumnBudget(config, 'below');
      expect(above.pixels).not.toBe(below.pixels);
      // above uses a smaller axis margin (48) than below (55) → 7px more room
      expect(above.pixels - below.pixels).toBe(AXIS_MARGIN_BELOW - AXIS_MARGIN_ABOVE);
    });
  });

  it('above budget equals the legacy DegradationEngine formula (timelineY − 148)', () => {
    // Guarantees the B1 refactor did not change degradation behavior.
    for (const [w, h] of VIEWPORTS) {
      const config = createLayoutConfig(w, h);
      const legacy = config.timelineY - MINIMAP_SAFE_ZONE - AXIS_MARGIN_ABOVE;
      expect(getHalfColumnBudget(config, 'above').pixels).toBe(legacy);
    }
  });
});
