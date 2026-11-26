import { useCallback, useEffect, useId, useLayoutEffect, useReducer, useRef } from "react";
import Board from "./Board";
import TrayChoice from "./TrayChoice";
import TraySlider from "./TraySlider";
import CheckButtons from "./guided/CheckButtons.tsx";
import PresetButtons from "./guided/PresetButtons.tsx";
import TableFold from "./guided/TableFold.tsx";
import { RefusalNote } from "./guided/refusal.tsx";
import SpokenText from "./guided/SpokenText.tsx";
import StageChoice from "./guided/StageChoice.tsx";
import useAnnouncer from "./guided/useAnnouncer.ts";
import useCommittedSlider from "./guided/useCommittedSlider.ts";
import { spokenMathLine } from "./spokenMath.ts";
import { usePointerScrub } from "./usePointerScrub.ts";
import { chartRows } from "./descriptiveStats/chart.ts";
import DotPlot from "./descriptiveStats/DotPlot.tsx";
import LineUp from "./descriptiveStats/LineUp.tsx";
import StatsTables from "./descriptiveStats/StatsTables.tsx";
import {
  CONTROL_LABELS,
  CUTOFF_OPTIONS,
  SCALE_LABELS,
  alreadyShowingLine,
  announcementFor,
  boardLabel,
  checkRefusal,
  childOptions,
  coveredText,
  dataTable,
  describeGiant,
  describeHeight,
  describeSavings,
  feedbackLine,
  formatGiant,
  formatHeight,
  formatSavings,
  goalLine,
  goalStatus,
  readoutLines,
  stageOptions,
  statusLine,
  summaryNote,
  summaryTable,
  symbolLines,
} from "./descriptiveStats/describe.ts";
import { SCALES, getSetup, type SetupId } from "./descriptiveStats/setups.ts";
import { clampToSlider, initialState, isCovered, reducer, stageAllowed, type Action, type DescriptiveState } from "./descriptiveStats/state.ts";

const SCALE_OPTIONS = SCALES.map((value) => ({ value, label: SCALE_LABELS[value] }));

/** The value the tray slider moves on this setup, or null when it has none. */
function sliderValue(state: DescriptiveState): number | null {
  switch (getSetup(state.setupId).kind) {
    case "spread":
      return state.values[state.selected];
    case "newcomer":
      return state.newcomer;
    case "outliers":
      return state.giant;
    default:
      return null;
  }
}

interface DescriptiveStatsProps {
  /** Which configuration to show; see src/components/react/descriptiveStats/setups.ts. */
  setup: SetupId;
}

/** A board line that shows its symbols ("σ = 8 cm", "|z| > 2") and gives screen readers the words. */
function Said({ text }: { text: string }) {
  return <SpokenText line={spokenMathLine(text)} />;
}

/**
 * A short list of numbers as a dot plot, with tables: the middle child, a newcomer in a cafe, the spread of a class,
 * a box plot, two tests on three scales, and a giant pumpkin. Design and reasoning: decision 0015.
 */
