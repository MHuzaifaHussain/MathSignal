import type { CSSProperties } from "react";
import { cellName, focusSet, missedOutcome, unitsNote } from "./describe.ts";
import { hasWordedRowHeaders, type Scenario } from "./scenarios.ts";
import { SMALL_GRID_MAX_CELLS, type EventSpaceState } from "./state.ts";
import { useRovingGrid } from "./useRovingGrid.ts";
import type { OutcomeId } from "./model.ts";

interface OutcomeGridProps {
  state: EventSpaceState;
  scenario: Scenario;
  /** id of the status line that describes the grid. */
  describedBy: string;
  /** False when the events are fixed data: cells stay focusable for reading but don't toggle. */
  editable: boolean;
  onToggle: (id: OutcomeId) => void;
}

/**
 * The sample space as a real table: one row per value of the first part, one column per value of the second,
 * one toggle button per outcome. Membership is shown by fill, border and a letter tag, and spoken in the name.
 */
export default function OutcomeGrid({ state, scenario, describedBy, editable, onToggle }: OutcomeGridProps) {
  const isList = scenario.layout === "list";
  const rows = scenario.rowValues.length;
  const cols = scenario.colValues.length;
  const { tabIndexFor, onKeyDown, register, onCellFocus } = useRovingGrid(rows, cols);
  const editing = state.events[state.editing];
  const focus = focusSet(state);
  const missed = missedOutcome(state);
  // Counts fit inside cells only on small grids; larger ones show them in the readout.
  const showTallies = state.tossCount > 0 && scenario.outcomes.length <= SMALL_GRID_MAX_CELLS;

  return (
    <>
    {/* Visible key to the axes; the table's accessible name already says this, so it is hidden from screen readers. */}
    {!isList && (
      <p className="ms-event-caption" aria-hidden="true">
        Rows: {scenario.rowLabel.toLowerCase()}. Columns: {scenario.colLabel.toLowerCase()}.
      </p>
    )}
    <table
      className={hasWordedRowHeaders(scenario) ? "ms-event-grid ms-event-grid--worded-rows" : "ms-event-grid"}
      role="grid"
      aria-label={
        isList
          ? `Outcomes of ${scenario.describeSpace}.`
          : `Outcomes of ${scenario.describeSpace}. Rows: ${scenario.rowLabel.toLowerCase()}. Columns: ${scenario.colLabel.toLowerCase()}.`
      }
      aria-describedby={describedBy}
      style={{ "--ms-event-cols": cols } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {!isList && (
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
      )}
      <tbody>
        {scenario.rowValues.map((rowValue, row) => (
          <tr key={rowValue}>
            {!isList && <th scope="row">{rowValue}</th>}
            {scenario.outcomes
              .filter((outcome) => outcome.row === row)
              .map((outcome) => {
                const inA = state.events.A.has(outcome.id);
                const inB = state.events.B.has(outcome.id);
                const units = unitsNote(state, outcome);
                const classes = [
                  "ms-event-cell",
                  inA && "is-a",
                  inB && "is-b",
                  missed === outcome.id && "is-missed",
                  focus && !focus.has(outcome.id) && "is-outside",
                  units && "is-weighted",
                ].filter(Boolean).join(" ");
                return (
                  <td key={outcome.id}>
                    <button
                      ref={register(outcome.row, outcome.col)}
                      type="button"
                      className={classes}
                      tabIndex={tabIndexFor(outcome.row, outcome.col)}
                      aria-pressed={editable ? editing.has(outcome.id) : undefined}
                      aria-disabled={editable ? undefined : true}
                      aria-label={cellName(state, outcome)}
                      onFocus={() => onCellFocus(outcome.row, outcome.col)}
                      onClick={editable ? () => onToggle(outcome.id) : undefined}
                    >
                      {inA && <span className="ms-event-tag ms-event-tag-a" data-tag="A" aria-hidden="true" />}
                      {state.stage === "picture" && scenario.pictureFaces ? (
                        <span className="ms-event-faces" aria-hidden="true">
                          {scenario.pictureFaces(outcome).map((face, index) => (
                            <span key={index} className="ms-event-face">{face}</span>
                          ))}
                        </span>
                      ) : (
                        <span className="ms-event-label" aria-hidden="true">{outcome.label}</span>
                      )}
                      {inB && <span className="ms-event-tag ms-event-tag-b" data-tag="B" aria-hidden="true" />}
                      {missed === outcome.id && <span className="ms-event-note" aria-hidden="true">missed</span>}
                      {showTallies && <span className="ms-event-note" aria-hidden="true">{state.tallies[outcome.id] ?? 0}</span>}
                      {units && <span className="ms-event-units" aria-hidden="true">{units}</span>}
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
