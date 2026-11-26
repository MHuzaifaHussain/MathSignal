import { useCallback, useEffect, useId, useLayoutEffect, useReducer, useRef } from "react";
import Board, { type InteractionSource } from "./Board";
import ChalkNote from "./ChalkNote";
import TrayChoice from "./TrayChoice";
import TraySlider from "./TraySlider";
import CheckButtons from "./guided/CheckButtons.tsx";
import PresetButtons from "./guided/PresetButtons.tsx";
import { RefusalNote } from "./guided/refusal.tsx";
import SpokenText from "./guided/SpokenText.tsx";
import StageChoice from "./guided/StageChoice.tsx";
import TableFold from "./guided/TableFold.tsx";
import useAnnouncer from "./guided/useAnnouncer.ts";
import useCommittedSlider from "./guided/useCommittedSlider.ts";
import CurvePlane from "./functionCurve/CurvePlane.tsx";
import CurveTables from "./functionCurve/CurveTables.tsx";
import SlopeStrip from "./functionCurve/SlopeStrip.tsx";
import {
  CHOICE_OPTIONS,
  CONTROL_LABELS,
  STAGE_LABELS,
  announcementFor,
  boardLabel,
  chalkNote,
  checkRefusal,
  choiceLegend,
  feedbackLine,
  guessDescription,
  guessFormat,
  guessLabel,
  hDescription,
  hFormat,
  hNote,
  lineSlopeDescription,
  lineSlopeFormat,
  noticeLine,
  pointDescription,
  pointFormat,
  pointLabel,
  presetsFor,
  readoutLines,
  statusLine,
} from "./functionCurve/describe.ts";
import { getSetup, viewOf, type SetupId, type Stage } from "./functionCurve/setups.ts";
import {
  activePresetOf,
  allowedHIndices,
  covered,
  hPosition,
  hasCornerLines,
  initialState,
  lineSlopesOf,
  reducer,
  stageAllowed,
  type Action,
  type CurveState,
  type SliderKey,
} from "./functionCurve/state.ts";
import useSquarePlane from "./vectorBoard/useSquarePlane.ts";

const STAGE_OPTIONS: readonly { value: Stage; label: string }[] = (["slide", "ruler", "tangent", "slope-curve"] as const).map((value) => ({ value, label: STAGE_LABELS[value] }));

/**
 * The action a slider's value stands for, so a move and its commit go through the same reducer. `continues` marks a
 * point move that follows another before the commit, so a notice the burst raised survives until it is announced.
 */
function sliderAction(state: CurveState, key: SliderKey, value: number, continues = false): Action {
  switch (key) {
    case "guess":
      return { type: "guess", index: value };
    case "h":
      return { type: "h", index: allowedHIndices(state)[value] };
    case "point":
      return { type: "point", xIndex: value, continues };
    case "line-slope":
      return { type: "line-slope", index: value };
  }
}

/** True while the board still shows the value the slider committed. */
function sliderHolds(state: CurveState, key: SliderKey, value: number): boolean {
  switch (key) {
    case "guess":
      return state.guessIndex === value;
    case "h":
      return hPosition(state) === value;
    case "point":
      return state.xIndex === value;
    case "line-slope":
      return state.lineSlopeIndex === value;
  }
}

interface FunctionCurveProps {
  /** Which configuration to show; see src/components/react/functionCurve/setups.ts. */
  setup: SetupId;
}

/**
 * The slope of a one-input curve: a ruler (a secant) from a point on the curve, shortened on both sides until its
 * slope settles on the tangent's, and a corner where the two sides never agree. Every number is exact. Each setup
 * holds its answer until the reader commits with Check. Design and reasoning: decision 0020.
 */
