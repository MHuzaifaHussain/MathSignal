interface ChalkNoteProps {
  /** Shown when the board is at least 560px wide. Qualitative only, never a number. */
  long: string;
  /** Shown on narrower boards. */
  short: string;
  /** Where it sits on a plot; the top-left by default. */
  corner?: "top-left" | "bottom-left";
}

/**
 * A handwritten note on a board, in Kalam at 20px or larger.
 * Decorative restatement of the lesson, so it is hidden from screen readers.
 */
export default function ChalkNote({ long, short, corner = "top-left" }: ChalkNoteProps) {
  return (
    <p className={corner === "bottom-left" ? "ms-chalk-note is-bottom-left" : "ms-chalk-note"} aria-hidden="true">
      <span className="ms-chalk-note-long">{long}</span>
      <span className="ms-chalk-note-short">{short}</span>
    </p>
  );
}
