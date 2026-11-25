import { useId, type ReactNode } from "react";
import { TABLE_FOLD_LABEL } from "./tableFold.ts";

interface TableFoldProps {
  /** Owned by the board (its reducer, or Bayes's state), so Reset closes it. */
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Exactly one read-only table component; scripts/check-boards.mjs checks it holds no control. */
  children: ReactNode;
}

/**
 * The "Table view" switch and, directly under it, the region holding the board's data table. Folded, the region is
 * display: none on screen and out of the accessibility tree; in print it always shows. It owns no state and says
 * nothing: the board announces the change with tableFoldAnnouncement. Styles: .ms-board-table-fold. Decision 0017.
 */
export default function TableFold({ open, onToggle, children }: TableFoldProps) {
  const regionId = useId();
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={open}
        aria-controls={regionId}
        className="ms-board-button ms-board-switch"
        onClick={() => onToggle(!open)}
      >
        {TABLE_FOLD_LABEL}
      </button>
      <div id={regionId} className={open ? "ms-board-table-fold" : "ms-board-table-fold is-folded"}>
        {children}
      </div>
    </>
  );
}
