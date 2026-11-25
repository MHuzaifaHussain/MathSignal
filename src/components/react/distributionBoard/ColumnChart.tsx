import type { ReactNode } from "react";
import { MeanGuide, MeanMark, SigmaSpan, type Position } from "../chartMarks.tsx";

/** One drawn column. Positions are percents of the column area, worked out by the mode (columnAxis or the ruler). */
export interface ChartColumn {
  key: string;
  /** Left edge and width across the column area, in percent. */
  left: number;
  width: number;
  /** Height as a percent of the plot; any nonzero chance draws at least the 2 px stub (MIN_VISIBLE_PX). */
  height: number;
  nonzero: boolean;
  /** The board's one ochre "look here" column. */
  look?: boolean;
}

export interface ChartTick {
  key: string;
  /** Across the column area, in percent. */
  x: number;
  /** Empty for an unlabeled tick mark. */
  label: string;
  /** Labeled only where the columns are wide enough (every second value on a narrow chart). */
  thin?: boolean;
}

export interface ChartGridline {
  /** Height as a percent of the plot. */
  y: number;
  label: string;
  solid: boolean;
}

export interface ChartMarks {
  mu?: { x: number; label: string } | null;
  sigma?: { from: number; to: number; label: string } | null;
  ghost?: { from: number; to: number; label: string } | null;
}

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
}

const percent = (value: number) => `${value}%`;

/**
 * DistributionBoard's plain column chart for the family and density modes (decision 0018): ink columns on a fixed
 * scale, labeled gridlines in a gutter on the left, at most one ochre column, and the shared μ and σ marks. It is
 * aria-hidden: the readouts and the table behind Table view carry every number. Styles: .ms-cols.
 */
export default function ColumnChart({ columns, ticks, gridlines, marks, touching = false, overlay, unit }: ColumnChartProps) {
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
