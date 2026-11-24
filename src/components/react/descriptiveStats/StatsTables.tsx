import type { TableData } from "./describe.ts";

function Table({ table }: { table: TableData }) {
  return (
    <table className="ms-desc-table">
      <caption>{table.caption}</caption>
      <thead>
        <tr>
          {table.headers.map((header) => (
            <th key={header} scope="col">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.header}>
            <th scope="row">{row.header}</th>
            {row.cells.map((cell, index) => (
              <td key={index}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface StatsTablesProps {
  data: TableData;
  summary: TableData;
  /** Shown instead of the summary while the board holds it back. */
  covered: string | null;
}

/** The chart's data as a native table, and a summary table (Statistic, Value, How it is computed). Both print. */
export default function StatsTables({ data, summary, covered }: StatsTablesProps) {
  return (
    <div className="ms-desc-tables">
      <Table table={data} />
      {covered ? (
        <div className="ms-desc-covered">
          <p>{covered}</p>
        </div>
      ) : (
        <Table table={summary} />
      )}
    </div>
  );
}
