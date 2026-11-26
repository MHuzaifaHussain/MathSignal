// Every sentence DescriptiveStats shows or speaks, built from state. The visible text and the live-region text come
// from the same functions, so what a screen reader hears always matches the screen. Design: decision 0015.
//
// Number format, one rule for every number on the board:
// - Whole numbers of 1,000 or more are grouped with commas ("1,206 / 9", "1,000").
// - An exact amount drops trailing zeros ("103.6", "4.5"); a rounded one shows two decimals after "≈" ("≈ 8.44").
// - A min–max score reads unreduced, reduced, then rounded: "15/18 = 5/6 ≈ 0.83".
// "≈" appears only when the decimal is rounded.
import { compareFractions, formatFraction, fraction, multiplyFractions, toNumber, type Fraction } from '../boardMath.ts';
import { capitalize, groupThousands, joinWords, plural } from '../boardText.ts';
import { CHECKS_BEFORE_ANSWER } from '../guided/guided.ts';
import { tableFoldAnnouncement } from '../guided/tableFold.ts';
import { formatNumber } from '../plotColors.ts';
import { CAFE_SAVINGS, TEST_B, pumpkins } from './datasets.ts';
import {
	FENCE_FACTOR,
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
	rootNumber,
	sampleSD,
	sampleVariance,
	sortedValues,
	subtractFractions,
	sum,
	topCount,
	zScore,
	type Root,
} from './model.ts';
import { presetById, type Scale, type Setup, type Stage } from './setups.ts';
import { isCovered, middleChildren, setupOf, valuesNow, type Action, type DescriptiveState } from './state.ts';

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
	pick: 'Your pick for the middle',
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

export { groupThousands };

/** Two decimals show the value exactly. */
const isTwoDecimals = (value: Fraction) => (value.numerator * PERCENT) % value.denominator === 0;

/** "134", "103.6", "1,000", or "≈ 8.44" when two decimals round it. */
export function amount(value: Fraction): string {
	if (value.denominator === 1) return groupThousands(value.numerator);
	const decimal = formatNumber(toNumber(value), 2);
	return isTwoDecimals(value) ? decimal.replace(/\.?0+$/, '') : `≈ ${decimal}`;
}

/** "= 8" or "≈ 8.49": a written number as the end of an equation, keeping "≈" when it is already there. */
function withEquals(text: string): string {
	return text.startsWith('≈') ? text : `= ${text}`;
}

/** "= 103.6" or "≈ 8.44": the end of an equation. */
export function equalsAmount(value: Fraction): string {
	return withEquals(amount(value));
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
			return `${values.length} pumpkins at the village fair. ${outlierWeightSentence(state)}`;
	}
}

// ---- Line-up: the middle child ----

export function coveredText(): string {
	return 'The summary appears when you find the middle of the class.';
}

export function checkRefusal(state: DescriptiveState): string | null {
	if (setupOf(state).kind !== 'lineup' || state.checked || state.pick !== null) return null;
	return `Pick a child under ${CONTROL_LABELS.pick} first.`;
}

type Rank = ReturnType<typeof rankOf>;

/** "4 children shorter and 4 taller", naming children of the same height only when there are some. */
function shorterAndTaller(rank: Rank): string {
	const shorter = plural(rank.shorter, 'child', 'children');
	return rank.same === 0 ? `${shorter} shorter and ${rank.taller} taller` : `${shorter} shorter, ${rank.taller} taller and ${rank.same} the same height`;
}

/** "8 children are shorter and none is taller", for the child standing in the middle of the arrival line. */
function rankClauses(rank: Rank): string {
	const taller = rank.taller === 0 ? 'none is taller' : `${rank.taller} ${rank.taller === 1 ? 'is' : 'are'} taller`;
	const same = rank.same === 0 ? [] : [`${rank.same} ${rank.same === 1 ? 'is' : 'are'} the same height`];
	const shorter = rank.shorter === 0 ? 'no child is shorter' : `${plural(rank.shorter, 'child is', 'children are')} shorter`;
	return joinWords([shorter, ...same, taller]);
}

