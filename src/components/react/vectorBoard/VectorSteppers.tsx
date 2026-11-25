import { useId } from "react";
import { RefusalNote, refusedBy } from "../guided/refusal.tsx";
import { refusalKey, refusalNotes, stepperGroupName, stepperHeaders, stepperName, stepperRows, type TableRow } from "./describe.ts";
import { stepRefusal, type Action, type Axis, type Direction, type VectorId, type VectorState } from "./state.ts";

const STEP_SYMBOLS: Readonly<Record<Direction, string>> = { [-1]: "−", 1: "+" };

interface VectorSteppersProps {
  state: VectorState;
  /** The row the reader is pointing at; the plane draws its component legs. */
  linkedId: TableRow["id"] | null;
  onLink: (id: TableRow["id"] | null) => void;
  send: (action: Action) => void;
}

/**
 * The keyboard path for every handle, always visible under the readouts: one group per movable vector, named by it,
 * with − / + buttons per axis in normal tab order. Refused presses stay focusable with aria-disabled and point at a
 * visible note. Focus or hover on a row links it to its arrow on the plane. The read-only coordinate table is
 * behind Table view (decision 0017); these buttons never fold with it.
 */
export default function VectorSteppers({ state, linkedId, onLink, send }: VectorSteppersProps) {
  const baseId = useId();
  const noteId = (key: string) => `${baseId}-${key}`;
  const rows = stepperRows(state);
  const headers = stepperHeaders(state);
  const notes = refusalNotes(state);

  const stepButton = (id: VectorId, axis: Axis, direction: Direction) => {
    const refusal = stepRefusal(state, id, axis, direction);
    return (
      <button
        type="button"
        className="ms-vec-step"
        aria-label={stepperName(state, id, axis, direction)}
        {...refusedBy(refusal ? noteId(refusalKey(refusal)) : null)}
        onClick={() => send({ type: "step", id, axis, direction })}
      >
        <span aria-hidden="true">{STEP_SYMBOLS[direction]}</span>
      </button>
    );
  };

  const stepper = (id: VectorId, axis: Axis, value: string) => (
    <span className="ms-vec-stepper" role="group" aria-label={stepperGroupName(state, id, axis)}>
      {stepButton(id, axis, -1)}
      <span className="ms-vec-value">{value}</span>
      {stepButton(id, axis, 1)}
    </span>
  );

  if (rows.length === 0) return null;
  return (
    <div className="ms-vec-steppers">
      {/* Every button already names its direction, so the column words are for the eye only. */}
      <div className="ms-vec-steppers-head" aria-hidden="true">
        <span />
        <span>{headers.x}</span>
        <span>{headers.y}</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          role="group"
          aria-label={row.name}
          className={row.id === linkedId ? "ms-vec-steppers-row is-linked" : "ms-vec-steppers-row"}
          onFocus={() => onLink(row.id)}
          onBlur={() => onLink(null)}
          onMouseEnter={() => onLink(row.id)}
          onMouseLeave={() => onLink(null)}
        >
          <span className="ms-vec-steppers-name" aria-hidden="true">
            {row.name}
          </span>
          {stepper(row.stepId, "x", row.x)}
          {stepper(row.stepId, "y", row.y)}
        </div>
      ))}
      {notes.map((note) => (
        <RefusalNote key={note.key} id={noteId(note.key)}>
          {note.text}
        </RefusalNote>
      ))}
    </div>
  );
}
