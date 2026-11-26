import { Polyline } from "mafs";

// Plain lines for the Mafs planes, shared so a dotted line looks the same on every board. Mafs' own Line.Segment
// draws only solid or dashed lines, so a line whose meaning is "dotted" must come from here.

/**
 * The dotted stroke: short round dots, 1px long and 5px apart at the base size, set in rem in components.css so they
 * grow with the board (decision 0025). Also used on circles (`svgEllipseProps={{ style: DOTTED }}`).
 */
export const DOTTED = { strokeDasharray: "var(--ms-plot-dotted-dash)", strokeLinecap: "round" } as const;

export type LineStyle = "solid" | "dashed" | "dotted";

type Point = readonly [number, number];

interface SegmentProps {
  from: Point;
  to: Point;
  color: string;
  /** The stroke in px, already multiplied by the board scale. */
  weight: number;
  lineStyle?: LineStyle;
}

/** A straight line from `from` to `to` with no arrowhead: solid, dashed (Mafs' dash) or dotted. */
export function Segment({ from, to, color, weight, lineStyle = "solid" }: SegmentProps) {
  return (
    <Polyline
      points={[
        [from[0], from[1]],
        [to[0], to[1]],
      ]}
      color={color}
      weight={weight}
      fillOpacity={0}
      strokeStyle={lineStyle === "dashed" ? "dashed" : "solid"}
      svgPolylineProps={lineStyle === "dotted" ? { style: DOTTED } : undefined}
    />
  );
}
