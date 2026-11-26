import { useCallback } from "react";
import { Coordinates, Line, Mafs, MovablePoint, Plot, Point, Text } from "mafs";
import type { vec } from "mafs";
import { toNumber } from "../boardMath";
import { layoutPlaneSize } from "../boardScale.ts";
import { Segment } from "../planeLines";
import { plotColors } from "../plotColors";
import useBoardScale from "../useBoardScale.ts";
import { evaluate, pieceCurve } from "./functions.ts";
import { axisLabels, numberedValues, planeLabels } from "./labelLayout.ts";
import { LABEL_SIZE, viewNumbers } from "./model.ts";
import { planeMarks, type Mark, type MarkColor, type MarkFill } from "./marks.ts";
import { pointValue, viewOf } from "./setups.ts";
import { curveFor, type CurveState } from "./state.ts";

/** The only place mark colors become CSS: marks.ts decides which mark is ink, muted or ochre. */
export const MARK_COLORS: Readonly<Record<MarkColor, string>> = { ink: plotColors.ink, muted: plotColors.inkMuted, ochre: plotColors.attention, axis: plotColors.axis };
/** The only place a dot's fill becomes CSS: marks.ts decides which dots are open. */
export const MARK_FILLS: Readonly<Record<MarkFill, string>> = { board: "var(--ms-board)" };
/** Mafs' Point has no class; this one gives it its rem radius in components.css, so it grows with the board. */
export const POINT_CLASS = "ms-plot-point";

interface CurvePlaneProps {
  state: CurveState;
  /** Side of the square plane in pixels. */
  size: number;
  /** A drag of the point, snapped to the half-step grid: the new 2x. */
  onMovePoint: (xIndex: number) => void;
}

interface MarkShapeProps {
  mark: Mark;
  /** The board scale: marks.ts gives weights in px at the base size. */
  scale: number;
  onMovePoint: (point: vec.Vector2) => void;
  constrain: (point: vec.Vector2) => vec.Vector2;
}

function MarkShape({ mark, scale, onMovePoint, constrain }: MarkShapeProps) {
  const color = MARK_COLORS[mark.color];
  switch (mark.kind) {
    case "curve":
      return <Plot.OfX y={pieceCurve(mark.coefficients)} domain={[mark.domain[0], mark.domain[1]]} color={color} weight={mark.weight * scale} />;
    case "ground":
    case "ruler":
    case "run-leg":
    case "rise-leg":
      return <Segment from={mark.from} to={mark.to} color={color} weight={mark.weight * scale} lineStyle={mark.lineStyle} />;
    case "tangent":
      return <Line.PointSlope point={[mark.point[0], mark.point[1]]} slope={mark.slope} color={color} weight={mark.weight * scale} />;
    case "corner-line":
      return <Line.PointSlope point={[0, 0]} slope={mark.slope} color={color} weight={mark.weight * scale} />;
    case "ruler-end":
    case "point":
      if (mark.kind === "point" && mark.movable) {
        return <MovablePoint point={[mark.at[0], mark.at[1]]} constrain={constrain} onMove={onMovePoint} color={color} />;
      }
      return <Point x={mark.at[0]} y={mark.at[1]} color={color} svgCircleProps={{ className: POINT_CLASS }} />;
    case "open-dot":
    case "value-dot":
    case "axis-name":
    case "axis-number":
      return null;
  }
}

/**
 * The Mafs plane: the curve piece by piece (so a corner stays sharp), the dotted rise and run legs, the dashed ruler,
 * the tangent or the corner line, and the point. Every color and line style comes from planeMarks (marks.ts); this
 * file only maps the list to Mafs. The point's handle is a pointer shortcut: Board hides it from the keyboard and
 * the accessibility tree, and the Point slider is the complete path.
 */
export default function CurvePlane({ state, size, onMovePoint }: CurvePlaneProps) {
  const scale = useBoardScale();
  // The label layout is measured in base px, so it runs at the base size and the text is drawn LABEL_SIZE × scale.
  const layoutSize = layoutPlaneSize(size, scale);
  const curveView = viewOf(state.preset);
  const { x, y } = viewNumbers(curveView.view);
  const f = curveFor(state);
  const [low, high] = curveView.xIndexRange;
  // Snap a drag to the slider's grid, on the curve.
  const constrain = useCallback(
    (point: vec.Vector2): vec.Vector2 => {
      const xIndex = Math.min(Math.max(Math.round(point[0] * 2), low), high);
      const at = pointValue(xIndex);
      return [toNumber(at), toNumber(evaluate(f, at))];
    },
    [f, low, high],
  );
  const handleMove = useCallback((point: vec.Vector2) => onMovePoint(Math.round(point[0] * 2)), [onMovePoint]);
  const slide = state.stage === "slide";
  const marks = planeMarks(state);
  // A number gives way where a dot or the ochre line covers it, so it depends on the state and the plane's size.
  const numbered = numberedValues(state, layoutSize, marks);
  const xAxis = slide ? { lines: 1, labels: false as const } : { lines: curveView.xLines, labels: axisLabels(numbered.x) };
  const yAxis = slide ? { lines: 1, labels: false as const } : { lines: curveView.yLines, labels: axisLabels(numbered.y) };
  const labels = planeLabels(state, layoutSize);

  return (
    <Mafs height={size} viewBox={{ x: [x[0], x[1]], y: [y[0], y[1]], padding: 0 }} preserveAspectRatio={false} pan={false} zoom={false}>
      <Coordinates.Cartesian xAxis={xAxis} yAxis={yAxis} subdivisions={false} />
      {marks.map((mark, index) => (
        // The point keeps one key, so a drag that swaps Slide for Ruler (and the marks before it) doesn't remount it.
        <MarkShape key={mark.kind === "point" ? "point" : `${mark.kind}-${index}`} mark={mark} scale={scale} onMovePoint={handleMove} constrain={constrain} />
      ))}
      {labels.map((label, index) => (
        <Text key={`label-${index}`} x={label.textAt[0]} y={label.textAt[1]} attach={label.attach} attachDistance={0} size={LABEL_SIZE * scale} color={MARK_COLORS[label.color]}>
          {label.text}
        </Text>
      ))}
    </Mafs>
  );
}
