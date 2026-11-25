import { useCallback, useEffect, useId, useLayoutEffect, useReducer, useRef } from "react";
import { Coordinates, Mafs, MovablePoint, Plot, Polygon, Text } from "mafs";
import type { vec } from "mafs";
import Board from "../Board";
import ChalkNote from "../ChalkNote";
import TrayChoice from "../TrayChoice";
import TraySlider from "../TraySlider";
import { toNumber } from "../boardMath.ts";
import CheckButtons from "../guided/CheckButtons.tsx";
import PresetButtons from "../guided/PresetButtons.tsx";
import { RefusalNote } from "../guided/refusal.tsx";
import SpokenText from "../guided/SpokenText.tsx";
import TableFold from "../guided/TableFold.tsx";
import useAnnouncer from "../guided/useAnnouncer.ts";
import useCommittedSlider from "../guided/useCommittedSlider.ts";
import { Segment } from "../planeLines";
import { plotColors } from "../plotColors";
import ZTable from "./ZTable.tsx";
import {
  BOARD_LABEL,
  CONTROL_LABELS,
  announcementFor,
  chalkNote,
  checkRefusal,
  readoutLines,
  sliderDescribe,
  sliderFormat,
  sliderLabel,
  tableCaption,
  tableRows,
  verdictLine,
} from "./describe.ts";
import {
  MU_LABEL_AT,
  ROW_CAPTION_X,
  RULER_LABEL_SIZE,
  SIGMA_LABEL_AT,
  UNIT_ROW_Y,
  Z_BOARD_HEIGHT,
  Z_ROW_Y,
  Z_VIEW_X,
  Z_VIEW_Y,
  indexFromDragX,
  indexFromSlider,
  maxIndex,
  rulerTicks,
  shadePolygon,
  standardNormalDensity,
  valueAt,
  zAt,
} from "./model.ts";
import { getZPreset, type ZPresetId, type ZSetupId } from "./setups.ts";
import { activePresetId, allowedPresets, initialState, presetOf, revealed, setupOf, zReducer, type ZAction } from "./state.ts";

/** How many steps Page Up and Page Down move: 5 cm, or 0.25 on the standard preset. */
const LARGE_STEP_COUNT = 5;
const PEAK = standardNormalDensity(0);
/** The σ span sits at the inflection height, as on the bell. */
const INFLECTION = standardNormalDensity(1);

/**
 * NormalDistribution's z mode (decision 0019): the standard normal curve on a fixed z-unit view over a ruler in the
 * group's units. The reader says who is taller for their age and presses Check; only then do the z ruler, the
 * z-scores, Shade and the other presets appear, because on a fixed z view the marker's position is the answer.
 * Wiring only: the rules are in state.ts and every sentence in describe.ts.
 */
