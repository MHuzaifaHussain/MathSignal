import { useRef, type PointerEvent } from "react";

interface PencilDragOptions {
  /** The pencil's whole-number position k at a point across the strip, 0 at its left edge and 1 at its right. */
  positionAt: (across: number) => number;
  /** Every move while dragging: update the board, but don't announce. */
  onMove: (k: number) => void;
  /** Once, when the drag ends: announce. */
  onCommit: (k: number) => void;
}

const clampUnit = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Pointer drag on the strip under the axis. It mirrors the tray's "Pencil position" slider, which is the keyboard
 * and screen-reader path, so the strip itself is aria-hidden and never focusable.
 */
export function usePencilDrag({ positionAt, onMove, onCommit }: PencilDragOptions) {
  const dragging = useRef(false);
  const lastPosition = useRef<number | null>(null);

  const positionOf = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return positionAt(clampUnit((event.clientX - rect.left) / rect.width));
  };

  const moveTo = (k: number) => {
    if (k === lastPosition.current) return;
    lastPosition.current = k;
    onMove(k);
  };

  const finish = (event: PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (lastPosition.current !== null) onCommit(lastPosition.current);
  };

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = true;
      lastPosition.current = null;
      moveTo(positionOf(event));
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (dragging.current) moveTo(positionOf(event));
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  };
}
