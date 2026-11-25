import type { BayesScenario, BayesValues } from "./scenarios.ts";
import { tableCopy } from "./table.ts";

interface CountTableProps {
  values: BayesValues;
  scenario: BayesScenario;
}

/**
 * The square as a native table of whole counts (A and not A by B and not B, with totals), plus the two readout
 * numbers as "k of n". The B-and-A count and B's total, the two numbers P(A | B) divides, are bold, never colored.
 * It sits inside the board's TableFold, which hides it until "Table view" is on and always prints it.
 */
export default function CountTable({ values, scenario }: CountTableProps) {
  const copy = tableCopy(values, scenario);
  return (
    <div className="ms-bayes-table">
      <table>
        <caption>{copy.caption}</caption>
        <thead>
          <tr>
            <td />
            {copy.columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {copy.rows.map((row) => (
            <tr key={row.header}>
              <th scope="row">{row.header}</th>
              {row.cells.map((cell, index) => (
                <td key={copy.columns[index]} className={cell.divides ? "is-divided" : undefined}>
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {copy.lines.map((line) => (
        <p key={line.text} className="ms-board-readout">
          <span aria-hidden="true">{line.text}</span>
          <span className="sr-only">{line.spoken}</span>
        </p>
      ))}
    </div>
  );
}
