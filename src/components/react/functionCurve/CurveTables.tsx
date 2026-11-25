import SpokenText from "../guided/SpokenText.tsx";
import { tableHeaders, tableRows } from "./describe.ts";
import type { CurveState } from "./state.ts";

/**
 * The rulers from the current point as one native, read-only table: h | Rise | Slope, or h | Slope | Miss once the
 * tangent is drawn. The row header holds only h, since line B already names the ruler's other end, so three columns
 * fit the tray at 320px. It sits inside the board's TableFold, which always prints it.
 */
export default function CurveTables({ state }: { state: CurveState }) {
  const headers = tableHeaders(state);
  return (
    <div className="ms-fncurve-table-wrap">
      <table className="ms-fncurve-table">
        <caption>
          <SpokenText line={headers.caption} />
        </caption>
        <thead>
          <tr>
            {headers.columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows(state).map((row) => (
            <tr key={row.hIndex}>
              <th scope="row">
                <SpokenText line={row.header} />
              </th>
              <td>
                <SpokenText line={row.cells[0]} />
              </td>
              <td>
                <SpokenText line={row.cells[1]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
