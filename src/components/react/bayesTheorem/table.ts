// The BayesTheorem board's "Show as table" view: the square's four areas as whole counts, and every sentence the
// table shows or speaks. Pure TypeScript with no React, so scripts/check-boards.mjs can assert the counts.
import { formatNumber } from '../plotColors.ts';
import { computePosterior, type BayesScenario, type BayesValues } from './scenarios.ts';

/** The sliders move in hundredths, so every value is a whole number of percent. */
const PERCENT = 100;
/** Populations tried in order; 10,000 always works, because each area is (percent × percent) / 10,000. */
const POPULATIONS = [100, 1_000, 10_000] as const;
const GRID_TOLERANCE = 1e-9;

export interface CountTable {
	/** How many the table counts: the smallest of 100, 1,000 or 10,000 that keeps all four counts whole. */
	population: number;
	/** In A and in B: the highlighted block. */
	bAndA: number;
	/** In A, not in B. */
	notBAndA: number;
	/** Not in A, in B: the shaded strip. */
	bAndNotA: number;
	/** In neither. */
	notBAndNotA: number;
}

/** A slider value as whole percent; a value off the 0.01 grid can't make whole counts, so it fails loudly. */
function toPercent(value: number, name: string): number {
	const percent = Math.round(value * PERCENT);
	if (!(value >= 0 && value <= 1) || Math.abs(value * PERCENT - percent) > GRID_TOLERANCE) {
		throw new Error(`countTable: ${name} must be a probability on the 0.01 grid, got ${value}`);
	}
	return percent;
}

/** The four areas as counts, in exact integer arithmetic, out of the smallest population that keeps them whole. */
export function countTable({ prior, likelihood, falsePositive }: BayesValues): CountTable {
	const a = toPercent(prior, 'prior');
	const b = toPercent(likelihood, 'likelihood');
	const c = toPercent(falsePositive, 'falsePositive');
	// Each area in units of 1/10,000 of the square.
	const areas = {
		bAndA: a * b,
		notBAndA: a * (PERCENT - b),
		bAndNotA: (PERCENT - a) * c,
		notBAndNotA: (PERCENT - a) * (PERCENT - c),
	};
	const whole = PERCENT * PERCENT;
	const population = POPULATIONS.find((size) => Object.values(areas).every((area) => (area * size) % whole === 0));
	if (population === undefined) throw new Error(`countTable: no whole-number population for ${a}%, ${b}%, ${c}%`);
	const count = (area: number) => (area * population) / whole;
	return {
		population,
		bAndA: count(areas.bAndA),
		notBAndA: count(areas.notBAndA),
		bAndNotA: count(areas.bAndNotA),
		notBAndNotA: count(areas.notBAndNotA),
	};
}

const groupThousands = new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: 0 });
/** "1,000", "9,312". */
export const formatCount = (count: number) => groupThousands.format(count);

export interface TableCell {
	text: string;
	/** One of the two counts P(A | B) divides (B and A, and all of B), drawn bold. */
	divides: boolean;
}

const cell = (count: number, divides = false): TableCell => ({ text: formatCount(count), divides });

export interface TableCopy {
	caption: string;
	/** Column headers after the empty corner: B, not B, Total. */
	columns: readonly [string, string, string];
	rows: readonly { header: string; cells: readonly TableCell[] }[];
	/** The two lines under the table, tied to the readout: shown, and spoken without symbols. */
	lines: readonly { text: string; spoken: string }[];
}

/**
 * The table's text. The probabilities come from computePosterior and formatNumber, exactly as the readout gets them,
 * so the table never rounds a value differently from the readout above it.
 */
export function tableCopy(values: BayesValues, scenario: BayesScenario): TableCopy {
	const counts = countTable(values);
	const { evidence, posterior } = computePosterior(values);
	const inB = counts.bAndA + counts.bAndNotA;
	const notInB = counts.notBAndA + counts.notBAndNotA;
	const inA = counts.bAndA + counts.notBAndA;
	const notInA = counts.bAndNotA + counts.notBAndNotA;
	const noun = scenario.countNoun;
	const total = formatCount(counts.population);
	const posteriorLine =
		posterior === null
			? { text: `P(A | B): no ${noun} in B, so it is undefined`, spoken: `P of A given B: no ${noun} in B, so it is undefined` }
			: {
					text: `P(A | B): ${formatCount(counts.bAndA)} of the ${formatCount(inB)} ${noun} in B, ${formatNumber(posterior, 3)}`,
					spoken: `P of A given B: ${formatCount(counts.bAndA)} of the ${formatCount(inB)} ${noun} in B, ${formatNumber(posterior, 3)}`,
				};
	return {
		caption: `The square as counts, out of ${total} ${noun}`,
		columns: ['B', 'not B', 'Total'],
		rows: [
			{ header: 'A', cells: [cell(counts.bAndA, true), cell(counts.notBAndA), cell(inA)] },
			{ header: 'not A', cells: [cell(counts.bAndNotA), cell(counts.notBAndNotA), cell(notInA)] },
			{ header: 'Total', cells: [cell(inB, true), cell(notInB), cell(counts.population)] },
		],
		lines: [
			posteriorLine,
			{
				text: `P(B): ${formatCount(inB)} of ${total} ${noun}, ${formatNumber(evidence, 3)}`,
				spoken: `P of B: ${formatCount(inB)} of ${total} ${noun}, ${formatNumber(evidence, 3)}`,
			},
		],
	};
}

/** Spoken when the switch turns the table on, and after each change while it is on. */
export function tableSummary(values: BayesValues, scenario: BayesScenario): string {
	const counts = countTable(values);
	const inB = counts.bAndA + counts.bAndNotA;
	return `Out of ${formatCount(counts.population)} ${scenario.countNoun}, ${formatCount(inB)} are in B and ${formatCount(counts.bAndA)} of those are in A.`;
}

export const TABLE_LABELS = {
	/** The switch's name; it is on while the table shows. */
	toggle: 'Show as table',
	shown: 'Table shown under the readout.',
	hidden: 'Table hidden.',
} as const;
