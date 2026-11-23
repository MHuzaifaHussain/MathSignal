import { useCallback, useMemo, useState } from "react";
import { Mafs, Polygon, Text } from "mafs";
import type { vec } from "mafs";
import Board from "./Board";
import TraySlider from "./TraySlider";
import { formatNumber, plotColors } from "./plotColors";

const PROBABILITY_RANGE: vec.Vector2 = [0.01, 0.99];
const PROBABILITY_STEP = 0.01;
const INITIAL = { prior: 0.3, likelihood: 0.8, falsePositive: 0.1 };
const BOARD_HEIGHT = 340;

const rectangle = (x0: number, x1: number, y0: number, y1: number): vec.Vector2[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

function computePosterior(prior: number, likelihood: number, falsePositive: number) {
  const evidence = likelihood * prior + falsePositive * (1 - prior);
  return { evidence, posterior: evidence > 0 ? (likelihood * prior) / evidence : 0 };
}

/**
 * Bayes' theorem as areas in a unit square: the prior is a column's width, each likelihood is a
 * height within its column, and the posterior is the highlighted area's share of everything that tested positive.
 */
export default function BayesTheorem() {
  const [prior, setPrior] = useState(INITIAL.prior);
  const [likelihood, setLikelihood] = useState(INITIAL.likelihood);
  const [falsePositive, setFalsePositive] = useState(INITIAL.falsePositive);
  const [announcement, setAnnouncement] = useState("");

  const { evidence, posterior } = useMemo(
    () => computePosterior(prior, likelihood, falsePositive),
    [prior, likelihood, falsePositive],
  );

  const announce = useCallback((nextPrior: number, nextLikelihood: number, nextFalsePositive: number) => {
    const result = computePosterior(nextPrior, nextLikelihood, nextFalsePositive);
    setAnnouncement(`Posterior P of A given B is ${formatNumber(result.posterior, 3)}.`);
  }, []);

  const handleReset = useCallback(() => {
    setPrior(INITIAL.prior);
    setLikelihood(INITIAL.likelihood);
    setFalsePositive(INITIAL.falsePositive);
    announce(INITIAL.prior, INITIAL.likelihood, INITIAL.falsePositive);
  }, [announce]);

  const probabilitySlider = (label: string, value: number, onChange: (value: number) => void, commit: (value: number) => void) => (
    <TraySlider
      label={label}
      value={value}
      min={PROBABILITY_RANGE[0]}
      max={PROBABILITY_RANGE[1]}
      step={PROBABILITY_STEP}
      format={(next) => formatNumber(next)}
      describe={(next) => `${label} ${formatNumber(next)}`}
      onValueChange={onChange}
      onValueCommitted={commit}
    />
  );

  const tray = (
    <>
      {probabilitySlider("P(A)", prior, setPrior, (value) => announce(value, likelihood, falsePositive))}
      {probabilitySlider("P(B | A)", likelihood, setLikelihood, (value) => announce(prior, value, falsePositive))}
      {probabilitySlider("P(B | not A)", falsePositive, setFalsePositive, (value) => announce(prior, likelihood, value))}
      <p className="ms-board-readout">
        P(A | B) = {formatNumber(posterior, 3)} &nbsp; P(B) = {formatNumber(evidence, 3)}
      </p>
    </>
  );

  return (
    <Board
      label="Bayes' theorem as areas. Adjust the prior and the two likelihoods with the sliders below."
      tray={tray}
      onReset={handleReset}
      announcement={announcement}
    >
      <Mafs height={BOARD_HEIGHT} viewBox={{ x: [-0.05, 1.05], y: [-0.08, 1.05], padding: 0 }} preserveAspectRatio={false} pan={false} zoom={false}>
        {/* The whole population */}
        <Polygon points={rectangle(0, 1, 0, 1)} color={plotColors.axis} fillOpacity={0.06} strokeOpacity={0.6} />
        {/* A: column whose width is the prior */}
        <Polygon points={rectangle(0, prior, 0, 1)} color={plotColors.ink} fillOpacity={0.08} strokeOpacity={0.5} />
        {/* B and A: the numerator, highlighted */}
        <Polygon points={rectangle(0, prior, 0, likelihood)} color={plotColors.attention} fillOpacity={0.45} />
        {/* B and not A: false positives */}
        <Polygon points={rectangle(prior, 1, 0, falsePositive)} color={plotColors.ink} fillOpacity={0.28} />

        <Text x={prior / 2} y={1.0 - 0.04} size={14} color={plotColors.ink}>
          A
        </Text>
        <Text x={(prior + 1) / 2} y={1.0 - 0.04} size={14} color={plotColors.inkMuted}>
          not A
        </Text>
        <Text x={prior / 2} y={likelihood / 2} size={13} color={plotColors.ink}>
          B and A
        </Text>
        <Text x={(prior + 1) / 2} y={Math.max(falsePositive / 2, 0.04)} size={13} color={plotColors.ink}>
          B and not A
        </Text>
      </Mafs>
    </Board>
  );
}
