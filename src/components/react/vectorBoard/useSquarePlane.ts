import { useEffect, useState, type RefObject } from "react";

/** The plane's side before it is measured (and on the server): its width in a 375px viewport. */
export const FALLBACK_PLANE_SIZE = 343;

/**
 * The measured width of the plane's wrapper, so Mafs can be as tall as it is wide. The wrapper's CSS
 * (aspect-ratio: 1) reserves the square before this runs, so the board doesn't shift when it hydrates.
 */
export default function useSquarePlane(ref: RefObject<HTMLElement | null>): number {
  const [size, setSize] = useState(FALLBACK_PLANE_SIZE);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const width = Math.round(element.clientWidth);
      if (width > 0) setSize(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
