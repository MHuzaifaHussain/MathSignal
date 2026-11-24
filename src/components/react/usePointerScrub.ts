import { useRef, type PointerEvent } from "react";

interface PointerScrubOptions {
  /** The board's value at a point across the strip, 0 at its left edge and 1 at its right. */
  valueAt: (across: number) => number;
  /** Every move while dragging: update the board, but don't announce. */
  onMove: (value: number) => void;
  /** Once, when the drag ends: announce. */
  onCommit: (value: number) => void;
}

const clampUnit = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Pointer drag along a strip under a chart's axis. It mirrors one of the tray's sliders, which is the keyboard and
 * screen-reader path, so the strip itself is aria-hidden and never focusable. Spread the result onto the strip.
 */
export function usePointerScrub({ valueAt, onMove, onCommit }: PointerScrubOptions) {
  const dragging = useRef(false);
  const lastValue = useRef<number | null>(null);

  const valueOf = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return valueAt(clampUnit((event.clientX - rect.left) / rect.width));
  };

  const moveTo = (value: number) => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    onMove(value);
  };

  const finish = (event: PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (lastValue.current !== null) onCommit(lastValue.current);
  };

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = true;
      lastValue.current = null;
      moveTo(valueOf(event));
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (dragging.current) moveTo(valueOf(event));
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  };
}