/** The places in the arrival line that look like the middle: one child when n is odd, two when n is even. */
function arrivalMiddle(count: number): number[] {
	return count % 2 === 1 ? [(count - 1) / 2] : [count / 2 - 1, count / 2];
}

/** "(133 + 136) / 2 = 134.5 cm": the median of an even class, halfway between its two middle children. */
function halfwaySum(values: readonly number[], pair: readonly number[]): string {
	return `(${pair.map((child) => values[child]).join(' + ')}) / 2 ${equalsAmount(median(values))} cm`;
}

/** The verdict for the right child, or for the answer shown after two misses. */
function middleVerdict(values: readonly number[], child: number, shown: boolean): string {
	const pair = middleChildren(values);
	const height = values[child];
	const name = childName(child);
	if (pair.length === 1) {
		const rank = rankOf(values, child);
		const atMedian = `so the median height is ${height} cm.`;
		if (shown) return `The middle child is ${name.toLowerCase()} (${height} cm): ${plural(rank.shorter, 'child is', 'children are')} shorter and ${rank.taller} taller, ${atMedian}`;
		return `Yes. ${name} (${height} cm) has ${shorterAndTaller(rank)}, ${atMedian}`;
	}
	const halfway = `so the median height is halfway between them: ${halfwaySum(values, pair)}.`;
	const outside = values.length / 2 - 1;
	if (shown) {
		const [low, high] = pair.map((index) => `${childName(index).toLowerCase()} (${values[index]} cm)`);
		return `The two middle children are ${low} and ${high}: ${plural(outside, 'child is', 'children are')} shorter than both and ${outside} taller than both, ${halfway}`;
	}
	const other = pair.find((index) => index !== child) ?? child;
	return `Yes. ${name} (${height} cm) is one of the two middle children, with ${shorterAndTaller(rankOf(values, child))}. The other is ${childName(other).toLowerCase()} (${values[other]} cm), ${halfway}`;
}

export function feedbackLine(state: DescriptiveState): string | null {
	const { feedback } = state;
	if (!feedback) return null;
	const values = state.values;
	if (feedback.kind !== 'wrong') return middleVerdict(values, feedback.child, feedback.kind === 'shown');
	const height = values[feedback.child];
	const rank = rankOf(values, feedback.child);
	const name = childName(feedback.child);
	const hint = rank.shorter > rank.taller ? 'Try a shorter child.' : 'Try a taller child.';
	const arrival = arrivalMiddle(values.length);
	if (arrival.includes(feedback.child)) {
		const next = state.linedUp ? hint : 'Line them up first.';
		const where = arrival.length === 1 ? 'stands in the middle' : 'is one of the two in the middle';
		return `${name} ${where} of the arrival line, but ${rankClauses(rank)}. ${next}`;
	}
	return `${name} (${height} cm) has ${shorterAndTaller(rank)}. ${hint}`;
}

/** "(122 + 125 + … + 148) / 9 = 1,206 / 9 = 134": the mean as a sum over the sorted values. */
function meanChain(values: readonly number[]): string {
	const total = sum(values);
	return `(${sortedValues(values).map(groupThousands).join(' + ')}) / ${values.length} = ${groupThousands(total)} / ${values.length} ${equalsAmount(mean(values))}`;
}

/** Why the mean sits above or below the median, from all the distances, not one child. */
function meanVersusMedian(values: readonly number[], setup: Setup): string {
	const gap = subtractFractions(mean(values), median(values));
	const size = withUnit(amount(fraction(Math.abs(gap.numerator), gap.denominator)), setup);
	const order = compareFractions(gap, fraction(0, 1));
	if (order === 0) return 'The mean and the median are the same.';
	if (order > 0) return `The tallest children stand further above the median than the shortest stand below it, so the mean sits ${size} higher.`;
	return `The shortest children stand further below the median than the tallest stand above it, so the mean sits ${size} lower.`;
}

