// Where the density mode's bins, ticks, gridlines and marks sit, as plain data for ColumnChart and CurvePlot
// (decision 0018). Every x goes through rulerPercent, so the Bars and Curve views put the same place at the same
// spot. Pure, so scripts/check-boards.mjs checks the positions.
import { fraction, toNumber } from '../boardMath.ts';
import { columnHeight } from './columnAxis.ts';
import type { ChartColumn, ChartGridline, ChartMarks, ChartTick } from './ColumnChart.tsx';
import { bins, curvePoints, meanOf, QUARTERS_PER_CM, RULER_CM, rulerPercent, shadedPoints, varianceOf, type Knot } from './density.ts';
import { chartLabels } from './densityDescribe.ts';
import { binWidthOf, densitySetupOf, quartersToCm, shapeNow, type DensityState } from './densityState.ts';

/** A point of the curve in chart percents: x across the ruler, y up the plot. */
export interface PlotPoint {
	x: number;
	y: number;
}

export interface DensityChart {
	/** Empty in the Curve view. */
	columns: ChartColumn[];
	ticks: ChartTick[];
	gridlines: ChartGridline[];
	marks: ChartMarks;
	/** The curve's outline, drawn in the Curve view. */
	curve: PlotPoint[] | null;
	/** The shaded stretch and its two edges, on a setup with an interval. */
	shaded: { outline: PlotPoint[]; from: number; to: number } | null;
	unit: string;
	heightUnit: string;
}

export function densityChart(state: DensityState): DensityChart {
	const setup = densitySetupOf(state);
	const shape = shapeNow(state);
	const yMax = toNumber(setup.yMax);
	const labels = chartLabels(state);
	const toPlot = (points: readonly Knot[]) =>
		points.map((point) => ({ x: rulerPercent(point.x), y: columnHeight(toNumber(point.height), yMax) }));
	const columns =
		state.stage === 'bars'
			? bins(shape, binWidthOf(state.binsPerCm)).map((bin) => ({
					key: String(toNumber(bin.from)),
					left: rulerPercent(bin.from),
					width: rulerPercent(bin.to) - rulerPercent(bin.from),
					height: columnHeight(toNumber(bin.height), yMax),
					nonzero: bin.share.numerator > 0,
				}))
			: [];
	const ticks = Array.from({ length: RULER_CM * QUARTERS_PER_CM + 1 }, (_, quarter) => ({
		key: String(quarter),
		x: rulerPercent(fraction(quarter, QUARTERS_PER_CM)),
		label: quarter % QUARTERS_PER_CM === 0 ? String(quarter / QUARTERS_PER_CM) : '',
	}));
	const gridlines = labels.gridlines.map((line) => ({ y: columnHeight(line.value, yMax), label: line.label, solid: line.solid }));
	const mu = toNumber(meanOf(shape));
	const sigma = Math.sqrt(toNumber(varianceOf(shape)));
	const marks: ChartMarks = {
		mu: labels.mu ? { x: rulerPercent(mu), label: labels.mu } : null,
		sigma: labels.sigma ? { from: rulerPercent(mu - sigma), to: rulerPercent(mu + sigma), label: labels.sigma } : null,
	};
	const interval = setup.openingInterval
		? { outline: toPlot(shadedPoints(shape, quartersToCm(state.from), quartersToCm(state.to))), from: rulerPercent(quartersToCm(state.from)), to: rulerPercent(quartersToCm(state.to)) }
		: null;
	return {
		columns,
		ticks,
		gridlines,
		marks,
		curve: state.stage === 'curve' ? toPlot(curvePoints(shape)) : null,
		shaded: interval,
		unit: labels.axis,
		heightUnit: labels.heightAxis,
	};
}
