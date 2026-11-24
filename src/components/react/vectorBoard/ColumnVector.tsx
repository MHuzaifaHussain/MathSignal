interface ColumnVectorProps {
  name: string;
  x: string;
  y: string;
  /** "a is the column 3, 2", read instead of the drawing, as the notation registry says a column vector. */
  spoken: string;
}

/**
 * A column vector for the Lists stage: two stacked numbers between CSS brackets, in HTML rather than KaTeX
 * (decision 0007). The drawing is hidden from screen readers, which hear `spoken`.
 */
export default function ColumnVector({ name, x, y, spoken }: ColumnVectorProps) {
  return (
    <span className="ms-vec-column">
      <span className="sr-only">{spoken}</span>
      <span className="ms-vec-column-name" aria-hidden="true">
        {name} =
      </span>
      <span className="ms-vec-column-body" aria-hidden="true">
        <span>{x}</span>
        <span>{y}</span>
      </span>
    </span>
  );
}
