// Every sentence DescriptiveStats shows or speaks, built from state. The visible text and the live-region text come
// from the same functions, so what a screen reader hears always matches the screen. Design: decision 0015.
//
// Number format, one rule for every number on the board:
// - Whole numbers of 1,000 or more are grouped with commas ("1,206 / 9", "1,000").
// - An exact amount drops trailing zeros ("103.6", "4.5"); a rounded one shows two decimals after "≈" ("≈ 8.44").
// - A min–max score reads unreduced, reduced, then rounded: "15/18 = 5/6 ≈ 0.83".
// "≈" appears only when the decimal is rounded.
import { compareFractions, formatFraction, fraction, toNumber, type Fraction } from '../boardMath.ts';
import { capitalize, joinWords, plural } from '../boardText.ts';
import { formatNumber } from '../plotColors.ts';
import { CAFE_SAVINGS, TEST_B } from './datasets.ts';
import {
	fences,
	iqr,
	iqrFlags,
	mean,
	median,
	minMax,
	modes,
	populationSD,
	populationVariance,
	quartiles,
	range,
	rankOf,
	sampleSD,
	sampleVariance,
	sortedValues,
	sum,
	topCount,
	zScore,
	type Root,
} from './model.ts';
import type { Scale, Setup, Stage } from './setups.ts';
import { isCovered, setupOf, valuesNow, type Action, type DescriptiveState } from './state.ts';

export const STAGE_LABELS: Readonly<Record<Stage, string>> = {
	pictures: 'Pictures',
	numbers: 'Numbers',
	symbols: 'Symbols',
	'line-up': 'Line-up',
	quartiles: 'Quartiles',
	box: 'Box plot',
};

export const SCALE_LABELS: Readonly<Record<Scale, string>> = { raw: 'Raw marks', minmax: 'Min–max (0 to 1)', z: 'z-scores' };

/** The board's control names. Sentences that tell the reader to use a control quote these, so the two can't drift. */
export const CONTROL_LABELS = {
	check: 'Check',
	showAnswer: 'Show the answer',
	lineUp: 'Line them up',
	pick: 'Your middle child',
	childToMove: 'Child to move',
	height: 'Height',
	distances: 'Show distances',
	sample: 'Also as a sample',
	newcomer: 'The millionaire walks in',
	newcomerSavings: "Newcomer's savings",
	scale: 'Scale',
	giant: 'Giant pumpkin',
	cutoff: 'Flag when |z| is above',
	presets: 'Presets',
	presetsCaption: 'Try',
} as const;

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
/** A mean that moves further than this many axis widths "jumps". */
const JUMP_AXIS_WIDTHS = 1;
const PERCENT = 100;

// ---- Numbers ----

/** "1,206", "−12", "48". Whole numbers only. */
export function groupThousands(value: number): string {
	if (!Number.isInteger(value)) throw new Error(`DescriptiveStats: groupThousands takes whole numbers, got ${value}.`);
	const digits = String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return value < 0 ? `−${digits}` : digits;
}

/** Two decimals show the value exactly. */
const isTwoDecimals = (value: Fraction) => (value.numerator * PERCENT) % value.denominator === 0;

/** "134", "103.6", "1,000", or "≈ 8.44" when two decimals round it. */
export function amount(value: Fraction): string {
	if (value.denominator === 1) return groupThousands(value.numerator);
	const decimal = formatNumber(toNumber(value), 2);
	return isTwoDecimals(value) ? decimal.replace(/\.?0+$/, '') : `≈ ${decimal}`;
}

/** "= 103.6" or "≈ 8.44": the end of an equation. */
export function equalsAmount(value: Fraction): string {
	const text = amount(value);
	return text.startsWith('≈') ? text : `= ${text}`;
}

/** A float that two decimals can only approximate: "≈ 7.68". Whole results are written plainly. */
function approxNumber(value: number): string {
	const rounded = formatNumber(value, 2);
	return Math.abs(Number(rounded.replace('−', '-')) - value) < 1e-9 ? rounded.replace(/\.?0+$/, '') : `≈ ${rounded}`;
}

/** σ or s as text: "8", "1.5", or "≈ 8.49". */
export function rootAmount(root: Root): string {
	return root.exact ? amount(root.value) : approxNumber(root.value);
}

const rootNumber = (root: Root) => (root.exact ? toNumber(root.value) : root.value);

/** "+3", "−12", "0": a signed distance. */
function signed(value: Fraction): string {
	if (value.numerator === 0) return '0';
	const text = amount(fraction(Math.abs(value.numerator), value.denominator));
	const sign = value.numerator > 0 ? '+' : '−';
	return text.startsWith('≈') ? `≈ ${sign}${text.slice(2)}` : `${sign}${text}`;
}

const ORDINAL_SUFFIXES: Readonly<Record<number, string>> = { 1: 'st', 2: 'nd', 3: 'rd' };

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function ordinal(n: number): string {
	const lastTwo = n % 100;
	if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
	return `${n}${ORDINAL_SUFFIXES[n % 10] ?? 'th'}`;
}

function subscript(n: number): string {
	return [...String(n)].map((digit) => SUBSCRIPT_DIGITS[Number(digit)]).join('');
}

const withUnit = (text: string, setup: Setup) => (setup.words.unit ? `${text} ${setup.words.unit}` : text);
const childName = (child: number) => `Child ${child + 1}`;
const subtract = (a: Fraction, b: Fraction): Fraction => fraction(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);

// ---- Board name, status and the stage choice ----

export function boardLabel(setup: Setup): string {
	return setup.label;
}

export function stageOptions(setup: Setup): { value: Stage; label: string }[] {
	return setup.stages.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] }));
}

