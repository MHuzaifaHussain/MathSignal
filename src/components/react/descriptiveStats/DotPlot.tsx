import type { CSSProperties, PointerEvent } from "react";
import { MeanGuide, MeanMark, SigmaSpan } from "../chartMarks.tsx";
import type { ChartDot, ChartRow } from "./chart.ts";

type Position = CSSProperties & Record<`--${string}`, string | number>;

/** Spread onto the strip under the axis: pointer drag that mirrors a tray slider. */
export interface ScrubHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

function dotClass(dot: ChartDot): string {
  return ["ms-desc-dot", dot.look ? "is-look" : "", dot.iqrFlag ? "is-iqr" : "", dot.zFlag ? "is-z" : ""].filter(Boolean).join(" ");
}

function Dot({ dot }: { dot: ChartDot }) {
  return (
    <span className={dotClass(dot)} style={{ "--x": `${dot.x}%`, "--row": dot.row } as Position}>
      {dot.text && <span className="ms-desc-dot-text">{dot.text}</span>}
      {dot.iqrFlag && <span className="ms-desc-flag-tag is-iqr">IQR</span>}
      {dot.zFlag && <span className="ms-desc-flag-tag is-z">z</span>}
    </span>
  );
}

function Row({ row, scrub }: { row: ChartRow; scrub?: ScrubHandlers }) {
  const onAxis = row.dots.filter((dot) => !dot.lane);
  const inLane = row.dots.filter((dot) => dot.lane);
  const hasLane = inLane.length > 0 || Boolean(row.mean?.lane);
  return (
    <div className={hasLane ? "ms-desc-row has-lane" : "ms-desc-row"}>
      {row.title && <p className="ms-desc-row-title">{row.title}</p>}
      <div className="ms-desc-track">
        {row.mean && !row.mean.lane && (
          <div className="ms-mark-row">
            <MeanMark x={row.mean.x} label={row.mean.label} />
          </div>
        )}
        {row.spans.map((span) => (
          <div key={span.kind} className="ms-mark-row">
            <SigmaSpan kind={span.kind} from={span.from} to={span.to} label={span.label} />
          </div>
        ))}
        <div className="ms-desc-plot" style={{ "--reserve": row.reserve } as Position}>
          {row.mean && !row.mean.lane && <MeanGuide x={row.mean.x} />}
          {row.arms.map((arm, index) => (
            <span key={index} className="ms-desc-arm" style={{ "--from": `${arm.from}%`, "--to": `${arm.to}%`, "--row": arm.row } as Position} />
          ))}
          {onAxis.map((dot) => (
            <Dot key={dot.key} dot={dot} />
          ))}
          {row.modeTags.map((tag) => (
            <span key={tag.x} className="ms-desc-mode-tag" style={{ "--x": `${tag.x}%`, "--row": tag.row } as Position}>
              mode
            </span>
          ))}
        </div>
        {row.box && (
          <div className="ms-desc-box-row">
            {row.box.fences?.map((x, index) => (
              <span key={index} className="ms-desc-fence" style={{ "--x": `${x}%` } as Position} />
            ))}
            <span className="ms-desc-whisker" style={{ "--from": `${row.box.low}%`, "--to": `${row.box.high}%` } as Position} />
            <span className="ms-desc-box" style={{ "--from": `${row.box.q1}%`, "--to": `${row.box.q3}%` } as Position} />
            <span className="ms-desc-box-median" style={{ "--x": `${row.box.median}%` } as Position} />
          </div>
        )}
        {row.median && (
          <div className="ms-desc-tag-row">
            <span className="ms-desc-median" style={{ "--x": `${row.median.x}%` } as Position}>
              <span className="ms-desc-diamond" />
              {row.median.label}
            </span>
          </div>
        )}
        {row.quartileTags.length > 0 && (
          <div className="ms-desc-tag-row">
            {row.quartileTags.map((tag) => (
              <span key={tag.label} className="ms-desc-quartile" style={{ "--x": `${tag.x}%` } as Position}>
                {tag.label}
              </span>
            ))}
          </div>
        )}
        <div className="ms-desc-axis">
          {row.ticks.map((tick) => (
            <span key={tick.value} className={tick.narrow ? "ms-desc-tick" : "ms-desc-tick is-minor"} style={{ "--x": `${tick.x}%` } as Position}>
              {tick.label}
            </span>
          ))}
          {scrub && <div className="ms-desc-strip" {...scrub} />}
        </div>
        {row.zTicks.length > 0 && (
          <div className="ms-desc-tag-row">
            {row.zTicks.map((tick) => (
              <span key={tick.label} className={`ms-desc-ztick is-${tick.kind}`} style={{ "--x": `${tick.x}%` } as Position}>
                {tick.label}
              </span>
            ))}
          </div>
        )}
        <p className="ms-desc-unit">{row.unit}</p>
      </div>
      {hasLane && (
        <div className="ms-desc-lane">
          {row.mean?.lane && <span className="ms-desc-lane-mean">{row.mean.label}</span>}
          {inLane.map((dot) => (
            <span key={dot.key} className={dotClass(dot).replace("ms-desc-dot", "ms-desc-lane-value")}>
              {dot.text}
              {dot.iqrFlag && <span className="ms-desc-flag-tag is-iqr">IQR</span>}
              {dot.zFlag && <span className="ms-desc-flag-tag is-z">z</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface DotPlotProps {
  rows: readonly ChartRow[];
  /** Pointer drag under the first row's axis, mirroring the tray's slider. */
  scrub?: ScrubHandlers;
}

/**
 * Dot plots on value-positioned axes: ties stack, marks sit on rows of their own so labels never collide, and
 * values past the axis wait in a lane at the right edge. aria-hidden: the readouts and tables are its equivalent.
 */
export default function DotPlot({ rows, scrub }: DotPlotProps) {
  return (
    <div className="ms-desc-chart" aria-hidden="true">
      {rows.map((row, index) => (
        <Row key={row.id} row={row} scrub={index === 0 ? scrub : undefined} />
      ))}
    </div>
  );
}