/** `noMode` ends the sentence when nothing repeats: "there is no mode", or "this class has no mode" on line-ups. */
function modeSentence(values: readonly number[], setup: Setup, noMode = 'there is no mode'): string {
	const found = modes(values);
	const top = topCount(values);
	if (found.length === 0) {
		return top === 1 ? `No ${setup.kind === 'newcomer' ? 'amount' : 'height'} repeats, so ${noMode}.` : `Every value appears ${top} times, so ${noMode}.`;
	}
	const held = found.length === 1 ? `held by ${plural(top, setup.words.item, setup.words.items)}` : `each held by ${plural(top, setup.words.item, setup.words.items)}`;
	return `Mode: ${joinWords(found.map((value) => withUnit(groupThousands(value), setup)))}, ${held}.`;
}

/** Line-up setups after Check: the mean, the mode and the range. */
function lineupSummary(state: DescriptiveState): string[] {
	const setup = setupOf(state);
	const values = state.values;
	const ordered = sortedValues(values);
	return [
		`Mean: ${meanChain(values)} cm. ${meanVersusMedian(values, setup)}`,
		modeSentence(values, setup, 'this class has no mode'),
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
	if (variance.denominator === 1) return `√${groupThousands(variance.numerator)} ${withEquals(rootAmount(root))} ${setup.words.unit}`;
	if (root.exact) return `√(${formatFraction(variance)}) = ${amount(root.value)} ${setup.words.unit}`;
	return `${approxNumber(root.value)} ${setup.words.unit}`;
}

/** "s = √72 ≈ 8.49 cm" or "s ≈ 8.17 cm". */
function symbolChain(symbol: 'σ' | 's', variance: Fraction, root: Root, setup: Setup): string {
	return `${symbol} ${withEquals(rootChain(variance, root, setup))}`;
}

/** σ for a list: "8", or "≈ 7.75". The ghost, goal and announcement lines share it. */
export function sigmaText(values: readonly number[]): string {
	return rootAmount(populationSD(values));
}

/** Owner decision 6: x̄ and s (÷ n − 1) beside μ and σ, while "Also as a sample" is on. Their switch announces them. */
export function sampleLines(state: DescriptiveState): string[] {
	if (!state.sample) return [];
	const setup = setupOf(state);
	const values = state.values;
	const sampleVar = sampleVariance(values);
	return [
		`As a sample of a bigger group, the same mean is written x̄ ${equalsAmount(mean(values))} cm.`,
		`Sample variance: ${amount(squaredTotal(values))} / ${n(values) - 1} ${equalsAmount(sampleVar)} ${setup.words.unitSquared}. ${symbolChain('s', sampleVar, sampleSD(values), setup)}.`,
	];
}

function spreadLines(state: DescriptiveState): string[] {
	const setup = setupOf(state);
	const values = state.values;
	const center = mean(values);
	if (new Set(values).size === 1) {
		return [`Every child is ${values[0]} cm: every distance is 0, so the variance is 0 and σ = 0 cm.`, ...sampleLines(state)];
	}
	const lines = [`Mean: ${groupThousands(sum(values))} / ${n(values)} ${equalsAmount(center)} cm.`];
	const ordered = sortedValues(values);
	const distances = ordered.map((value) => subtractFractions(fraction(value, 1), center));
	const total = squaredTotal(values);
	if (state.distances) {
		const exactCenter = center.denominator === 1;
		lines.push(
			`Distances from the mean, ${amount(center)} cm: ${joinWords(distances.map(signed))} cm. They add up to 0, so their plain average is always 0.`,
		);
		lines.push(
			exactCenter
				? `Squared: ${distances.map((d) => groupThousands(d.numerator * d.numerator)).join(' + ')} = ${groupThousands(total.numerator)} ${setup.words.unitSquared}.`
				: `Squared and added: ${amount(total)} ${setup.words.unitSquared}.`,
		);
	}
	const variance = populationVariance(values);
	lines.push(`Variance: ${amount(total)} / ${n(values)} ${equalsAmount(variance)} ${setup.words.unitSquared}. Standard deviation: ${rootChain(variance, populationSD(values), setup)}.`);
	lines.push(...sampleLines(state));
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
	const sigmaPart = `σ ${withEquals(sigmaText(state.values))} cm`;
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
	const reach = multiplyFractions(FENCE_FACTOR, spreadQ);
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
		return `Test ${test}: (${value} − ${amount(center)}) / ${amount(sigma.value)} ${withEquals(rootAmount(z))}.`;
	}
	const centerText = amount(center).replace('≈ ', '');
	const sigmaText = rootAmount(sigma).replace('≈ ', '');
	return `Test ${test}: mean ${amount(center)}, σ ${rootAmount(sigma)}, so z = (${value} − ${centerText}) / ${sigmaText} ${withEquals(rootAmount(z))}.`;
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
	const rose = (before: number, after: number) => (after > before ? 'rose' : after < before ? 'fell' : 'stayed');
	return `One mark of ${state.values[changed]} moved both scores for test B: min–max ${rose(toNumber(minBefore), toNumber(minAfter))} from ${amount(minBefore)} to ${minMaxChain(anaB, state.values)}, the z-score ${rose(rootNumber(zBefore), rootNumber(zAfter))} from ${rootAmount(zBefore)} to ${rootAmount(zAfter)}. Ana's ${anaB} did not change.`;
}