export function childOptions(state: DescriptiveState): { value: string; label: string }[] {
	return state.values.map((_, child) => ({ value: String(child), label: childName(child) }));
}

export const CUTOFF_OPTIONS: readonly { value: '2' | '3'; label: string }[] = [
	{ value: '2', label: '2' },
	{ value: '3', label: '3' },
];

export function statusLine(state: DescriptiveState): string {
	const setup = setupOf(state);
	const values = valuesNow(state);
	const ordered = sortedValues(values);
	const extent = `from ${withUnit(groupThousands(ordered[0]), setup)} to ${withUnit(groupThousands(ordered[ordered.length - 1]), setup)}`;
	switch (setup.kind) {
		case 'lineup':
			return `${values.length} children, ${state.linedUp ? 'lined up from shortest to tallest' : 'in the order they arrived'}. Heights ${extent}.`;
		case 'newcomer':
			return `${plural(values.length, 'customer', 'customers')}' savings, in thousands of dollars${state.newcomer === null ? '' : ', with the newcomer'}.`;
		case 'spread':
			return `${values.length} children, heights ${extent}. Pick a child under ${CONTROL_LABELS.childToMove}, then change their ${CONTROL_LABELS.height.toLowerCase()}.`;
		case 'box':
			return `${values.length} children, heights ${extent}, lined up from shortest to tallest.`;
		case 'scaling':
			return `Two tests, 9 marks each: test A out of ${setup.testA?.outOf}, test B out of ${TEST_B.outOf}. Ana's marks are ringed.`;
		case 'outliers':
			return `${values.length} pumpkins at the village fair. ${state.giants === 2 ? `The two giants weigh ${state.giant} kg each.` : `The giant weighs ${state.giant} kg.`}`;
	}
}

// ---- Line-up: the middle child ----

export function coveredText(): string {
	return 'The summary appears when you find the middle child.';
}

export function checkRefusal(state: DescriptiveState): string | null {
	if (setupOf(state).kind !== 'lineup' || state.checked || state.pick !== null) return null;
	return `Pick a child under ${CONTROL_LABELS.pick} first.`;
}

const shorterAndTaller = (shorter: number, taller: number) => `${plural(shorter, 'child', 'children')} shorter and ${taller} taller`;

export function feedbackLine(state: DescriptiveState): string | null {
	const { feedback } = state;
	if (!feedback) return null;
	const values = state.values;
	const height = values[feedback.child];
	const rank = rankOf(values, feedback.child);
	const name = childName(feedback.child);
	const median = `so the median height is ${height} cm.`;
	if (feedback.kind === 'right') return `Yes. ${name} (${height} cm) has ${shorterAndTaller(rank.shorter, rank.taller)}, ${median}`;
	if (feedback.kind === 'shown') return `The middle child is ${name.toLowerCase()} (${height} cm): ${plural(rank.shorter, 'child is', 'children are')} shorter and ${rank.taller} taller, ${median}`;
	const hint = rank.shorter > rank.taller ? 'Try a shorter child.' : 'Try a taller child.';
	if (feedback.child === (values.length - 1) / 2) {
		const taller = rank.taller === 0 ? 'none is taller' : `${rank.taller} ${rank.taller === 1 ? 'is' : 'are'} taller`;
		const next = state.linedUp ? hint : 'Line them up first.';
		return `${name} stands in the middle of the arrival line, but ${plural(rank.shorter, 'child is', 'children are')} shorter and ${taller}. ${next}`;
	}
	return `${name} (${height} cm) has ${shorterAndTaller(rank.shorter, rank.taller)}. ${hint}`;
}

/** "(122 + 125 + … + 148) / 9 = 1,206 / 9 = 134": the mean as a sum over the sorted values. */
function meanChain(values: readonly number[]): string {
	const total = sum(values);
	return `(${sortedValues(values).map(groupThousands).join(' + ')}) / ${values.length} = ${groupThousands(total)} / ${values.length} ${equalsAmount(mean(values))}`;
}

/** Why the mean sits above or below the median, from all the distances, not one child. */
function meanVersusMedian(values: readonly number[], setup: Setup): string {
	const gap = subtract(mean(values), median(values));
	const size = withUnit(amount(fraction(Math.abs(gap.numerator), gap.denominator)), setup);
	const order = compareFractions(gap, fraction(0, 1));
	if (order === 0) return 'The mean and the median are the same.';
	if (order > 0) return `The tallest children stand further above the median than the shortest stand below it, so the mean sits ${size} higher.`;
	return `The shortest children stand further below the median than the tallest stand above it, so the mean sits ${size} lower.`;
}

function modeSentence(values: readonly number[], setup: Setup): string {
	const found = modes(values);
	const top = topCount(values);
	if (found.length === 0) {
		return top === 1 ? `No ${setup.kind === 'newcomer' ? 'amount' : 'height'} repeats, so there is no mode.` : `Every value appears ${top} times, so there is no mode.`;
	}
	const held = found.length === 1 ? `held by ${plural(top, setup.words.item, setup.words.items)}` : `each held by ${plural(top, setup.words.item, setup.words.items)}`;
	return `Mode: ${joinWords(found.map((value) => withUnit(groupThousands(value), setup)))}, ${held}.`;
}

/** Line-up setups after Check: the mean, the mode and the range. */
function lineupSummary(state: DescriptiveState): string[] {
	const setup = setupOf(state);
	const values = state.values;
	const ordered = sortedValues(values);
	const noMode = modes(values).length === 0 && topCount(values) === 1;
	return [
		`Mean: ${meanChain(values)} cm. ${meanVersusMedian(values, setup)}`,
		noMode ? 'No height repeats, so this class has no mode.' : modeSentence(values, setup),
		`Range: ${ordered[ordered.length - 1]} − ${ordered[0]} = ${range(values)} cm.`,
	];
}

