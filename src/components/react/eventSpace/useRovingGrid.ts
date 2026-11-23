import { useCallback, useRef, useState, type KeyboardEvent } from "react";

type Position = readonly [row: number, col: number];

/**
 * Roving tabindex for a grid of buttons (WAI-ARIA data grid pattern): the grid is one tab stop, arrow keys
 * move without wrapping, Home/End go to the ends of the row, Ctrl+Home/End to the first and last cell.
 * Space and Enter stay with the buttons themselves, so toggling is native.
 */
export function useRovingGrid(rows: number, cols: number) {
  const [focused, setFocused] = useState<Position>([0, 0]);
  const cells = useRef(new Map<string, HTMLButtonElement>());

  const moveTo = useCallback((row: number, col: number) => {
    const next: Position = [Math.min(Math.max(row, 0), rows - 1), Math.min(Math.max(col, 0), cols - 1)];
    setFocused(next);
    cells.current.get(`${next[0]}:${next[1]}`)?.focus();
  }, [rows, cols]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const [row, col] = focused;
    const targets: Record<string, Position | undefined> = {
      ArrowUp: [row - 1, col],
      ArrowDown: [row + 1, col],
      ArrowLeft: [row, col - 1],
      ArrowRight: [row, col + 1],
      Home: event.ctrlKey ? [0, 0] : [row, 0],
      End: event.ctrlKey ? [rows - 1, cols - 1] : [row, cols - 1],
    };
    const target = targets[event.key];
    if (!target) return;
    event.preventDefault();
    moveTo(target[0], target[1]);
  }, [focused, moveTo, rows, cols]);

  const tabIndexFor = useCallback((row: number, col: number): 0 | -1 => (row === focused[0] && col === focused[1] ? 0 : -1), [focused]);

  /** Ref callback for the button at (row, col); also follows focus when a cell is clicked. */
  const register = useCallback((row: number, col: number) => (element: HTMLButtonElement | null) => {
    if (element) cells.current.set(`${row}:${col}`, element);
    else cells.current.delete(`${row}:${col}`);
  }, []);

  const onCellFocus = useCallback((row: number, col: number) => setFocused([row, col]), []);

  return { focused, tabIndexFor, onKeyDown, register, onCellFocus };
}
