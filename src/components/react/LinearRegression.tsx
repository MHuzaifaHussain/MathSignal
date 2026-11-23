import { useCallback, useMemo, useState } from "react";
import { Coordinates, Line, Mafs, MovablePoint } from "mafs";
import type { vec } from "mafs";
import Board from "./Board";
import ChalkNote from "./ChalkNote";
import { formatNumber, plotColors } from "./plotColors";

const INITIAL_POINTS: vec.Vector2[] = [
  [1, 2],
  [2, 2.8],
  [3, 3.5],
  [4, 4.2],
  [5, 5.5],
  [6, 5.8],
  [7, 7.2],
  [8, 8],
  [9, 8.5],
];
const VIEW: vec.Vector2 = [-1, 10];
const BOARD_HEIGHT = 380;
/** Below this, the x values are effectively identical and the slope is undefined. */
const VERTICAL_LINE_EPSILON = 1e-10;
const HANDLE_LABELS = INITIAL_POINTS.map((_, i) => `Data point ${i + 1} of ${INITIAL_POINTS.length}`);

const clampToView = (value: number) => Math.min(VIEW[1], Math.max(VIEW[0], value));
/** Points stay on the board: the view is fixed, so a point dropped outside would be lost but still counted. */
const keepInView = ([x, y]: vec.Vector2): vec.Vector2 => [clampToView(x), clampToView(y)];

interface Fit {
  slope: number;
  intercept: number;
  rSquared: number;
}

/** Ordinary least squares fit; null when every point shares one x value (vertical line). */
function leastSquares(points: vec.Vector2[]): Fit | null {
  const n = points.length;
  const sum = points.reduce(
    (acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y, xy: acc.xy + x * y, xx: acc.xx + x * x, yy: acc.yy + y * y }),
    { x: 0, y: 0, xy: 0, xx: 0, yy: 0 },
  );
  const denominator = n * sum.xx - sum.x * sum.x;
  if (Math.abs(denominator) < VERTICAL_LINE_EPSILON) return null;

  const slope = (n * sum.xy - sum.x * sum.y) / denominator;
  const intercept = (sum.y - slope * sum.x) / n;
  const meanY = sum.y / n;
  const totalSquares = sum.yy - n * meanY * meanY;
  const residualSquares = points.reduce((acc, [x, y]) => acc + (y - (slope * x + intercept)) ** 2, 0);
  const rSquared = totalSquares === 0 ? 1 : 1 - residualSquares / totalSquares;
  return { slope, intercept, rSquared };
}

function describeFit(fit: Fit | null): string {
  if (!fit) return "All points share one x value, so the slope is undefined.";
  return `Best-fit line: slope ${formatNumber(fit.slope)}, intercept ${formatNumber(fit.intercept)}, R squared ${formatNumber(fit.rSquared, 3)}.`;
}

/** Linear regression board: drag any point and the least-squares line refits. */
export default function LinearRegression() {
  const [points, setPoints] = useState<vec.Vector2[]>(INITIAL_POINTS);
  const [announcement, setAnnouncement] = useState("");
  const fit = useMemo(() => leastSquares(points), [points]);

  const movePoint = useCallback((index: number, next: vec.Vector2) => {
    setPoints((previous) => previous.map((point, i) => (i === index ? next : point)));
  }, []);

  const handleReset = useCallback(() => {
    setPoints(INITIAL_POINTS);
    setAnnouncement(describeFit(leastSquares(INITIAL_POINTS)));
  }, []);

  const tray = fit ? (
    <p className="ms-board-readout">
      y = {formatNumber(fit.slope)}x {fit.intercept < 0 ? "−" : "+"} {formatNumber(Math.abs(fit.intercept))}
      &nbsp;&nbsp; R² = {formatNumber(fit.rSquared, 3)}
    </p>
  ) : (
    <p className="ms-board-readout">Slope undefined: every point has the same x.</p>
  );

  return (
    <Board
      label="Linear regression. Drag any point, or focus it and use the arrow keys, to see the least-squares line refit."
      tray={tray}
      onReset={handleReset}
      announcement={announcement}
      onInteractionEnd={() => setAnnouncement(describeFit(fit))}
      handleLabels={HANDLE_LABELS}
    >
      <Mafs height={BOARD_HEIGHT} viewBox={{ x: VIEW, y: VIEW, padding: 0 }} preserveAspectRatio={false} pan={false} zoom={false}>
        <Coordinates.Cartesian xAxis={{ lines: 1 }} yAxis={{ lines: 1 }} />
        {fit && <Line.PointSlope point={[0, fit.intercept]} slope={fit.slope} color={plotColors.ink} weight={2.5} />}
        {points.map((point, i) => (
          <MovablePoint key={i} point={point} constrain={keepInView} onMove={(next) => movePoint(i, next)} color={plotColors.attention} />
        ))}
      </Mafs>
      <ChalkNote long="one outlier can tilt the whole line" short="outliers tilt the line" />
    </Board>
  );
}