// ---- Newcomer: mean, median and mode ----

function medianSentence(values: readonly number[]): string {
	const ordered = sortedValues(values);
	const n = values.length;
	if (n % 2 === 1) return `Median: ${amount(median(values))}, the ${ordinal((n + 1) / 2)} of ${n}.`;
	const low = ordered[n / 2 - 1];
	const high = ordered[n / 2];
	return `Median: (${groupThousands(low)} + ${groupThousands(high)}) / 2 ${equalsAmount(median(values))}, the average of the ${ordinal(n / 2)} and ${ordinal(n / 2 + 1)}.`;
}

const sameModes = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

function newcomerReadout(state: DescriptiveState): string {
	const setup = setupOf(state);
	const values = valuesNow(state);
	const meanText = `Mean: ${groupThousands(sum(values))} / ${values.length} ${equalsAmount(mean(values))}.`;
	const found = modes(values);
	const still = state.newcomer !== null && found.length === 1 && sameModes(found, modes(CAFE_SAVINGS));
	const modeText = still ? `Mode: still ${groupThousands(found[0])}.` : modeSentence(values, { ...setup, words: { ...setup.words, unit: '' } });
	return `${plural(values.length, 'customer', 'customers')}. ${meanText} ${medianSentence(values)} ${modeText}`;
}

function modeWords(values: readonly number[]): string {
	const found = modes(values);
	return found.length === 0 ? 'no mode' : joinWords(found.map(groupThousands));
}

/** What the newcomer did to the three centers, compared with the nine regulars. */
export function newcomerChange(state: DescriptiveState): string {
	const setup = setupOf(state);
	const before = CAFE_SAVINGS;
	const after = valuesNow(state);
	const meanBefore = mean(before);
	const meanAfter = mean(after);
	const moved = Math.abs(toNumber(meanAfter) - toNumber(meanBefore));
	const meanVerb = moved === 0 ? 'stayed at' : moved > (setup.axis.max - setup.axis.min) * JUMP_AXIS_WIDTHS ? 'jumped from' : 'moved from';
	const meanPart = moved === 0 ? `the mean stayed at ${amount(meanAfter)} thousand dollars` : `the mean ${meanVerb} ${amount(meanBefore)} to ${amount(meanAfter)} thousand dollars`;
	const medianBefore = median(before);
	const medianAfter = median(after);
	const medianPart = compareFractions(medianBefore, medianAfter) === 0 ? `the median stayed at ${amount(medianAfter)}` : `the median moved from ${amount(medianBefore)} to ${amount(medianAfter)}`;
	const modePart = modeWords(before) === modeWords(after) ? `the mode stayed at ${modeWords(after)}` : `the mode changed from ${modeWords(before)} to ${modeWords(after)}`;
	return `${capitalize(meanPart)}; ${medianPart}; ${modePart}.`;
}

export function formatSavings(value: number): string {
	return groupThousands(value);
}

export function describeSavings(value: number): string {
	return `newcomer has ${groupThousands(value)} thousand dollars${value === 1000 ? ', a million' : ''}`;
}

// ---- Spread: distances, variance, σ and s ----

const n = (values: readonly number[]) => values.length;

/** Σ (x − μ)², exact: n times the variance. */
function squaredTotal(values: readonly number[]): Fraction {
	const variance = populationVariance(values);
	return fraction(variance.numerator * n(values), variance.denominator);
}

/** "√64 = 8 cm", "√72 ≈ 8.49 cm", "√(9/4) = 1.5 cm", or "≈ 8.17 cm" when the variance itself was rounded. */
function rootChain(variance: Fraction, root: Root, setup: Setup): string {
	if (variance.denominator === 1) return `√${groupThousands(variance.numerator)} ${root.exact ? `= ${amount(root.value)}` : approxNumber(root.value)} ${setup.words.unit}`;
	if (root.exact) return `√(${formatFraction(variance)}) = ${amount(root.value)} ${setup.words.unit}`;
	return `${approxNumber(root.value)} ${setup.words.unit}`;
}

/** "s = √72 ≈ 8.49 cm" or "s ≈ 8.17 cm". */
function symbolChain(symbol: 'σ' | 's', variance: Fraction, root: Root, setup: Setup): string {
	const chain = rootChain(variance, root, setup);
	return chain.startsWith('≈') ? `${symbol} ${chain}` : `${symbol} = ${chain}`;
}

/** σ for a list: "8", or "≈ 7.75". The ghost, goal and announcement lines share it. */
export function sigmaText(values: readonly number[]): string {
	return rootAmount(populationSD(values));
}

function spreadLines(state: DescriptiveState): string[] {
	const setup = setupOf(state);
	const values = state.values;
	const center = mean(values);
	if (new Set(values).size === 1) {
		return [`Every child is ${values[0]} cm: every distance is 0, so the variance is 0 and σ = 0 cm.`];
	}
	const lines = [`Mean: ${groupThousands(sum(values))} / ${n(values)} ${equalsAmount(center)} cm.`];
	const ordered = sortedValues(values);
	const distances = ordered.map((value) => subtract(fraction(value, 1), center));
	const total = squaredTotal(values);
	if (state.distances) {
		const exactCenter = center.denominator === 1;
		lines.push(
			`Distances from the mean, ${amount(center)} cm${exactCenter ? '' : ', rounded'}: ${joinWords(distances.map(signed))} cm. They add up to 0, so their plain average is always 0.`,
		);
		lines.push(
			exactCenter
				? `Squared: ${distances.map((d) => groupThousands(d.numerator * d.numerator)).join(' + ')} = ${groupThousands(total.numerator)} ${setup.words.unitSquared}.`
				: `Squared and added: ${amount(total)} ${setup.words.unitSquared}.`,
		);
	}
	const variance = populationVariance(values);
	const totalText = total.denominator === 1 ? groupThousands(total.numerator) : amount(total);
	lines.push(`Variance: ${totalText} / ${n(values)} ${equalsAmount(variance)} ${setup.words.unitSquared}. Standard deviation: ${rootChain(variance, populationSD(values), setup)}.`);
	if (state.sample) {
		const sampleVar = sampleVariance(values);
		lines.push(`As a sample of a bigger group, the same mean is written x̄ ${equalsAmount(center)} cm.`);
		lines.push(`Sample variance: ${totalText} / ${n(values) - 1} ${equalsAmount(sampleVar)} ${setup.words.unitSquared}. ${symbolChain('s', sampleVar, sampleSD(values), setup)}.`);
	}
	return lines;
}

