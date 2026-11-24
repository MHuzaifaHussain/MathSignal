import type { CSSProperties } from "react";
import { lineUpBars } from "./chart.ts";
import type { DescriptiveState } from "./state.ts";

type Position = CSSProperties & Record<`--${string}`, string | number>;

interface LineUpProps {
  state: DescriptiveState;
}

/**
 * The pictures stage: each child as a bar drawn to their height, with the height and child number under it. Bars
 * keep their element when the class lines up, so they slide to their new place (instantly under reduced motion).
 * Decorative: the data table and the status line say the same.
 */
export default function LineUp({ state }: LineUpProps) {
  const bars = lineUpBars(state);
  return (
    <div className="ms-desc-lineup" aria-hidden="true" style={{ "--count": bars.length } as Position}>
      {bars.map((bar) => (
        <span
          key={bar.child}
          className={bar.look ? "ms-desc-bar is-look" : "ms-desc-bar"}
          style={{ "--slot": bar.slot, "--h": bar.percent / 100 } as Position}
        >
          <span className="ms-desc-bar-body" />
          <span className="ms-desc-bar-value">{bar.height}</span>
          <span className="ms-desc-bar-child">{bar.child + 1}</span>
        </span>
      ))}
    </div>
  );
}
