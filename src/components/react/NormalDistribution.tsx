import "mafs/core.css";
import { useState, useCallback } from "react";
import {
  Mafs,
  Coordinates,
  Plot,
  MovablePoint,
  Text,
  Theme,
} from "mafs";
import type { vec } from "mafs";

const MIN_SIGMA = 0.1;

function gaussian(x: number, mu: number, sigma: number): number {
  const coefficient = 1 / (sigma * Math.sqrt(2 * Math.PI));
  const exponent = -0.5 * ((x - mu) / sigma) ** 2;
  return coefficient * Math.exp(exponent);
}

export default function NormalDistribution() {
  const [mu, setMu] = useState(0);
  const [sigma, setSigma] = useState(1);

  const handleMuMove = useCallback((point: vec.Vector2) => {
    setMu(point[0]);
  }, []);

  const handleSigmaMove = useCallback(
    (point: vec.Vector2) => {
      // Sigma control sits at mu + sigma on the x-axis.
      // Dragging it changes sigma = distance from mu, clamped to MIN_SIGMA.
      const newSigma = Math.max(MIN_SIGMA, Math.abs(point[0] - mu));
      setSigma(newSigma);
    },
    [mu],
  );

  const constrainToXAxis = useCallback(
    (point: vec.Vector2): vec.Vector2 => [point[0], 0],
    [],
  );

  const constrainSigma = useCallback(
    (point: vec.Vector2): vec.Vector2 => [
      Math.max(mu + MIN_SIGMA, point[0]),
      0,
    ],
    [mu],
  );

  const curve = useCallback(
    (x: number) => gaussian(x, mu, sigma),
    [mu, sigma],
  );

  const peakY = gaussian(mu, mu, sigma);

  return (
    <Mafs viewBox={{ x: [-5, 5], y: [-0.1, 0.5] }}>
      <Coordinates.Cartesian
        xAxis={{ lines: 1 }}
        yAxis={{ lines: 0.1 }}
      />

      {/* Shaded area under the curve */}
      <Plot.Inequality
        y={{ "<": curve, ">": () => 0 }}
        color={Theme.blue}
        fillOpacity={0.15}
      />

      {/* The Gaussian curve */}
      <Plot.OfX y={curve} color={Theme.blue} weight={2.5} />

      {/* Draggable mean control (on x-axis) */}
      <MovablePoint
        point={[mu, 0]}
        onMove={handleMuMove}
        constrain={constrainToXAxis}
        color={Theme.orange}
      />

      {/* Draggable sigma control (at mu + sigma on x-axis) */}
      <MovablePoint
        point={[mu + sigma, 0]}
        onMove={handleSigmaMove}
        constrain={constrainSigma}
        color={Theme.green}
      />

      {/* Parameter labels */}
      <Text x={mu} y={peakY + 0.04} size={14} color={Theme.foreground}>
        {`μ = ${mu.toFixed(2)}, σ = ${sigma.toFixed(2)}`}
      </Text>

      {/* Point labels */}
      <Text x={mu} y={-0.05} size={12} color={Theme.orange}>
        μ
      </Text>
      <Text x={mu + sigma} y={-0.05} size={12} color={Theme.green}>
        μ+σ
      </Text>
    </Mafs>
  );
}