/** The goal on spread setups. */
export function goalLine(state: DescriptiveState): string | null {
	const { goal } = setupOf(state);
	if (!goal) return null;
	return `Goal: without changing the mean, make σ smaller than ${goal.sigmaBelow} cm.`;
}

export function goalMet(state: DescriptiveState): boolean {
	const { goal } = setupOf(state);
	if (!goal) return false;
	const center = mean(state.values);
	return center.denominator === 1 && center.numerator === goal.mean && rootNumber(populationSD(state.values)) < goal.sigmaBelow;
}

/** Where the reader stands on the goal, in one sentence. */
export function goalStatus(state: DescriptiveState): string | null {
	const { goal } = setupOf(state);
	if (!goal) return null;
	const center = mean(state.values);
	const sigma = sigmaText(state.values);
	const sigmaPart = sigma.startsWith('≈') ? `σ ${sigma} cm` : `σ = ${sigma} cm`;
	if (goalMet(state)) return `Done: the mean is still ${goal.mean} cm and ${sigmaPart} is smaller than ${goal.sigmaBelow} cm.`;
	if (center.denominator !== 1 || center.numerator !== goal.mean) {
		return `The mean is now ${amount(center)} cm. Move another child to bring it back to ${goal.mean} cm.`;
	}
	return `The mean is ${goal.mean} cm, but ${sigmaPart} is not smaller than ${goal.sigmaBelow} cm yet.`;
}

export function ghostLine(state: DescriptiveState): string | null {
	if (!state.ghost) return null;
	const before = rootAmount(state.ghost.sigma);
	const now = sigmaText(state.values);
	return `Dashed: σ for ${state.ghost.preset} was ${before} cm; now it is ${now} cm.`;
}

export function formatHeight(value: number): string {
	return `${value} cm`;
}

export function describeHeight(state: DescriptiveState, value: number): string {
	return `child ${state.selected + 1}, ${value} cm`;
}

// ---- Box plot ----

function boxLines(state: DescriptiveState): string[] {
	const values = state.values;
	const ordered = sortedValues(values);
	const count = n(values);
	const quarter = (count - 1) / 4;
	if (state.stage === 'line-up') return [`${count} children make ${count - 1} steps from shortest to tallest.`];
	const { q1, median: middle, q3 } = quartiles(values);
	const place = (steps: number) => ordinal(steps + 1);
	const quartileLine = `Each quarter is ${plural(quarter, 'step', 'steps')}: Q1 is the ${place(quarter)} in line (${amount(q1)} cm), the median the ${place(2 * quarter)} (${amount(middle)} cm), Q3 the ${place(3 * quarter)} (${amount(q3)} cm).`;
	if (state.stage === 'quartiles') return [quartileLine];
	const spreadQ = iqr(values);
	const reach = fraction(spreadQ.numerator * 3, spreadQ.denominator * 2);
	const { lower, upper } = fences(values);
	const flags = iqrFlags(values);
	const inside = ordered.filter((value) => !flags[values.indexOf(value)]);
	const fenceLine = `IQR = ${amount(q3)} − ${amount(q1)} = ${amount(spreadQ)} cm. The fences sit 1.5 × ${amount(spreadQ)} = ${amount(reach)} cm beyond the box, at ${amount(lower)} cm and ${amount(upper)} cm.`;
	const outside = ordered.filter((value) => flags[values.indexOf(value)]);
	if (outside.length === 0) return [`${fenceLine} Every child is inside them, so the whiskers reach the shortest (${ordered[0]} cm) and the tallest (${ordered[ordered.length - 1]} cm).`];
	const sentences = outside.map((value) => {
		const above = compareFractions(fraction(value, 1), upper) > 0;
		const whisker = above ? inside[inside.length - 1] : inside[0];
		return `${value} cm is ${above ? 'above the upper' : 'below the lower'} fence (${amount(above ? upper : lower)} cm), so it is drawn as its own dot and the whisker stops at ${whisker} cm.`;
	});
	return [fenceLine, ...sentences];
}

// ---- Scaling ----

/** A min–max score unreduced, reduced, then as a decimal: "15/18 = 5/6 ≈ 0.83". */
function minMaxChain(value: number, values: readonly number[]): string {
	const low = sortedValues(values)[0];
	const reduced = minMax(value, values);
	const unreduced = `${value - low}/${range(values)}`;
	const fractions = formatFraction(reduced) === unreduced ? unreduced : `${unreduced} = ${formatFraction(reduced)}`;
	return `${fractions} ${equalsAmount(reduced)}`;
}

