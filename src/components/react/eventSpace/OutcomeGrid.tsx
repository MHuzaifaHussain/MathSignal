import type { CSSProperties } from "react";
import { cellName, focusSet, missedOutcome } from "./describe.ts";
import type { Scenario } from "./scenarios.ts";
import type { EventSpaceState } from "./state.ts";
import { useRovingGrid } from "./useRovingGrid.ts";
import type { OutcomeId } from "./model.ts";

/** Grids up to this size show toss counts inside the cells. */
const MAX_CELLS_WITH_TALLIES = 12;

interface OutcomeGridProps {
  state: EventSpaceState;
  scenario: Scenario;
  /** id of the status line that describes the grid. */
  describedBy: string;
  onToggle: (id: OutcomeId) => void;
}

/**
 * The sample space as a real table: one row per value of the first part, one column per value of the second,
 * one toggle button per outcome. Membership is shown by fill, border and a letter tag, and spoken in the name.
 */
export default function OutcomeGrid({ state, scenario, describedBy, onToggle }: OutcomeGridProps) {
  const rows = scenario.rowValues.length;
  const cols = scenario.colValues.length;
  const { tabIndexFor, onKeyDown, register, onCellFocus } = useRovingGrid(rows, cols);
  const editing = state.events[state.editing];
  const focus = focusSet(state);
  const missed = missedOutcome(state);
  // Counts fit inside cells only on small grids; larger ones show them in the readout.
  const showTallies = state.tossCount > 0 && scenario.outcomes.length <= MAX_CELLS_WITH_TALLIES;

  return (
    <>
    {/* Visible key to the axes; the table's accessible name already says this, so it is hidden from screen readers. */}
    <p className="ms-event-caption" aria-hidden="true">
      Rows: {scenario.rowLabel.toLowerCase()}. Columns: {scenario.colLabel.toLowerCase()}.
    </p>
    <table
      className="ms-event-grid"
      role="grid"
      aria-multiselectable="true"
      aria-label={`Outcomes of ${scenario.describeSpace}. Rows: ${scenario.rowLabel.toLowerCase()}. Columns: ${scenario.colLabel.toLowerCase()}.`}
      aria-describedby={describedBy}
      style={{ "--ms-event-cols": cols } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <thead>
        <tr>
          <td className="ms-event-corner" />
          {scenario.colValues.map((value) => (
            <th key={value} scope="col">
              {value}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {scenario.rowValues.map((rowValue, row) => (
          <tr key={rowValue}>
            <th scope="row">{rowValue}</th>
            {scenario.outcomes
              .filter((outcome) => outcome.row === row)
              .map((outcome) => {
                const inA = state.events.A.has(outcome.id);
                const inB = state.events.B.has(outcome.id);
                const classes = [
                  "ms-event-cell",
                  inA && "is-a",
                  inB && "is-b",
                  missed === outcome.id && "is-missed",
                  focus && !focus.has(outcome.id) && "is-outside",
                ].filter(Boolean).join(" ");
                return (
                  <td key={outcome.id}>
                    <button
                      ref={register(outcome.row, outcome.col)}
                      type="button"
                      className={classes}
                      tabIndex={tabIndexFor(outcome.row, outcome.col)}
                      aria-pressed={editing.has(outcome.id)}
                      aria-label={cellName(state, outcome)}
                      onFocus={() => onCellFocus(outcome.row, outcome.col)}
                      onClick={() => onToggle(outcome.id)}
                    >
                      {inA && <span className="ms-event-tag ms-event-tag-a" aria-hidden="true">A</span>}
                      <span className="ms-event-label" aria-hidden="true">{outcome.label}</span>
                      {inB && <span className="ms-event-tag ms-event-tag-b" aria-hidden="true">B</span>}
                      {missed === outcome.id && <span className="ms-event-note" aria-hidden="true">missed</span>}
                      {showTallies && <span className="ms-event-note" aria-hidden="true">{state.tallies[outcome.id] ?? 0}</span>}
                    </button>
                  </td>
                );
              })}
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}
