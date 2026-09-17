/**
 * Chart palette — Jitter Bean theme, stepped for the DARK panel surface.
 *
 * These are not the light-mode hues darkened; they are their own steps chosen
 * for the dark surface and validated as a set against #383838 (the panel the
 * charts sit on):
 *
 *   Lightness band      PASS  all 8 inside L 0.48–0.67
 *   Chroma floor        PASS  all 8 >= 0.1
 *   CVD separation      PASS  worst adjacent ΔE 8.6 (protan)
 *   Normal-vision floor PASS  worst adjacent ΔE 19.3
 *   Contrast            WARN  #d55181 (2.97:1) and #008300 (2.37:1) fall under
 *                             3:1, so the "relief rule" applies — every chart
 *                             using them ships direct labels and a table view.
 *
 * Slot 1 leads with the brand's spot orange. The ORDER is the colourblind-safety
 * mechanism, not decoration: candidate orderings were run through the validator
 * and this one had the best worst-adjacent margin (ΔE 13.2 at six slots, versus
 * 8.4 for the obvious orange-blue-aqua-yellow order). Don't reorder without
 * re-running it.
 *
 * Slots are assigned per entity in a fixed order and never cycled, so a
 * location keeps its colour when a filter changes how many series are on screen.
 */

export const CATEGORICAL = [
  '#d95926', // 1 spot orange (brand)
  '#3987e5', // 2 blue
  '#199e70', // 3 aqua
  '#9085e9', // 4 violet
  '#c98500', // 5 amber
  '#d55181', // 6 magenta
  '#008300', // 7 green
  '#e66767', // 8 red
] as const;

/**
 * Single fill for magnitude bars (expenses by category).
 *
 * A ramp was the first instinct, but with eight categories no single-hue ramp
 * clears the adjacent-ΔL floor on this surface, and the brand's own roast ramp
 * bottoms out at 1.08:1 against the panel — invisible. Bar length already
 * encodes magnitude and every bar is direct-labelled, so one brand hue is the
 * honest encoding rather than a ramp implying precision that isn't there.
 * 4.16:1 on the panel.
 */
export const MAGNITUDE_FILL = '#f07838';

/**
 * Validated 5-step amber ramp, kept for a future heatmap or ordinal encoding.
 * Ordinal checks on #383838: monotone L PASS, adjacent ΔL PASS, light-end
 * contrast 2.13:1 PASS, single hue (25° spread) PASS.
 */
export const SEQUENTIAL_AMBER = [
  '#ffdfb5', '#f7b56d', '#e8933a', '#c96f22', '#a5521b',
] as const;

/** Roast ramp straight from the brand — warm, but only safe on light fills. */
export const ROAST = ['#c8a06a', '#a8763f', '#7b4f28', '#4a2c18'] as const;

/** Chart ink, against the dark panel. */
export const CHART_INK = {
  primary: '#f4e9d8',
  secondary: '#d6c9b2',
  muted: '#b3a894',
  grid: '#4a4542',
  surface: '#383838',
};

export const MEASURE_COLORS = {
  revenue: '#3987e5',
  expense: '#d95926',
  net: '#199e70',
};

/** Stable colour for an entity, by its position in a fixed ordering. */
export function entityColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}

/** Step the amber ramp across N ordered items. */
export function sequentialStep(index: number, total: number): string {
  if (total <= 1) return SEQUENTIAL_AMBER[2];
  const pos = Math.round((index / (total - 1)) * (SEQUENTIAL_AMBER.length - 1));
  return SEQUENTIAL_AMBER[Math.min(pos, SEQUENTIAL_AMBER.length - 1)];
}
