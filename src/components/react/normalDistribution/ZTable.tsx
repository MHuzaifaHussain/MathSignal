import SpokenText from "../guided/SpokenText.tsx";
import { spokenMathLine } from "../spokenMath.ts";

interface ZTableProps {
  caption: string;
  /** Header then cell, from describe.ts's tableRows. */
  rows: readonly (readonly [string, string])[];
}

/**
 * The z mode's numbers, step by step, as a native two-column table with row headers. Read-only, so it may sit inside
 * TableFold (decision 0017). Styles: .ms-normal-z-table.
 */
export default function ZTable({ caption, rows }: ZTableProps) {
  return (
    <table className="ms-normal-z-table">
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([header, cell]) => (
          <tr key={header}>
            {/* Symbols on screen, words for screen readers: "z-score, (x − mu) divided by sigma". */}
            <th scope="row">
              <SpokenText line={spokenMathLine(header)} />
            </th>
            <td>
              <SpokenText line={spokenMathLine(cell)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
