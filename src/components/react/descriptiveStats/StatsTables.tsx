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
  /** Said in the summary's place while a gate keeps every row of it back (describe.ts summaryNote), or null. */
  note: string | null;
}

/**
 * The chart's data as a native table, and a summary table (Statistic, Value, How it is computed). They sit inside the
 * board's TableFold, which always prints them. An empty summary is never drawn: its note, if any, stands in for it.
 */
export default function StatsTables({ data, summary, note }: StatsTablesProps) {
  return (
    <div className="ms-desc-tables">
      <Table table={data} />
      {summary.rows.length > 0 ? <Table table={summary} /> : note && <p className="ms-board-readout">{note}</p>}
    </div>
  );
}
