import { useCallback, useEffect, useId, useLayoutEffect, useReducer, useRef } from "react";
import Board from "../Board";
import TrayChoice from "../TrayChoice";
import TraySlider from "../TraySlider";
import { KEYBOARD_COMMIT_DELAY_MS } from "../boardTiming";
import CheckButtons from "../guided/CheckButtons.tsx";
import PresetButtons from "../guided/PresetButtons.tsx";
import { RefusalNote } from "../guided/refusal.tsx";
import TableFold from "../guided/TableFold.tsx";
import useAnnouncer from "../guided/useAnnouncer.ts";
import useCommittedSlider from "../guided/useCommittedSlider.ts";
import ColumnChart from "./ColumnChart.tsx";
import ReadPair from "./ReadPair.tsx";
import SpokenText from "../guided/SpokenText.tsx";
import { spokenMathLine, spokenMathTwin } from "./spokenMath.ts";
import ValueTable from "./ValueTable.tsx";
import { familyChart } from "./familyChart.ts";
import {
  FAMILY_BOARD_LABELS,
  FAMILY_LABELS,
  GUESS_LABELS,
  describeChance,
  describeTrials,
  familyAnnouncement,
  formatChance,
  formatCoins,
  formatTrials,
  guessLine,
  readButtonName,
  readOutput,
  readoutLines,
  refusalText,
  sequenceItems,
  statusLine,
  tableOf,
  verdictLine,
} from "./familyDescribe.ts";
import type { FamilySetupId } from "./familySetups.ts";
import { activePreset, familyReducer, familySetupOf, initialFamilyState, isCovered, presetsLocked, readBlocked, type FamilyAction, type FamilyState } from "./familyState.ts";

type SliderKey = "n" | "p";

/**
 * DistributionBoard's family mode (decision 0018): a binomial distribution set by n and p, drawn as plain columns
 * on a fixed scale. `coins-binomial` holds 4 or more coins behind a guess; `binomial-spread` adds p, μ and the
 * spread switch. Wiring only: the rules are in familyState.ts and every sentence in familyDescribe.ts.
 */
