// What DescriptiveStats draws, as plain data: dot rows, marks and boxes in percent across each axis. Pure, so
// scripts/check-boards.mjs checks what the chart shows before Check; the React files only lay it out.
// The chart is aria-hidden: the readouts and tables say everything it shows. Design and reasoning: decision 0015.
import { toNumber } from '../boardMath.ts';
import type { SpanKind } from '../chartMarks.tsx';
import { axisUnit, ghostLabel, laneLabel, meanLabel, medianLabel, spreadLabel, tickLabel } from './describe.ts';
import { across, stackHeight, stackRows, ticks, type Axis } from './layout.ts';
import { fences, iqrFlags, mean, median, minMax, modes, populationSD, quartiles, rootNumber, sampleSD, sortedValues, zFlags, zScore, type Root } from './model.ts';
import { listsOf, type Setup } from './setups.ts';
import { isCovered, setupOf, valuesNow, type DescriptiveState } from './state.ts';

export interface ChartDot {
	key: string;
	/** Percent across the axis; 100 for a dot in the off-chart lane. */
	x: number;
	row: number;
	/** Drawn as an edge arrow carrying `text`, because the value is past the axis. */
	lane: boolean;
	/** A place number on the box plot's line-up step, or the lane arrow's value. */
	text: string | null;
	/** Ochre "look here": the reader's pick, the child being moved, or Ana's mark. */
	look: boolean;
	iqrFlag: boolean;
	zFlag: boolean;
}

export interface ChartRow {
	id: string;
	title: string | null;
	ticks: { value: number; label: string; x: number; narrow: boolean }[];
	unit: string;
	dots: ChartDot[];
	/** Rows of dots to reserve, so the chart doesn't shift as dots stack. */
	reserve: number;
	mean: { x: number; label: string; lane: boolean } | null;
	median: { x: number; label: string } | null;
	spans: { kind: SpanKind; from: number; to: number; label: string }[];
	quartileTags: { x: number; label: string }[];
	box: { q1: number; median: number; q3: number; low: number; high: number; fences: readonly [number, number] | null } | null;
	/** The z row's 0 (pink mean) and ±1 (blue σ) ticks. */
	zTicks: { x: number; kind: 'mean' | 'sigma'; label: string }[];
	/** Distance arms from each dot to the mean, ink. */
	arms: { from: number; to: number; row: number }[];
	/** Ink "mode" tags above the tallest stacks. */
	modeTags: { x: number; row: number }[];
}

/**
 * Dot rows the chart reserves, so it keeps its height. A slider can stack every dot on one value, so those setups
 * reserve one row per dot; fixed lists reserve the tallest stack any of their presets makes.
 */
function reserveFor(setup: Setup, axis: Axis, scale: (values: readonly number[]) => readonly number[] = (values) => values): number {
	if (setup.slider) return Math.max(...listsOf(setup).map((list) => list.values.length));
	return Math.max(...listsOf(setup).map((list) => stackHeight(scale(list.values).map((value) => Math.min(value, axis.max)), axis)));
}
const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

function emptyRow(id: string, axis: Axis, unit: string, values: readonly number[], reserve: number): ChartRow {
	const rows = stackRows(values.map((value) => Math.min(value, axis.max)), axis);
	return {
		id,
		title: null,
		ticks: ticks(axis).map((tick) => ({ ...tick, label: tickLabel(tick.value), x: across(axis, tick.value) })),
		unit,
		dots: values.map((value, index) => ({
			key: `${id}-${index}`,
			x: clampPercent(across(axis, value)),
			row: rows[index],
			lane: value > axis.max,
			text: null,
			look: false,
			iqrFlag: false,
			zFlag: false,
		})),
		reserve,
		mean: null,
		median: null,
		spans: [],
		quartileTags: [],
		box: null,
		zTicks: [],
		arms: [],
		modeTags: [],
	};
}

function spreadSpans(axis: Axis, values: readonly number[], state: DescriptiveState): ChartRow['spans'] {
	const center = toNumber(mean(values));
	const span = (kind: ChartRow['spans'][number]['kind'], root: Root, label: string) => {
		const size = rootNumber(root);
		return { kind, from: clampPercent(across(axis, center - size)), to: clampPercent(across(axis, center + size)), label };
	};
	const sigma = populationSD(values);
	const spans = [span('sigma', sigma, spreadLabel('σ', sigma))];
	if (state.sample) spans.push(span('sample', sampleSD(values), spreadLabel('s', sampleSD(values))));
	if (state.ghost) spans.push(span('ghost', state.ghost.sigma, ghostLabel(state.ghost.sigma)));
	return spans;
}

function boxOf(axis: Axis, values: readonly number[], withFences: boolean): ChartRow['box'] {
	const { q1, median: middle, q3 } = quartiles(values);
	const flags = iqrFlags(values);
	const inside = sortedValues(values.filter((_, index) => !flags[index]));
	const { lower, upper } = fences(values);
	const at = (value: number) => clampPercent(across(axis, value));
	return {
		q1: at(toNumber(q1)),
		median: at(toNumber(middle)),
		q3: at(toNumber(q3)),
		low: at(inside[0]),
		high: at(inside[inside.length - 1]),
		fences: withFences ? [at(toNumber(lower)), at(toNumber(upper))] : null,
	};
}

function meanMark(axis: Axis, state: DescriptiveState, values: readonly number[]): ChartRow['mean'] {
	const center = toNumber(mean(values));
	const lane = center > axis.max;
	return { x: clampPercent(across(axis, center)), label: lane ? `${meanLabel(state)} →` : meanLabel(state), lane };
}

