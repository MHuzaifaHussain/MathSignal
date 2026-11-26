import { Coordinates, Mafs, Plot, Point, Text } from "mafs";
import { pieceCurve } from "./functions.ts";
import { LABEL_DISTANCE, LABEL_SIZE, labelTextPoint, scaleOf, viewNumbers } from "./model.ts";
import { STRIP_NUMBER_OFFSET, stripMarks } from "./marks.ts";
import { viewOf } from "./setups.ts";
import type { CurveState } from "./state.ts";
import { MARK_COLORS, MARK_FILLS } from "./CurvePlane.tsx";

/** The strip is a quarter as tall as the plane is wide. */
export const STRIP_HEIGHT_RATIO = 0.25;

interface SlopeStripProps {
  state: CurveState;
  /** The plane's width in pixels; the strip shares it and its x range. */
  width: number;
}

/**
 * The slope curve under the plane, in the Slope curve stage: f′ on the same x range, with an ink dot at (a, f′(a)) and
 * open dots where f′ jumps. Its scales are unequal and its axis numbers say so; they are drawn here rather than by
 * Mafs, so they clear the open dots on the axis and the slope curve (setups.ts picks their values and sides).
 * Every mark comes from stripMarks (marks.ts).
 */
export default function SlopeStrip({ state, width }: SlopeStripProps) {
  const curveView = viewOf(state.preset);
  const { x } = viewNumbers(curveView.view);
  const { y, labels } = curveView.strip;
  const step = Math.min(...labels.slice(1).map((value, index) => value - labels[index]));
  const height = Math.round(width * STRIP_HEIGHT_RATIO);
  const scale = scaleOf(x, y, width, height);
  const marks = stripMarks(state);
  return (
    <Mafs height={height} viewBox={{ x: [x[0], x[1]], y: [y[0], y[1]], padding: 0 }} preserveAspectRatio={false} pan={false} zoom={false}>
      <Coordinates.Cartesian xAxis={{ lines: curveView.xLines, labels: false }} yAxis={{ lines: step, labels: false }} subdivisions={false} />
      {marks.map((mark, index) => {
        const color = MARK_COLORS[mark.color];
        switch (mark.kind) {
          case "curve":
            return <Plot.OfX key={index} y={pieceCurve(mark.coefficients)} domain={[mark.domain[0], mark.domain[1]]} color={color} weight={mark.weight} />;
          case "open-dot":
            return <Point key={index} x={mark.at[0]} y={mark.at[1]} color={color} svgCircleProps={{ stroke: color, style: { fill: MARK_FILLS[mark.fill], strokeWidth: mark.weight } }} />;
          case "value-dot":
            return <Point key={index} x={mark.at[0]} y={mark.at[1]} color={color} />;
          case "axis-name":
          case "axis-number": {
            if (!mark.label) return null;
            // attachDistance 0: labelTextPoint puts the name's box just inside the strip's top-left corner, and each
            // number STRIP_NUMBER_OFFSET px from the y-axis. The numbers take the axes' own size, as on the plane.
            const distance = mark.kind === "axis-number" ? STRIP_NUMBER_OFFSET : LABEL_DISTANCE;
            const [textX, textY] = labelTextPoint(scale, mark.label.at, mark.label.attach, distance);
            const fontSize = mark.kind === "axis-number" ? { fontSize: "inherit" } : {};
            return (
              <Text key={index} x={textX} y={textY} attach={mark.label.attach} attachDistance={0} size={LABEL_SIZE} color={MARK_COLORS[mark.label.color]} svgTextProps={fontSize}>
                {mark.label.text}
              </Text>
            );
          }
          default:
            throw new Error(`SlopeStrip: no drawing for a "${mark.kind}" mark`);
        }
      })}
    </Mafs>
  );
}
