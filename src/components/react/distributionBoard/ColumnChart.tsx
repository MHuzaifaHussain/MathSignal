import type { ReactNode } from "react";
import { MeanGuide, MeanMark, SigmaSpan, type Position } from "../chartMarks.tsx";
import type { ChartColumn, ChartGridline, ChartMarks, ChartTick } from "./chartTypes.ts";

interface ColumnChartProps {
  columns: readonly ChartColumn[];
  ticks: readonly ChartTick[];
  gridlines: readonly ChartGridline[];
  marks?: ChartMarks;
  /** Value columns leave a gap between neighbors; histogram bins touch, as a histogram's bars do. */
  touching?: boolean;
  /** Drawn over the columns in the same coordinates, such as the density curve. */
  overlay?: ReactNode;
  unit: string;
  /** The vertical unit, shown above the plot when the gridline labels are bare numbers ("Height (per cm)"). */
  heightUnit?: string;
}

const percent = (value: number) => `${value}%`;

/**
 * DistributionBoard's plain column chart for the family and density modes (decision 0018): ink columns on a fixed
 * scale, labeled gridlines in a gutter on the left, at most one ochre column, and the shared μ and σ marks. It is
 * aria-hidden: the readouts and the table behind Table view carry every number. Styles: .ms-cols.
 */
export default function ColumnChart({ columns, ticks, gridlines, marks, touching = false, overlay, unit, heightUnit }: ColumnChartProps) {
  const hasMarks = Boolean(marks?.mu || marks?.sigma || marks?.ghost);
  return (
    <div className={touching ? "ms-cols is-touching" : "ms-cols"} aria-hidden="true">
      {hasMarks && (
        <div className="ms-cols-marks">
          {marks?.mu && (
            <div className="ms-mark-row">
              <MeanMark x={marks.mu.x} label={marks.mu.label} />
            </div>
          )}
          {marks?.sigma && (
            <div className="ms-mark-row">
              <SigmaSpan kind="sigma" from={marks.sigma.from} to={marks.sigma.to} label={marks.sigma.label} />
            </div>
          )}
          {marks?.ghost && (
            <div className="ms-mark-row">
              <SigmaSpan kind="ghost" from={marks.ghost.from} to={marks.ghost.to} label={marks.ghost.label} />
            </div>
          )}
        </div>
      )}
      {heightUnit && <p className="ms-cols-height-unit">{heightUnit}</p>}
      <div className="ms-cols-plot">
        {gridlines.map((line) => (
          <span key={line.label} className={line.solid ? "ms-cols-grid is-solid" : "ms-cols-grid"} style={{ "--y": percent(line.y) } as Position}>
            <span className="ms-cols-grid-label">{line.label}</span>
          </span>
        ))}
        <div className="ms-cols-area">
          {columns.map((column) => (
            <span
              key={column.key}
              className={column.look ? "ms-cols-column is-look" : "ms-cols-column"}
              hidden={!column.nonzero}
              style={{ "--left": percent(column.left), "--width": percent(column.width), "--h": percent(column.height) } as Position}
            />
          ))}
          {overlay}
          {marks?.mu && <MeanGuide x={marks.mu.x} />}
        </div>
      </div>
      <div className="ms-cols-ticks">
        {ticks.map((tick) => (
          <span key={tick.key} className={tick.thin ? "ms-cols-tick is-thin" : "ms-cols-tick"} style={{ "--x": percent(tick.x) } as Position}>
            {tick.label}
          </span>
        ))}
      </div>
      <p className="ms-cols-unit">{unit}</p>
    </div>
  );
}
