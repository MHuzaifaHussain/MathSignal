import { useEffect, useState } from "react";
import { createAnnouncer, type Announcer, type Clock } from "./announcer.ts";

/** Timers are only started by `announce`, which boards call from effects and handlers, so this never runs on the server. */
const WINDOW_CLOCK: Clock = {
  setTimeout: (run, ms) => window.setTimeout(run, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};

/**
 * A board's polite live region: returns the text to pass to Board's `announcement`, and `announce(text, delayMs)`.
 * Call `announce` only when an interaction ends; pass KEYBOARD_COMMIT_DELAY_MS for a burst of key presses.
 * `announce` keeps its identity across renders, so effects can list it as a dependency.
 */
export default function useAnnouncer(): readonly [string, Announcer["announce"]] {
  const [announcement, setAnnouncement] = useState("");
  const [announcer] = useState(() => createAnnouncer(setAnnouncement, WINDOW_CLOCK));
  useEffect(() => announcer.cancel, [announcer]);
  return [announcement, announcer.announce];
}
