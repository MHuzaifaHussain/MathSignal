import { RefusalNote, refusedBy } from "../guided/refusal.tsx";

interface ReadPairProps {
  /** The group's name, e.g. "Read the bar for". */
  label: string;
  /** "Reading the bar for 2 heads.": shown between the buttons. */
  output: string;
  names: { fewer: string; more: string };
  /** The refusal text for each direction right now, or null when that press would go through. */
  refused: { fewer: string | null; more: string | null };
  /** Notes the board already draws elsewhere, as text to RefusalNote id, so one reason is never drawn twice. */
  sharedNotes?: Readonly<Record<string, string>>;
  /** Ids for this pair's own notes. */
  ids: { fewer: string; more: string };
  onStep: (direction: 1 | -1) => void;
}

/**
 * The − / + pair that moves "Read the bar for" (decision 0018). Both buttons stay in tab order; at an end a press
 * is refused with a visible reason rather than a disabled button, so no slider's maximum ever has to follow n.
 */
export default function ReadPair({ label, output, names, refused, sharedNotes = {}, ids, onStep }: ReadPairProps) {
  const noteFor = (text: string | null, ownId: string) => (text ? (sharedNotes[text] ?? ownId) : null);
  const ownNotes = [
    { text: refused.fewer, id: ids.fewer },
    { text: refused.more, id: ids.more },
  ].flatMap((note) => (note.text && !sharedNotes[note.text] ? [{ text: note.text, id: note.id }] : []));
  return (
    <div className="ms-read-pair" role="group" aria-label={label}>
      <span className="ms-read-pair-label" aria-hidden="true">
        {label}
      </span>
      <div className="ms-read-pair-row">
        <button type="button" className="ms-dist-step" aria-label={names.fewer} {...refusedBy(noteFor(refused.fewer, ids.fewer))} onClick={() => onStep(-1)}>
          <span aria-hidden="true">−</span>
        </button>
        {/* aria-live off: an <output> is a live region by default, and the board announces each read itself. */}
        <output className="ms-read-pair-output" aria-live="off">
          {output}
        </output>
        <button type="button" className="ms-dist-step" aria-label={names.more} {...refusedBy(noteFor(refused.more, ids.more))} onClick={() => onStep(1)}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {ownNotes.map((note) => (
        <RefusalNote key={note.id} id={note.id}>
          {note.text}
        </RefusalNote>
      ))}
    </div>
  );
}
