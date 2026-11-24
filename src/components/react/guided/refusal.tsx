import type { ReactNode } from "react";

/**
 * Props for a control the board refuses right now. It stays focusable and pressable (never `disabled`), and
 * points at a visible RefusalNote. The control's own onClick decides what a refused press says.
 */
export function refusedBy(reasonId: string | null | undefined) {
  return {
    "aria-disabled": reasonId ? true : undefined,
    "aria-describedby": reasonId || undefined,
  } as const;
}

interface RefusalNoteProps {
  /** The id the refused controls name in `aria-describedby`. */
  id: string;
  children: ReactNode;
}

/** The visible reason a control is refused. Hidden in print with the controls it explains. Styles: .ms-board-refusal. */
export function RefusalNote({ id, children }: RefusalNoteProps) {
  return (
    <p id={id} className="ms-board-refusal">
      {children}
    </p>
  );
}
