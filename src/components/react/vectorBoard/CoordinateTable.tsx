import { useId } from "react";
import { RefusalNote, refusedBy } from "../guided/refusal.tsx";
import { refusalKey, refusalNotes, stepperGroupName, stepperName, tableHeaders, tableRows, lengthLines, type TableRow } from "./describe.ts";
import { stepRefusal, type Action, type Axis, type Direction, type VectorId, type VectorState } from "./state.ts";

const STEP_SYMBOLS: Readonly<Record<Direction, string>> = { [-1]: "−", 1: "+" };

interface CoordinateTableProps {
  state: VectorState;
  /** The row the reader is pointing at; the plane draws its component legs. */
  linkedId: TableRow["id"] | null;
  onLink: (id: TableRow["id"] | null) => void;
  send: (action: Action) => void;
}

/**
 * The vectors as a native table, and the keyboard path for every handle: each movable row has − / + buttons in
 * normal tab order (not role="grid"). Refused presses stay focusable with aria-disabled and point at a visible
 * note. Focus or hover on a row links it to its arrow on the plane.
 */
export default function CoordinateTable({ state, linkedId, onLink, send }: CoordinateTableProps) {
  const baseId = useId();
  const noteId = (key: string) => `${baseId}-${key}`;
  const headers = tableHeaders(state);
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

  return (
    <div className="ms-vec-table-wrap">
      <table className="ms-vec-table">
        <caption>{headers.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{headers.vector}</th>
            <th scope="col">{headers.x}</th>
            <th scope="col">{headers.y}</th>
            <th scope="col" className="ms-vec-length">
              {headers.length}
            </th>
          </tr>
        </thead>
        <tbody>
          {tableRows(state).map((row) => (
            <tr
              key={row.id}
              className={row.id === linkedId ? "is-linked" : undefined}
              onFocus={() => onLink(row.id)}
              onBlur={() => onLink(null)}
              onMouseEnter={() => onLink(row.id)}
              onMouseLeave={() => onLink(null)}
            >
              <th scope="row">{row.name}</th>
              <td>{row.stepId ? stepper(row.stepId, "x", row.x) : row.x}</td>
              <td>{row.stepId ? stepper(row.stepId, "y", row.y) : row.y}</td>
              <td className="ms-vec-length">{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ms-vec-length-lines">
        {lengthLines(state).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {notes.map((note) => (
        <RefusalNote key={note.key} id={noteId(note.key)}>
          {note.text}
        </RefusalNote>
      ))}
    </div>
  );
}
