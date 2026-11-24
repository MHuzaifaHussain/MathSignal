import { useCallback, useEffect, useId, useReducer, useRef } from "react";
import Board from "./Board";
import TrayChoice from "./TrayChoice";
import { KEYBOARD_COMMIT_DELAY_MS } from "./boardTiming";
import CheckButtons from "./guided/CheckButtons.tsx";
import PresetButtons from "./guided/PresetButtons.tsx";
import { RefusalNote, refusedBy } from "./guided/refusal.tsx";
import StageChoice from "./guided/StageChoice.tsx";
import useAnnouncer from "./guided/useAnnouncer.ts";
import CupRow from "./eventSpace/CupRow.tsx";
import OutcomeGrid from "./eventSpace/OutcomeGrid.tsx";
import WrongModelTiles from "./eventSpace/WrongModelTiles.tsx";
import { simulate } from "./eventSpace/model.ts";
import { COMPARE_COVERED_NOTE, COMPARE_LABEL, STAGE_LABELS, additivityLine, announcementFor, compareLines, feedbackLine, jugLine, markedLine, presetLabel, readoutLines, setsLine, shrinkRefusalText, statusLine, tossLine, totalLine } from "./eventSpace/describe.ts";
import { SCENARIOS } from "./eventSpace/scenarios.ts";
import { canShrink, getSetup, type SetupId } from "./eventSpace/setups.ts";
import { activeWeightPreset, initialState, isLocked, reducer, shrinkBlocked, stageAllowed, type Action, type EventKey, type LookAt, type Stage } from "./eventSpace/state.ts";

const LOCKED_REASON = "Check your answer first";
/** Tosses per press of "Toss 100". */
const TOSS_BATCH = 100;
const CUPS_NOTE = "The cups are drawn the same size. The water in them is the probability, not the cup.";
const STAGE_OPTIONS: readonly { value: Stage; label: string }[] = (["picture", "letters", "sets"] as const).map((value) => ({ value, label: STAGE_LABELS[value] }));
const LOOK_AT_OPTIONS: readonly { value: LookAt; label: string }[] = [
  { value: "everything", label: "Everything" },
  { value: "A and B", label: "A and B" },
  { value: "A or B", label: "A or B" },
  { value: "not A", label: "Not A" },
];

interface EventSpaceProps {
  /** Which configuration to show; see src/components/react/eventSpace/setups.ts. */
  setup: SetupId;
}

/**
 * A sample space as a table of outcomes, equally likely or (on a weighted die) carrying units of 12. Readers build
 * events by tapping outcomes, and the board reads them back as exact counts and fractions. On goal setups nothing
 * is revealed until Check passes; on compare setups the verdict waits for the Compare switch.
 * Design and reasoning: decision 0011.
 */
