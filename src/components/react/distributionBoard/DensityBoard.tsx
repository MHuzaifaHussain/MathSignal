import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import Board from "../Board";
import TrayChoice from "../TrayChoice";
import TraySlider from "../TraySlider";
import PresetButtons from "../guided/PresetButtons.tsx";
import StageChoice from "../guided/StageChoice.tsx";
import TableFold from "../guided/TableFold.tsx";
import useAnnouncer from "../guided/useAnnouncer.ts";
import useCommittedSlider from "../guided/useCommittedSlider.ts";
import ColumnChart from "./ColumnChart.tsx";
import CurvePlot from "./CurvePlot.tsx";
import SpokenText from "./SpokenText.tsx";
import ValueTable from "./ValueTable.tsx";
import { densityChart } from "./densityChart.ts";
import {
  DENSITY_BOARD_LABELS,
  DENSITY_LABELS,
  STAGE_LABELS,
  binWidthOptions,
  densityAnnouncement,
  describeFrom,
  describeTo,
  formatQuarters,
  readoutLines,
  statusLine,
  tableOf,
} from "./densityDescribe.ts";
import { shapeOf, type BinsPerCm, type DensitySetupId, type DensityStage } from "./densitySetups.ts";
import { LAST_QUARTER, densityReducer, densitySetupOf, initialDensityState, sandOf, type DensityAction, type DensityState } from "./densityState.ts";

type SliderKey = "from" | "to";

/**
 * DistributionBoard's density mode (decision 0018): one bag of sand on a 4 cm ruler, as bars whose height is share ÷
 * width, or as the curve with a shaded stretch whose area is the chance. Wiring only: the rules are in
 * densityState.ts and every sentence in densityDescribe.ts.
 */
export default function DensityBoard({ setup: setupId }: { setup: DensitySetupId }) {
  const [state, dispatch] = useReducer(densityReducer, setupId, initialDensityState);
  const setup = densitySetupOf(state);
  const [announcement, announce] = useAnnouncer();
  const sliderGuard = useCommittedSlider<SliderKey>();
  const pending = useRef<{ previous: DensityState; action: DensityAction } | null>(null);
  /** The state before a slider started moving, so its commit can say whether the other end was pushed along. */
  const slideFrom = useRef<DensityState | null>(null);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const send = useCallback(
    (action: DensityAction) => {
      sliderGuard.interrupt();
      slideFrom.current = null;
      pending.current = { previous: stateRef.current, action };
      dispatch(action);
    },
    [sliderGuard],
  );

  const slide = useCallback(
    (key: SliderKey, quarters: number) => {
      pending.current = null;
      slideFrom.current ??= stateRef.current;
      sliderGuard.moved(key);
      dispatch({ type: key, quarters });
    },
    [sliderGuard],
  );

  const commit = useCallback(
    (key: SliderKey, quarters: number) => {
      const current = stateRef.current;
      if (!sliderGuard.take(key, current[key] === quarters)) return;
      const previous = slideFrom.current ?? current;
      slideFrom.current = null;
      announce(densityAnnouncement(previous, current, { type: key, quarters }));
    },
    [announce, sliderGuard],
  );

  useEffect(() => {
    const done = pending.current;
    if (!done) return;
    pending.current = null;
    announce(densityAnnouncement(done.previous, state, done.action));
  }, [state, announce]);

  const chart = densityChart(state);
  const table = tableOf(state);
  const hasInterval = setup.openingInterval !== null;
  const stageOptions = setup.stages.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] }));

  const tray = (
    <>
      <StageChoice<DensityStage>
        legend={DENSITY_LABELS.showAs}
        options={stageOptions}
        isAllowed={() => true}
        value={state.stage}
        onChange={(stage) => send({ type: "stage", stage })}
      />
      {state.stage === "bars" && setup.binWidths.length > 1 && (
        <TrayChoice
          legend={DENSITY_LABELS.binWidth}
          options={binWidthOptions(state)}
          value={String(state.binsPerCm)}
          onChange={(value) => send({ type: "bin-width", binsPerCm: Number(value) as BinsPerCm })}
        />
      )}
      {hasInterval && (
        <>
          <TraySlider
            label={DENSITY_LABELS.from}
            value={state.from}
            min={0}
            max={LAST_QUARTER}
            step={1}
            onValueChange={(quarters) => slide("from", quarters)}
            onValueCommitted={(quarters) => commit("from", quarters)}
            format={formatQuarters}
            describe={describeFrom}
          />
          <TraySlider
            label={DENSITY_LABELS.to}
            value={state.to}
            min={0}
            max={LAST_QUARTER}
            step={1}
            onValueChange={(quarters) => slide("to", quarters)}
            onValueCommitted={(quarters) => commit("to", quarters)}
            format={formatQuarters}
            describe={describeTo}
          />
        </>
      )}
      {setup.spreadSwitch && (
        <button type="button" role="switch" aria-checked={state.spreadShown} className="ms-board-button ms-board-switch" onClick={() => send({ type: "spread", on: !state.spreadShown })}>
          {DENSITY_LABELS.spread}
        </button>
      )}
      <PresetButtons
        label={DENSITY_LABELS.presets}
        caption={DENSITY_LABELS.presets}
        presets={setup.shapes.map((id) => ({ id: shapeOf(id).name, label: shapeOf(id).name }))}
        activeId={sandOf(state).name}
        onPick={(name) => send({ type: "preset", name })}
      />
      <TableFold open={state.tableOpen} onToggle={(open) => send({ type: "table", open })}>
        <ValueTable caption={table.caption} headers={table.headers} rows={table.rows} footer={table.footer} />
      </TableFold>
    </>
  );

  return (
    <Board label={hasInterval ? DENSITY_BOARD_LABELS.interval : DENSITY_BOARD_LABELS.pour} tray={tray} onReset={() => send({ type: "reset" })} announcement={announcement}>
      <div className="ms-dist">
        <p className="ms-dist-status">{statusLine(state)}</p>
        <ColumnChart
          columns={chart.columns}
          ticks={chart.ticks}
          gridlines={chart.gridlines}
          marks={chart.marks}
          touching
          overlay={chart.curve || chart.shaded ? <CurvePlot curve={chart.curve} shaded={chart.shaded} /> : null}
          unit={chart.unit}
          heightUnit={chart.heightUnit}
        />
        <div className="ms-dist-readouts">
          {readoutLines(state).map((line) => (
            <p key={line.visible} className="ms-board-readout">
              <SpokenText line={line} />
            </p>
          ))}
        </div>
      </div>
    </Board>
  );
}
