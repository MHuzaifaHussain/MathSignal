import { useCallback } from "react";
import { Coordinates, Line, Mafs, MovablePoint, Plot, Point, Text } from "mafs";
import type { vec } from "mafs";
import { toNumber } from "../boardMath";
import { Segment } from "../planeLines";
import { plotColors } from "../plotColors";
import { evaluate, pieceCurve } from "./functions.ts";
import { LABEL_DISTANCE, LABEL_SIZE, fitLabel, viewNumbers } from "./model.ts";
import { planeMarks, type Mark, type MarkColor } from "./marks.ts";
import { pointValue, viewOf } from "./setups.ts";
import { curveFor, type CurveState } from "./state.ts";

/** The only place mark colors become CSS: marks.ts decides which mark is ink, muted or ochre. */
export const MARK_COLORS: Readonly<Record<MarkColor, string>> = { ink: plotColors.ink, muted: plotColors.inkMuted, ochre: plotColors.attention };

/** An axis number with a real minus sign. */
const axisNumber = (value: number) => (value < 0 ? `−${Math.abs(value)}` : String(value));

interface CurvePlaneProps {
  state: CurveState;
  /** Side of the square plane in pixels. */
  size: number;
  /** A drag of the point, snapped to the half-step grid: the new 2x. */
  onMovePoint: (xIndex: number) => void;
}

function MarkShape({ mark, onMovePoint, constrain }: { mark: Mark; onMovePoint: (point: vec.Vector2) => void; constrain: (point: vec.Vector2) => vec.Vector2 }) {
  const color = MARK_COLORS[mark.color];
  switch (mark.kind) {
    case "curve":
      return <Plot.OfX y={pieceCurve(mark.coefficients)} domain={[mark.domain[0], mark.domain[1]]} color={color} weight={mark.weight} />;
    case "ground":
    case "ruler":
    case "run-leg":
    case "rise-leg":
      return <Segment from={mark.from} to={mark.to} color={color} weight={mark.weight} lineStyle={mark.lineStyle} />;
    case "tangent":
      return <Line.PointSlope point={[mark.point[0], mark.point[1]]} slope={mark.slope} color={color} weight={mark.weight} />;
    case "corner-line":
      return <Line.PointSlope point={[0, 0]} slope={mark.slope} color={color} weight={mark.weight} />;
    case "ruler-end":
    case "point":
      if (mark.kind === "point" && mark.movable) {
        return <MovablePoint point={[mark.at[0], mark.at[1]]} constrain={constrain} onMove={onMovePoint} color={color} />;
      }
      return <Point x={mark.at[0]} y={mark.at[1]} color={color} />;
    case "open-dot":
    case "value-dot":
    case "axis-name":
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
  const xAxis = slide ? { lines: 1, labels: false as const } : { lines: curveView.xLines, labels: axisNumber };
  const yAxis = slide ? { lines: 1, labels: false as const } : { lines: curveView.yLines, labels: axisNumber };
  const marks = planeMarks(state);

  return (
    <Mafs height={size} viewBox={{ x: [x[0], x[1]], y: [y[0], y[1]], padding: 0 }} preserveAspectRatio={false} pan={false} zoom={false}>
      <Coordinates.Cartesian xAxis={xAxis} yAxis={yAxis} subdivisions={false} />
      {marks.map((mark, index) => (
        // The point keeps one key, so a drag that swaps Slide for Ruler (and the marks before it) doesn't remount it.
        <MarkShape key={mark.kind === "point" ? "point" : `${mark.kind}-${index}`} mark={mark} onMovePoint={handleMove} constrain={constrain} />
      ))}
      {marks.map((mark, index) => {
        if (!mark.label) return null;
        const fitted = fitLabel(curveView.view, mark.label.at, mark.label.attach, mark.label.text, size);
        return (
          <Text
            key={`label-${index}`}
            x={fitted.at[0]}
            y={fitted.at[1]}
            attach={fitted.attach}
            attachDistance={LABEL_DISTANCE}
            size={LABEL_SIZE}
            color={MARK_COLORS[mark.label.color]}
          >
            {mark.label.text}
          </Text>
        );
      })}
    </Mafs>
  );
}
