import { useCallback, useMemo, useState } from "react";
import { Mafs, Polygon, Text } from "mafs";
import type { vec } from "mafs";
import Board from "./Board";
import TraySlider from "./TraySlider";
import PresetButtons from "./guided/PresetButtons.tsx";
import { formatNumber, plotColors } from "./plotColors";
import { BAYES_SCENARIOS, DEFAULT_SCENARIO, computePosterior, type BayesScenarioId, type BayesValues } from "./bayesTheorem/scenarios.ts";

const PROBABILITY_RANGE: vec.Vector2 = [0.01, 0.99];
const PROBABILITY_STEP = 0.01;
const BOARD_HEIGHT = 340;
const SCENARIO_IDS = Object.keys(BAYES_SCENARIOS) as BayesScenarioId[];
const SCENARIO_PRESETS = SCENARIO_IDS.map((id) => ({ id, label: BAYES_SCENARIOS[id].label }));
/** Below this prior, A's column is too thin to hold its labels (the medical test's is 0.01), so they sit beside it. */
const NARROW_COLUMN = 0.15;
const LABEL_GAP = 0.01;

const rectangle = (x0: number, x1: number, y0: number, y1: number): vec.Vector2[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

function toScenarioId(id: string): BayesScenarioId {
  const known = SCENARIO_IDS.find((scenarioId) => scenarioId === id);
  if (!known) throw new Error(`BayesTheorem: no example scenario "${id}".`);
  return known;
}

/** "0.083", or the reason there is no posterior when P(B) is 0. */
const posteriorText = (posterior: number | null) => (posterior === null ? "undefined, because P(B) = 0" : formatNumber(posterior, 3));

/**
 * Bayes' theorem as areas in a unit square: the prior is a column's width, each likelihood is a
 * height within its column, and the posterior is the highlighted area's share of everything that tested positive.
 * Presets load a named scenario (bayesTheorem/scenarios.ts) and say what A and B stand for.
 */
export default function BayesTheorem() {
  const initial = BAYES_SCENARIOS[DEFAULT_SCENARIO];
  const [scenarioId, setScenarioId] = useState<BayesScenarioId>(DEFAULT_SCENARIO);
  const [prior, setPrior] = useState(initial.values.prior);
  const [likelihood, setLikelihood] = useState(initial.values.likelihood);
  const [falsePositive, setFalsePositive] = useState(initial.values.falsePositive);
  const [announcement, setAnnouncement] = useState("");

  const { evidence, posterior } = useMemo(
    () => computePosterior({ prior, likelihood, falsePositive }),
    [prior, likelihood, falsePositive],
  );

  const announce = useCallback((values: BayesValues, prefix = "") => {
    setAnnouncement(`${prefix}Posterior P of A given B is ${posteriorText(computePosterior(values).posterior)}.`);
  }, []);

  const loadScenario = useCallback(
    (id: BayesScenarioId) => {
      const scenario = BAYES_SCENARIOS[id];
      setScenarioId(id);
      setPrior(scenario.values.prior);
      setLikelihood(scenario.values.likelihood);
      setFalsePositive(scenario.values.falsePositive);
      announce(scenario.values, `${scenario.label}. ${scenario.meaning} `);
    },
    [announce],
  );

  const handleReset = useCallback(() => loadScenario(DEFAULT_SCENARIO), [loadScenario]);

  // Labels for A's column: centered inside it, or anchored just right of it when the column is too thin.
  const columnLabelPosition =
    prior < NARROW_COLUMN ? { x: prior + LABEL_GAP, attach: "e" as const } : { x: prior / 2 };

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
      <PresetButtons
        label="Example scenarios"
        caption="Example"
        presets={SCENARIO_PRESETS}
        activeId={scenarioId}
        onPick={(id) => loadScenario(toScenarioId(id))}
      />
      <p className="ms-event-note-line">{BAYES_SCENARIOS[scenarioId].meaning}</p>
      {probabilitySlider("P(A)", prior, setPrior, (value) => announce({ prior: value, likelihood, falsePositive }))}
      {probabilitySlider("P(B | A)", likelihood, setLikelihood, (value) => announce({ prior, likelihood: value, falsePositive }))}
      {probabilitySlider("P(B | not A)", falsePositive, setFalsePositive, (value) => announce({ prior, likelihood, falsePositive: value }))}
      <p className="ms-board-readout">
        P(A | B) = {posteriorText(posterior)} &nbsp; P(B) = {formatNumber(evidence, 3)}
      </p>
    </>
  );

  return (
    <Board
      label="Bayes' theorem as areas. Pick an example or adjust the prior and the two likelihoods with the sliders below."
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

        <Text {...columnLabelPosition} y={1.0 - 0.04} size={14} color={plotColors.ink}>
          A
        </Text>
        <Text x={(prior + 1) / 2} y={1.0 - 0.04} size={14} color={plotColors.inkMuted}>
          not A
        </Text>
        <Text {...columnLabelPosition} y={likelihood / 2} size={13} color={plotColors.ink}>
          B and A
        </Text>
        <Text x={(prior + 1) / 2} y={Math.max(falsePositive / 2, 0.04)} size={13} color={plotColors.ink}>
          B and not A
        </Text>
      </Mafs>
    </Board>
  );
}