/** "(36 − 21) / (39 − 21) = 15/18 = 5/6 ≈ 0.83". */
function scaledFraction(value: number, values: readonly number[]): string {
	const ordered = sortedValues(values);
	const low = ordered[0];
	const high = ordered[ordered.length - 1];
	return `(${value} − ${low}) / (${high} − ${low}) = ${minMaxChain(value, values)}`;
}

function zSentence(test: string, value: number, values: readonly number[]): string {
	const center = mean(values);
	const sigma = populationSD(values);
	const z = zScore(value, values);
	if (center.denominator === 1 && sigma.exact && sigma.value.denominator === 1) {
		return `Test ${test}: (${value} − ${amount(center)}) / ${amount(sigma.value)} ${z.exact ? equalsAmount(z.value) : approxNumber(z.value)}.`;
	}
	const centerText = amount(center).replace('≈ ', '');
	const sigmaText = rootAmount(sigma).replace('≈ ', '');
	return `Test ${test}: mean ${amount(center)}, σ ${rootAmount(sigma)}, so z = (${value} − ${centerText}) / ${sigmaText} ${z.exact ? equalsAmount(z.value) : approxNumber(z.value)}.`;
}

function verdict(scaleName: string, a: number, b: number): string {
	if (Math.abs(a - b) < 1e-12) return '';
	return ` ${scaleName} says test ${a > b ? 'A' : 'B'}.`;
}

function scalingLines(state: DescriptiveState): string[] {
	const setup = setupOf(state);
	const testA = setup.testA;
	if (!testA || setup.anaB === undefined) throw new Error(`DescriptiveStats: setup "${setup.id}" has no tests.`);
	const anaA = testA.values[testA.ana];
	const valuesB = state.values;
	const anaB = valuesB[setup.anaB];
	if (state.scale === 'raw') {
		const percent = (mark: number, outOf: number) => amount(fraction(mark * PERCENT, outOf));
		return [`Ana scored ${anaA} out of ${testA.outOf} on test A (${percent(anaA, testA.outOf)}%) and ${anaB} out of ${TEST_B.outOf} on test B (${percent(anaB, TEST_B.outOf)}%).`];
	}
	if (state.scale === 'minmax') {
		const a = toNumber(minMax(anaA, testA.values));
		const b = toNumber(minMax(anaB, valuesB));
		return [`Test A: ${scaledFraction(anaA, testA.values)}. Test B: ${scaledFraction(anaB, valuesB)}.${verdict('Min–max', a, b)}`];
	}
	const zA = rootNumber(zScore(anaA, testA.values));
	const zB = rootNumber(zScore(anaB, valuesB));
	const both = Math.abs(zA - zB) < 1e-12 && Math.abs(zA - 1) < 1e-12 ? ' Ana is exactly one standard deviation above the mean on both.' : verdict('z', zA, zB);
	return [`${zSentence('A', anaA, testA.values)} ${zSentence('B', anaB, valuesB)}${both}`];
}

/** What the low mark did to test B's scores, compared with the plain test B. */
export function lowMarkChange(state: DescriptiveState): string {
	const setup = setupOf(state);
	const anaIndex = setup.anaB ?? 0;
	const anaB = state.values[anaIndex];
	const changed = state.values.findIndex((mark, index) => mark !== TEST_B.values[index]);
	if (changed < 0) return scalingLines(state).join(' ');
	const minBefore = minMax(anaB, TEST_B.values);
	const minAfter = minMax(anaB, state.values);
	const zBefore = zScore(anaB, TEST_B.values);
	const zAfter = zScore(anaB, state.values);
	const rootText = (root: Root) => (root.exact ? amount(root.value) : approxNumber(root.value));
	const rose = (before: number, after: number) => (after > before ? 'rose' : after < before ? 'fell' : 'stayed');
	return `One mark of ${state.values[changed]} moved both scores for test B: min–max ${rose(toNumber(minBefore), toNumber(minAfter))} from ${amount(minBefore)} to ${minMaxChain(anaB, state.values)}, the z-score ${rose(rootNumber(zBefore), rootNumber(zAfter))} from ${rootText(zBefore)} to ${rootText(zAfter)}. Ana's ${anaB} did not change.`;
}

// ---- Outliers ----

function outlierLines(state: DescriptiveState): string[] {
	const values = state.values;
	const { q1, q3 } = quartiles(values);
	const spreadQ = iqr(values);
	const reach = fraction(spreadQ.numerator * 3, spreadQ.denominator * 2);
	const { lower, upper } = fences(values);
	const fenceLine = `Q1 = ${amount(q1)} kg, Q3 = ${amount(q3)} kg, IQR = ${amount(spreadQ)} kg, so the upper fence is ${amount(q3)} + ${amount(reach)} = ${amount(upper)} kg.`;
	const giant = state.giant;
	const center = mean(values);
	const sigma = populationSD(values);
	const z = rootNumber(zScore(giant, values));
	const zText = approxNumber(z);
	const iqrFlagged = compareFractions(fraction(giant, 1), upper) > 0;
	const onFence = compareFractions(fraction(giant, 1), upper) === 0;
	const meanText = `Mean ${amount(center)} kg, σ ${rootAmount(sigma).startsWith('≈') ? rootAmount(sigma) : `= ${rootAmount(sigma)}`} kg`;
	const zFlagText = z > 3 ? 'flagged at |z| > 2 and at |z| > 3' : z > 2 ? 'flagged at |z| > 2, not at |z| > 3' : 'not flagged at |z| > 2 or at |z| > 3';
	const lines = [fenceLine];
	if (state.giants === 2) {
		const zVerdict = z > 2 ? `Both pass |z| > 2${z > 3 ? ' and |z| > 3' : ''}.` : 'Neither passes |z| > 2: the two giants hide each other.';
		lines.push(`${meanText}, each z ${zText}. ${zVerdict} ${iqrFlagged ? 'The IQR rule still flags both.' : 'The IQR rule flags neither.'}`);
	} else if (!iqrFlagged && z <= 2 && !onFence) {
		const largest = Math.max(...values.map((value) => Math.abs(rootNumber(zScore(value, values)))));
		lines.push(`Every pumpkin is inside the fences (${amount(lower)} kg to ${amount(upper)} kg) and every |z| is at most ${approxNumber(largest)}: nothing is flagged.`);
	} else {
		const iqrText = onFence
			? `On the fence is not past it: the IQR rule doesn't flag ${giant} kg, ${z > 2 ? `but z ${zText} passes |z| > 2.` : 'and |z| > 2 doesn\'t either.'}`
			: iqrFlagged
				? `The ${giant} kg pumpkin is past it: the IQR rule flags it.`
				: `The ${giant} kg pumpkin is inside it: the IQR rule doesn't flag it.`;
		lines.push(iqrText);
		lines.push(`${meanText}, so its z-score is ${zText}: ${zFlagText}.`);
	}
	if (state.cutoff === 3) lines.push(`With ${values.length} pumpkins no z-score can reach √${values.length - 1} ${approxNumber(Math.sqrt(values.length - 1))}, however heavy the giant, so |z| > 3 can never flag anything here.`);
	return lines;
}

