import { useState } from "react";
import { createSliderGuard, type SliderGuard } from "./sliderGuard.ts";

/**
 * One stale-commit guard for a board, kept across renders (sliderGuard.ts has the rule). Call `moved` from each
 * slider's change handler, `interrupt` from every other action, and `take` first in each slider's commit handler.
 */
export default function useCommittedSlider<K extends string>(): SliderGuard<K> {
  const [guard] = useState(() => createSliderGuard<K>());
  return guard;
}
