import { toNumber } from "../boardMath.ts";
import { MeanGuide, MeanMark, SigmaSpan, type Position } from "../chartMarks.tsx";
import { chartLabels } from "./describe.ts";
import { mean, standardDeviation, torqueSign, type Bar } from "./model.ts";
import { TILT_DEGREES, type Setup } from "./setups.ts";
import { outcomesOf, type SourceId } from "./sources.ts";
import { distributionNow, parkedPencil, type DistributionState, type Stage } from "./state.ts";
import { usePointerScrub } from "../usePointerScrub.ts";

/** The 3 × 3 cells (0 top-left to 8 bottom-right) that carry a pip on each die face. */
const PIP_CELLS: Readonly<Record<string, readonly number[]>> = {
  "1": [4],
  "2": [0, 8],
  "3": [0, 4, 8],
  "4": [0, 2, 6, 8],
  "5": [0, 2, 4, 6, 8],
  "6": [0, 2, 3, 5, 6, 8],
};
const GRID_CELLS = Array.from({ length: 9 }, (_, cell) => cell);

interface OutcomeFaceProps {
  source: SourceId;
  label: string;
  stage: Stage;
}

/** An outcome as drawn: die pips or coin faces in the Pictures view, its label otherwise. Decorative only. */
export function OutcomeFace({ source, label, stage }: OutcomeFaceProps) {
  if (stage !== "pictures") return <span className="ms-dist-face-label">{label}</span>;
  if (source === "one-die") {
    const pips = PIP_CELLS[label];
    if (!pips) throw new Error(`DistributionBoard: no pip layout for die face "${label}".`);
    return (
      <span className="ms-dist-pips">
        {GRID_CELLS.map((cell) => (
          <span key={cell} className={pips.includes(cell) ? "ms-dist-pip is-on" : "ms-dist-pip"} />
        ))}
      </span>
    );
  }
  return (
    <span className="ms-dist-coins">
      {[...label].map((face, index) => (
        <span key={index} className="ms-dist-coin">
          {face}
        </span>
      ))}
    </span>
  );
}

interface BarChartProps {
  setup: Setup;
  state: DistributionState;
  /** The outcome whose stepper has focus or hover; its tile is marked in ochre. */
  linkedId: string | null;
  onPencilMove: (k: number) => void;
  onPencilCommit: (k: number) => void;
}

/**
 * The chart: stacked outcome tiles on a plank, the axis, and on later setups the ochre pencil, the pink μ and the
 * blue σ. It is aria-hidden; the readout sentences and DistributionTable are its accessible equivalent.
 */
export default function BarChart({ setup, state, linkedId, onPencilMove, onPencilCommit }: BarChartProps) {
  const [lowest, highest] = setup.range;
  const columns = highest - lowest + 1;
  const outcomes = outcomesOf(setup.source);
  const distribution = distributionNow(state);
  const labels = chartLabels(state);
  const W = setup.stepDenominator;
  /** Where a value sits across the chart, in percent: the middle of its column. */
  const across = (value: number) => ((value - lowest + 0.5) / columns) * 100;
  const at = (value: number): Position => ({ "--x": `${across(value)}%` });
  const center = toNumber(mean(distribution));
  const sigma = standardDeviation(distribution);
  const isBalance = setup.kind === "balance";
  // Level and still until "Balance it"; afterward it follows the live pencil.
  const tilt = isBalance && state.revealed ? torqueSign(distribution, state.pencil, W) * TILT_DEGREES : 0;
  const pencilValue = state.pencil / W;
  const drag = usePointerScrub({
    valueAt: (fraction) => {
      const k = Math.round((lowest - 0.5 + fraction * columns) * W);
      return Math.min(Math.max(k, parkedPencil(setup)), highest * W);
    },
    onMove: onPencilMove,
    onCommit: onPencilCommit,
  });

  const stackHeight = (bar: Bar) => bar.members.length;
  const tiles = distribution.bars.flatMap((bar) =>
    bar.members.map((id, row) => {
      const outcome = outcomes.find((candidate) => candidate.id === id);
      if (!outcome) throw new Error(`DistributionBoard: setup "${setup.id}" has no outcome "${id}".`);
      return (
        <span
          key={id}
          className={id === linkedId ? "ms-dist-tile is-linked" : "ms-dist-tile"}
          style={{ ...at(bar.value), "--row": row } as Position}
        >
          <OutcomeFace source={setup.source} label={outcome.label} stage={state.stage} />
        </span>
      );
    }),
  );
  const ticks = Array.from({ length: columns }, (_, index) => lowest + index);

  return (
    <div className={isBalance ? "ms-dist-chart is-balance" : "ms-dist-chart"} aria-hidden="true" style={{ "--ms-dist-cols": columns, "--ms-dist-rows": outcomes.length } as Position}>
      {labels.mu && (
        <div className="ms-mark-row">
          <MeanMark x={across(center)} label={labels.mu} />
        </div>
      )}
      {labels.sigma && (
        <div className="ms-mark-row">
          <SigmaSpan kind="sigma" from={across(center - sigma)} to={across(center + sigma)} label={labels.sigma} />
        </div>
      )}
      {labels.ghost && state.ghost && (
        <div className="ms-mark-row">
          <SigmaSpan kind="ghost" from={across(center - state.ghost.sigma)} to={across(center + state.ghost.sigma)} label={labels.ghost} />
        </div>
      )}
      <div className="ms-dist-stacks">
        {labels.mu && <MeanGuide x={across(center)} />}
        <div
          className={isBalance ? "ms-dist-beam is-plank" : "ms-dist-beam"}
          style={{ "--pivot": `${across(pencilValue)}%`, "--tilt": `${tilt}deg` } as Position}
        >
          {tiles}
          <span className="ms-dist-axis-line" />
        </div>
        {labels.arms.map((arm) => {
          const bar = distribution.bars.find((candidate) => candidate.value === arm.value);
          if (!bar) throw new Error(`DistributionBoard: no bar at ${arm.value} for its distance arm.`);
          const from = Math.min(across(center), across(arm.value));
          const to = Math.max(across(center), across(arm.value));
          return (
            <span key={arm.value} className="ms-dist-arm" style={{ "--from": `${from}%`, "--to": `${to}%`, "--row": stackHeight(bar) } as Position}>
              <span className="ms-dist-arm-label">{arm.text}</span>
            </span>
          );
        })}
      </div>
      <div className="ms-dist-under">
        {isBalance && (
          <span className="ms-dist-pencil" style={at(pencilValue)}>
            <svg className="ms-dist-pencil-wedge" viewBox="0 0 14 12" focusable="false">
              <polygon points="7,1 13,11 1,11" />
            </svg>
          </span>
        )}
        <div className="ms-dist-ticks">
          {ticks.map((value) => (
            <span key={value} className="ms-dist-tick" style={at(value)}>
              {value}
            </span>
          ))}
        </div>
        {labels.shares.length > 0 && (
          <div className="ms-dist-shares">
            {labels.shares.map((share) => (
              <span key={share.value} className="ms-dist-share" style={at(share.value)}>
                {share.text}
              </span>
            ))}
          </div>
        )}
        {labels.pencil && (
          <div className="ms-dist-pencil-row">
            <span className="ms-dist-pencil-label" style={at(pencilValue)}>
              {labels.pencil}
            </span>
          </div>
        )}
        <p className="ms-dist-unit">{labels.axis}</p>
        {isBalance && <div className="ms-dist-strip" {...drag} />}
      </div>
    </div>
  );
}
