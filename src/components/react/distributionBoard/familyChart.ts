// Where the family mode's columns and marks sit, as plain data for ColumnChart (decision 0018). Pure, so
// scripts/check-boards.mjs checks the positions; every label comes from familyDescribe.
import { toNumber } from '../boardMath.ts';
import { across, columnHeight, tickEvery } from './columnAxis.ts';
import { chartLabels } from './familyDescribe.ts';
import { familyDistribution, familyMoments, familySetupOf, visibleGhost, type FamilyState } from './familyState.ts';
import type { ChartColumn, ChartGridline, ChartMarks, ChartTick } from './chartTypes.ts';

export interface FamilyChart {
	columns: ChartColumn[];
	ticks: ChartTick[];
	gridlines: ChartGridline[];
	marks: ChartMarks;
	unit: string;
}

export function familyChart(state: FamilyState): FamilyChart {
	const setup = familySetupOf(state);
	const [first, last] = setup.axis;
	const count = last - first + 1;
	const width = 100 / count;
	const yMax = toNumber(setup.yMax);
	const bars = familyDistribution(state).bars;
	const labels = chartLabels(state);
	const every = tickEvery(count);
	const values = Array.from({ length: count }, (_, index) => first + index);
	const columns = values.map((value) => {
		const bar = bars.find((candidate) => candidate.value === value);
		const probability = bar ? toNumber(bar.probability) : 0;
		return {
			key: String(value),
			left: across(value, first, last) - width / 2,
			width,
			height: columnHeight(probability, yMax),
			nonzero: probability > 0,
			look: value === state.read,
		};
	});
	const ticks = values.map((value) => ({ key: String(value), x: across(value, first, last), label: String(value), thin: (value - first) % every !== 0 }));
	const gridlines = labels.gridlines.map((line) => ({ y: columnHeight(line.value, yMax), label: line.label, solid: line.solid }));
	const { mean, variance } = familyMoments(state);
	const mu = toNumber(mean);
	const span = (sigma: number) => ({ from: across(mu - sigma, first, last), to: across(mu + sigma, first, last) });
	const ghost = visibleGhost(state);
	const marks: ChartMarks = {
		mu: labels.mu ? { x: across(mu, first, last), label: labels.mu } : null,
		sigma: labels.sigma ? { ...span(Math.sqrt(toNumber(variance))), label: labels.sigma } : null,
		ghost: labels.ghost && ghost ? { ...span(Math.sqrt(toNumber(ghost.variance))), label: labels.ghost } : null,
	};
	return { columns, ticks, gridlines, marks, unit: labels.axis };
}
