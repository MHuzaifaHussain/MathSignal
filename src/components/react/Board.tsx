import { useCallback, useEffect, useRef, type ReactNode } from "react";

interface BoardProps {
  /** Accessible name of the figure, e.g. "Normal distribution with draggable mean and spread". */
  label: string;
  /** The Mafs canvas, plus any ChalkNote. */
  children: ReactNode;
  /** Sliders, readouts and buttons shown under the canvas. */
  tray?: ReactNode;
  /** Adds a Reset button to the tray. */
  onReset?: () => void;
  /** Polite live-region text. Update it only when an interaction ends, never on every frame. */
  announcement?: string;
  /** Called once when a drag on the canvas ends; use it to update `announcement`. */
  onInteractionEnd?: () => void;
}

/** The frame every interactive plot sits in. Styles: src/styles/components.css (.ms-board). */
export default function Board({ label, children, tray, onReset, announcement = "", onInteractionEnd }: BoardProps) {
  const hasTray = Boolean(tray) || Boolean(onReset);

  // Mafs captures the pointer and stops pointerup from bubbling, so listen on window in the
  // capture phase for the end of a drag that started on this board.
  const interactionEndRef = useRef(onInteractionEnd);
  useEffect(() => {
    interactionEndRef.current = onInteractionEnd;
  });
  const removeListenersRef = useRef<(() => void) | null>(null);
  useEffect(() => () => removeListenersRef.current?.(), []);

  const handlePointerDown = useCallback(() => {
    removeListenersRef.current?.();
    const handleEnd = () => {
      removeListenersRef.current?.();
      interactionEndRef.current?.();
    };
    window.addEventListener("pointerup", handleEnd, { capture: true });
    window.addEventListener("pointercancel", handleEnd, { capture: true });
    removeListenersRef.current = () => {
      window.removeEventListener("pointerup", handleEnd, { capture: true });
      window.removeEventListener("pointercancel", handleEnd, { capture: true });
      removeListenersRef.current = null;
    };
  }, []);

  return (
    <figure className="ms-board" role="group" aria-label={label}>
      <div className="ms-board-canvas" onPointerDownCapture={handlePointerDown}>
        {children}
      </div>
      {hasTray && (
        <div className="ms-board-tray">
          {tray}
          {onReset && (
            <button type="button" className="ms-board-button" onClick={onReset}>
              Reset
            </button>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </figure>
  );
}
