import { useSyncExternalStore } from "react";

// How much larger than the base size the page is drawn: the root font size over 16px. It is 1 up to 1920px and grows
// to 1.5 at 3840px (global.css, decision 0025). Mafs takes px numbers, so every Mafs board multiplies its px design
// constants (plot heights, text sizes, line weights) by it. One shared store, so a page with several boards keeps one
// resize listener and reads the root at most once per animation frame.

/** The root font size, in px, at which a board is drawn at its design size. */
const BASE_ROOT_FONT_SIZE_PX = 16;
/** The scale on the server and during hydration: the server HTML is drawn at the base size. */
export const BASE_BOARD_SCALE = 1;

let current: number | null = null;
let pendingFrame = 0;
const listeners = new Set<() => void>();

function readBoardScale(): number {
  const fontSize = getComputedStyle(document.documentElement).fontSize;
  const pixels = Number.parseFloat(fontSize);
  if (!(pixels > 0)) throw new Error(`useBoardScale: the root font size is "${fontSize}", not a positive length.`);
  return pixels / BASE_ROOT_FONT_SIZE_PX;
}

/** Reads the root again and tells the boards, only when the scale has changed. */
function refresh(): void {
  pendingFrame = 0;
  const next = readBoardScale();
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

function scheduleRefresh(): void {
  if (pendingFrame === 0) pendingFrame = requestAnimationFrame(refresh);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("resize", scheduleRefresh);
    // The window may have been resized while no board listened, leaving the cached value stale.
    const next = readBoardScale();
    if (next !== current) {
      current = next;
      listener();
    }
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener("resize", scheduleRefresh);
    if (pendingFrame !== 0) cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
  };
}

function getSnapshot(): number {
  if (current === null) current = readBoardScale();
  return current;
}

const getServerSnapshot = () => BASE_BOARD_SCALE;

/**
 * The board scale: 1 up to 1920px, 1.5 at 3840px. Islands are rendered on the server too, so the server and the
 * hydrating render use BASE_BOARD_SCALE and the board re-renders at the measured scale right after hydration (React
 * doesn't patch a px height that differs at hydration, so a value read during that render would leave it stale).
 */
export default function useBoardScale(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