export default function DescriptiveStats({ setup: setupId }: DescriptiveStatsProps) {
  const setup = getSetup(setupId);
  const [state, dispatch] = useReducer(reducer, setupId, initialState);
  const [announcement, announce] = useAnnouncer();
  const checkReasonId = useId();
  const lastAction = useRef<Action | null>(null);
  const sliderGuard = useCommittedSlider<"value">();
  const stateRef = useRef(state);
  // A layout effect, so a commit that ends a drag (pointerup) reads the state of the drag's last move, whose passive
  // effects may still be pending.
  useLayoutEffect(() => {
    stateRef.current = state;
  });
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  const send = useCallback(
    (action: Action) => {
      sliderGuard.interrupt();
      const repeat = action.type === "preset" ? alreadyShowingLine(stateRef.current, action.id) : null;
      if (repeat) {
        lastAction.current = null;
        announce(repeat);
        return;
      }
      lastAction.current = action;
      dispatch(action);
    },
    [announce, sliderGuard],
  );

  /** Slider and drag moves update the board silently; the commit below speaks once. */
  const slide = useCallback((value: number) => {
    lastAction.current = null;
    sliderGuard.moved("value");
    dispatch({ type: "set-value", value });
  }, [sliderGuard]);

  const commitSlide = useCallback(
    (value: number) => {
      const current = stateRef.current;
      if (!sliderGuard.take("value", sliderValue(current) === value)) return;
      announce(announcementFor(current, { type: "set-value", value }));
    },
    [announce, sliderGuard],
  );

  const scrub = usePointerScrub({
    valueAt: (fraction) => clampToSlider(setup, Math.round(setup.axis.min + fraction * (setup.axis.max - setup.axis.min))),
    onMove: slide,
    onCommit: commitSlide,
  });

  // Buttons, radios and switches speak at once, with the sentence that answers them.
  useEffect(() => {
    const action = lastAction.current;
    if (!action) return;
    announce(announcementFor(state, action));
    // Check and "Show the answer" disappear once they have answered, so keyboard focus moves to the verdict.
    if ((action.type === "check" || action.type === "show-answer") && state.checked) feedbackRef.current?.focus();
  }, [state, announce]);

  const covered = isCovered(state);
  const verdict = feedbackLine(state);
  const refusal = checkRefusal(state);
  const goal = goalLine(state);
  const goalNow = goalStatus(state);
  const symbols = symbolLines(state);
  const readouts = readoutLines(state);
  const slider = setup.slider;
  const sliderNow = sliderValue(state);
  const showPictures = setup.kind === "lineup" && state.stage === "pictures";

  const sliderProps = {
    spread: { label: CONTROL_LABELS.height, format: formatHeight, describe: (value: number) => describeHeight(state, value) },
    newcomer: { label: CONTROL_LABELS.newcomerSavings, format: formatSavings, describe: describeSavings },
    outliers: { label: CONTROL_LABELS.giant, format: formatGiant, describe: (value: number) => describeGiant(state, value) },
  } as const;
  const sliderText = setup.kind === "spread" || setup.kind === "newcomer" || setup.kind === "outliers" ? sliderProps[setup.kind] : null;

  const tray = (
    <>
      {setup.kind === "lineup" && (
        <button
          type="button"
          role="switch"
          aria-checked={state.linedUp}
          className="ms-board-button ms-board-switch"
          onClick={() => send({ type: "line-up", on: !state.linedUp })}
        >
          {CONTROL_LABELS.lineUp}
        </button>
      )}
      {setup.kind === "lineup" && !state.checked && (
        <TrayChoice
          legend={CONTROL_LABELS.pick}
          options={childOptions(state)}
          value={state.pick === null ? null : String(state.pick)}
          onChange={(child) => send({ type: "pick", child: Number(child) })}
        />
      )}
      {setup.kind === "lineup" && (
        <CheckButtons
          progress={state}
          checkLabel={CONTROL_LABELS.check}
          showAnswerLabel={CONTROL_LABELS.showAnswer}
          checkRefusalId={refusal ? checkReasonId : null}
          onCheck={() => send({ type: "check" })}
          onShowAnswer={() => send({ type: "show-answer" })}
        />
      )}
      {refusal && <RefusalNote id={checkReasonId}>{refusal}</RefusalNote>}
      <StageChoice
        legend={setup.stageLegend}
        options={stageOptions(setup)}
        isAllowed={(stage) => stageAllowed(state, stage)}
        value={state.stage}
        onChange={(stage) => send({ type: "stage", stage })}
      />
      {setup.kind === "newcomer" && (
        <button
          type="button"
          role="switch"
          aria-checked={state.newcomer !== null}
          className="ms-board-button ms-board-switch"
          onClick={() => send({ type: "newcomer", on: state.newcomer === null })}
        >
          {CONTROL_LABELS.newcomer}
        </button>
      )}
      {setup.kind === "spread" && (
        <TrayChoice
          legend={CONTROL_LABELS.childToMove}
          options={childOptions(state)}
          value={String(state.selected)}
          onChange={(child) => send({ type: "select", child: Number(child) })}
        />
      )}
      {slider && sliderText && sliderNow !== null && (
        <TraySlider
          label={sliderText.label}
          value={sliderNow}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          largeStep={slider.largeStep}
          onValueChange={slide}
          onValueCommitted={commitSlide}
          format={sliderText.format}
          describe={sliderText.describe}
        />
      )}
      {setup.kind === "spread" && (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={state.distances}
            className="ms-board-button ms-board-switch"
            onClick={() => send({ type: "distances", on: !state.distances })}
          >
            {CONTROL_LABELS.distances}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={state.sample}
            className="ms-board-button ms-board-switch"
            onClick={() => send({ type: "sample", on: !state.sample })}
          >
            {CONTROL_LABELS.sample}
          </button>
        </>
      )}
      {setup.kind === "scaling" && <TrayChoice legend={CONTROL_LABELS.scale} options={SCALE_OPTIONS} value={state.scale} onChange={(scale) => send({ type: "scale", scale })} />}
      {setup.kind === "outliers" && (
        <TrayChoice
          legend={spokenMathLine(CONTROL_LABELS.cutoff)}
          options={CUTOFF_OPTIONS}
          value={String(state.cutoff) as "2" | "3"}
          onChange={(cutoff) => send({ type: "cutoff", cutoff: cutoff === "3" ? 3 : 2 })}
        />
      )}
      {setup.presets.length > 0 && (
        <PresetButtons
          label={CONTROL_LABELS.presets}
          caption={CONTROL_LABELS.presetsCaption}
          presets={setup.presets}
          activeId={state.activePreset}
          onPick={(id) => send({ type: "preset", id })}
        />
      )}
      <TableFold open={state.tableOpen} onToggle={(open) => send({ type: "table", open })}>
        <StatsTables data={dataTable(state)} summary={summaryTable(state)} note={summaryNote(state)} />
      </TableFold>
    </>
  );

  return (
    <Board label={boardLabel(setup)} tray={tray} onReset={() => send({ type: "reset" })} announcement={announcement}>
      <div className={`ms-desc is-${setup.kind}`}>
        <p className="ms-desc-status">
          <Said text={statusLine(state)} />
        </p>
        {goal && (
          <div className="ms-desc-goal">
            <p className="ms-desc-goal-line">
              <Said text={goal} />
            </p>
            {goalNow && (
              <p className="ms-board-readout">
                <Said text={goalNow} />
              </p>
            )}
          </div>
        )}
        {showPictures ? <LineUp state={state} /> : <DotPlot rows={chartRows(state)} scrub={setup.kind === "spread" ? scrub : undefined} />}
        {symbols.length > 0 && (
          <div className="ms-desc-symbols">
            {symbols.map((line) => (
              <p key={line.text}>
                <span aria-hidden="true">{line.text}</span>
                <span className="sr-only">{line.spoken}</span>
              </p>
            ))}
          </div>
        )}
        {verdict && (
          <p ref={feedbackRef} className="ms-desc-feedback" tabIndex={-1}>
            <Said text={verdict} />
          </p>
        )}
        {(readouts.length > 0 || covered) && (
          <div className="ms-desc-readouts">
            {/* While the summary waits for Check, the canvas says why, outside the fold. */}
            {covered && <p className="ms-board-readout">{coveredText()}</p>}
            {readouts.map((line) => (
              <p key={line} className="ms-board-readout">
                <Said text={line} />
              </p>
            ))}
          </div>
        )}
      </div>
    </Board>
  );
}
