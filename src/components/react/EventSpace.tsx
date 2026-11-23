import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import Board from "./Board";
import TrayChoice from "./TrayChoice";
import { KEYBOARD_COMMIT_DELAY_MS } from "./boardTiming";
import CupRow from "./eventSpace/CupRow.tsx";
import OutcomeGrid from "./eventSpace/OutcomeGrid.tsx";
import WrongModelTiles from "./eventSpace/WrongModelTiles.tsx";
import { simulate } from "./eventSpace/model.ts";
import { additivityLine, announcementFor, feedbackLine, jugLine, markedLine, presetLabel, readoutLines, statusLine, tossLine, totalLine } from "./eventSpace/describe.ts";
import { SCENARIOS } from "./eventSpace/scenarios.ts";
import { getSetup, type SetupId } from "./eventSpace/setups.ts";
import { CHECKS_BEFORE_ANSWER, initialState, isLocked, reducer, type Action, type EventKey, type LookAt } from "./eventSpace/state.ts";

const LOCKED_REASON = "Check your answer first";
/** Tosses per press of "Toss 100". */
const TOSS_BATCH = 100;
const CUPS_NOTE = "The cups are drawn the same size. The water in them is the probability, not the cup.";
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
 * A sample space as a table of equally likely outcomes. Readers build events by tapping outcomes, and the
 * board reads them back as exact counts and fractions. On goal setups nothing is revealed until Check passes.
 * Design: docs/superpowers/specs/2026-11-23-eventspace-design.md. Decision 0011.
 */
export default function EventSpace({ setup: setupId }: EventSpaceProps) {
  const setup = getSetup(setupId);
  const scenario = SCENARIOS[setup.scenario];
  const [state, dispatch] = useReducer(reducer, setupId, initialState);
  const [announcement, setAnnouncement] = useState("");
  const statusId = useId();
  const lockedReasonId = useId();
  const lastAction = useRef<Action | null>(null);
  const announceTimer = useRef<number | undefined>(undefined);

  const send = useCallback((action: Action) => {
    lastAction.current = action;
    dispatch(action);
  }, []);

  // Announce when an interaction ends: at once for buttons, after a pause for a burst of cell toggles.
  useEffect(() => {
    const action = lastAction.current;
    if (!action) return;
    const text = announcementFor(state, action);
    window.clearTimeout(announceTimer.current);
    const burst = action.type === "toggle" || (action.type === "pour" && !state.refusal);
    if (burst) announceTimer.current = window.setTimeout(() => setAnnouncement(text), KEYBOARD_COMMIT_DELAY_MS);
    else setAnnouncement(text);
  }, [state]);
  useEffect(() => () => window.clearTimeout(announceTimer.current), []);

  const locked = isLocked(state);
  const feedback = feedbackLine(state);
  const marked = markedLine(state);
  const readouts = readoutLines(state);
  const eventKeys = (Object.keys(setup.events) as EventKey[]).filter((key) => setup.events[key]);
  const tosses = tossLine(state);
  const showWrongModel = state.wrongModel && Boolean(scenario.wrongModel);
  /** A button that is shown but refused until Check passes on a goal setup. */
  const lockable = (onPress: () => void) => ({
    "aria-disabled": locked || undefined,
    "aria-describedby": locked ? lockedReasonId : undefined,
    onClick: () => (locked ? setAnnouncement(`${LOCKED_REASON}.`) : onPress()),
  });

  const presetButtons = (key: EventKey) => (
    <div className="ms-event-presets" role="group" aria-label={`Presets for event ${key}`}>
      <span className="ms-event-presets-label">{key}:</span>
      {setup.events[key]?.presets.map((preset) => (
        <button key={preset} type="button" className="ms-board-button" {...lockable(() => send({ type: "preset", event: key, preset }))}>
          {presetLabel(scenario, preset)}
        </button>
      ))}
    </div>
  );

  const tray = (
    <>
      {setup.goal && !state.checked && (
        <button type="button" className="ms-board-button ms-board-button-primary" onClick={() => send({ type: "check" })}>
          Check
        </button>
      )}
      {setup.goal && !state.checked && state.failedChecks >= CHECKS_BEFORE_ANSWER && (
        <button type="button" className="ms-board-button" onClick={() => send({ type: "show-answer" })}>
          Show the answer
        </button>
      )}
      {eventKeys.length > 1 && (
        <TrayChoice
          legend="Editing"
          options={eventKeys.map((key) => ({ value: key, label: key }))}
          value={state.editing}
          onChange={(event) => send({ type: "edit", event })}
        />
      )}
      {setup.lookAt && <TrayChoice legend="Look at" options={LOOK_AT_OPTIONS} value={state.lookAt} onChange={(lookAt) => send({ type: "look", lookAt })} />}
      {eventKeys.map((key) => (
        <div key={key}>{presetButtons(key)}</div>
      ))}
      {setup.toss && (
        <button type="button" className="ms-board-button" {...lockable(() => send({ type: "toss", results: simulate(scenario.outcomes, TOSS_BATCH, Math.random) }))}>
          Toss {TOSS_BATCH}
        </button>
      )}
      {setup.wrongModel && scenario.wrongModel && (
        <button
          type="button"
          role="switch"
          aria-checked={state.wrongModel}
          className="ms-board-button ms-board-switch"
          {...lockable(() => send({ type: "wrong-model", on: !state.wrongModel }))}
        >
          {scenario.wrongModel.switchLabel}
        </button>
      )}
      {locked && (
        <p id={lockedReasonId} className="ms-event-note-line">
          {LOCKED_REASON}: presets and readouts unlock when your answer is right.
        </p>
      )}
      {setup.mode === "weights" && (
        <>
          <p className="ms-board-readout">{jugLine(state)}</p>
          <div className="ms-event-presets" role="group" aria-label="Fill the cups">
            <span className="ms-event-presets-label">Fill:</span>
            {Object.keys(setup.weightPresets ?? {}).map((name) => (
              <button key={name} type="button" className="ms-board-button" onClick={() => send({ type: "weight-preset", name })}>
                {name}
              </button>
            ))}
          </div>
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
              <OutcomeGrid state={state} scenario={scenario} describedBy={statusId} onToggle={(id) => send({ type: "toggle", id })} />
            )}
          </>
        )}
        {marked && <p className="ms-event-status">{marked}</p>}
        {feedback && <p className="ms-event-feedback">{feedback}</p>}
      </div>
    </Board>
  );
}