export default function FamilyBoard({ setup: setupId }: { setup: FamilySetupId }) {
  const [state, dispatch] = useReducer(familyReducer, setupId, initialFamilyState);
  const setup = familySetupOf(state);
  const [announcement, announce] = useAnnouncer();
  const sliderGuard = useCommittedSlider<SliderKey>();
  const ids = { check: useId(), locked: useId(), fewer: useId(), more: useId() };
  const pending = useRef<{ previous: FamilyState; action: FamilyAction } | null>(null);
  /** The state before a slider started moving, so its commit can say what clamped since. */
  const slideFrom = useRef<FamilyState | null>(null);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });
  const verdictRef = useRef<HTMLParagraphElement>(null);

  const send = useCallback(
    (action: FamilyAction) => {
      sliderGuard.interrupt();
      slideFrom.current = null;
      pending.current = { previous: stateRef.current, action };
      dispatch(action);
    },
    [sliderGuard],
  );

  const slide = useCallback(
    (key: SliderKey, action: FamilyAction) => {
      pending.current = null;
      slideFrom.current ??= stateRef.current;
      sliderGuard.moved(key);
      dispatch(action);
    },
    [sliderGuard],
  );

  // A late commit only announces: dispatching here could undo a button pressed since, and the guard keeps a stale
  // commit quiet.
  const commit = useCallback(
    (key: SliderKey, value: number) => {
      const current = stateRef.current;
      const holds = key === "n" ? current.n === value : current.j === value;
      if (!sliderGuard.take(key, holds)) return;
      const previous = slideFrom.current ?? current;
      slideFrom.current = null;
      announce(familyAnnouncement(previous, current, key === "n" ? { type: "n", n: value } : { type: "p", j: value }));
    },
    [announce, sliderGuard],
  );

  useEffect(() => {
    const done = pending.current;
    if (!done) return;
    pending.current = null;
    const burst = done.action.type === "read" && !state.refusal;
    announce(familyAnnouncement(done.previous, state, done.action), burst ? KEYBOARD_COMMIT_DELAY_MS : 0);
    // Check and the guess radios leave the tray once the guess is in, so focus moves to the verdict.
    if (done.action.type === "check" && state.checked) verdictRef.current?.focus();
  }, [state, announce]);

  const covered = isCovered(state);
  const isGuess = setup.kind === "guess";
  const status = statusLine(state);
  const items = sequenceItems(state);
  const verdict = verdictLine(state);
  const guess = guessLine(state);
  const chart = familyChart(state);
  const table = tableOf(state);
  const lockedText = refusalText(state, "locked");
  const blockedText = (direction: 1 | -1) => {
    const blocked = readBlocked(state, direction);
    return blocked ? refusalText(state, blocked) : null;
  };

  const tray = (
    <>
      <TraySlider
        label={isGuess ? FAMILY_LABELS.coins : FAMILY_LABELS.trials}
        value={state.n}
        min={setup.nRange[0]}
        max={setup.nRange[1]}
        step={1}
        onValueChange={(n) => slide("n", { type: "n", n })}
        onValueCommitted={(n) => commit("n", n)}
        format={isGuess ? formatCoins : formatTrials}
        describe={isGuess ? formatCoins : describeTrials}
      />
      {!isGuess && (
        <TraySlider
          label={FAMILY_LABELS.chance}
          value={state.j}
          min={setup.jRange[0]}
          max={setup.jRange[1]}
          step={1}
          onValueChange={(j) => slide("p", { type: "p", j })}
          onValueCommitted={(j) => commit("p", j)}
          format={formatChance}
          describe={describeChance}
        />
      )}
      <ReadPair
        label={FAMILY_LABELS.read}
        output={readOutput(state)}
        names={{ fewer: readButtonName(state, -1), more: readButtonName(state, 1) }}
        refused={{ fewer: blockedText(-1), more: blockedText(1) }}
        sharedNotes={presetsLocked(state) ? { [lockedText]: ids.locked } : {}}
        ids={{ fewer: ids.fewer, more: ids.more }}
        onStep={(direction) => send({ type: "read", direction })}
      />
      {isGuess && !state.checked && setup.guess && (
        <>
          <TrayChoice
            legend={FAMILY_LABELS.guess}
            options={setup.guess.options.map((value) => ({ value, label: GUESS_LABELS[value] }))}
            value={state.guess}
            onChange={(value) => send({ type: "guess", guess: value })}
          />
          <CheckButtons
            progress={state}
            checkLabel={FAMILY_LABELS.check}
            showAnswerLabel={FAMILY_LABELS.showAnswer}
            checkRefusalId={state.guess ? null : ids.check}
            onCheck={() => send({ type: "check" })}
            onShowAnswer={() => send({ type: "check" })}
          />
          {!state.guess && <RefusalNote id={ids.check}>{refusalText(state, "no-guess")}</RefusalNote>}
        </>
      )}
      {!isGuess && (
        <button type="button" role="switch" aria-checked={state.spreadShown} className="ms-board-button ms-board-switch" onClick={() => send({ type: "spread", on: !state.spreadShown })}>
          {FAMILY_LABELS.spread}
        </button>
      )}
      <PresetButtons
        label={FAMILY_LABELS.presets}
        caption={FAMILY_LABELS.presets}
        presets={setup.presets.map((preset) => ({ id: preset.name, label: preset.name }))}
        activeId={activePreset(state)?.name ?? null}
        refusalId={presetsLocked(state) ? ids.locked : null}
        onPick={(name) => send({ type: "preset", name })}
      />
      {presetsLocked(state) && <RefusalNote id={ids.locked}>{lockedText}</RefusalNote>}
      {/* No table while the chart is covered, so no switch either: it arrives with the chart. */}
      {table.rows.length > 0 && (
        <TableFold open={state.tableOpen} onToggle={(open) => send({ type: "table", open })}>
          <ValueTable caption={table.caption} headers={table.headers} rows={table.rows} />
        </TableFold>
      )}
    </>
  );

  return (
    <Board label={FAMILY_BOARD_LABELS[setup.kind]} tray={tray} onReset={() => send({ type: "reset" })} announcement={announcement}>
      <div className="ms-dist">
        <p className="ms-dist-status">
          <SpokenText line={spokenMathTwin(status)} />
        </p>
        {guess && <p className="ms-dist-guess">{guess}</p>}
        {verdict && (
          <p ref={verdictRef} className="ms-dist-feedback ms-dist-verdict" tabIndex={-1}>
            <SpokenText line={spokenMathLine(verdict)} />
          </p>
        )}
        {covered ? (
          <div className="ms-dist-covered">
            <p>{FAMILY_LABELS.covered}</p>
          </div>
        ) : (
          <ColumnChart columns={chart.columns} ticks={chart.ticks} gridlines={chart.gridlines} marks={chart.marks} unit={chart.unit} />
        )}
        {items.length > 0 && (
          <ul className="ms-dist-sequences">
            {items.map((item) => (
              <li key={item.visible}>
                <SpokenText line={item} />
              </li>
            ))}
          </ul>
        )}
        <div className="ms-dist-readouts">
          {readoutLines(state).map((line) => (
            <p key={line.visible} className="ms-board-readout">
              <SpokenText line={spokenMathTwin(line)} />
            </p>
          ))}
        </div>
      </div>
    </Board>
  );
}
