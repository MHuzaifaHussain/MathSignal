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
            <th scope="row">{header}</th>
            <td>{cell}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
