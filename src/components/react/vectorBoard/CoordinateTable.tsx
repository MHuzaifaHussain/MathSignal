import { tableHeaders, tableRows, type TableRow } from "./describe.ts";
import type { VectorState } from "./state.ts";

interface CoordinateTableProps {
  state: VectorState;
  /** The row the reader is pointing at; the plane draws its component legs. */
  linkedId: TableRow["id"] | null;
  onLink: (id: TableRow["id"] | null) => void;
}

/**
 * The vectors as a native, read-only table (Vector, x, y, Length), every row including a + b, c a and the track.
 * It sits inside the board's TableFold, which always prints it; its − / + buttons live in VectorSteppers, always in
 * view. Hover on a row links it to its arrow on the plane.
 */
export default function CoordinateTable({ state, linkedId, onLink }: CoordinateTableProps) {
  const headers = tableHeaders(state);
  return (
    <div className="ms-vec-table-wrap">
      <table className="ms-vec-table">
        <caption>{headers.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{headers.vector}</th>
            <th scope="col">{headers.x}</th>
            <th scope="col">{headers.y}</th>
            <th scope="col">{headers.length}</th>
          </tr>
        </thead>
        <tbody>
          {tableRows(state).map((row) => (
            <tr
              key={row.id}
              className={row.id === linkedId ? "is-linked" : undefined}
              onMouseEnter={() => onLink(row.id)}
              onMouseLeave={() => onLink(null)}
            >
              <th scope="row">{row.name}</th>
              <td>{row.x}</td>
              <td>{row.y}</td>
              <td>{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
