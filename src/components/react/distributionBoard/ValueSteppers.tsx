import { useId } from "react";
import { OutcomeFace } from "./BarChart.tsx";
import { refusalText, rowText, stepperHeaders, stepperName } from "./describe.ts";
import type { Setup } from "./setups.ts";
import { outcomesOf } from "./sources.ts";
import { stepBlocked, type Action, type DistributionState, type Refusal } from "./state.ts";

type RefusalKind = Refusal["kind"];
const STEPPER_REFUSALS: readonly RefusalKind[] = ["locked", "not-editable", "below-range", "above-range"];
const DIRECTIONS = [-1, 1] as const;
const STEP_SYMBOLS: Readonly<Record<-1 | 1, string>> = { [-1]: "−", 1: "+" };

interface ValueSteppersProps {
  setup: Setup;
  state: DistributionState;
  /** id of the status line that describes the steppers. */
  describedBy: string;
  linkedId: string | null;
  onLink: (id: string | null) => void;
  send: (action: Action) => void;
}

/**
 * A − / + pair per outcome, all in normal tab order (the CupRow pattern, not role="grid"). Refused presses stay
 * focusable with aria-disabled and point at a visible reason. Focus or hover on a row links it to its tile.
 */
export default function ValueSteppers({ setup, state, describedBy, linkedId, onLink, send }: ValueSteppersProps) {
  const reasonIds: Record<RefusalKind, string> = {
    locked: useId(),
    "not-editable": useId(),
    "below-range": useId(),
    "above-range": useId(),
    parked: useId(),
  };
  const outcomes = outcomesOf(setup.source);
  const headers = stepperHeaders(setup, state.stage);
  const blocked = new Set(outcomes.flatMap((outcome) => DIRECTIONS.map((direction) => stepBlocked(state, outcome.id, direction))));
  const shownReasons = STEPPER_REFUSALS.filter((kind) => blocked.has(kind));

  const stepButton = (id: string, direction: -1 | 1) => {
    const reason = stepBlocked(state, id, direction);
    return (
      <button
        type="button"
        className="ms-dist-step"
        aria-label={stepperName(state, id, direction)}
        aria-disabled={reason ? true : undefined}
        aria-describedby={reason ? reasonIds[reason] : undefined}
        onClick={() => send({ type: "step", id, direction })}
      >
        <span aria-hidden="true">{STEP_SYMBOLS[direction]}</span>
      </button>
    );
  };

  return (
    <div className="ms-dist-steppers" role="group" aria-label={headers.group} aria-describedby={describedBy}>
      <div className="ms-dist-stepper-head" aria-hidden="true">
        <span>{headers.outcome}</span>
        <span>{headers.value}</span>
      </div>
      {outcomes.map((outcome) => {
        const value = state.values[outcome.id];
        return (
          <div
            key={outcome.id}
            className={outcome.id === linkedId ? "ms-dist-row is-linked" : "ms-dist-row"}
            onFocus={() => onLink(outcome.id)}
            onBlur={() => onLink(null)}
            onMouseEnter={() => onLink(outcome.id)}
            onMouseLeave={() => onLink(null)}
          >
            <span className="ms-dist-row-face" aria-hidden="true">
              <OutcomeFace source={setup.source} label={outcome.label} stage={state.stage} />
            </span>
            {stepButton(outcome.id, -1)}
            {/* aria-live off: an <output> is a live region by default, and the board already announces each change. */}
            <output className="ms-dist-row-value" aria-live="off">
              <span className="sr-only">{rowText(state, outcome.id)}</span>
              <span aria-hidden="true">{value}</span>
              {state.stage === "pictures" && (
                <span className="ms-dist-dots" aria-hidden="true">
                  {Array.from({ length: value }, (_, index) => (
                    <span key={index} className="ms-dist-dot" />
                  ))}
                </span>
              )}
            </output>
            {stepButton(outcome.id, 1)}
          </div>
        );
      })}
      {shownReasons.map((kind) => (
        <p key={kind} id={reasonIds[kind]} className="ms-dist-note">
          {refusalText(setup, { kind })}
        </p>
      ))}
    </div>
  );
}
