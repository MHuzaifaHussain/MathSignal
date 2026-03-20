import "mafs/core.css";
import { useState, useMemo, useCallback } from "react";
import {
  Mafs,
  Coordinates,
  Polygon,
  MovablePoint,
  Text,
  Theme,
} from "mafs";
import type { vec } from "mafs";

const CLAMP_MIN = 0.01;
const CLAMP_MAX = 0.99;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function BayesTheorem() {
  const [priorA, setPriorA] = useState(0.3);
  const [likelihoodBA, setLikelihoodBA] = useState(0.8);
  const [likelihoodBNotA, setLikelihoodBNotA] = useState(0.1);

  // P(B) = P(B|A) * P(A) + P(B|¬A) * P(¬A)
  // P(A|B) = P(B|A) * P(A) / P(B)
  const { pB, posterior } = useMemo(() => {
    const pB =
      likelihoodBA * priorA + likelihoodBNotA * (1 - priorA);
    const posterior = pB > 0 ? (likelihoodBA * priorA) / pB : 0;
    return { pB, posterior };
  }, [priorA, likelihoodBA, likelihoodBNotA]);

  // --- Slider row positions (y-axis) ---
  const ROW_Y = -0.15;

  const constrainSlider = useCallback(
    (point: vec.Vector2): vec.Vector2 => [
      clamp(point[0], CLAMP_MIN, CLAMP_MAX),
      ROW_Y,
    ],
    [],
  );

  const handlePriorMove = useCallback((point: vec.Vector2) => {
    setPriorA(clamp(point[0], CLAMP_MIN, CLAMP_MAX));
  }, []);

  const handleLikelihoodMove = useCallback((point: vec.Vector2) => {
    setLikelihoodBA(clamp(point[0], CLAMP_MIN, CLAMP_MAX));
  }, []);

  const handleLikelihoodNotAMove = useCallback((point: vec.Vector2) => {
    setLikelihoodBNotA(clamp(point[0], CLAMP_MIN, CLAMP_MAX));
  }, []);

  // --- Rectangles ---
  // Full space is a 1x1 unit square at origin
  const RECT_BASE = 0;
  const RECT_TOP = 1;

  // P(A) region: left column, width = priorA
  const priorRect: vec.Vector2[] = [
    [0, RECT_BASE],
    [priorA, RECT_BASE],
    [priorA, RECT_TOP],
    [0, RECT_TOP],
  ];

  // P(B|A) region: within A column, height = likelihoodBA
  const likelihoodRect: vec.Vector2[] = [
    [0, RECT_BASE],
    [priorA, RECT_BASE],
    [priorA, likelihoodBA],
    [0, likelihoodBA],
  ];

  // P(B|¬A) region: within ¬A column
  const likelihoodNotARect: vec.Vector2[] = [
    [priorA, RECT_BASE],
    [1, RECT_BASE],
    [1, likelihoodBNotA],
    [priorA, likelihoodBNotA],
  ];

  return (
    <Mafs viewBox={{ x: [-0.2, 1.3], y: [-0.35, 1.25], padding: 0 }}>
      <Coordinates.Cartesian
        xAxis={{ lines: 0.25, labels: (v) => v.toFixed(2) }}
        yAxis={{ lines: 0.25, labels: (v) => v.toFixed(2) }}
      />

      {/* P(A) prior column */}
      <Polygon
        points={priorRect}
        color={Theme.blue}
        fillOpacity={0.12}
        strokeOpacity={0.4}
      />

      {/* P(B|A) * P(A): joint probability */}
      <Polygon
        points={likelihoodRect}
        color={Theme.blue}
        fillOpacity={0.35}
      />

      {/* P(B|¬A) * P(¬A): false positive region */}
      <Polygon
        points={likelihoodNotARect}
        color={Theme.orange}
        fillOpacity={0.2}
      />

      {/* Labels for regions */}
      <Text x={priorA / 2} y={0.5} size={12} color={Theme.blue}>
        P(A)
      </Text>
      <Text x={priorA / 2} y={likelihoodBA / 2} size={11} color={Theme.blue}>
        P(B|A)·P(A)
      </Text>
      <Text
        x={(priorA + 1) / 2}
        y={likelihoodBNotA / 2}
        size={11}
        color={Theme.orange}
      >
        P(B|¬A)·P(¬A)
      </Text>

      {/* Draggable controls along the bottom */}
      <MovablePoint
        point={[priorA, ROW_Y]}
        onMove={handlePriorMove}
        constrain={constrainSlider}
        color={Theme.blue}
      />
      <MovablePoint
        point={[likelihoodBA, ROW_Y]}
        onMove={handleLikelihoodMove}
        constrain={constrainSlider}
        color={Theme.green}
      />
      <MovablePoint
        point={[likelihoodBNotA, ROW_Y]}
        onMove={handleLikelihoodNotAMove}
        constrain={constrainSlider}
        color={Theme.orange}
      />

      {/* Slider labels */}
      <Text x={priorA} y={ROW_Y - 0.07} size={11} color={Theme.blue}>
        {`P(A) = ${priorA.toFixed(2)}`}
      </Text>
      <Text x={likelihoodBA} y={ROW_Y - 0.07} size={11} color={Theme.green}>
        {`P(B|A) = ${likelihoodBA.toFixed(2)}`}
      </Text>
      <Text
        x={likelihoodBNotA}
        y={ROW_Y - 0.07}
        size={11}
        color={Theme.orange}
      >
        {`P(B|¬A) = ${likelihoodBNotA.toFixed(2)}`}
      </Text>

      {/* Computed results */}
      <Text x={0.5} y={1.15} size={14} color={Theme.foreground}>
        {`P(A|B) = ${posterior.toFixed(4)}    P(B) = ${pB.toFixed(4)}`}
      </Text>
    </Mafs>
  );
}
