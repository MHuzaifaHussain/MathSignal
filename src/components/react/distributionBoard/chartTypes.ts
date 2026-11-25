// The plain data the family and density modes hand to ColumnChart (decision 0018). Types only, so the pure modules
// never import a React component.

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
