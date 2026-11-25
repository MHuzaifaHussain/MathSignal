import { useCallback, useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import Board, { type InteractionSource } from "./Board";
import ChalkNote from "./ChalkNote";
import TrayChoice from "./TrayChoice";
import TraySlider from "./TraySlider";
import { KEYBOARD_COMMIT_DELAY_MS } from "./boardTiming";
import CheckButtons from "./guided/CheckButtons.tsx";
import PresetButtons from "./guided/PresetButtons.tsx";
import { RefusalNote } from "./guided/refusal.tsx";
import StageChoice from "./guided/StageChoice.tsx";
import TableFold from "./guided/TableFold.tsx";
import useAnnouncer from "./guided/useAnnouncer.ts";
import useCommittedSlider from "./guided/useCommittedSlider.ts";
import ColumnVector from "./vectorBoard/ColumnVector.tsx";
import CoordinateTable from "./vectorBoard/CoordinateTable.tsx";
import VectorPlane from "./vectorBoard/VectorPlane.tsx";
import VectorSteppers from "./vectorBoard/VectorSteppers.tsx";
import {
  CONTROL_LABELS,
  SIGN_OPTIONS,
  SPAN_OPTIONS,
  STAGE_LABELS,
  WEIGHT_LABELS,
  announcementFor,
  boardLabel,
  chalkNote,
  checkRefusal,
  columnVectors,
  feedbackLine,
  handleAnnouncement,
  handlesFor,
  listsLine,
  presetsFor,
  readoutLines,
  scalarFormat,
  statusLine,
  weightDescription,
  type TableRow,
} from "./vectorBoard/describe.ts";
import type { Vec2 } from "./vectorBoard/model.ts";
import { getSetup, type SetupId, type Stage } from "./vectorBoard/setups.ts";
import { handleIds, initialState, reducer, sliderWeights, stageAllowed, weightValue, type Action, type HandleId, type Weight } from "./vectorBoard/state.ts";
import useSquarePlane from "./vectorBoard/useSquarePlane.ts";

const STAGE_OPTIONS: readonly { value: Stage; label: string }[] = (["trips", "arrows", "lists"] as const).map((value) => ({ value, label: STAGE_LABELS[value] }));
const WEIGHT_DESCRIPTIONS: Readonly<Record<Weight, (value: number) => string>> = { c: weightDescription("c"), d: weightDescription("d") };

/** The handle with keyboard focus, or null. Mafs renders the handles in the order of `ids`. */
function focusedHandle(plane: HTMLElement | null, ids: readonly HandleId[]): HandleId | null {
  const points = Array.from(plane?.querySelectorAll(".mafs-movable-point") ?? []);
  const index = points.findIndex((point) => point === document.activeElement);
  return index >= 0 ? (ids[index] ?? null) : null;
}

interface VectorBoard2DProps {
  /** Which configuration to show; see src/components/react/vectorBoard/setups.ts. */
  setup: SetupId;
}

/**
 * Vectors on a whole-number grid: two trips and their sum, a vector and its multiples, a push and its part along a
 * track, the dot product of two arrows, and linear combinations c a + d b with their span. Every setup holds its
 * answer until the reader commits with Check.
 * Every handle also moves with the − / + buttons under the plane; the coordinate table folds behind Table view.
 * Design and reasoning: decisions 0014 and 0017.
 */
export default function VectorBoard2D({ setup: setupId }: VectorBoard2DProps) {
  const setup = getSetup(setupId);
  const [state, dispatch] = useReducer(reducer, setupId, initialState);
  const [announcement, announce] = useAnnouncer();
  const [linkedId, setLinkedId] = useState<TableRow["id"] | null>(null);
  const checkReasonId = useId();
  const lastAction = useRef<Action | null>(null);
  /** The handle moved since the last interaction ended; a press elsewhere in the board leaves it null. */
  const movedHandle = useRef<HandleId | null>(null);
  /** A late commit from one weight slider never talks over the other slider, a button or a handle moved since. */
  const sliderGuard = useCommittedSlider<Weight>();
  const stateRef = useRef(state);
  // A layout effect, so a commit that ends a drag (pointerup) reads the state of the drag's last move, whose passive
  // effects may still be pending.
  useLayoutEffect(() => {
    stateRef.current = state;
  });
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const planeSize = useSquarePlane(planeRef);

  const send = useCallback(
    (action: Action) => {
      sliderGuard.interrupt();
      lastAction.current = action;
      dispatch(action);
    },
    [sliderGuard],
  );

  /** Mafs drags and arrow keys update silently; the board speaks once the interaction ends. */
  const moveHandle = useCallback(
    (id: HandleId, to: Vec2) => {
      sliderGuard.interrupt();
      lastAction.current = null;
      movedHandle.current = id;
      dispatch({ type: "move", id, to });
    },
    [sliderGuard],
  );

  // The ref moves with each slider change, so a commit that follows at once compares against the value just set.
  const moveScalar = useCallback(
    (weight: Weight, value: number) => {
      lastAction.current = null;
      sliderGuard.moved(weight);
      const action: Action = { type: "scalar", weight, value };
      stateRef.current = reducer(stateRef.current, action);
      dispatch(action);
    },
    [sliderGuard],
  );

  const commitScalar = useCallback(
    (weight: Weight, value: number) => {
      const current = stateRef.current;
      if (!sliderGuard.take(weight, weightValue(current, weight) === value)) return;
      announce(announcementFor(current, { type: "scalar", weight, value }));
    },
    [announce, sliderGuard],
  );

  // A handle that sits at an edge doesn't move on an arrow press, so Mafs calls no onMove; the focused handle
  // still gets its sentence ("a is at the right edge of the board."). A pointer speaks only for the handle it
  // moved, so a plain click on a handle stays quiet.
  const handleInteractionEnd = useCallback(
    (source: InteractionSource) => {
      const current = stateRef.current;
      const ids = handleIds(current);
      const id = source === "keyboard" ? focusedHandle(planeRef.current, ids) : movedHandle.current;
      movedHandle.current = null;
      if (id && ids.includes(id)) announce(handleAnnouncement(current, id));
    },
    [announce],
  );

  // Announce when a button or stepper interaction ends: at once for buttons, after a pause for a burst of presses.
  useEffect(() => {
    const action = lastAction.current;
    if (!action) return;
    const burst = action.type === "step" && !state.refusal;
    announce(announcementFor(state, action), burst ? KEYBOARD_COMMIT_DELAY_MS : 0);
    // Check and "Show the answer" disappear once they've answered, so keyboard focus moves to the verdict.
    if ((action.type === "check" || action.type === "show-answer") && state.checked) feedbackRef.current?.focus();
  }, [state, announce]);

  const verdict = feedbackLine(state);
  const checkReason = checkRefusal(state);
  const note = chalkNote(state);
  const columns = columnVectors(state);
  const lists = listsLine(state);
  const presets = presetsFor(state);
  const range = setup.scaleRange;

  const tray = (
    <>
      {/* The answer controls come before Check, so a keyboard reader sets the answer and then tabs on to Check. */}
      {setup.kind === "align" && !state.checked && (
        <TrayChoice legend={CONTROL_LABELS.signLegend} options={SIGN_OPTIONS} value={state.signGuess} onChange={(sign) => send({ type: "sign", sign })} />
      )}
      {/* The one-shot span guess leaves once Check has answered it, as the sign guess does. */}
      {setup.kind === "span-choice" && !state.checked && (
        <TrayChoice legend={CONTROL_LABELS.spanLegend} options={SPAN_OPTIONS} value={state.spanGuess} onChange={(guess) => send({ type: "span-guess", guess })} />
      )}
      {range &&
        sliderWeights(setup).map((weight) => (
          <TraySlider
            key={weight}
            label={WEIGHT_LABELS[weight]}
            value={weightValue(state, weight)}
            min={range.min}
            max={range.max}
            step={range.step}
            onValueChange={(value) => moveScalar(weight, value)}
            onValueCommitted={(value) => commitScalar(weight, value)}
            format={scalarFormat}
            describe={WEIGHT_DESCRIPTIONS[weight]}
          />
        ))}
      <CheckButtons
        progress={state}
        checkLabel={CONTROL_LABELS.check}
        showAnswerLabel={CONTROL_LABELS.showAnswer}
        checkRefusalId={checkReason ? checkReasonId : null}
        onCheck={() => send({ type: "check" })}
        onShowAnswer={() => send({ type: "show-answer" })}
      />
      {checkReason && <RefusalNote id={checkReasonId}>{checkReason}</RefusalNote>}
      <StageChoice
        legend={CONTROL_LABELS.showAs}
        options={STAGE_OPTIONS}
        isAllowed={(stage) => stageAllowed(state, stage)}
        value={state.stage}
        onChange={(stage) => send({ type: "stage", stage })}
      />
      {setup.kind === "add" && state.checked && (
        <button
          type="button"
          role="switch"
          aria-checked={state.otherOrder}
          className="ms-board-button ms-board-switch"
          onClick={() => send({ type: "other-order", on: !state.otherOrder })}
        >
          {CONTROL_LABELS.otherOrder}
        </button>
      )}
      {presets.length > 0 && (
        <PresetButtons
          label={CONTROL_LABELS.presets}
          caption={CONTROL_LABELS.presetsCaption}
          presets={presets}
          activeId={state.activePreset}
          onPick={(id) => send({ type: "preset", id })}
        />
      )}
      <TableFold open={state.tableOpen} onToggle={(open) => send({ type: "table", open })}>
        <CoordinateTable state={state} linkedId={linkedId} onLink={setLinkedId} />
      </TableFold>
    </>
  );

  return (
    <Board
      label={boardLabel(state)}
      tray={tray}
      onReset={() => send({ type: "reset" })}
      announcement={announcement}
      onInteractionEnd={handleInteractionEnd}
      handleLabels={handlesFor(state).map((handle) => handle.label)}
    >
      <div className="ms-vec">
        <p className="ms-vec-status">
          {statusLine(state)}
        </p>
        <div className="ms-vec-body">
          <div ref={planeRef} className="ms-vec-plane">
            <VectorPlane state={state} linkedId={linkedId} size={planeSize} onMove={moveHandle} />
            {note && <ChalkNote long={note.long} short={note.short} />}
          </div>
          <div className="ms-vec-side">
            <div className="ms-vec-readouts">
              {readoutLines(state).map((line) => (
                <p key={line} className="ms-board-readout">
                  {line}
                </p>
              ))}
            </div>
            {columns.length > 0 && (
              <div className="ms-vec-lists">
                <div className="ms-vec-columns">
                  {columns.map((column) => (
                    <ColumnVector key={column.name} {...column} />
                  ))}
                </div>
                {lists && <p className="ms-board-readout">{lists}</p>}
              </div>
            )}
            <VectorSteppers state={state} linkedId={linkedId} onLink={setLinkedId} send={send} />
          </div>
        </div>
        {verdict && (
          <p ref={feedbackRef} className="ms-vec-feedback" tabIndex={-1}>
            {verdict}
          </p>
        )}
      </div>
    </Board>
  );
}
