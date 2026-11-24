import type { CSSProperties } from "react";

// The marks that carry a meaning color on HTML charts, shared so μ and σ look the same on every board.
// Each mark is positioned in percent across its row; the row itself is the board's own element.
// Styles: "Chart marks" in src/styles/components.css.

type Position = CSSProperties & Record<`--${string}`, string>;

/** Clamped to the row, so a mark for a value past the axis stays at its edge instead of drawing off the board. */
const percent = (value: number) => `${Math.min(Math.max(value, 0), 100)}%`;

interface MeanMarkProps {
  /** Where the mean sits across the row, in percent. */
  x: number;
  /** "μ = 3.5", "mean 134": always a word or symbol, so the mark never depends on color. */
  label: string;
}

/** The mean: a pink downward triangle under its label. */
export function MeanMark({ x, label }: MeanMarkProps) {
  return (
    <span className="ms-mark-mean" style={{ "--x": percent(x) } as Position}>
      <span className="ms-mark-label">{label}</span>
      <svg className="ms-mark-mean-triangle" viewBox="0 0 12 10" focusable="false">
        <polygon points="0,0 12,0 6,10" />
      </svg>
    </span>
  );
}

/** The mean's dashed pink guide, from the triangle's row down to the axis. Its parent must be positioned. */
export function MeanGuide({ x }: { x: number }) {
  return <span className="ms-mark-mean-guide" style={{ "--x": percent(x) } as Position} />;
}

/** `sigma`: the standard deviation, solid blue. `ghost`: an earlier σ kept for comparison, dashed ink. */
export type SpanKind = "sigma" | "ghost";

interface SigmaSpanProps {
  kind: SpanKind;
  /** The span's ends across the row, in percent (mean − spread and mean + spread). */
  from: number;
  to: number;
  label: string;
}

/** A capped span for a spread around the mean. At zero width only one cap is left, a tick. */
export function SigmaSpan({ kind, from, to, label }: SigmaSpanProps) {
  const zero = from === to;
  return (
    <span
      className={`ms-span ms-span-${kind}${zero ? " is-zero" : ""}`}
      style={{ "--from": percent(from), "--to": percent(to) } as Position}
    >
      <span className="ms-span-label">{label}</span>
    </span>
  );
}
