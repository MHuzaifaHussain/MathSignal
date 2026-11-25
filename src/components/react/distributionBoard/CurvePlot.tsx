import { useId, type CSSProperties } from "react";
import type { PlotPoint } from "./densityChart.ts";

interface CurvePlotProps {
  /** The pile's outline, in chart percents; null in the Bars view. */
  curve: readonly PlotPoint[] | null;
  /** The shaded stretch's outline and its two edges, in chart percents. */
  shaded: { outline: readonly PlotPoint[]; from: number; to: number } | null;
}

/** Percents to the SVG's 0..100 box, with y measured down from the top. */
const points = (list: readonly PlotPoint[]) => list.map((point) => `${point.x},${100 - point.y}`).join(" ");

/**
 * The density curve and the shaded stretch under it, drawn over ColumnChart's column area (decision 0018). The SVG
 * stretches to the area (preserveAspectRatio="none"), so it holds no text: every label is HTML. Strokes keep their
 * width through vector-effect. In forced colors the stretch fills with a hatch pattern, its id from useId so two
 * boards on one page don't share it. aria-hidden, like the chart around it. Styles: .ms-curve.
 */
export default function CurvePlot({ curve, shaded }: CurvePlotProps) {
  const hatchId = useId();
  return (
    <svg className="ms-curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false" style={{ "--ms-curve-hatch": `url(#${hatchId})` } as CSSProperties}>
      <defs>
        <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line className="ms-curve-hatch-line" x1="0" y1="0" x2="0" y2="4" />
        </pattern>
      </defs>
      {shaded && (
        <>
          <polygon className="ms-curve-shade" points={points(shaded.outline)} />
          <line className="ms-curve-edge" x1={shaded.from} y1="0" x2={shaded.from} y2="100" />
          <line className="ms-curve-edge" x1={shaded.to} y1="0" x2={shaded.to} y2="100" />
        </>
      )}
      {curve && <polyline className="ms-curve-line" points={points(curve)} />}
    </svg>
  );
}
