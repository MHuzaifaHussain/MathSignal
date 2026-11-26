// Where a span's label sits, so it never runs past the chart's edge (chartMarks.tsx). Pure, so
// scripts/check-boards.mjs pins it.

/** Which part of the span the label lines up with: its middle, or the end nearer the chart's edge. */
export type SpanLabelAnchor = "center" | "start" | "end";

/**
 * A centered label is safe while the span's middle is this far from either edge, in percent of the row. The widest
 * label ("Before: σ ≈ 1.58", 96px) is a third of a 320px board's row, so half of it is about 17%.
 */
export const CENTERED_LABEL_MARGIN = 20;

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

/**
 * Centered, unless the span's middle is near an edge: then the label lines up with the span's end on that side,
 * which is inside the row, so the label grows away from the edge.
 */
export function spanLabelAnchor(from: number, to: number): SpanLabelAnchor {
  const middle = (clampPercent(from) + clampPercent(to)) / 2;
  if (middle > 100 - CENTERED_LABEL_MARGIN) return "end";
  if (middle < CENTERED_LABEL_MARGIN) return "start";
  return "center";
}