export default function EventSpace({ setup: setupId }: EventSpaceProps) {
  const setup = getSetup(setupId);
  const scenario = SCENARIOS[setup.scenario];
  const [state, dispatch] = useReducer(reducer, setupId, initialState);
  const [announcement, announce] = useAnnouncer();
  const statusId = useId();
  const lockedReasonId = useId();
  const shrinkReasonId = useId();
  const compareNoteId = useId();
  const lastAction = useRef<Action | null>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  const send = useCallback((action: Action) => {
    lastAction.current = action;
    dispatch(action);
  }, []);

  // Announce when an interaction ends: at once for buttons, after a pause for a burst of cell toggles.
  useEffect(() => {
    const action = lastAction.current;
    if (!action) return;
    const burst = action.type === "toggle" || (action.type === "pour" && !state.refusal);
    announce(announcementFor(state, action), burst ? KEYBOARD_COMMIT_DELAY_MS : 0);
    // Check and "Show the answer" disappear once the answer is in, so keyboard focus moves to the feedback.
    if ((action.type === "check" || action.type === "show-answer") && state.checked) feedbackRef.current?.focus();
  }, [state, announce]);

  const locked = isLocked(state);
  const feedback = feedbackLine(state);
  const marked = markedLine(state);
  const readouts = readoutLines(state);
  const eventKeys = (Object.keys(setup.events) as EventKey[]).filter((key) => setup.events[key]);
  const editableKeys = eventKeys.filter((key) => setup.events[key]?.editable);
  const presetKeys = eventKeys.filter((key) => (setup.events[key]?.presets.length ?? 0) > 0);
  const shrinkRefusal = canShrink(setup) ? shrinkBlocked(state) : null;
  const comparison = compareLines(state);
  const weighsInCompare = setup.mode === "compare" && Boolean(setup.weightPresets);
  const tosses = tossLine(state);
  const sets = setsLine(state);
  const showWrongModel = state.wrongModel && Boolean(scenario.wrongModel);
  /** Refused until Check passes on a goal setup: the button stays pressable, and a press only says why. */
  const lockedRefusalId = locked ? lockedReasonId : null;
  const unlessLocked = (onPress: () => void) => (locked ? announce(`${LOCKED_REASON}.`) : onPress());

  const tray = (
    <>
      {setup.goal && (
        <CheckButtons
          progress={state}
          checkLabel="Check"
          showAnswerLabel="Show the answer"
          onCheck={() => send({ type: "check" })}
          onShowAnswer={() => send({ type: "show-answer" })}
        />
      )}
      <StageChoice
        legend="Show as"
        options={STAGE_OPTIONS}
        isAllowed={(stage) => stageAllowed(state, stage)}
        value={state.stage}
        onChange={(stage) => send({ type: "stage", stage })}
      />
      {editableKeys.length > 1 && (
        <TrayChoice
          legend="Editing"
          options={editableKeys.map((key) => ({ value: key, label: key }))}
          value={state.editing}
          onChange={(event) => send({ type: "edit", event })}
        />
      )}
      {setup.lookAt && <TrayChoice legend="Look at" options={LOOK_AT_OPTIONS} value={state.lookAt} onChange={(lookAt) => send({ type: "look", lookAt })} />}
      {presetKeys.map((key) => (
        <div key={key}>
          <PresetButtons
            label={`Presets for event ${key}`}
            caption={key}
            presets={(setup.events[key]?.presets ?? []).map((preset) => ({ id: preset, label: presetLabel(scenario, preset) }))}
            refusalId={lockedRefusalId}
            onPick={(preset) => unlessLocked(() => send({ type: "preset", event: key, preset }))}
          />
        </div>
      ))}
      {weighsInCompare && (
        <TrayChoice
          legend="Die"
          options={Object.keys(setup.weightPresets ?? {}).map((name) => ({ value: name, label: name }))}
          value={activeWeightPreset(state)}
          onChange={(name) => send({ type: "weight-preset", name })}
        />
      )}
      {setup.mode === "compare" && (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={state.compare}
            aria-describedby={state.compare ? undefined : compareNoteId}
            className="ms-board-button ms-board-switch"
            onClick={() => send({ type: "compare", on: !state.compare })}
          >
            {COMPARE_LABEL}
          </button>
          {!state.compare && (
            <p id={compareNoteId} className="ms-event-compare-note">
              {COMPARE_COVERED_NOTE}
            </p>
          )}
        </>
      )}
      {canShrink(setup) && (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={state.shrink}
            {...refusedBy(shrinkRefusal ? shrinkReasonId : null)}
            className="ms-board-button ms-board-switch"
            onClick={() => send({ type: "shrink", on: !state.shrink })}
          >
            Shrink the world to B
          </button>
          {shrinkRefusal && <RefusalNote id={shrinkReasonId}>{shrinkRefusalText(shrinkRefusal)}</RefusalNote>}
        </>
      )}
      {setup.toss && (
        <button
          type="button"
          className="ms-board-button"
          {...refusedBy(lockedRefusalId)}
          onClick={() => unlessLocked(() => send({ type: "toss", results: simulate(scenario.outcomes, TOSS_BATCH, Math.random) }))}
        >
          Toss {TOSS_BATCH}
        </button>
      )}
      {setup.wrongModel && scenario.wrongModel && (
        <button
          type="button"
          role="switch"
          aria-checked={state.wrongModel}
          className="ms-board-button ms-board-switch"
          {...refusedBy(lockedRefusalId)}
          onClick={() => unlessLocked(() => send({ type: "wrong-model", on: !state.wrongModel }))}
        >
          {scenario.wrongModel.switchLabel}
        </button>
      )}
      {locked && <RefusalNote id={lockedReasonId}>{LOCKED_REASON}: presets and readouts unlock when your answer is right.</RefusalNote>}
      {setup.mode === "weights" && (
        <>
          <p className="ms-board-readout">{jugLine(state)}</p>
          <PresetButtons
            label="Fill the cups"
            caption="Fill"
            presets={Object.keys(setup.weightPresets ?? {}).map((name) => ({ id: name, label: name }))}
            onPick={(name) => send({ type: "weight-preset", name })}
          />
          <div className="ms-event-readouts">
            <p className="ms-board-readout">{totalLine(state)}</p>
            <p className="ms-board-readout">{additivityLine(state)}</p>
          </div>
          <p className="ms-event-note-line">{CUPS_NOTE}</p>
        </>
      )}
      {(readouts.length > 0 || tosses) && (
        <div className="ms-event-readouts">
          {[...readouts, ...(tosses ? [tosses] : [])].map((line) => (
            <p key={line} className="ms-board-readout">
              {line}
            </p>
          ))}
          {comparison && (
            <div className="ms-event-compare">
              {comparison.map((line) => (
                <p key={line} className="ms-board-readout">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <Board label={setup.label} tray={tray} onReset={() => send({ type: "reset" })} announcement={announcement}>
      <div className="ms-event">
        <p id={statusId} className="ms-event-status">
          {statusLine(state)}
        </p>
        {setup.mode === "weights" ? (
          <CupRow state={state} scenario={scenario} send={send} />
        ) : (
          <>
            {showWrongModel ? (
              <WrongModelTiles state={state} scenario={scenario} />
            ) : (
              <OutcomeGrid
                state={state}
                scenario={scenario}
                describedBy={statusId}
                editable={Boolean(setup.events[state.editing]?.editable)}
                onToggle={(id) => send({ type: "toggle", id })}
              />
            )}
          </>
        )}
        {sets && <p className="ms-event-sets">{sets}</p>}
        {marked && <p className="ms-event-status">{marked}</p>}
        {feedback && (
          <p ref={feedbackRef} className="ms-event-feedback" tabIndex={-1}>
            {feedback}
          </p>
        )}
      </div>
    </Board>
  );
}
