import { useId } from "react";
import { WEIGHT_TOTAL } from "./model.ts";
import { cupName, refusalText } from "./describe.ts";
import type { Scenario } from "./scenarios.ts";
import { pourBlocked, type Action, type EventSpaceState, type Refusal } from "./state.ts";

interface CupRowProps {
  state: EventSpaceState;
  scenario: Scenario;
  send: (action: Action) => void;
}

const SLOTS = Array.from({ length: WEIGHT_TOTAL }, (_, index) => WEIGHT_TOTAL - 1 - index);

/**
 * Weights mode: one cup per outcome, each a column of 12 unit slots, with a pour-in and a pour-out button.
 * Refused moves stay focusable (aria-disabled) and point at the visible reason. No selection state, so the
 * table holds only buttons and text.
 */
export default function CupRow({ state, scenario, send }: CupRowProps) {
  const reasonIds: Record<Refusal["reason"], string> = { "cup-empty": useId(), "jug-empty": useId() };
  const blocked = scenario.outcomes.flatMap((outcome) => [pourBlocked(state, outcome.id, 1), pourBlocked(state, outcome.id, -1)]);
  const shownReasons = (["cup-empty", "jug-empty"] as const).filter((reason) => blocked.includes(reason));

  const pourButton = (outcomeId: string, label: string, direction: 1 | -1, symbol: string) => {
    const reason = pourBlocked(state, outcomeId, direction);
    return (
      <button
        type="button"
        className="ms-cup-button"
        aria-label={`${direction === 1 ? "Pour one unit into" : "Pour one unit out of"} cup ${label}`}
        aria-disabled={reason ? true : undefined}
        aria-describedby={reason ? reasonIds[reason] : undefined}
        onClick={() => send({ type: "pour", id: outcomeId, direction })}
      >
        <span aria-hidden="true">{symbol}</span>
      </button>
    );
  };

  return (
    <>
      <table className="ms-cup-row" aria-label={`Cups for ${scenario.describeSpace}, filled from a jug of ${WEIGHT_TOTAL} units.`}>
        <thead>
          <tr>
            {scenario.outcomes.map((outcome) => (
              <th key={outcome.id} scope="col">
                Cup {outcome.label}
                {state.events.A.has(outcome.id) && <span className="ms-cup-tag"> A</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {scenario.outcomes.map((outcome) => {
              const units = state.weights[outcome.id] ?? 0;
              return (
                <td key={outcome.id} className={state.events.A.has(outcome.id) ? "is-a" : undefined}>
                  <div className="ms-cup" role="img" aria-label={cupName(state, outcome)}>
                    {SLOTS.map((slot) => (
                      <span key={slot} className={slot < units ? "ms-cup-slot is-filled" : "ms-cup-slot"} />
                    ))}
                  </div>
                  <p className="ms-cup-share" aria-hidden="true">
                    {units}/{WEIGHT_TOTAL}
                  </p>
                  <div className="ms-cup-buttons">
                    {pourButton(outcome.id, outcome.label, 1, "+")}
                    {pourButton(outcome.id, outcome.label, -1, "−")}
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      {shownReasons.map((reason) => (
        <p key={reason} id={reasonIds[reason]} className="ms-event-note-line">
          {reason === "cup-empty" ? "Empty cups can't be poured out: " : "Nothing left to pour in: "}
          {refusalText(reason)}
        </p>
      ))}
      {state.refusal && (
        <p className="ms-event-feedback" role="status">
          {refusalText(state.refusal.reason)}
        </p>
      )}
    </>
  );
}
