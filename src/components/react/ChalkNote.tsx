interface ChalkNoteProps {
  /** Shown when the board is at least 560px wide. Qualitative only, never a number. */
  long: string;
  /** Shown on narrower boards. */
  short: string;
}

/**
 * A handwritten note on a board, in Kalam at 20px or larger.
 * Decorative restatement of the lesson, so it is hidden from screen readers.
 */
export default function ChalkNote({ long, short }: ChalkNoteProps) {
  return (
    <p className="ms-chalk-note" aria-hidden="true">
      <span className="ms-chalk-note-long">{long}</span>
      <span className="ms-chalk-note-short">{short}</span>
    </p>
  );
}
