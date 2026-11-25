export interface ValueTableData {
  caption: string;
  headers: readonly string[];
  /** The first cell of each row is its row header. */
  rows: readonly (readonly string[])[];
  /** One closing row: a label over the first two columns and a value over the rest. */
  footer?: { label: string; value: string } | null;
}

/**
 * A board's numbers as a native table, for the family and density modes' Table view (decision 0017). Read-only, so
 * it may sit inside TableFold. With no rows it renders nothing. Styles: .ms-dist-table.
 */
export default function ValueTable({ caption, headers, rows, footer }: ValueTableData) {
  if (rows.length === 0) return null;
  return (
    <table className="ms-dist-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            <th scope="row">{row[0]}</th>
            {row.slice(1).map((cell, index) => (
              <td key={index}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>
              {footer.label}
            </th>
            <td colSpan={Math.max(headers.length - 2, 1)}>{footer.value}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