// ---- Outliers ----

/**
 * True once a giant is in: two giants, or one heavier or lighter than the opening's 8 kg. Until then the ceiling
 * sentence for |z| > 3 would answer the page's "how heavy must the giant be?" before the reader has tried a weight
 * (answer gating, decision 0015). Moving the giant back to 8 kg hides it again: that is the opening view.
 */
function giantTried(state: DescriptiveState): boolean {
	const opening = setupOf(state).opening;
	return state.giants === 2 || state.giant !== opening[opening.length - 1];
}

/** Before a giant is in, the ninth pumpkin is an ordinary 8 kg one, so the status line doesn't call it a giant. */
function outlierWeightSentence(state: DescriptiveState): string {
	if (state.giants === 2) return `The two giants weigh ${state.giant} kg each.`;
	return giantTried(state) ? `The giant weighs ${state.giant} kg.` : `The ninth pumpkin weighs ${state.giant} kg.`;
}

/**
 * Two giants mask each other only when one giant of that weight, on its own, would pass |z| > 2. At 8 kg neither
 * would, so there is nothing to hide and the board doesn't claim masking.
 */
function loneGiantPassesTwo(giant: number): boolean {
	return rootNumber(zScore(giant, pumpkins(giant, 1))) > 2;
}

function outlierLines(state: DescriptiveState): string[] {
	const values = state.values;
	const { q1, q3 } = quartiles(values);
	const spreadQ = iqr(values);
	const reach = multiplyFractions(FENCE_FACTOR, spreadQ);
	const { lower, upper } = fences(values);
	const fenceLine = `Q1 = ${amount(q1)} kg, Q3 = ${amount(q3)} kg, IQR = ${amount(spreadQ)} kg, so the upper fence is ${amount(q3)} + ${amount(reach)} = ${amount(upper)} kg.`;
	const giant = state.giant;
	const center = mean(values);
	const sigma = populationSD(values);
	const z = rootNumber(zScore(giant, values));
	const zText = approxNumber(z);
	const iqrFlagged = compareFractions(fraction(giant, 1), upper) > 0;
	const onFence = compareFractions(fraction(giant, 1), upper) === 0;
	const meanText = `Mean ${amount(center)} kg, σ ${withEquals(rootAmount(sigma))} kg`;
	const zFlagText = z > 3 ? 'flagged at |z| > 2 and at |z| > 3' : z > 2 ? 'flagged at |z| > 2, not at |z| > 3' : 'not flagged at |z| > 2 or at |z| > 3';
	const lines = [fenceLine];
	if (state.giants === 2) {
		const zVerdict = z > 2 ? `Both pass |z| > 2${z > 3 ? ' and |z| > 3' : ''}.` : `Neither passes |z| > 2${loneGiantPassesTwo(giant) ? ': the two giants hide each other' : ''}.`;
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
	if (state.cutoff === 3 && giantTried(state)) lines.push(ceilingLine(state));
	return lines;
}

/**
 * Why |z| > 3 can't fire. One value among n has |z| below √(n − 1); each of two equal giants shares the stretch and
 * stays below the tighter √((n − 2)/2), the bound the outlier page states.
 */
function ceilingLine(state: DescriptiveState): string {
	const count = state.values.length;
	if (state.giants === 2) {
		const square = (count - 2) / 2;
		return `With ${count} pumpkins and two equal giants, neither giant's z-score can reach √${square} ${approxNumber(Math.sqrt(square))}, however heavy they are, so |z| > 3 can never flag anything here.`;
	}
	return `With ${count} pumpkins no z-score can reach √${count - 1} ${approxNumber(Math.sqrt(count - 1))}, however heavy the giant, so |z| > 3 can never flag anything here.`;
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

/** "median = x₍₅₎", or halfway between the two middle heights when n is even. */
function medianSymbolLine(values: readonly number[]): SymbolLine {
	const count = n(values);
	const value = amount(median(values));
	if (count % 2 === 1) {
		const middle = (count + 1) / 2;
		return { text: `median = x₍${subscript(middle)}₎ = ${value} cm`, spoken: `The median is x ${middle} in brackets, the ${ordinal(middle)} height in order: ${value} cm.` };
	}
	const low = count / 2;
	const high = low + 1;
	return {
		text: `median = (x₍${subscript(low)}₎ + x₍${subscript(high)}₎) / 2 = ${value} cm`,
		spoken: `The median is halfway between x ${low} and x ${high} in brackets, the ${ordinal(low)} and ${ordinal(high)} heights in order: ${value} cm.`,
	};
}

export function symbolLines(state: DescriptiveState): SymbolLine[] {
	if (state.stage !== 'symbols') return [];
	const setup = setupOf(state);
	const values = state.values;
	const count = n(values);
	const center = mean(values);
	if (setup.kind === 'lineup') {
		return [
			{ text: `x₍₁₎ ≤ x₍₂₎ ≤ … ≤ x₍${subscript(count)}₎`, spoken: `The heights in order: x 1 in brackets is the shortest, x ${count} in brackets the tallest.` },
			medianSymbolLine(values),
			{ text: `μ = (1/n) Σ xᵢ = ${groupThousands(sum(values))} / ${count} ${equalsAmount(center)} cm`, spoken: `mu, the mean, is 1 over n times the sum of every x i: ${groupThousands(sum(values))} divided by ${count}, ${amount(center)} cm.` },
		];
	}
	const variance = populationVariance(values);
	const lines: SymbolLine[] = [
		{ text: `μ = (1/n) Σ xᵢ ${equalsAmount(center)} cm`, spoken: `mu, the mean, is 1 over n times the sum of every x i: ${amount(center)} cm.` },
		{ text: `σ² = (1/n) Σ (xᵢ − μ)² ${equalsAmount(variance)} cm²`, spoken: `sigma squared, the variance, is 1 over n times the sum of each squared distance from mu: ${amount(variance)} square centimeters.` },
		{ text: `σ = √σ² ${withEquals(sigmaText(values))} cm`, spoken: `sigma, the standard deviation, is the square root of the variance: ${sigmaText(values)} cm.` },
	];
	if (state.sample) {
		const sampleVar = sampleVariance(values);
		const s = rootAmount(sampleSD(values));
		lines.push(
			{ text: `s² = (1/(n − 1)) Σ (xᵢ − x̄)² ${equalsAmount(sampleVar)} cm²`, spoken: `s squared, the sample variance, is 1 over n minus 1 times the sum of each squared distance from x bar: ${amount(sampleVar)} square centimeters.` },
			{ text: `s = √s² ${withEquals(s)} cm`, spoken: `s, the sample standard deviation, is its square root: ${s} cm.` },
		);
	}
	const s = rootAmount(sampleSD(values));
	lines.push({
		text: `÷ ${count} counts every child once, as NumPy's np.std does by default. pandas' .std() divides by ${count - 1} and gives ${s} cm.`,
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

/** "Heights, child by child: Tight class." Names the loaded preset, so the caption never calls another class ours. */
function heightsCaption(state: DescriptiveState): string {
	const caption = 'Heights, child by child';
	if (state.activePreset === null) return `${caption}.`;
	const preset = presetById(setupOf(state), state.activePreset);
	if (!preset) throw new Error(`DescriptiveStats: active preset "${state.activePreset}" is not one of setup "${state.setupId}"'s presets.`);
	return `${caption}: ${preset.label}.`;
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
	const fixedCaption: Record<string, string> = {
		lineup: 'The children, in the order they arrived.',
		newcomer: 'Savings, customer by customer.',
		outliers: 'The pumpkins, one by one.',
	};
	const caption = setup.kind === 'spread' || setup.kind === 'box' ? heightsCaption(state) : fixedCaption[setup.kind];
	const rowName = (index: number) => {
		if (setup.kind === 'newcomer' && index >= state.values.length) return 'Newcomer';
		if (setup.kind === 'outliers' && index >= values.length - state.giants) return `Pumpkin ${index + 1} (giant)`;
		return `${setup.words.itemTitle} ${index + 1}`;
	};
	return {
		caption,
		headers: [setup.words.itemTitle, setup.words.valueTitle, ...(showPlaces ? ['Place in line'] : [])],
		rows: values.map((value, index) => ({ header: rowName(index), cells: [groupThousands(value), ...(showPlaces ? [order[index]] : [])] })),
	};
}

type SummaryRow = { header: string; cells: string[] };
const row = (header: string, value: string, how: string): SummaryRow => ({ header, cells: [value, how] });

/** The Mode row: none, one most common value, or several tied for most common, each with its unit. */
function modeRow(found: readonly number[], setup: Setup): SummaryRow {
	if (found.length === 0) return row('Mode', 'None', 'Every value appears equally often');
	const value = joinWords(found.map((entry) => withUnit(groupThousands(entry), setup)));
	return row('Mode', value, found.length === 1 ? 'The most common value' : 'The most common values, tied');
}

function centerRows(values: readonly number[], setup: Setup): SummaryRow[] {
	const count = n(values);
	const middle = count % 2 === 1 ? `The ${ordinal((count + 1) / 2)} of ${count} in order` : `The average of the ${ordinal(count / 2)} and ${ordinal(count / 2 + 1)} in order`;
	const found = modes(values);
	return [
		row('Count, n', String(count), `How many ${setup.words.items}`),
		row('Mean', withUnit(amount(mean(values)), setup), `The sum, ${groupThousands(sum(values))}, divided by ${count}`),
		row('Median', withUnit(amount(median(values)), setup), middle),
		modeRow(found, setup),
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

/**
 * class-box: the summary rows each step may show. Every quartile row waits for the Quartiles step, the IQR and the
 * fences for Box plot, so the table never answers "which child marks the first quarter?" early (decision 0015).
 */
export const BOX_SUMMARY_ROWS: Readonly<Record<'line-up' | 'quartiles' | 'box', readonly string[]>> = {
	'line-up': ['Smallest', 'Largest'],
	quartiles: ['Smallest', 'Q1', 'Median', 'Q3', 'Largest'],
	box: ['Smallest', 'Q1', 'Median', 'Q3', 'Largest', 'IQR', 'Fences'],
};

/**
 * marks-scaling: the summary rows each scale may show, only the numbers its own readout uses. Raw shows none, since
 * the means, σs and ends would give both scaled scores before the reader picks a scale (decision 0015).
 */
export const SCALING_SUMMARY_ROWS: Readonly<Record<Scale, readonly ('ends' | 'mean' | 'sd')[]>> = {
	raw: [],
	minmax: ['ends'],
	z: ['mean', 'sd'],
};

/** Shown where the summary would be while a gate keeps every row of it back; null when the summary has rows. */
export function summaryNote(state: DescriptiveState): string | null {
	if (setupOf(state).kind !== 'scaling' || SCALING_SUMMARY_ROWS[state.scale].length > 0) return null;
	const picks = (['minmax', 'z'] as const).map((scale) => SCALE_LABELS[scale]).join(' or ');
	return `Each test's summary appears when you pick ${picks} under ${CONTROL_LABELS.scale}.`;
}

/** The box summary rows for the step in view, in quartileRows' order. */
function boxRows(state: DescriptiveState, values: readonly number[], setup: Setup): SummaryRow[] {
	if (state.stage !== 'line-up' && state.stage !== 'quartiles' && state.stage !== 'box') {
		throw new Error(`DescriptiveStats: setup "${setup.id}" has no box step "${state.stage}".`);
	}
	const shown = BOX_SUMMARY_ROWS[state.stage];
	return quartileRows(values, setup).filter((entry) => shown.includes(entry.header));
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
			return { caption, headers, rows: boxRows(state, values, setup) };
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
			const testRows = (name: string, list: readonly number[]) => {
				const all = {
					mean: row(`Test ${name} mean, μ`, amount(mean(list)), `The sum, ${groupThousands(sum(list))}, divided by ${n(list)}`),
					sd: row(`Test ${name} standard deviation, σ`, rootAmount(populationSD(list)), 'Dividing by n (np.std)'),
					ends: row(`Test ${name} lowest and highest`, `${sortedValues(list)[0]} and ${sortedValues(list)[n(list) - 1]}`, 'The ends min–max scaling uses'),
				};
				return SCALING_SUMMARY_ROWS[state.scale].map((key) => all[key]);
			};
			return { caption, headers, rows: [...testRows('A', testA.values), ...testRows('B', state.values)] };
		}
	}
}

/**
 * The body said after "Table shown under the switch.": what the folded tables hold. While a gate keeps the summary
 * back, its second sentence is the board's own reason (coveredText or summaryNote), never a restatement of it.
 */
export function tableFoldSentence(state: DescriptiveState): string {
	const setup = setupOf(state);
	const { items, values } = setup.words;
	const count = valuesNow(state).length;
	const then = 'and then the summary.';
	switch (setup.kind) {
		case 'lineup':
			return isCovered(state)
				? `It lists the ${count} ${items} in the order they arrived, with their ${values}. ${coveredText()}`
				: `It lists the ${count} ${items} in the order they arrived, with their ${values} and places in line, ${then}`;
		case 'spread':
		case 'box':
			return `It lists the ${count} ${items}, with their ${values} and places in line, ${then}`;
		case 'newcomer':
		case 'outliers':
			return `It lists the ${count} ${items}, with their ${values}, ${then}`;
		case 'scaling': {
			const note = summaryNote(state);
			const marks = `It lists the ${count} ${items} on each test, lowest first`;
			return note ? `${marks}. ${note}` : `${marks}, ${then}`;
		}
	}
}

// ---- Chart labels ----

export function meanLabel(state: DescriptiveState): string {
	const center = amount(mean(valuesNow(state)));
	const symbol = setupOf(state).kind === 'lineup' || setupOf(state).kind === 'newcomer' ? 'mean' : state.sample ? 'μ = x̄' : 'μ';
	if (symbol === 'mean') return `mean ${center}`;
	return `${symbol} ${withEquals(center)}`;
}

export function medianLabel(state: DescriptiveState): string {
	return `median ${amount(median(valuesNow(state)))}`;
}

export function spreadLabel(symbol: 'σ' | 's', root: Root): string {
	return `${symbol} ${withEquals(rootAmount(root))}`;
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

/** The second wrong Check reveals "Show the answer"; saying so also keeps it from repeating the first. */
function checkAnnouncement(state: DescriptiveState): string {
	const line = feedbackLine(state) ?? '';
	return state.feedback?.kind === 'wrong' && state.failedChecks === CHECKS_BEFORE_ANSWER ? `${line} You can now show the answer.` : line;
}

/**
 * "Already showing Our class.": pressing the preset in view changes nothing (on a line-up the reducer returns the same
 * state, so no effect would speak), and the board says this instead, so the press is heard. Null for any other preset.
 */
export function alreadyShowingLine(state: DescriptiveState, presetId: string): string | null {
	if (state.activePreset !== presetId) return null;
	const preset = presetById(setupOf(state), presetId);
	if (!preset) throw new Error(`DescriptiveStats: setup "${state.setupId}" has no preset "${presetId}".`);
	return `Already showing ${preset.label}.`;
}

/** What the live region says when an interaction ends: the sentence that answers it. */
export function announcementFor(state: DescriptiveState, action: Action): string {
	const setup = setupOf(state);
	const readouts = readoutLines(state).join(' ');
	const goal = goalStatus(state);
	switch (action.type) {
		case 'line-up':
			return statusLine(state);
		case 'pick':
			return `${CONTROL_LABELS.pick}: child ${action.child + 1}, ${state.values[action.child]} cm.`;
		// A passed Check and a shown answer move focus to the verdict, which is read there; saying it here too would
		// read it twice (decision 0019). A wrong Check leaves focus on Check, so its verdict is announced.
		case 'check':
			if (state.refusal) return checkRefusal(state) ?? '';
			return state.checked ? '' : checkAnnouncement(state);
		case 'show-answer':
			return '';
		case 'select':
			return `Moving child ${state.selected + 1}, ${state.values[state.selected]} cm.`;
		case 'set-value':
			if (setup.kind === 'spread') {
				return `Child ${state.selected + 1} is now ${state.values[state.selected]} cm. Mean ${amount(mean(state.values))} cm, σ ${withEquals(sigmaText(state.values))} cm. ${goal ?? ''}`.trim();
			}
			if (setup.kind === 'newcomer') return state.newcomer === null ? statusLine(state) : newcomerChange(state);
			return readouts;
		case 'preset': {
			const label = setup.presets.find((preset) => preset.id === action.id)?.label ?? '';
			if (setup.kind === 'newcomer') return state.newcomer === null ? `${label}. ${readouts}` : `${label}. ${newcomerChange(state)}`;
			// On Raw marks the change in scaled scores would answer the page before a scale is picked: say what shows.
			if (setup.kind === 'scaling') return action.id === setup.presets[0]?.id || state.scale === 'raw' ? `${label}. ${readouts}` : lowMarkChange(state);
			if (setup.kind === 'spread') return `${label}. ${readouts} ${goal ?? ''}`.trim();
			// A new class arrives unsorted and covered, so it is introduced, not summarized.
			if (setup.kind === 'lineup') return `${label}. ${statusLine(state)}`;
			return `${label}. ${readouts}`;
		}
		case 'stage': {
			const symbols = symbolLines(state);
			return `Showing ${STAGE_LABELS[state.stage]}. ${symbols.length > 0 ? symbols.map((line) => line.spoken).join(' ') : readouts}`.trim();
		}
		case 'distances':
			return state.distances ? readouts : 'Distances hidden.';
		case 'sample':
			return state.sample ? sampleLines(state).join(' ') : 'Sample versions hidden.';
		case 'newcomer':
			return state.newcomer === null ? `Nobody new. ${readouts}` : newcomerChange(state);
		case 'scale':
			return `${SCALE_LABELS[state.scale]}. ${readouts}`;
		case 'cutoff':
			return `Flagging when |z| is above ${state.cutoff}. ${readouts}`;
		case 'table':
			return tableFoldAnnouncement(action.open, tableFoldSentence(state));
		case 'reset':
			return `Back to the start. ${statusLine(state)}`;
	}
}