export function formatGiant(value: number): string {
	return `${value} kg`;
}

export function describeGiant(state: DescriptiveState, value: number): string {
	return state.giants === 2 ? `both giant pumpkins, ${value} kg` : `giant pumpkin, ${value} kg`;
}

// ---- Readouts and symbols ----

export function readoutLines(state: DescriptiveState): string[] {
	const setup = setupOf(state);
	switch (setup.kind) {
		case 'lineup':
			return isCovered(state) ? [] : lineupSummary(state);
		case 'newcomer':
			return [newcomerReadout(state)];
		case 'spread': {
			const ghost = ghostLine(state);
			return [...spreadLines(state), ...(ghost ? [ghost] : [])];
		}
		case 'box':
			return boxLines(state);
		case 'scaling':
			return scalingLines(state);
		case 'outliers':
			return outlierLines(state);
	}
}

/** A symbols-stage line: the Unicode shown on screen and the words a screen reader says instead. */
export interface SymbolLine {
	text: string;
	spoken: string;
}

export function symbolLines(state: DescriptiveState): SymbolLine[] {
	if (state.stage !== 'symbols') return [];
	const setup = setupOf(state);
	const values = state.values;
	const count = n(values);
	const center = mean(values);
	if (setup.kind === 'lineup') {
		const middle = (count + 1) / 2;
		return [
			{ text: `x₍₁₎ ≤ x₍₂₎ ≤ … ≤ x₍${subscript(count)}₎`, spoken: `The heights in order: x 1 in brackets is the shortest, x ${count} in brackets the tallest.` },
			{ text: `median = x₍${subscript(middle)}₎ = ${amount(median(values))} cm`, spoken: `The median is x ${middle} in brackets, the ${ordinal(middle)} height in order: ${amount(median(values))} cm.` },
			{ text: `μ = (1/n) Σ xᵢ = ${groupThousands(sum(values))} / ${count} ${equalsAmount(center)} cm`, spoken: `mu, the mean, is 1 over n times the sum of every x i: ${groupThousands(sum(values))} divided by ${count}, ${amount(center)} cm.` },
		];
	}
	const variance = populationVariance(values);
	const lines: SymbolLine[] = [
		{ text: `μ = (1/n) Σ xᵢ ${equalsAmount(center)} cm`, spoken: `mu, the mean, is 1 over n times the sum of every x i: ${amount(center)} cm.` },
		{ text: `σ² = (1/n) Σ (xᵢ − μ)² ${equalsAmount(variance)} cm²`, spoken: `sigma squared, the variance, is 1 over n times the sum of each squared distance from mu: ${amount(variance)} square centimeters.` },
		{ text: `σ = √σ² = ${sigmaText(values)} cm`, spoken: `sigma, the standard deviation, is the square root of the variance: ${sigmaText(values)} cm.` },
	];
	if (state.sample) {
		const sampleVar = sampleVariance(values);
		const s = rootAmount(sampleSD(values));
		lines.push(
			{ text: `s² = (1/(n − 1)) Σ (xᵢ − x̄)² ${equalsAmount(sampleVar)} cm²`, spoken: `s squared, the sample variance, is 1 over n minus 1 times the sum of each squared distance from x bar: ${amount(sampleVar)} square centimeters.` },
			{ text: `s = √s² ${s.startsWith('≈') ? s : `= ${s}`} cm`, spoken: `s, the sample standard deviation, is its square root: ${s} cm.` },
		);
	}
	const s = rootAmount(sampleSD(values));
	lines.push({
		text: `÷ ${count} counts every child once, as NumPy's np.std does by default. pandas' .std() divides by ${count - 1} and gives ${s.startsWith('≈') ? s : `= ${s}`} cm.`,
		spoken: `Dividing by ${count} counts every child once, as NumPy's np.std does by default. pandas' .std() divides by ${count - 1} and gives ${s} cm.`,
	});
	return lines;
}

// ---- Tables ----

export interface TableData {
	caption: string;
	headers: string[];
	rows: { header: string; cells: string[] }[];
}

/** Each item's place in the sorted line ("5th"); ties share the first place they take. */
function places(values: readonly number[]): string[] {
	const ordered = sortedValues(values);
	return values.map((value) => ordinal(ordered.indexOf(value) + 1));
}

