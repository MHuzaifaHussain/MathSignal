import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import Board from "./Board";
import TraySlider from "./TraySlider";
import { KEYBOARD_COMMIT_DELAY_MS } from "./boardTiming";
import BarChart from "./distributionBoard/BarChart.tsx";
import DistributionTable from "./distributionBoard/DistributionTable.tsx";
import ValueSteppers from "./distributionBoard/ValueSteppers.tsx";
import {
  CONTROL_LABELS,
  STAGE_LABELS,
  announcementFor,
  balanceLine,
  boardLabel,
  coveredText,
  describePencil,
  feedbackLine,
  formatPencil,
  ghostLine,
  goalLine,
  meanLines,
  pencilLine,
  readoutLines,
  refusalText,
  spreadLines,
  statusLine,
  symbolLines,
} from "./distributionBoard/describe.ts";
import { getSetup, type SetupId } from "./distributionBoard/setups.ts";
import { initialState, isCovered, parkedPencil, reducer, stageAllowed, type Action, type Stage } from "./distributionBoard/state.ts";
import CheckButtons from "./guided/CheckButtons.tsx";
import PresetButtons from "./guided/PresetButtons.tsx";
import { RefusalNote, refusedBy } from "./guided/refusal.tsx";
import StageChoice from "./guided/StageChoice.tsx";
import useAnnouncer from "./guided/useAnnouncer.ts";

const STAGE_OPTIONS: readonly { value: Stage; label: string }[] = (["pictures", "numbers", "symbols"] as const).map((value) => ({ value, label: STAGE_LABELS[value] }));

interface DistributionBoardProps {
  /** Which configuration to show; see src/components/react/distributionBoard/setups.ts. */
  setup: SetupId;
}

/**
 * A random variable as a bar chart: the reader gives each outcome a value with − / +, and outcomes that share a
 * value stack into one bar. Later setups add the pencil (the mean as a balance point) and the spread around it.
 * Design and reasoning: decision 0012.
 */
