import SpokenText from "../guided/SpokenText.tsx";
import { spokenLine } from "./describe.ts";
import { NORM_TABLE_HEADERS, normRows } from "./normsDescribe.ts";
import type { VectorState } from "./state.ts";

/**
 * city-walk's folded table: the pin measured three ways (Measure, How, Length). Before Check it has only the walk,
 * which the status line already says. Read-only, inside the board's TableFold, which always prints it; it reuses the
 * coordinate table's styles, so print and forced colors treat it the same. Design and reasoning: decision 0021.
 */
export default function NormTable({ state }: { state: VectorState }) {
  return (
    <div className="ms-vec-table-wrap">
      <table className="ms-vec-table">
        <caption>{NORM_TABLE_HEADERS.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{NORM_TABLE_HEADERS.measure}</th>
            <th scope="col">{NORM_TABLE_HEADERS.how}</th>
            <th scope="col">{NORM_TABLE_HEADERS.length}</th>
          </tr>
        </thead>
        <tbody>
          {normRows(state).map((row) => (
            <tr key={row.measure}>
              <th scope="row">
                <SpokenText line={spokenLine(row.name)} />
              </th>
              <td>
                <SpokenText line={spokenLine(row.how)} />
              </td>
              <td>{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