export function dataTable(state: DescriptiveState): TableData {
	const setup = setupOf(state);
	if (setup.kind === 'scaling') {
		const testA = setup.testA;
		if (!testA || setup.anaB === undefined) throw new Error(`DescriptiveStats: setup "${setup.id}" has no tests.`);
		const mark = (values: readonly number[], index: number, ana: number) => `${values[index]}${index === ana ? ' (Ana)' : ''}`;
		return {
			caption: 'Marks on the two tests, lowest first.',
			headers: ['Mark', `Test A (out of ${testA.outOf})`, `Test B (out of ${TEST_B.outOf})`],
			rows: testA.values.map((_, index) => ({ header: String(index + 1), cells: [mark(testA.values, index, testA.ana), mark(state.values, index, setup.anaB ?? 0)] })),
		};
	}
	const values = valuesNow(state);
	const showPlaces = (setup.kind === 'lineup' || setup.kind === 'spread' || setup.kind === 'box') && !isCovered(state);
	const order = places(values);
	const caption: Record<string, string> = {
		lineup: 'Our class, in the order they arrived.',
		spread: 'Our class, child by child.',
		box: 'Our class, child by child.',
		newcomer: 'Savings, customer by customer.',
		outliers: 'The pumpkins, one by one.',
	};
	const rowName = (index: number) => {
		if (setup.kind === 'newcomer' && index >= state.values.length) return 'Newcomer';
		if (setup.kind === 'outliers' && index >= values.length - state.giants) return `Pumpkin ${index + 1} (giant)`;
		return `${setup.words.itemTitle} ${index + 1}`;
	};
	return {
		caption: caption[setup.kind],
		headers: [setup.words.itemTitle, setup.words.valueTitle, ...(showPlaces ? ['Place in line'] : [])],
		rows: values.map((value, index) => ({ header: rowName(index), cells: [groupThousands(value), ...(showPlaces ? [order[index]] : [])] })),
	};
}

type SummaryRow = { header: string; cells: string[] };
const row = (header: string, value: string, how: string): SummaryRow => ({ header, cells: [value, how] });

function centerRows(values: readonly number[], setup: Setup): SummaryRow[] {
	const count = n(values);
	const middle = count % 2 === 1 ? `The ${ordinal((count + 1) / 2)} of ${count} in order` : `The average of the ${ordinal(count / 2)} and ${ordinal(count / 2 + 1)} in order`;
	const found = modes(values);
	return [
		row('Count, n', String(count), `How many ${setup.words.items}`),
		row('Mean', withUnit(amount(mean(values)), setup), `The sum, ${groupThousands(sum(values))}, divided by ${count}`),
		row('Median', withUnit(amount(median(values)), setup), middle),
		row('Mode', found.length === 0 ? 'None' : joinWords(found.map(groupThousands)), found.length === 0 ? 'Every value appears equally often' : 'The most common value'),
	];
}

function spreadRows(values: readonly number[], setup: Setup, sample: boolean): SummaryRow[] {
	const count = n(values);
	const rows = [
		row('Variance, σ²', withUnit(amount(populationVariance(values)), { ...setup, words: { ...setup.words, unit: setup.words.unitSquared } }), `Squared distances from the mean, added, divided by ${count}`),
		row('Standard deviation, σ', withUnit(rootAmount(populationSD(values)), setup), 'The square root of the variance (np.std)'),
	];
	if (!sample) return rows;
	return [
		...rows,
		row('Sample variance, s²', withUnit(amount(sampleVariance(values)), { ...setup, words: { ...setup.words, unit: setup.words.unitSquared } }), `The same squares divided by ${count - 1}`),
		row('Sample standard deviation, s', withUnit(rootAmount(sampleSD(values)), setup), "The square root of s² (pandas' .std())"),
	];
}

function quartileRows(values: readonly number[], setup: Setup): SummaryRow[] {
	const ordered = sortedValues(values);
	const { q1, median: middle, q3 } = quartiles(values);
	const { lower, upper } = fences(values);
	return [
		row('Smallest', withUnit(groupThousands(ordered[0]), setup), 'The 1st in order'),
		row('Q1', withUnit(amount(q1), setup), "A quarter of the way along the line (NumPy's linear method)"),
		row('Median', withUnit(amount(middle), setup), 'Halfway along the line'),
		row('Q3', withUnit(amount(q3), setup), 'Three quarters of the way along the line'),
		row('Largest', withUnit(groupThousands(ordered[ordered.length - 1]), setup), `The ${ordinal(ordered.length)} in order`),
		row('IQR', withUnit(amount(iqr(values)), setup), 'Q3 − Q1'),
		row('Fences', `${withUnit(amount(lower), setup)} and ${withUnit(amount(upper), setup)}`, '1.5 × IQR below Q1 and above Q3'),
	];
}

