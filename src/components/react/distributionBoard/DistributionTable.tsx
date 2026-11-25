import { tableHeaders, tableRows } from "./describe.ts";
import { setupOf, type DistributionState } from "./state.ts";

interface DistributionTableProps {
  state: DistributionState;
}

/**
 * The chart as a native table (Value | Faces | P(X = x)), inside the board's TableFold, which always prints it. It
 * renders nothing while the chart is covered, because tableRows is empty then.
 */
export default function DistributionTable({ state }: DistributionTableProps) {
  const rows = tableRows(state);
  if (rows.length === 0) return null;
  const headers = tableHeaders(setupOf(state));
  return (
    <table className="ms-dist-table">
      <caption>{headers.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{headers.value}</th>
          <th scope="col">{headers.members}</th>
          <th scope="col">{headers.probability}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.value}>
            <th scope="row">{row.value}</th>
            <td>{row.members}</td>
            <td>{row.probability}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
