/**
 * Layout budget — single source of truth for vertical half-column space.
 *
 * The timeline splits each column into two half-columns: `above` the axis and
 * `below` it. How much vertical room each half-column has was historically
 * computed in three places that disagreed (DegradationEngine, CapacityModel,
 * PositioningEngine). This module is the one definition; everything else calls
 * `getHalfColumnBudget`.
 *
 * Margins (ground truth: PositioningEngine, where cards physically land):
 *   - MINIMAP_SAFE_ZONE (100px): reserved band at the top of the screen for the
 *     minimap + breadcrumb. Only the `above` half-column loses this; `below`
 *     has no minimap overhead. This is the source of the above/below asymmetry.
 *   - AXIS_MARGIN_ABOVE (48px): gap between the lowest above-card and the axis.
 *   - AXIS_MARGIN_BELOW (55px): gap between the axis (and its month/year labels)
 *     and the highest below-card.
 *
 * Cells: layout capacity is counted in 44px cells (one title-only card + one
 * CARD_SPACING gap). `cells` is how many cells fit in the pixel budget, with a
 * trailing-gap credit (the last card needs no gap after it) — matching the
 * CARD_HEIGHT_CELLS derivation in config.ts.
 */

import { CARD_HEIGHTS, CARD_SPACING } from './cardMetrics';

/** Top-of-screen safe zone (minimap 50 + breadcrumb 40 + padding 10). Only affects `above`. */
export const MINIMAP_SAFE_ZONE = 100;

/** Gap between the lowest above-card and the timeline axis. */
export const AXIS_MARGIN_ABOVE = 48;

/** Gap between the axis (with its labels) and the highest below-card. */
export const AXIS_MARGIN_BELOW = 55;

/** Capacity cell height: one title-only card + one inter-card gap. */
export const CELL_SIZE = CARD_HEIGHTS['title-only'] + CARD_SPACING; // 32 + 12 = 44

export type HalfColumnSide = 'above' | 'below';

/** Minimal shape needed to compute a budget (LayoutConfig satisfies this). */
export interface BudgetInput {
  viewportHeight: number;
  timelineY?: number;
}

/**
 * Vertical position of the timeline axis for a given viewport height.
 * Mirrors createLayoutConfig() in config.ts: the axis sits at the centre of the
 * space left under the top safe zone. Callers that already have a real
 * `config.timelineY` should pass it; this is the fallback for callers (e.g.
 * CapacityModel) that only know the viewport height.
 */
export function computeTimelineY(viewportHeight: number): number {
  const available = viewportHeight - MINIMAP_SAFE_ZONE;
  return MINIMAP_SAFE_ZONE + available / 2;
}

/**
 * Available vertical space for one half-column, in pixels and in cells.
 * `above` loses the minimap safe zone; `below` does not — so the two sides
 * genuinely differ and must be queried separately.
 */
export function getHalfColumnBudget(
  input: BudgetInput,
  side: HalfColumnSide
): { pixels: number; cells: number } {
  const timelineY = input.timelineY ?? input.viewportHeight / 2;

  const pixels =
    side === 'above'
      ? timelineY - MINIMAP_SAFE_ZONE - AXIS_MARGIN_ABOVE
      : input.viewportHeight - timelineY - AXIS_MARGIN_BELOW;

  const cells = Math.max(0, Math.floor((pixels + CARD_SPACING) / CELL_SIZE));

  return { pixels, cells };
}
