import { useCallback, useMemo, useState } from "react";
import { Mafs, Polygon, Text } from "mafs";
import type { vec } from "mafs";
import Board from "./Board";
import TraySlider from "./TraySlider";
import PresetButtons from "./guided/PresetButtons.tsx";
import TableFold from "./guided/TableFold.tsx";
import { tableFoldAnnouncement } from "./guided/tableFold.ts";
import useAnnouncer from "./guided/useAnnouncer.ts";
import { formatNumber, plotColors } from "./plotColors";
import { BAYES_SCENARIOS, computePosterior, resolveScenarios, type BayesScenarioId, type BayesValues } from "./bayesTheorem/scenarios.ts";
import { tableSummary } from "./bayesTheorem/table.ts";
import CountTable from "./bayesTheorem/CountTable.tsx";
import { labelPositions } from "./bayesTheorem/labels.ts";

const PROBABILITY_RANGE: vec.Vector2 = [0.01, 0.99];
const PROBABILITY_STEP = 0.01;
const BOARD_HEIGHT = 340;

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
  const [tableShown, setTableShown] = useState(false);
  const [announcement, announce] = useAnnouncer();
  const scenario = BAYES_SCENARIOS[scenarioId];

  const { evidence, posterior } = useMemo(
    () => computePosterior({ prior, likelihood, falsePositive }),
    [prior, likelihood, falsePositive],
  );

  // Both readout numbers, so a page that asks for P(B) (the law of total probability) is heard as well as seen.
  // The shared announcer empties and refills the region, so pressing the same preset twice is spoken twice.
  // While the table shows, each change also says what it counts now.
  const announceValues = useCallback(
    (values: BayesValues, prefix = "", tableScenario: BayesScenarioId | null = null) => {
      const result = computePosterior(values);
      const table = tableScenario === null ? "" : ` ${tableSummary(values, BAYES_SCENARIOS[tableScenario])}`;
      announce(`${prefix}Posterior P of A given B is ${posteriorText(result.posterior)}; P of B is ${formatNumber(result.evidence, 3)}.${table}`);
    },
    [announce],
  );
  const tableScenario = tableShown ? scenarioId : null;

  const loadScenario = useCallback(
    (id: BayesScenarioId, withTable: boolean) => {
      const picked = BAYES_SCENARIOS[id];
      setScenarioId(id);
      setPrior(picked.values.prior);
      setLikelihood(picked.values.likelihood);
      setFalsePositive(picked.values.falsePositive);
      announceValues(picked.values, `${picked.label}. ${picked.meaning} `, withTable ? id : null);
    },
    [announceValues],
  );

  // Reset returns to the opening view, which has the table hidden.
  const handleReset = useCallback(() => {
    setTableShown(false);
    loadScenario(choice.initial, false);
  }, [loadScenario, choice.initial]);

  const toggleTable = (open: boolean) => {
    setTableShown(open);
    announce(tableFoldAnnouncement(open, tableSummary({ prior, likelihood, falsePositive }, scenario)));
  };

  // Only the page's own presets can be picked, so a stray id from the buttons fails loudly.
  const pickPreset = (id: string) => {
    const picked = choice.scenarios.find((scenario) => scenario === id);
    if (!picked) throw new Error(`BayesTheorem: "${id}" is not one of this board's presets (${choice.scenarios.join(", ")}).`);
    loadScenario(picked, tableShown);
  };

  // Inside each column, or beside a column too thin to hold them, never on the other event's fill.
  const labels = labelPositions({ prior, likelihood, falsePositive });

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
      <p className="ms-event-note-line">{scenario.meaning}</p>
      {probabilitySlider("P(A)", prior, setPrior, (value) => announceValues({ prior: value, likelihood, falsePositive }, "", tableScenario))}
      {probabilitySlider("P(B | A)", likelihood, setLikelihood, (value) => announceValues({ prior, likelihood: value, falsePositive }, "", tableScenario))}
      {probabilitySlider("P(B | not A)", falsePositive, setFalsePositive, (value) => announceValues({ prior, likelihood, falsePositive: value }, "", tableScenario))}
      <p className="ms-board-readout">
        P(A | B) = {posteriorText(posterior)} &nbsp; P(B) = {formatNumber(evidence, 3)}
      </p>
      <TableFold open={tableShown} onToggle={toggleTable}>
        <CountTable values={{ prior, likelihood, falsePositive }} scenario={scenario} />
      </TableFold>
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

        <Text {...labels.aName} size={14} color={plotColors.ink}>
          A
        </Text>
        <Text {...labels.notAName} size={14} color={plotColors.inkMuted}>
          not A
        </Text>
        <Text {...labels.bAndA} size={13} color={plotColors.ink}>
          B and A
        </Text>
        <Text {...labels.bAndNotA} size={13} color={plotColors.ink}>
          B and not A
        </Text>
      </Mafs>
    </Board>
  );
}
