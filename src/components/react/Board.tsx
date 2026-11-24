import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

const MOVE_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

interface BoardProps {
  /** Accessible name of the figure, e.g. "Normal distribution with draggable mean and spread". */
  label: string;
  /**
   * A Mafs canvas (plus any ChalkNote), or an HTML table for discrete content (decision 0011). HTML boards own
   * their announcements and don't pass onInteractionEnd or handleLabels.
   */
  children: ReactNode;
  /** Optional sliders, readouts and buttons shown under the canvas. */
  tray?: ReactNode;
  /** Adds a Reset button to the tray. */
  onReset?: () => void;
  /** Polite live-region text. Update it only when an interaction ends, never on every frame. */
  announcement?: string;
  /** Called once when a drag or an arrow-key move on the canvas ends; use it to update `announcement`. */
  onInteractionEnd?: () => void;
  /**
   * Accessible names for the canvas's draggable handles, in render order. When given, the handles stay
   * keyboard-focusable (arrow keys move them). When omitted, the tray's sliders are the keyboard path,
   * so the handles are removed from the tab order and the accessibility tree.
   */
  handleLabels?: readonly string[];
}

/** The frame every interactive plot sits in. Styles: src/styles/components.css (.ms-board). */
export default function Board({
  label,
  children,
  tray,
  onReset,
  announcement = "",
  onInteractionEnd,
  handleLabels,
}: BoardProps) {
  const hasTray = Boolean(tray) || Boolean(onReset);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Mafs renders each handle as a focusable <g> with no name or role; give them one or hide them.
  // Mafs mounts its handles only after measuring itself, so watch the canvas for them.
  const handleLabelsRef = useRef(handleLabels);
  // A layout effect, so the labels are current before the MutationObserver's microtask reads them when a
  // change adds or removes a handle in the same commit.
  useLayoutEffect(() => {
    handleLabelsRef.current = handleLabels;
  });
  const describeHandles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.querySelectorAll<SVGGElement>(".mafs-movable-point").forEach((handle, index) => {
      const handleLabel = handleLabelsRef.current?.[index];
      if (handleLabel) {
        handle.setAttribute("role", "button");
        handle.setAttribute("aria-roledescription", "draggable point");
        handle.setAttribute("aria-label", `${handleLabel}. Use the arrow keys to move it.`);
        handle.removeAttribute("aria-hidden");
        handle.setAttribute("tabindex", "0");
      } else {
        handle.setAttribute("tabindex", "-1");
        handle.setAttribute("aria-hidden", "true");
      }
    });
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    describeHandles();
    // childList only: the attribute changes above must not retrigger the observer.
    const observer = new MutationObserver(describeHandles);
    observer.observe(canvas, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [describeHandles]);
  // New names for handles that stay mounted (no childList change, so the observer stays quiet).
  const labelsKey = handleLabels?.join("\u0000");
  useEffect(() => {
    describeHandles();
  }, [labelsKey, describeHandles]);

  // Mafs captures the pointer and stops pointerup and keyup from bubbling, so listen in the
  // capture phase. The callback is deferred one task so Mafs' own final onMove has rendered first.
  const interactionEndRef = useRef(onInteractionEnd);
  useEffect(() => {
    interactionEndRef.current = onInteractionEnd;
  });
  const pendingEndRef = useRef<number | undefined>(undefined);
  const removeListenersRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      removeListenersRef.current?.();
      window.clearTimeout(pendingEndRef.current);
    },
    [],
  );

  const endInteraction = useCallback(() => {
    window.clearTimeout(pendingEndRef.current);
    pendingEndRef.current = window.setTimeout(() => interactionEndRef.current?.(), 0);
  }, []);

  const handlePointerDown = useCallback(() => {
    removeListenersRef.current?.();
    const handleEnd = () => {
      removeListenersRef.current?.();
      endInteraction();
    };
    window.addEventListener("pointerup", handleEnd, { capture: true });
    window.addEventListener("pointercancel", handleEnd, { capture: true });
    removeListenersRef.current = () => {
      window.removeEventListener("pointerup", handleEnd, { capture: true });
      window.removeEventListener("pointercancel", handleEnd, { capture: true });
      removeListenersRef.current = null;
    };
  }, [endInteraction]);

  const handleKeyUp = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (MOVE_KEYS.has(event.key)) endInteraction();
    },
    [endInteraction],
  );

  return (
    <figure className="ms-board" role="group" aria-label={label}>
      <div ref={canvasRef} className="ms-board-canvas" onPointerDownCapture={handlePointerDown} onKeyUpCapture={handleKeyUp}>
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
