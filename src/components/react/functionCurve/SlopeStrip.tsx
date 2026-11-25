import { Coordinates, Mafs, Plot, Point, Text } from "mafs";
import { pieceCurve } from "./functions.ts";
import { LABEL_DISTANCE, LABEL_SIZE, axisNumber, viewNumbers } from "./model.ts";
import { stripMarks } from "./marks.ts";
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
 * open dots where f′ jumps. Its scales are unequal and its axis numbers say so: 0 and one value near each end.
 * Every mark comes from stripMarks (marks.ts).
 */
export default function SlopeStrip({ state, width }: SlopeStripProps) {
  const curveView = viewOf(state.preset);
  const { x } = viewNumbers(curveView.view);
  const { y, labels } = curveView.strip;
  const step = Math.min(...labels.slice(1).map((value, index) => value - labels[index]));
  const marks = stripMarks(state);
  return (
    <Mafs height={Math.round(width * STRIP_HEIGHT_RATIO)} viewBox={{ x: [x[0], x[1]], y: [y[0], y[1]], padding: 0 }} preserveAspectRatio={false} pan={false} zoom={false}>
      <Coordinates.Cartesian xAxis={{ lines: curveView.xLines, labels: false }} yAxis={{ lines: step, labels: (value) => (labels.includes(value) ? axisNumber(value) : "") }} subdivisions={false} />
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
            return (
              mark.label && (
                <Text key={index} x={mark.label.at[0]} y={mark.label.at[1]} attach={mark.label.attach} attachDistance={LABEL_DISTANCE} size={LABEL_SIZE} color={MARK_COLORS[mark.label.color]}>
                  {mark.label.text}
                </Text>
              )
            );
          default:
            throw new Error(`SlopeStrip: no drawing for a "${mark.kind}" mark`);
        }
      })}
    </Mafs>
  );
}
