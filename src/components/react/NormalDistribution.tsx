import { useCallback, useMemo, useState } from "react";
import { Coordinates, Line, Mafs, MovablePoint, Plot, Text } from "mafs";
import type { vec } from "mafs";
import Board from "./Board";
import ChalkNote from "./ChalkNote";
import TraySlider from "./TraySlider";
import { formatNumber, plotColors } from "./plotColors";

const INITIAL_MU = 0;
const INITIAL_SIGMA = 1;
const MU_RANGE: vec.Vector2 = [-3, 3];
const SIGMA_RANGE: vec.Vector2 = [0.4, 2.5];
const MU_STEP = 0.1;
const SIGMA_STEP = 0.05;
const VIEW_X: vec.Vector2 = [-5, 5];
/** Tall enough for the narrowest bell: peak = 1 / (σ√2π) ≈ 1.0 at σ = 0.4. */
const VIEW_Y: vec.Vector2 = [-0.12, 1.1];
const BOARD_HEIGHT = 360;
const LABEL_OFFSET = 0.07;

function gaussian(x: number, mu: number, sigma: number): number {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

const clamp = (value: number, [min, max]: vec.Vector2) => Math.min(max, Math.max(min, value));
/** Tick labels at the very edge of the view get cut in half by the plot's frame, so they are left out. */
const edgeSafeLabel = (x: number) => (Math.abs(x) >= VIEW_X[1] ? "" : formatNumber(x, 0));
/** The σ handle sits on whichever side of μ has more room, so it never leaves the board. */
const sigmaSide = (mu: number) => (mu > 0 ? -1 : 1);
/**
 * σ from the handle's x, measured on the handle's own side of μ. Moving past μ pins σ at its
 * minimum instead of mirroring it (which made the spread grow while dragging or pressing inward).
 */
const sigmaFromHandleX = (x: number, mu: number) => clamp(sigmaSide(mu) * (x - mu), SIGMA_RANGE);

function describeState(mu: number, sigma: number): string {
  return `Mean ${formatNumber(mu)}, standard deviation ${formatNumber(sigma)}, peak height ${formatNumber(gaussian(mu, mu, sigma))}.`;
}

/** Normal distribution board: drag μ along the axis, drag σ along the curve's inflection point. */
export default function NormalDistribution() {
  const [mu, setMu] = useState(INITIAL_MU);
  const [sigma, setSigma] = useState(INITIAL_SIGMA);
  const [announcement, setAnnouncement] = useState("");

  const curve = useCallback((x: number) => gaussian(x, mu, sigma), [mu, sigma]);
  const peakY = useMemo(() => gaussian(mu, mu, sigma), [mu, sigma]);
  // The σ handle sits on the curve at μ ± σ, an inflection point.
  const side = sigmaSide(mu);
  const sigmaHandle: vec.Vector2 = [mu + side * sigma, gaussian(mu + sigma, mu, sigma)];

  const announce = useCallback((nextMu: number, nextSigma: number) => {
    setAnnouncement(describeState(nextMu, nextSigma));
  }, []);

  const handleMuMove = useCallback(
    ([x]: vec.Vector2) => setMu(clamp(x, MU_RANGE)),
    [],
  );

  const constrainMu = useCallback(
    ([x]: vec.Vector2): vec.Vector2 => [clamp(x, MU_RANGE), 0],
    [],
  );

  const handleSigmaMove = useCallback(
    ([x]: vec.Vector2) => setSigma(sigmaFromHandleX(x, mu)),
    [mu],
  );

  const constrainSigma = useCallback(
    ([x]: vec.Vector2): vec.Vector2 => {
      const nextSigma = sigmaFromHandleX(x, mu);
      return [mu + sigmaSide(mu) * nextSigma, gaussian(mu + nextSigma, mu, nextSigma)];
    },
    [mu],
  );

  const handleReset = useCallback(() => {
    setMu(INITIAL_MU);
    setSigma(INITIAL_SIGMA);
    announce(INITIAL_MU, INITIAL_SIGMA);
  }, [announce]);

  const tray = (
    <>
      <TraySlider
        label="Mean μ"
        meaning="mu"
        value={mu}
        min={MU_RANGE[0]}
        max={MU_RANGE[1]}
        step={MU_STEP}
        format={(value) => formatNumber(value)}
        describe={(value) => `mean ${formatNumber(value)}`}
        onValueChange={setMu}
        onValueCommitted={(value) => announce(value, sigma)}
      />
      <TraySlider
        label="Spread σ"
        meaning="sigma"
        value={sigma}
        min={SIGMA_RANGE[0]}
        max={SIGMA_RANGE[1]}
        step={SIGMA_STEP}
        format={(value) => formatNumber(value)}
        describe={(value) => `standard deviation ${formatNumber(value)}`}
        onValueChange={setSigma}
        onValueCommitted={(value) => announce(mu, value)}
      />
    </>
  );

  return (
    <Board
      label="Normal distribution. Drag the pink point to move the mean and the blue point to change the spread, or use the sliders below."
      tray={tray}
      onReset={handleReset}
      announcement={announcement}
      onInteractionEnd={() => announce(mu, sigma)}
    >
      <Mafs
        height={BOARD_HEIGHT}
        viewBox={{ x: VIEW_X, y: VIEW_Y, padding: 0 }}
        preserveAspectRatio={false}
        pan={false}
        zoom={false}
      >
        <Coordinates.Cartesian xAxis={{ lines: 1, labels: edgeSafeLabel }} yAxis={false} />

        <Plot.Inequality y={{ "<": curve, ">": () => 0 }} color={plotColors.mu} fillOpacity={0.12} strokeOpacity={0} />
        <Plot.OfX y={curve} color={plotColors.mu} weight={2.5} />

        {/* μ guide from the axis to the peak */}
        <Line.Segment point1={[mu, 0]} point2={[mu, peakY]} color={plotColors.mu} style="dashed" weight={1} />

        {/* σ span from the mean to the inflection point */}
        <Line.Segment point1={[mu, sigmaHandle[1]]} point2={sigmaHandle} color={plotColors.sigma} weight={2} />

        <Text x={mu} y={-LABEL_OFFSET} size={16} color={plotColors.mu}>
          μ
        </Text>
        <Text x={mu + (side * sigma) / 2} y={sigmaHandle[1] + LABEL_OFFSET} size={16} color={plotColors.sigma}>
          σ
        </Text>

        <MovablePoint point={[mu, 0]} onMove={handleMuMove} constrain={constrainMu} color={plotColors.mu} />
        <MovablePoint point={sigmaHandle} onMove={handleSigmaMove} constrain={constrainSigma} color={plotColors.sigma} />
      </Mafs>
      <ChalkNote long="widen the bell and watch the peak" short="widen it, watch the peak" />
    </Board>
  );
}