export default function DistributionBoard({ setup: setupId }: DistributionBoardProps) {
  const setup = getSetup(setupId);
  const [state, dispatch] = useReducer(reducer, setupId, initialState);
  const [announcement, announce] = useAnnouncer();
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const statusId = useId();
  const parkedReasonId = useId();
  const lastAction = useRef<Action | null>(null);
  /** True while the latest change is a pencil move, so a late slider commit can't talk over a button pressed since. */
  const pencilMoving = useRef(false);
  const stateRef = useRef(state);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const goalRef = useRef<HTMLParagraphElement>(null);

  const send = useCallback((action: Action) => {
    pencilMoving.current = false;
    lastAction.current = action;
    dispatch(action);
  }, []);

  /** Pencil moves from the slider or the strip update the board silently; the commit below speaks once. */
  const movePencil = useCallback((k: number) => {
    lastAction.current = null;
    pencilMoving.current = true;
    dispatch({ type: "pencil", k });
  }, []);

  // The slider commits a keyboard change after a pause, so only announce; dispatching here could undo a
  // preset or Reset pressed in the meantime. A stale commit (the pencil has moved since, or a button was pressed
  // after the move, such as "Balance it") says nothing, so it never talks over that button's answer.
  const commitPencil = useCallback(
    (k: number) => {
      const current = stateRef.current;
      if (!pencilMoving.current || current.pencil !== k) return;
      pencilMoving.current = false;
      announce(announcementFor(current, { type: "pencil", k }));
    },
    [announce],
  );

  // Announce when an interaction ends: at once for buttons, after a pause for a burst of − / + presses.
  useEffect(() => {
    stateRef.current = state;
    const action = lastAction.current;
    if (!action) return;
    const burst = action.type === "step" && !state.refusal;
    announce(announcementFor(state, action), burst ? KEYBOARD_COMMIT_DELAY_MS : 0);
    // Check, "Show the answer", "Balance it" and "Check goal" disappear once they've done their job, so keyboard
    // focus moves to the sentence that answers them.
    const answered = (action.type === "check" || action.type === "show-answer") && state.checked;
    if (answered || (action.type === "balance" && state.revealed)) feedbackRef.current?.focus();
    if (action.type === "check-goal" && state.goal === "passed") goalRef.current?.focus();
  }, [state, announce]);

  const covered = isCovered(state);
  const goal = goalLine(state);
  const verdict = feedbackLine(state) ?? balanceLine(state);
  const pencil = pencilLine(state);
  const ghost = ghostLine(state);
  const readouts = [...readoutLines(state), ...meanLines(state), ...(pencil ? [pencil] : []), ...spreadLines(state), ...(ghost ? [ghost] : [])];
  const symbols = symbolLines(state);
  const parked = state.pencil === parkedPencil(setup);

  const tray = (
    <>
      {setup.kind === "goal" && (
        <CheckButtons
          progress={state}
          checkLabel={CONTROL_LABELS.check}
          showAnswerLabel={CONTROL_LABELS.showAnswer}
          onCheck={() => send({ type: "check" })}
          onShowAnswer={() => send({ type: "show-answer" })}
        />
      )}
      <StageChoice
        legend={CONTROL_LABELS.showAs}
        options={STAGE_OPTIONS}
        isAllowed={(stage) => stageAllowed(state, stage)}
        value={state.stage}
        onChange={(stage) => send({ type: "stage", stage })}
      />
      {setup.kind === "balance" && (
        <TraySlider
          label={CONTROL_LABELS.pencil}
          value={state.pencil}
          min={parkedPencil(setup)}
          max={setup.range[1] * setup.stepDenominator}
          step={1}
          onValueChange={movePencil}
          onValueCommitted={commitPencil}
          format={(k) => formatPencil(setup, k)}
          describe={(k) => describePencil(setup, k)}
        />
      )}
      {setup.kind === "balance" && !state.revealed && (
        <>
          <button
            type="button"
            className="ms-board-button ms-board-button-primary"
            {...refusedBy(parked ? parkedReasonId : null)}
            onClick={() => send({ type: "balance" })}
          >
            {CONTROL_LABELS.balance}
          </button>
          {parked && <RefusalNote id={parkedReasonId}>{refusalText(setup, { kind: "parked" })}</RefusalNote>}
        </>
      )}
      {setup.kind === "spread" && (
        <button
          type="button"
          role="switch"
          aria-checked={state.spreadShown}
          className="ms-board-button ms-board-switch"
          onClick={() => send({ type: "spread", on: !state.spreadShown })}
        >
          {CONTROL_LABELS.spread}
        </button>
      )}
      {!covered && setup.presets.length > 0 && (
        <PresetButtons
          label={CONTROL_LABELS.presets}
          caption={CONTROL_LABELS.presets}
          presets={setup.presets.map((name) => ({ id: name, label: name }))}
          activeId={state.activePreset}
          onPick={(name) => send({ type: "preset", name })}
        />
      )}
    </>
  );

  return (
    <Board label={boardLabel(setup)} tray={tray} onReset={() => send({ type: "reset" })} announcement={announcement}>
      <div className="ms-dist">
        <p id={statusId} className="ms-dist-status">
          {statusLine(state)}
        </p>
        {goal && (
          <div className="ms-dist-goal">
            <p ref={goalRef} className="ms-dist-goal-line" tabIndex={-1}>
              {goal}
            </p>
            {state.goal !== "passed" && (
              <button type="button" className="ms-board-button ms-board-button-primary" onClick={() => send({ type: "check-goal" })}>
                {CONTROL_LABELS.checkGoal}
              </button>
            )}
          </div>
        )}
        <div className="ms-dist-body">
          <ValueSteppers setup={setup} state={state} describedBy={statusId} linkedId={linkedId} onLink={setLinkedId} send={send} />
          <div className="ms-dist-view">
            {covered ? (
              <div className="ms-dist-covered">
                <p>{coveredText(setup)}</p>
              </div>
            ) : (
              <BarChart setup={setup} state={state} linkedId={linkedId} onPencilMove={movePencil} onPencilCommit={commitPencil} />
            )}
            {symbols.length > 0 && (
              <div className="ms-dist-symbols">
                {symbols.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </div>
        {readouts.length > 0 && (
          <div className="ms-dist-readouts">
            {readouts.map((line) => (
              <p key={line} className="ms-board-readout">
                {line}
              </p>
            ))}
          </div>
        )}
        <DistributionTable state={state} />
        {verdict && (
          <p ref={feedbackRef} className="ms-dist-feedback" tabIndex={-1}>
            {verdict}
          </p>
        )}
      </div>
    </Board>
  );
}
