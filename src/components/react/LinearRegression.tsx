import "mafs/core.css";
import { useState, useMemo, useCallback } from "react";
import {
  Mafs,
  Coordinates,
  MovablePoint,
  Line,
  Text,
  Theme,
} from "mafs";
import type { vec } from "mafs";

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

function leastSquares(points: vec.Vector2[]) {
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (const [x, y] of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const denominator = n * sumXX - sumX * sumX;

  // Vertical line edge case: slope is infinite
  if (Math.abs(denominator) < 1e-10) {
    return { slope: Infinity, intercept: 0, rSquared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  const ssTotal = sumYY - n * meanY * meanY;
  const ssResidual = points.reduce((sum, [x, y]) => {
    const predicted = slope * x + intercept;
    return sum + (y - predicted) ** 2;
  }, 0);

  const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

  return { slope, intercept, rSquared };
}

export default function LinearRegression() {
  const [points, setPoints] = useState<vec.Vector2[]>(INITIAL_POINTS);

  const { slope, intercept, rSquared } = useMemo(
    () => leastSquares(points),
    [points],
  );

  const handlePointMove = useCallback(
    (index: number, newPoint: vec.Vector2) => {
      setPoints((prev) => {
        const next = [...prev];
        next[index] = newPoint;
        return next;
      });
    },
    [],
  );

  const slopeStr = slope.toFixed(2);
  const interceptStr =
    intercept >= 0 ? `+ ${intercept.toFixed(2)}` : `- ${Math.abs(intercept).toFixed(2)}`;

  return (
    <Mafs viewBox={{ x: [-1, 10], y: [-1, 10] }}>
      <Coordinates.Cartesian xAxis={{ lines: 1 }} yAxis={{ lines: 1 }} />

      {/* Best-fit regression line */}
      {isFinite(slope) && (
        <Line.PointSlope
          point={[0, intercept]}
          slope={slope}
          color={Theme.blue}
          weight={2.5}
        />
      )}

      {/* Draggable data points */}
      {points.map((point, i) => (
        <MovablePoint
          key={i}
          point={point}
          onMove={(p) => handlePointMove(i, p)}
          color={Theme.orange}
        />
      ))}

      {/* Equation and R² display */}
      <Text x={0.5} y={9.2} size={14} color={Theme.foreground} attach="e">
        {`y = ${slopeStr}x ${interceptStr}`}
      </Text>
      <Text x={0.5} y={8.5} size={14} color={Theme.foreground} attach="e">
        {`R² = ${rSquared.toFixed(4)}`}
      </Text>
    </Mafs>
  );
}