function centerRow(state: DescriptiveState): ChartRow {
	const setup = setupOf(state);
	const values = valuesNow(state);
	const axis = setup.axis;
	const row = emptyRow('main', axis, axisUnit(state), values, reserveFor(setup, axis));
	const covered = isCovered(state);
	row.dots = row.dots.map((dot, index) => ({
		...dot,
		text: dot.lane ? laneLabel(values[index], setup) : null,
		look: (setup.kind === 'lineup' && state.pick === index) || (setup.kind === 'spread' && state.selected === index),
	}));
	if (!covered) {
		row.mean = meanMark(axis, state, values);
		if (setup.kind !== 'spread') row.median = { x: clampPercent(across(axis, toNumber(median(values)))), label: medianLabel(state) };
	}
	if (setup.kind === 'newcomer') {
		const tops = modes(values);
		row.modeTags = tops.map((value) => ({
			x: across(axis, value),
			row: Math.max(...row.dots.filter((_, index) => values[index] === value).map((dot) => dot.row)) + 1,
		}));
	}
	if (setup.kind === 'spread') {
		row.spans = spreadSpans(axis, values, state);
		if (state.distances) {
			const center = clampPercent(across(axis, toNumber(mean(values))));
			row.arms = row.dots.map((dot) => ({ from: Math.min(dot.x, center), to: Math.max(dot.x, center), row: dot.row }));
		}
	}
	return row;
}

function boxRow(state: DescriptiveState): ChartRow {
	const setup = setupOf(state);
	const values = state.values;
	const row = emptyRow('main', setup.axis, axisUnit(state), values, reserveFor(setup, setup.axis));
	const ordered = sortedValues(values);
	const flags = iqrFlags(values);
	row.dots = row.dots.map((dot, index) => ({ ...dot, text: state.stage === 'line-up' ? String(ordered.indexOf(values[index]) + 1) : null, iqrFlag: state.stage === 'box' && flags[index] }));
	if (state.stage === 'quartiles') {
		const { q1, median: middle, q3 } = quartiles(values);
		row.quartileTags = [
			{ x: across(setup.axis, toNumber(q1)), label: 'Q1' },
			{ x: across(setup.axis, toNumber(middle)), label: 'median' },
			{ x: across(setup.axis, toNumber(q3)), label: 'Q3' },
		];
	}
	if (state.stage === 'box') row.box = boxOf(setup.axis, values, true);
	return row;
}

function outlierRow(state: DescriptiveState): ChartRow {
	const setup = setupOf(state);
	const values = state.values;
	const row = emptyRow('main', setup.axis, axisUnit(state), values, reserveFor(setup, setup.axis));
	const iqr = iqrFlags(values);
	const z = zFlags(values, state.cutoff);
	row.dots = row.dots.map((dot, index) => ({ ...dot, text: dot.lane ? laneLabel(values[index], setup) : null, iqrFlag: iqr[index], zFlag: z[index] }));
	row.mean = meanMark(setup.axis, state, values);
	row.spans = spreadSpans(setup.axis, values, state);
	row.box = boxOf(setup.axis, values, true);
	return row;
}

function scalingRows(state: DescriptiveState): ChartRow[] {
	const setup = setupOf(state);
	const { testA, scaleAxes, anaB } = setup;
	if (!testA || !scaleAxes || anaB === undefined) throw new Error(`DescriptiveStats: setup "${setup.id}" has no tests.`);
	const tests = [
		{ id: 'a', title: `Test A, out of ${testA.outOf}`, values: testA.values, ana: testA.ana, raw: scaleAxes.rawA },
		{ id: 'b', title: 'Test B, out of 80', values: state.values, ana: anaB, raw: scaleAxes.rawB },
	];
	return tests.map((test) => {
		const axis = state.scale === 'raw' ? test.raw : state.scale === 'minmax' ? scaleAxes.minmax : scaleAxes.z;
		const scaleList = (values: readonly number[]) =>
			values.map((value) => {
				if (state.scale === 'raw') return value;
				if (state.scale === 'minmax') return toNumber(minMax(value, values));
				return rootNumber(zScore(value, values));
			});
		const scaled = scaleList(test.values);
		const reserve = test.id === 'a' ? stackHeight(scaled, axis) : reserveFor(setup, axis, scaleList);
		const row = emptyRow(test.id, axis, axisUnit(state), scaled, reserve);
		row.title = test.title;
		row.dots = row.dots.map((dot, index) => ({ ...dot, look: index === test.ana }));
		if (state.scale === 'z') {
			row.zTicks = [
				{ x: across(axis, 0), kind: 'mean', label: 'mean' },
				{ x: across(axis, -1), kind: 'sigma', label: '−1 σ' },
				{ x: across(axis, 1), kind: 'sigma', label: '+1 σ' },
			];
		}
		return row;
	});
}

export function chartRows(state: DescriptiveState): ChartRow[] {
	switch (setupOf(state).kind) {
		case 'scaling':
			return scalingRows(state);
		case 'box':
			return [boxRow(state)];
		case 'outliers':
			return [outlierRow(state)];
		default:
			return [centerRow(state)];
	}
}

/** The pictures stage: one bar per child, drawn to height from the floor, with its place in arrival order or the line. */
export function lineUpBars(state: DescriptiveState): { child: number; slot: number; height: number; percent: number; look: boolean }[] {
	const setup = setupOf(state);
	const order = state.values.map((_, child) => child);
	if (state.linedUp) order.sort((a, b) => state.values[a] - state.values[b]);
	return state.values.map((_, child) => ({
		child,
		slot: order.indexOf(child),
		height: state.values[child],
		percent: (state.values[child] / setup.axis.max) * 100,
		look: state.pick === child,
	}));
}