export default function FunctionCurve({ setup: setupId }: FunctionCurveProps) {
  const setup = getSetup(setupId);
  const [state, dispatch] = useReducer(reducer, setupId, initialState);
  const [announcement, announce] = useAnnouncer();
  const checkReasonId = useId();
  const lastAction = useRef<Action | null>(null);
  /** The point interaction not yet announced: a Point slider burst or a drag of the handle. */
  const pointInteraction = useRef<"slider" | "drag" | null>(null);
  const sliderGuard = useCommittedSlider<SliderKey>();
  const stateRef = useRef(state);
  // A layout effect, so a commit that ends a drag reads the state of the drag's last move.
  useLayoutEffect(() => {
    stateRef.current = state;
  });
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const planeSize = useSquarePlane(planeRef);

  const send = useCallback(
    (action: Action) => {
      sliderGuard.interrupt();
      pointInteraction.current = null;
      lastAction.current = action;
      dispatch(action);
    },
    [sliderGuard],
  );

  // The ref moves with each slider change, so a commit that follows at once compares against the value just set.
  const moveSlider = useCallback(
    (key: SliderKey, value: number) => {
      lastAction.current = null;
      sliderGuard.moved(key);
      const continues = key === "point" && pointInteraction.current === "slider";
      pointInteraction.current = key === "point" ? "slider" : null;
      const action = sliderAction(stateRef.current, key, value, continues);
      stateRef.current = reducer(stateRef.current, action);
      dispatch(action);
    },
    [sliderGuard],
  );

  const commitSlider = useCallback(
    (key: SliderKey, value: number) => {
      const current = stateRef.current;
      if (key === "point") pointInteraction.current = null;
      if (!sliderGuard.take(key, sliderHolds(current, key, value))) return;
      const said = announcementFor(current, sliderAction(current, key, value));
      if (said) announce(said);
    },
    [announce, sliderGuard],
  );

  /** A drag of the point updates silently; the board speaks once the drag ends. */
  const movePoint = useCallback(
    (xIndex: number) => {
      sliderGuard.interrupt();
      lastAction.current = null;
      const continues = pointInteraction.current === "drag";
      pointInteraction.current = "drag";
      dispatch({ type: "point", xIndex, continues });
    },
    [sliderGuard],
  );

  const handleInteractionEnd = useCallback(
    (source: InteractionSource) => {
      if (source !== "pointer" || pointInteraction.current !== "drag") return;
      pointInteraction.current = null;
      const current = stateRef.current;
      const said = announcementFor(current, { type: "point", xIndex: current.xIndex });
      if (said) announce(said);
    },
    [announce],
  );

  // Buttons, radios and switches speak at once.
  useEffect(() => {
    const action = lastAction.current;
    if (!action) return;
    const said = announcementFor(state, action);
    if (said) announce(said);
    // Check and "Show the answer" disappear once they've answered, so keyboard focus moves to the verdict.
    if ((action.type === "check" || action.type === "show-answer") && state.checked) feedbackRef.current?.focus();
  }, [state, announce]);

  const pressCheck = () => {
    // The first refused press sets `refused`, and the effect speaks the reason. A repeat changes no state, so no effect
    // runs: the reason is spoken from here, and only then, so each press says it exactly once.
    const current = stateRef.current;
    const reason = checkRefusal(current);
    if (reason && current.refused) announce(reason);
    send({ type: "check" });
  };

  const isCovered = covered(state);
  const status = statusLine(state);
  const verdict = feedbackLine(state);
  const checkReason = checkRefusal(state);
  const note = chalkNote(state);
  const notice = noticeLine(state);
  const presets = presetsFor(state);
  const hIndices = allowedHIndices(state);
  const curveView = viewOf(state.preset);
  const describeH = hDescription(state);
  const describePoint = pointDescription(state);

  const tray = (
    <>
      {/* The answer controls come before Check, so a keyboard reader sets the answer and then tabs on to Check. */}
      {setup.guess && isCovered && (
        <TraySlider
          label={guessLabel(state)}
          value={state.guessIndex}
          min={0}
          max={setup.guess.maxIndex}
          step={1}
          onValueChange={(value) => moveSlider("guess", value)}
          onValueCommitted={(value) => commitSlider("guess", value)}
          format={guessFormat}
          describe={guessDescription}
        />
      )}
      {!isCovered && (
        <TraySlider
          label={pointLabel(state)}
          value={state.xIndex}
          min={curveView.xIndexRange[0]}
          max={curveView.xIndexRange[1]}
          step={1}
          onValueChange={(value) => moveSlider("point", value)}
          onValueCommitted={(value) => commitSlider("point", value)}
          format={pointFormat}
          describe={describePoint}
        />
      )}
      <TraySlider
        label={CONTROL_LABELS.h}
        value={hPosition(state)}
        min={0}
        max={hIndices.length - 1}
        step={1}
        largeStep={1}
        onValueChange={(value) => moveSlider("h", value)}
        onValueCommitted={(value) => commitSlider("h", value)}
        format={hFormat(state)}
        describe={describeH}
      />
      <p className="ms-fncurve-note">
        <SpokenText line={hNote(state)} />
      </p>
      {setup.choices && isCovered && (
        <TrayChoice legend={choiceLegend(state)} options={CHOICE_OPTIONS} value={state.choice} onChange={(choice) => send({ type: "choice", choice })} />
      )}
      <StageChoice legend={CONTROL_LABELS.showAs} options={STAGE_OPTIONS} isAllowed={(stage) => stageAllowed(state, stage)} value={state.stage} onChange={(stage) => send({ type: "stage", stage })} />
      <CheckButtons
        progress={state}
        checkLabel={CONTROL_LABELS.check}
        showAnswerLabel={CONTROL_LABELS.showAnswer}
        checkRefusalId={checkReason ? checkReasonId : null}
        onCheck={pressCheck}
        onShowAnswer={() => send({ type: "show-answer" })}
      />
      {checkReason && <RefusalNote id={checkReasonId}>{checkReason}</RefusalNote>}
      {presets.length > 0 && (
        <PresetButtons label={CONTROL_LABELS.presets} caption={CONTROL_LABELS.presetsCaption} presets={presets} activeId={activePresetOf(state)} onPick={(id) => send({ type: "preset", id: id as CurveState["preset"] })} />
      )}
      {!isCovered && hasCornerLines(state.preset) && (
        <button type="button" role="switch" aria-checked={state.linesOn} className="ms-board-button ms-board-switch" onClick={() => send({ type: "lines", on: !state.linesOn })}>
          {CONTROL_LABELS.lines}
        </button>
      )}
      {state.linesOn && (
        <TraySlider
          label={CONTROL_LABELS.lineSlope}
          value={state.lineSlopeIndex}
          min={0}
          max={lineSlopesOf(state.preset).length - 1}
          step={1}
          largeStep={1}
          onValueChange={(value) => moveSlider("line-slope", value)}
          onValueCommitted={(value) => commitSlider("line-slope", value)}
          format={lineSlopeFormat(state)}
          describe={lineSlopeDescription(state)}
        />
      )}
      <TableFold open={state.tableOpen} onToggle={(open) => send({ type: "table", open })}>
        <CurveTables state={state} />
      </TableFold>
    </>
  );

  return (
    <Board label={boardLabel(state).spoken} tray={tray} onReset={() => send({ type: "reset" })} announcement={announcement} onInteractionEnd={handleInteractionEnd}>
      <div className="ms-fncurve">
        {status && (
          <p className="ms-fncurve-status">
            <SpokenText line={status} />
          </p>
        )}
        {verdict && (
          <p ref={feedbackRef} className="ms-fncurve-feedback" tabIndex={-1}>
            <SpokenText line={verdict} />
          </p>
        )}
        {note && <ChalkNote long={note.long} short={note.short} />}
        <div ref={planeRef} className="ms-fncurve-plane">
          <CurvePlane state={state} size={planeSize} onMovePoint={movePoint} />
        </div>
        {state.stage === "slope-curve" && !isCovered && (
          <div className="ms-fncurve-strip">
            <SlopeStrip state={state} width={planeSize} />
          </div>
        )}
        <div className="ms-fncurve-readouts">
          {readoutLines(state).map((line) => (
            <p key={line.visible} className="ms-board-readout">
              <SpokenText line={line} />
            </p>
          ))}
          {notice && (
            <p className="ms-board-readout">
              <SpokenText line={notice} />
            </p>
          )}
        </div>
      </div>
    </Board>
  );
}
