import { useCallback, useMemo, useState } from "react";
import { Mafs, Polygon, Text } from "mafs";
import type { vec } from "mafs";
import Board from "./Board";
import TraySlider from "./TraySlider";
import PresetButtons from "./guided/PresetButtons.tsx";
import useAnnouncer from "./guided/useAnnouncer.ts";
import { formatNumber, plotColors } from "./plotColors";
import { BAYES_SCENARIOS, computePosterior, resolveScenarios, type BayesScenarioId, type BayesValues } from "./bayesTheorem/scenarios.ts";

const PROBABILITY_RANGE: vec.Vector2 = [0.01, 0.99];
const PROBABILITY_STEP = 0.01;
const BOARD_HEIGHT = 340;
/** A column narrower than this is too thin to hold its labels (the medical test's A is 0.01), so they sit beside it. */
const NARROW_COLUMN = 0.15;
const LABEL_GAP = 0.01;

const rectangle = (x0: number, x1: number, y0: number, y1: number): vec.Vector2[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** "0.083", or the reason there is no posterior when P(B) is 0. */
const posteriorText = (posterior: number | null) => (posterior === null ? "undefined, because P(B) = 0" : formatNumber(posterior, 3));

interface BayesTheoremProps {
  /** The preset buttons, 2 to 4 ids from bayesTheorem/scenarios.ts in the page's order. Defaults to Any two events, Medical test and Wet lawn. */
  scenarios?: BayesScenarioId[];
  /** The scenario the board opens on and Reset returns to; one of `scenarios`. Defaults to the first of them. */
  initialScenario?: BayesScenarioId;
}

/**
 * Bayes' theorem as areas in a unit square: the prior is a column's width, each likelihood is a
 * height within its column, and the posterior is the highlighted area's share of everything that tested positive.
 * Presets load a named scenario (bayesTheorem/scenarios.ts) and say what A and B stand for.
 */
export default function BayesTheorem({ scenarios, initialScenario }: BayesTheoremProps) {
  // Throws on a bad id or list; the island renders at build time, so a page with one fails the build.
  const choice = resolveScenarios(scenarios, initialScenario);
  const presets = choice.scenarios.map((id) => ({ id, label: BAYES_SCENARIOS[id].label }));
  const initial = BAYES_SCENARIOS[choice.initial];
  const [scenarioId, setScenarioId] = useState<BayesScenarioId>(choice.initial);
  const [prior, setPrior] = useState(initial.values.prior);
  const [likelihood, setLikelihood] = useState(initial.values.likelihood);
  const [falsePositive, setFalsePositive] = useState(initial.values.falsePositive);
  const [announcement, announce] = useAnnouncer();

  const { evidence, posterior } = useMemo(
    () => computePosterior({ prior, likelihood, falsePositive }),
    [prior, likelihood, falsePositive],
  );

  // Both readout numbers, so a page that asks for P(B) (the law of total probability) is heard as well as seen.
  // The shared announcer empties and refills the region, so pressing the same preset twice is spoken twice.
  const announceValues = useCallback(
    (values: BayesValues, prefix = "") => {
      const result = computePosterior(values);
      announce(`${prefix}Posterior P of A given B is ${posteriorText(result.posterior)}; P of B is ${formatNumber(result.evidence, 3)}.`);
    },
    [announce],
  );

  const loadScenario = useCallback(
    (id: BayesScenarioId) => {
      const scenario = BAYES_SCENARIOS[id];
      setScenarioId(id);
      setPrior(scenario.values.prior);
      setLikelihood(scenario.values.likelihood);
      setFalsePositive(scenario.values.falsePositive);
      announceValues(scenario.values, `${scenario.label}. ${scenario.meaning} `);
    },
    [announceValues],
  );

  const handleReset = useCallback(() => loadScenario(choice.initial), [loadScenario, choice.initial]);

  // Only the page's own presets can be picked, so a stray id from the buttons fails loudly.
  const pickPreset = (id: string) => {
    const picked = choice.scenarios.find((scenario) => scenario === id);
    if (!picked) throw new Error(`BayesTheorem: "${id}" is not one of this board's presets (${choice.scenarios.join(", ")}).`);
    loadScenario(picked);
  };

  // Labels for A's column: centered inside it, or anchored just right of it when the column is too thin.
  const columnLabelPosition =
    prior < NARROW_COLUMN ? { x: prior + LABEL_GAP, attach: "e" as const } : { x: prior / 2 };
  // Labels for not A's column, the mirror image: anchored just left of it when the column is too thin.
  const otherColumnLabelPosition =
    1 - prior < NARROW_COLUMN ? { x: prior - LABEL_GAP, attach: "w" as const } : { x: (prior + 1) / 2 };

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
        presets={presets}
        activeId={scenarioId}
        onPick={pickPreset}
      />
      <p className="ms-event-note-line">{BAYES_SCENARIOS[scenarioId].meaning}</p>
      {probabilitySlider("P(A)", prior, setPrior, (value) => announceValues({ prior: value, likelihood, falsePositive }))}
      {probabilitySlider("P(B | A)", likelihood, setLikelihood, (value) => announceValues({ prior, likelihood: value, falsePositive }))}
      {probabilitySlider("P(B | not A)", falsePositive, setFalsePositive, (value) => announceValues({ prior, likelihood, falsePositive: value }))}
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
        <Text {...otherColumnLabelPosition} y={1.0 - 0.04} size={14} color={plotColors.inkMuted}>
          not A
        </Text>
        <Text {...columnLabelPosition} y={likelihood / 2} size={13} color={plotColors.ink}>
          B and A
        </Text>
        <Text {...otherColumnLabelPosition} y={Math.max(falsePositive / 2, 0.04)} size={13} color={plotColors.ink}>
          B and not A
        </Text>
      </Mafs>
    </Board>
  );
}