export function summaryTable(state: DescriptiveState): TableData {
	const setup = setupOf(state);
	const headers = ['Statistic', 'Value', 'How it is computed'];
	const caption = 'Summary.';
	if (isCovered(state)) return { caption, headers, rows: [] };
	const values = valuesNow(state);
	switch (setup.kind) {
		case 'lineup':
			return { caption, headers, rows: [...centerRows(values, setup), row('Range', `${range(values)} cm`, 'Tallest − shortest')] };
		case 'newcomer':
			return { caption, headers, rows: centerRows(values, { ...setup, words: { ...setup.words, unit: '' } }) };
		case 'spread':
			return { caption, headers, rows: [row('Mean, μ', `${amount(mean(values))} cm`, `The sum, ${groupThousands(sum(values))}, divided by ${n(values)}`), ...spreadRows(values, setup, state.sample)] };
		case 'box':
			return { caption, headers, rows: quartileRows(values, setup) };
		case 'outliers':
			return {
				caption,
				headers,
				rows: [
					...quartileRows(values, setup).filter((entry) => ['Q1', 'Q3', 'IQR', 'Fences'].includes(entry.header)),
					row('Mean, μ', `${amount(mean(values))} kg`, `The sum, ${groupThousands(sum(values))}, divided by ${n(values)}`),
					row('Standard deviation, σ', `${rootAmount(populationSD(values))} kg`, 'Dividing by n (np.std)'),
					row("Giant's z-score", approxNumber(rootNumber(zScore(state.giant, values))), '(giant − μ) / σ'),
				],
			};
		case 'scaling': {
			const testA = setup.testA;
			if (!testA) throw new Error(`DescriptiveStats: setup "${setup.id}" has no tests.`);
			const testRows = (name: string, list: readonly number[]) => [
				row(`Test ${name} mean, μ`, amount(mean(list)), `The sum, ${groupThousands(sum(list))}, divided by ${n(list)}`),
				row(`Test ${name} standard deviation, σ`, rootAmount(populationSD(list)), 'Dividing by n (np.std)'),
				row(`Test ${name} lowest and highest`, `${sortedValues(list)[0]} and ${sortedValues(list)[n(list) - 1]}`, 'The ends min–max scaling uses'),
			];
			return { caption, headers, rows: [...testRows('A', testA.values), ...testRows('B', state.values)] };
		}
	}
}

// ---- Chart labels ----

export function meanLabel(state: DescriptiveState): string {
	const center = amount(mean(valuesNow(state)));
	const symbol = setupOf(state).kind === 'lineup' || setupOf(state).kind === 'newcomer' ? 'mean' : state.sample ? 'μ = x̄' : 'μ';
	if (symbol === 'mean') return `mean ${center}`;
	return center.startsWith('≈') ? `${symbol} ${center}` : `${symbol} = ${center}`;
}

export function medianLabel(state: DescriptiveState): string {
	return `median ${amount(median(valuesNow(state)))}`;
}

export function spreadLabel(symbol: 'σ' | 's', root: Root): string {
	const text = rootAmount(root);
	return text.startsWith('≈') ? `${symbol} ${text}` : `${symbol} = ${text}`;
}

export function ghostLabel(sigma: Root): string {
	return `Before: ${spreadLabel('σ', sigma)}`;
}

/** An off-chart value as an edge arrow's text: "1,000 →". */
export function laneLabel(value: number, setup: Setup): string {
	return setup.kind === 'outliers' ? `${groupThousands(value)} kg →` : `${groupThousands(value)} →`;
}

export function axisUnit(state: DescriptiveState): string {
	const setup = setupOf(state);
	if (setup.kind === 'scaling') return { raw: 'marks', minmax: 'share of the way from lowest to highest', z: 'standard deviations from the mean' }[state.scale];
	return setup.kind === 'newcomer' ? 'thousand dollars' : setup.words.unit;
}

export function tickLabel(value: number): string {
	return Number.isInteger(value) ? groupThousands(value) : formatNumber(value, 2).replace(/0+$/, '');
}

// ---- Announcements ----

/** What the live region says when an interaction ends: the sentence that answers it. */
export function announcementFor(state: DescriptiveState, action: Action): string {
	const setup = setupOf(state);
	const readouts = readoutLines(state).join(' ');
	const goal = goalStatus(state);
	switch (action.type) {
		case 'line-up':
			return statusLine(state);
		case 'pick':
			return `Your middle child: child ${action.child + 1}, ${state.values[action.child]} cm.`;
		case 'check':
			return state.refusal ? (checkRefusal(state) ?? '') : (feedbackLine(state) ?? '');
		case 'show-answer':
			return feedbackLine(state) ?? '';
		case 'select':
			return `Moving child ${state.selected + 1}, ${state.values[state.selected]} cm.`;
		case 'set-value':
			if (setup.kind === 'spread') {
				const sigma = sigmaText(state.values);
				return `Child ${state.selected + 1} is now ${state.values[state.selected]} cm. Mean ${amount(mean(state.values))} cm, σ ${sigma.startsWith('≈') ? sigma : `= ${sigma}`} cm. ${goal ?? ''}`.trim();
			}
			if (setup.kind === 'newcomer') return state.newcomer === null ? statusLine(state) : newcomerChange(state);
			return readouts;
		case 'preset': {
			const label = setup.presets.find((preset) => preset.id === action.id)?.label ?? '';
			if (setup.kind === 'newcomer') return state.newcomer === null ? `${label}. ${readouts}` : `${label}. ${newcomerChange(state)}`;
			if (setup.kind === 'scaling') return action.id === setup.presets[0]?.id ? `${label}. ${readouts}` : lowMarkChange(state);
			if (setup.kind === 'spread') return `${label}. ${readouts} ${goal ?? ''}`.trim();
			return `${label}. ${readouts}`;
		}
		case 'stage': {
			const symbols = symbolLines(state);
			return `Showing ${STAGE_LABELS[state.stage]}. ${symbols.length > 0 ? symbols.map((line) => line.spoken).join(' ') : readouts}`.trim();
		}
		case 'distances':
			return state.distances ? readouts : 'Distances hidden.';
		case 'sample':
			return state.sample ? readoutLines(state).filter((line) => /x̄|Sample/.test(line)).join(' ') : 'Sample versions hidden.';
		case 'newcomer':
			return state.newcomer === null ? `Nobody new. ${readouts}` : newcomerChange(state);
		case 'scale':
			return `${SCALE_LABELS[state.scale]}. ${readouts}`;
		case 'cutoff':
			return `Flagging when |z| is above ${state.cutoff}. ${readouts}`;
		case 'reset':
			return `Back to the start. ${statusLine(state)}`;
	}
}