export default function ZBoard({ setup: setupId }: { setup: ZSetupId }) {
  const [state, dispatch] = useReducer(zReducer, setupId, initialState);
  const [announcement, announce] = useAnnouncer();
  const sliderGuard = useCommittedSlider<"value">();
  const checkReasonId = useId();
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });
  const verdictRef = useRef<HTMLParagraphElement>(null);
  const focusVerdict = useRef(false);
  /** True while a drag on the canvas has moved the value since the last interaction ended. */
  const dragged = useRef(false);

  /** Buttons, radios and switches: the reducer's next state decides what to say, at once. */
  const send = useCallback(
    (action: ZAction) => {
      sliderGuard.interrupt();
      dragged.current = false;
      const previous = stateRef.current;
      const next = zReducer(previous, action);
      stateRef.current = next;
      dispatch(action);
      const text = announcementFor(previous, next, action);
      if (text) announce(text);
      if (action.type === "check" && revealed(next) && !revealed(previous)) focusVerdict.current = true;
    },
    [announce, sliderGuard],
  );

  // Check disappears once it has answered, so focus moves to the verdict, which is read there.
  useEffect(() => {
    if (!focusVerdict.current) return;
    focusVerdict.current = false;
    verdictRef.current?.focus();
  }, [state]);

  const sayValue = useCallback(() => {
    const current = stateRef.current;
    const text = announcementFor(current, current, { type: "value", index: current.index });
    if (text) announce(text);
  }, [announce]);

  // stateRef moves with the action, as in `send`, so a commit that arrives before this change renders compares
  // against the value the slider just set, not a stale one, and never goes silent.
  const slide = useCallback(
    (value: number) => {
      dragged.current = false;
      sliderGuard.moved("value");
      const action: ZAction = { type: "value", index: indexFromSlider(presetOf(stateRef.current), value) };
      stateRef.current = zReducer(stateRef.current, action);
      dispatch(action);
    },
    [sliderGuard],
  );

  const commitSlide = useCallback(
    (value: number) => {
      const current = stateRef.current;
      if (!sliderGuard.take("value", indexFromSlider(presetOf(current), value) === current.index)) return;
      sayValue();
    },
    [sayValue, sliderGuard],
  );

  const constrainHandle = useCallback(([x]: vec.Vector2): vec.Vector2 => {
    const preset = presetOf(stateRef.current);
    return [toNumber(zAt(preset, indexFromDragX(preset, x))), 0];
  }, []);

  const dragHandle = useCallback(
    ([x]: vec.Vector2) => {
      sliderGuard.interrupt();
      dragged.current = true;
      dispatch({ type: "value", index: indexFromDragX(presetOf(stateRef.current), x) });
    },
    [sliderGuard],
  );

  const endInteraction = useCallback(() => {
    if (!dragged.current) return;
    dragged.current = false;
    sayValue();
  }, [sayValue]);

  const preset = presetOf(state);
  const setup = setupOf(state);
  const shown = revealed(state);
  const z = toNumber(zAt(preset, state.index));
  const stepSize = toNumber(preset.step);
  const reach = maxIndex(preset) * stepSize;
  const presets = allowedPresets(state).map((id) => ({ id, label: getZPreset(id).label }));
  const verdict = verdictLine(state);
  const checkReason = checkRefusal(state);
  const note = chalkNote(state);

  const tray = (
    <>
      <div className="ms-normal-z-readouts">
        {readoutLines(state).map((line) => (
          <p key={line.visible} className="ms-board-readout">
            <SpokenText line={line} />
          </p>
        ))}
      </div>
      {presets.length >= 2 && (
        <PresetButtons
          label={CONTROL_LABELS.presets}
          caption={CONTROL_LABELS.presetsCaption}
          presets={presets}
          activeId={activePresetId(state)}
          onPick={(id) => send({ type: "preset", id: id as ZPresetId })}
        />
      )}
      <TraySlider
        label={sliderLabel(preset)}
        value={toNumber(valueAt(preset, state.index))}
        min={preset.mean - reach}
        max={preset.mean + reach}
        step={stepSize}
        largeStep={LARGE_STEP_COUNT * stepSize}
        onValueChange={slide}
        onValueCommitted={commitSlide}
        format={(value) => sliderFormat(preset, value)}
        describe={(value) => sliderDescribe(preset, value)}
      />
      {!shown && (
        <>
          <TrayChoice legend={setup.question.legend} options={setup.question.options} value={state.guess} onChange={(guess) => send({ type: "guess", guess })} />
          <CheckButtons
            progress={state}
            checkLabel={CONTROL_LABELS.check}
            showAnswerLabel={CONTROL_LABELS.showAnswer}
            checkRefusalId={checkReason ? checkReasonId : null}
            onCheck={() => send({ type: "check" })}
            onShowAnswer={() => undefined}
          />
          {checkReason && <RefusalNote id={checkReasonId}>{checkReason}</RefusalNote>}
        </>
      )}
      {verdict && (
        <p ref={verdictRef} className="ms-board-readout ms-normal-z-verdict" tabIndex={-1}>
          <SpokenText line={verdict} />
        </p>
      )}
      {shown && (
        <button
          type="button"
          role="switch"
          aria-checked={state.shading}
          className="ms-board-button ms-board-switch"
          onClick={() => send({ type: "shade", on: !state.shading })}
        >
          {CONTROL_LABELS.shade}
        </button>
      )}
      <TableFold open={state.tableOpen} onToggle={(open) => send({ type: "table", open })}>
        <ZTable caption={tableCaption(state)} rows={tableRows(state)} />
      </TableFold>
    </>
  );

  return (
    <Board label={BOARD_LABEL} tray={tray} onReset={() => send({ type: "reset" })} announcement={announcement} onInteractionEnd={endInteraction}>
      <div className="ms-normal-z" aria-hidden="true">
        {note && <ChalkNote long={note.long} short={note.short} />}
        <Mafs height={Z_BOARD_HEIGHT} viewBox={{ x: Z_VIEW_X, y: Z_VIEW_Y, padding: 0 }} preserveAspectRatio={false} pan={false} zoom={false}>
          <Coordinates.Cartesian xAxis={{ lines: 1, labels: false }} yAxis={false} />

          {shown && state.shading && <Polygon points={shadePolygon(z)} color={plotColors.ink} fillOpacity={0.2} strokeOpacity={0} />}
          <Plot.OfX y={standardNormalDensity} color={plotColors.ink} weight={2.5} />

          {/* μ: a dashed guide up to the peak, labeled above it. */}
          <Segment from={[0, 0]} to={[0, PEAK]} color={plotColors.mu} weight={1} lineStyle="dashed" />
          <Text x={MU_LABEL_AT[0]} y={MU_LABEL_AT[1]} size={16} color={plotColors.mu}>
            μ
          </Text>
          {/* σ: a solid span from the mean to the inflection point, labeled beside its right end. */}
          <Segment from={[0, INFLECTION]} to={[1, INFLECTION]} color={plotColors.sigma} weight={2} />
          <Text x={SIGMA_LABEL_AT[0]} y={SIGMA_LABEL_AT[1]} size={16} color={plotColors.sigma}>
            σ
          </Text>

          {/* The ruler in the group's units, nearest the axis; the z ruler under it once the reader has committed. */}
          {preset.unit && (
            <Text x={ROW_CAPTION_X} y={UNIT_ROW_Y} size={RULER_LABEL_SIZE} color={plotColors.ink}>
              {preset.unit}
            </Text>
          )}
          {shown && (
            <Text x={ROW_CAPTION_X} y={Z_ROW_Y} size={RULER_LABEL_SIZE} color={plotColors.inkMuted}>
              z
            </Text>
          )}
          {rulerTicks(preset).map((tick) => (
            <g key={tick.z}>
              {tick.unitLabel && (
                <Text x={tick.z} y={UNIT_ROW_Y} size={RULER_LABEL_SIZE} color={plotColors.ink}>
                  {tick.unitLabel}
                </Text>
              )}
              {shown && (
                <Text x={tick.z} y={Z_ROW_Y} size={RULER_LABEL_SIZE} color={plotColors.inkMuted}>
                  {tick.zLabel}
                </Text>
              )}
            </g>
          ))}

          {/* The value: the board's one ochre element, the marker and its handle. */}
          <Segment from={[z, 0]} to={[z, standardNormalDensity(z)]} color={plotColors.attention} weight={3} />
          <MovablePoint point={[z, 0]} constrain={constrainHandle} onMove={dragHandle} color={plotColors.attention} />
        </Mafs>
      </div>
    </Board>
  );
}
