// Every sentence DistributionBoard shows or speaks, built from state. The visible text and the live-region text
// come from the same functions, so what a screen reader hears always matches the screen.
//
// Number format, one rule per kind of number:
// - Chances read count, reduced fraction, decimal: "3/6 = 1/2 = 0.50", always two decimals, like EventSpace. Check
//   and goal sentences, which already carry several numbers, stop at the reduced fraction and add the decimal only
//   when the fraction doesn't reduce ("3/6 = 1/2", "1/6 ≈ 0.17").
// - Amounts computed from the bars (μ, variance, σ, distances) drop trailing zeros: "μ = 7/2 = 3.5", "σ = 2".
// - The pencil, and anything measured from it, shows two decimals, because it repeats the slider's readout:
//   "your pencil at 3.50", "1 − 1.50 = −0.50".
// "≈" appears only when the decimal is rounded.
import { absoluteFraction, addFractions, compareFractions, formatFraction, fraction, squareRoot, toNumber, type Fraction } from '../boardMath.ts';
import { capitalize, joinWords, plural } from '../boardText.ts';
import type { OutcomeId } from '../eventSpace/model.ts';
import { CHECKS_BEFORE_ANSWER } from '../guided/guided.ts';
import { tableFoldAnnouncement } from '../guided/tableFold.ts';
import { spokenMath } from '../spokenMath.ts';
import { amountChain, briefChance, fullChance, isRoundedValue, isWhole, plainDecimal, shortAmount, trimmedDecimal } from './numberFormat.ts';
import { classifyGuess, mean, standardDeviation, torqueSign, variance, type Bar, type Distribution } from './model.ts';
import { ALL_ZERO, presetValues, type Setup } from './setups.ts';
import { outcomesOf, type SourceId } from './sources.ts';
import { distributionNow, isCovered, setupOf, type Action, type DistributionState, type Refusal, type Stage } from './state.ts';

/** The "Show as" options' names, shown on the buttons and spoken when the view changes. */
export const STAGE_LABELS: Readonly<Record<Stage, string>> = { pictures: 'Pictures', numbers: 'Numbers', symbols: 'Symbols' };

/** The board's control names. Sentences that tell the reader to press a control quote these, so the two can't drift. */
export const CONTROL_LABELS = {
	check: 'Check',
	showAnswer: 'Show the answer',
	showAs: 'Show as',
	pencil: 'Pencil position',
	balance: 'Balance it',
	spread: 'Show the spread',
	presets: 'Presets',
	checkGoal: 'Check goal',
} as const;

const NEW_GAME_LINE = `New game. Slide the pencil and press ${CONTROL_LABELS.balance}.`;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

interface WordPair {
	one: string;
	many: string;
}

/**
 * Sentence shapes that differ between a die whose faces win candies and two coins whose outcomes get X. Keyed by
 * source because each source carries one story today; the per-setup Wording still supplies names and value text.
 */
interface SourceCopy {
	unit: WordPair;
	/** What X stands for in the status line. */
	variable: string;
	/** The steppers' value column, e.g. "Candies". */
	valueHeader: string;
	/** "wins / win" for faces, "has / have" for coin outcomes. */
	verb: WordPair;
	/** "face 6" and "faces 1, 2 and 3", or bare "HT and TH": die faces are numerals, so they need the word. */
	name: (labels: readonly string[]) => string;
	/** One outcome's value as a sentence. */
	assigned: (label: string, valueText: string) => string;
	barName: (value: number) => string;
	coveredStatus: (setup: Setup) => string;
	coveredText: string;
	oneWrong: (label: string, setText: string, card: number) => string;
	severalWrong: (labels: readonly string[]) => string;
	matched: (setup: Setup, d: Distribution) => string;
	answerGroup: (bar: Bar, labels: readonly string[]) => string;
}

const facesName = (labels: readonly string[]) => `${labels.length === 1 ? 'face' : 'faces'} ${joinWords(labels)}`;
const CANDIES: WordPair = { one: 'candy', many: 'candies' };
const WINS: WordPair = { one: 'wins', many: 'win' };
const agree = (verb: WordPair, count: number) => (count === 1 ? verb.one : verb.many);
const numberWord = (count: number) => NUMBER_WORDS[count] ?? String(count);

const SOURCE_COPY: Readonly<Record<SourceId, SourceCopy>> = {
	'one-die': {
		unit: CANDIES,
		variable: 'candies won',
		valueHeader: 'Candies',
		verb: WINS,
		name: facesName,
		assigned: (label, valueText) => `${capitalize(facesName([label]))} wins ${valueText}.`,
		barName: (value) => `${value}-${CANDIES.one} bar`,
		coveredStatus: (setup) => `${cardName(setup)}: ${cardText(setup)}. Set each face to match, then press ${CONTROL_LABELS.check}.`,
		coveredText: 'The chart appears when your values match the card.',
		oneWrong: (label, setText, card) => `Not yet. ${capitalize(facesName([label]))} wins ${setText}; the card says ${card}.`,
		severalWrong: (labels) => `Not yet. ${capitalize(facesName(labels))} don't match the card.`,
		matched: (_setup, d) => {
			const bar = largestBar(d);
			const values = d.bars.map((entry) => String(entry.value));
			return (
				`Yes, that matches the card. ${capitalize(numberWord(d.bars.length))} amounts are possible, ${joinWords(values)} ${CANDIES.many}, ` +
				`so the chart has ${d.bars.length} bars, not ${d.totalWeight}. ${unequalLead(d)}: ${plural(bar.weight, 'face', 'faces')} ${agree(WINS, bar.weight)} ${bar.value}, ` +
				`so P(X = ${bar.value}) = ${briefChance(bar.weight, d.totalWeight)}, not 1/${d.bars.length}.`
			);
		},
		answerGroup: (bar, labels) => `${facesName(labels)} ${agree(WINS, labels.length)} ${bar.value}`,
	},
	'two-coins': {
		unit: { one: 'head', many: 'heads' },
		variable: 'number of heads',
		valueHeader: 'X',
		verb: { one: 'has', many: 'have' },
		name: joinWords,
		assigned: (label, valueText) => `${valueText} for ${label}.`,
		barName: (value) => `X = ${value} bar`,
		coveredStatus: () => `Let X count the heads. Set X for each outcome, then press ${CONTROL_LABELS.check}.`,
		coveredText: 'The chart appears when every outcome has its number of heads.',
		oneWrong: (label, setText, card) => `Not yet. ${label} has ${plural(card, 'head', 'heads')}; you set ${setText}.`,
		severalWrong: (labels) => `Not yet. ${joinWords(labels)} don't match.`,
		matched: (setup, d) => {
			const bar = largestBar(d);
			return (
				`Yes. X = ${bar.value} for ${joinWords(labelsOf(setup, bar.members))}: ${bar.weight} of ${d.totalWeight} outcomes, ` +
				`so P(X = ${bar.value}) = ${briefChance(bar.weight, d.totalWeight)}, not 1/${d.bars.length}.`
			);
		},
		answerGroup: (bar, labels) => `X = ${bar.value} for ${joinWords(labels)}`,
	},
};

const copyOf = (setup: Setup) => SOURCE_COPY[setup.source];
const isOne = (value: Fraction) => compareFractions(value, fraction(1, 1)) === 0;

// ---- Numbers ----

function withUnit(setup: Setup, text: string, value: Fraction): string {
	const { unit } = copyOf(setup);
	return `${text} ${isOne(value) ? unit.one : unit.many}`;
}

/** "(…) / 6 = 21/6 = 7/2 = 3.5": the unreduced quotient is shown when the sum is whole and the result isn't. */
function averageChain(sum: Fraction, count: number): string {
	const result = fraction(sum.numerator, sum.denominator * count);
	if (isWhole(result) || !isWhole(sum)) return amountChain(result);
	const counted = `${sum.numerator}/${count}`;
	return formatFraction(result) === counted ? amountChain(result) : `${counted} = ${amountChain(result)}`;
}

const sumFractions = (values: readonly Fraction[]) => values.reduce(addFractions, fraction(0, 1));
const difference = (a: Fraction, b: Fraction) => addFractions(a, fraction(-b.numerator, b.denominator));

// ---- Outcomes and bars ----

function labelsOf(setup: Setup, ids: readonly OutcomeId[]): string[] {
	const outcomes = outcomesOf(setup.source);
	return ids.map((id) => {
		const outcome = outcomes.find((candidate) => candidate.id === id);
		if (!outcome) throw new Error(`DistributionBoard: setup "${setup.id}" has no outcome "${id}".`);
		return outcome.label;
	});
}

/** The bar with the most weight, the first one on a tie: the bar the Check and Symbols sentences single out. */
function largestBar(d: Distribution): Bar {
	return d.bars.reduce((largest, bar) => (bar.weight > largest.weight ? bar : largest));
}

/** The match sentence argues that the amounts are not equally likely, so a card where they are needs new copy. */
function unequalLead(d: Distribution): string {
	if (d.bars.every((bar) => bar.weight === d.bars[0].weight)) {
		throw new Error('DistributionBoard: the match sentence assumes unequal bars; this card makes every amount equally likely.');
	}
	return 'They are not equally likely';
}

/** "Average over the faces" and "N equally likely faces" are only true when every outcome weighs the same. */
function assertEquallyLikely(setup: Setup): number {
	const outcomes = outcomesOf(setup.source);
	if (outcomes.some((outcome) => outcome.weight !== outcomes[0].weight)) {
		throw new Error(`DistributionBoard: setup "${setup.id}" has unequal weights, which its sentences don't describe yet.`);
	}
	return outcomes.length;
}

function cardName(setup: Setup): string {
	const card = setup.card;
	const name = setup.presets.find((preset) => preset !== ALL_ZERO && card && presetValues(setup, preset).every((value, index) => value === card[index]));
	if (!name) throw new Error(`DistributionBoard: setup "${setup.id}" has no preset matching its card.`);
	return name;
}

/** "faces 1, 2 and 3 win nothing, faces 4 and 5 win 1 candy, face 6 wins 5 candies", grouped by value. */
function cardText(setup: Setup): string {
	const card = setup.card ?? [];
	const outcomes = outcomesOf(setup.source);
	const values = [...new Set(card)].sort((a, b) => a - b);
	return values
		.map((value) => {
			const labels = outcomes.filter((_, index) => card[index] === value).map((outcome) => outcome.label);
			const amount = value === 0 ? 'nothing' : setup.wording.valueText(value);
			return `${facesName(labels)} ${agree(WINS, labels.length)} ${amount}`;
		})
		.join(', ');
}

function baseStatus(setup: Setup): string {
	return `${assertEquallyLikely(setup)} equally likely ${setup.wording.outcomeWord}s.`;
}

function meanSentence(state: DistributionState): string {
	const setup = setupOf(state);
	const center = mean(distributionNow(state));
	return `The mean is μ = ${withUnit(setup, amountChain(center), center)}.`;
}

// ---- Status, feedback and goal ----

export function statusLine(state: DistributionState): string {
	const setup = setupOf(state);
	const copy = copyOf(setup);
	const described = `${baseStatus(setup)} X = ${copy.variable}.`;
	switch (setup.kind) {
		case 'goal':
			return isCovered(state) ? `${baseStatus(setup)} ${copy.coveredStatus(setup)}` : described;
		case 'balance':
			return state.revealed ? `${described} ${meanSentence(state)}` : `${described} Slide the pencil to where you think the bars balance, then press ${CONTROL_LABELS.balance}.`;
		case 'spread':
			return `${described} ${meanSentence(state)}`;
	}
}

/** The covered panel that stands in for the chart and table on a goal setup before the match. */
export function coveredText(setup: Setup): string {
	return copyOf(setup).coveredText;
}

export function feedbackLine(state: DistributionState): string | null {
	const feedback = state.feedback;
	if (!feedback) return null;
	const setup = setupOf(state);
	const copy = copyOf(setup);
	switch (feedback.kind) {
		case 'match':
			return copy.matched(setup, distributionNow(state));
		case 'shown':
			return `The answer: ${answerText(setup, distributionNow(state))}`;
		case 'one-wrong':
			return copy.oneWrong(labelsOf(setup, [feedback.id])[0], setup.wording.valueText(feedback.set), feedback.card);
		case 'several-wrong':
			return copy.severalWrong(labelsOf(setup, feedback.ids));
	}
}

/** Every outcome's value, grouped by bar, then each bar's chance. Never starts with "Yes": the reader gave up. */
function answerText(setup: Setup, d: Distribution): string {
	const copy = copyOf(setup);
	const groups = d.bars.map((bar) => copy.answerGroup(bar, labelsOf(setup, bar.members)));
	const chances = d.bars.map((bar) => `P(X = ${bar.value}) = ${briefChance(bar.weight, d.totalWeight)}`);
	return `${groups.join(', ')}. ${chances.join(', ')}.`;
}

/** The follow-up goal after the card: the goal itself while open, then the verdict of "Check goal". */
export function goalLine(state: DistributionState): string | null {
	const setup = setupOf(state);
	const goal = setup.goalAfterCard;
	if (!goal || state.goal === null) return null;
	const target = `P(X = ${goal.value})`;
	if (state.goal === 'open') return `New goal: make ${target} = ${formatFraction(goal.chance)}.`;
	const outcomes = outcomesOf(setup.source);
	const hits = outcomes.filter((outcome) => state.values[outcome.id] === goal.value);
	const total = assertEquallyLikely(setup);
	const word = setup.wording.outcomeWord;
	const verb = agree(copyOf(setup).verb, hits.length);
	const amount = setup.wording.valueText(goal.value);
	const chance = `${target} = ${briefChance(hits.length, total)}`;
	if (state.goal === 'passed') {
		return `Yes: ${copyOf(setup).name(hits.map((outcome) => outcome.label))} ${verb} ${amount}, ${hits.length} of ${total} ${word}s, so ${chance}.`;
	}
	return `Not yet: ${plural(hits.length, word, `${word}s`)} ${verb} ${amount}, so ${chance}. You need ${neededCount(setup, total)} of the ${total}.`;
}

function neededCount(setup: Setup, total: number): number {
	const chance = setup.goalAfterCard?.chance ?? fraction(0, 1);
	const needed = (chance.numerator * total) / chance.denominator;
	if (!Number.isInteger(needed)) throw new Error(`DistributionBoard: setup "${setup.id}" sets a goal no whole number of outcomes can meet.`);
	return needed;
}

// ---- Readouts, Symbols and the table ----

/** One sentence per bar, then the total. Empty while covered, so nothing gives the grouping away. */
export function readoutLines(state: DistributionState): string[] {
	if (isCovered(state)) return [];
	const setup = setupOf(state);
	const d = distributionNow(state);
	const word = setup.wording.outcomeWord;
	const lines = d.bars.map(
		(bar) =>
			`${setup.wording.valueText(bar.value)}: ${copyOf(setup).name(labelsOf(setup, bar.members))}. ` +
			`${bar.weight} of ${d.totalWeight} ${word}s, so P(X = ${bar.value}) = ${fullChance(bar.weight, d.totalWeight)}.`,
	);
	return [...lines, `The bars add up to ${d.totalWeight}/${d.totalWeight} = 1.`];
}

/** The Symbols view: X as a function, then the largest bar as an event. Empty in other views and while covered. */
export function symbolLines(state: DistributionState): string[] {
	if (state.stage !== 'symbols' || isCovered(state)) return [];
	const setup = setupOf(state);
	const d = distributionNow(state);
	const mapping = outcomesOf(setup.source).map((outcome) => `X(${outcome.label}) = ${state.values[outcome.id]}`);
	const bar = largestBar(d);
	const event = `{${labelsOf(setup, bar.members).join(', ')}}`;
	return [`${mapping.join(', ')}.`, `The event X = ${bar.value} is the set ${event}, so P(X = ${bar.value}) = P(${event}) = ${bar.weight}/${d.totalWeight}.`];
}

export function tableRows(state: DistributionState): { value: string; members: string; probability: string }[] {
	if (isCovered(state)) return [];
	const setup = setupOf(state);
	const d = distributionNow(state);
	return d.bars.map((bar) => ({
		value: String(bar.value),
		members: joinWords(labelsOf(setup, bar.members)),
		probability: fullChance(bar.weight, d.totalWeight),
	}));
}

/** The body said after "Table shown under the switch.": how many bars the table lists, and what each row holds. */
export function tableFoldSentence(state: DistributionState): string {
	const bars = distributionNow(state).bars.length;
	const members = `${setupOf(state).wording.outcomeWord}s`;
	return `It lists ${plural(bars, 'bar', 'bars')}, ${bars === 1 ? '' : 'each '}with its ${members} and its chance.`;
}

export function tableHeaders(setup: Setup): { caption: string; value: string; members: string; probability: string } {
	return { caption: 'The bars as a table.', value: 'Value', members: `${capitalize(setup.wording.outcomeWord)}s`, probability: 'P(X = x)' };
}

// ---- The pencil and the balance ----

const pencilFraction = (setup: Setup, k: number) => fraction(k, setup.stepDenominator);

/** The slider's readout, e.g. "1.17" or "−0.50". */
export function formatPencil(setup: Setup, k: number): string {
	return plainDecimal(k / setup.stepDenominator);
}

/** The slider's spoken value, e.g. "pencil at 1.17 candies". */
export function describePencil(setup: Setup, k: number): string {
	return `pencil at ${formatPencil(setup, k)} ${copyOf(setup).unit.many}`;
}

const tipSide = (sign: -1 | 0 | 1) => (sign > 0 ? 'right' : 'left');

/**
 * The verdict after "Balance it", from classifyGuess. Null until the reveal, so the pencil move stays a guess. It
 * judges the stored guess, not the live pencil, so exploring afterward never rewrites the verdict. A value change
 * after the reveal drops the guess (the problem changed), and with it the verdict.
 */
export function balanceLine(state: DistributionState): string | null {
	const setup = setupOf(state);
	const guess = state.guess;
	if (setup.kind !== 'balance' || !state.revealed || guess === null) return null;
	const d = distributionNow(state);
	const center = mean(d);
	const pencil = formatPencil(setup, guess);
	const mu = `μ = ${withUnit(setup, amountChain(center), center)}`;
	const side = tipSide(torqueSign(d, guess, setup.stepDenominator));
	switch (classifyGuess(d, guess, setup.stepDenominator)) {
		case 'balanced':
			return `Balanced: your pencil at ${pencil} is right under the mean, ${mu}.`;
		case 'midrange':
			return `The plank tips down on the ${side}. You put the pencil halfway between the smallest and largest amounts, ${midrangeReason(setup, d, center)}. The balance point is ${mu}.`;
		case 'tallest-bar':
			return `The plank tips down on the ${side}. You put the pencil under the tallest bar, ${tallestBarReason(d, side)}. The balance point is ${mu}.`;
		case 'other':
			return `The plank tips down on the ${side}, so the balance point is farther ${side}. The mean is ${mu}; your pencil was at ${pencil}.`;
	}
}

/** "at 3, but 5 of the 6 faces sit at 0": the faces on μ's side of the midpoint outweigh the range's far end. */
function midrangeReason(setup: Setup, d: Distribution, center: Fraction): string {
	const lowest = d.bars[0].value;
	const highest = d.bars[d.bars.length - 1].value;
	const midpoint = fraction(lowest + highest, 2);
	const below = compareFractions(center, midpoint) < 0;
	const near = d.bars.filter((bar) => (below ? compareFractions(fraction(bar.value, 1), midpoint) < 0 : compareFractions(fraction(bar.value, 1), midpoint) > 0));
	const count = near.reduce((total, bar) => total + bar.weight, 0);
	const edge = below ? near[near.length - 1].value : near[0].value;
	const where = near.length === 1 ? `at ${edge}` : `at or ${below ? 'below' : 'above'} ${edge}`;
	return `at ${shortAmount(midpoint)}, but ${count} of the ${d.totalWeight} ${setup.wording.outcomeWord}s ${count === 1 ? 'sits' : 'sit'} ${where}`;
}

/** "at 0, but the bar out at 6 …": the bars on the heavy side of the pencil pull harder than the tall one under it. */
function tallestBarReason(d: Distribution, side: 'left' | 'right'): string {
	const tallest = largestBar(d);
	const beyond = d.bars.filter((bar) => (side === 'right' ? bar.value > tallest.value : bar.value < tallest.value));
	const pull = beyond.length === 1 ? `the bar out at ${beyond[0].value} sits far from the pencil and pulls harder` : 'the bars farther out pull harder';
	return `at ${tallest.value}, but ${pull}`;
}

/** After the reveal, the pull on the pencil as μ − c, so the tilt has a formula behind it. */
export function pencilLine(state: DistributionState): string | null {
	const setup = setupOf(state);
	if (setup.kind !== 'balance' || !state.revealed) return null;
	const d = distributionNow(state);
	const center = mean(d);
	const sign = torqueSign(d, state.pencil, setup.stepDenominator);
	if (sign === 0) return `Level: the pencil is at the mean, ${amountChain(center)}.`;
	const pencil = formatPencil(setup, state.pencil);
	const subtracted = state.pencil < 0 ? `(${pencil})` : pencil;
	const pull = toNumber(difference(center, pencilFraction(setup, state.pencil)));
	const result = `${isRoundedValue(pull) ? '≈' : '='} ${plainDecimal(pull)}`;
	return `Pencil at ${pencil}: the bars pull ${shortAmount(center)} − ${subtracted} ${result} ${copyOf(setup).unit.many} from it, so the plank tips ${tipSide(sign)}.`;
}

/** The mean two ways, once it is shown: averaged over the outcomes, then weighted by the bars. */
export function meanLines(state: DistributionState): string[] {
	const setup = setupOf(state);
	if (setup.kind === 'goal' || !state.revealed) return [];
	const count = assertEquallyLikely(setup);
	const d = distributionNow(state);
	const center = mean(d);
	const values = outcomesOf(setup.source).map((outcome) => state.values[outcome.id]);
	const sum = values.reduce((total, value) => total + value, 0);
	const average = withUnit(setup, averageChain(fraction(sum, 1), count), center);
	const weighted = d.bars.map((bar) => `${bar.value} × ${formatFraction(bar.probability)}`).join(' + ');
	return [`Average over the ${setup.wording.outcomeWord}s: (${values.join(' + ')}) / ${count} = ${average}.`, `The same from the bars: ${weighted} = ${amountChain(center)}.`];
}

// ---- Spread ----

/** "1 and 3 are 1 candy away; 2 is 0 away", farthest first. "each" only when one distance covers every bar. */
function distanceText(setup: Setup, d: Distribution, center: Fraction): string {
	const groups = new Map<string, { distance: Fraction; values: number[] }>();
	for (const bar of d.bars) {
		const distance = absoluteFraction(difference(fraction(bar.value, 1), center));
		const key = formatFraction(distance);
		const group = groups.get(key) ?? { distance, values: [] };
		group.values.push(bar.value);
		groups.set(key, group);
	}
	const ordered = [...groups.values()].sort((a, b) => compareFractions(b.distance, a.distance));
	return ordered
		.map(({ distance, values }) => {
			const verb = values.length === 1 ? 'is' : ordered.length === 1 ? 'are each' : 'are';
			const away = distance.numerator === 0 ? '0' : withUnit(setup, shortAmount(distance), distance);
			return `${joinWords(values.map(String))} ${verb} ${away} away`;
		})
		.join('; ');
}

/** "σ = √4 = 2 candies" or "σ = √(2/3) ≈ 0.82 candies": exact when the variance is a square of a fraction. */
function sigmaText(setup: Setup, spread: Fraction): string {
	const root = isWhole(spread) ? `√${spread.numerator}` : `√(${formatFraction(spread)})`;
	const sigma = squareRoot(spread);
	if (sigma.exact) return `σ = ${root} = ${withUnit(setup, amountChain(sigma.value), sigma.value)}`;
	return `σ = ${root} ≈ ${trimmedDecimal(sigma.value)} ${copyOf(setup).unit.many}`;
}

/** Distances, variance and σ once "Show the spread" is on. A single bar gets one sentence: nothing spreads. */
export function spreadLines(state: DistributionState): string[] {
	const setup = setupOf(state);
	if (setup.kind !== 'spread' || !state.spreadShown) return [];
	const d = distributionNow(state);
	const spread = variance(d);
	if (spread.numerator === 0) {
		const { verb } = copyOf(setup);
		return [`Every ${setup.wording.outcomeWord} ${verb.one} ${setup.wording.valueText(d.bars[0].value)}: nothing spreads, so the variance is 0 and σ = 0.`];
	}
	const center = mean(d);
	const count = assertEquallyLikely(setup);
	const squares = outcomesOf(setup.source).map((outcome) => {
		const distance = difference(fraction(state.values[outcome.id], 1), center);
		return fraction(distance.numerator * distance.numerator, distance.denominator * distance.denominator);
	});
	// A whole variance is one bare equality, so it gets the definition in words; a fraction chain already reads as a calculation.
	const definition = isWhole(spread) ? ' the average squared distance.' : '';
	return [
		`Distances from the mean: ${distanceText(setup, d, center)}.`,
		`Variance:${definition} (${squares.map(formatFraction).join(' + ')}) / ${count} = ${averageChain(sumFractions(squares), count)}.`,
		`Standard deviation: ${sigmaText(setup, spread)}.`,
	];
}

/** "= 2" or "≈ 0.82": σ as a decimal, for the ghost comparison. */
const sigmaValue = (sigma: number) => `${isRoundedValue(sigma) ? '≈' : '='} ${trimmedDecimal(sigma)}`;

/** The previous preset's σ beside the current one, while the dashed ghost is drawn. */
export function ghostLine(state: DistributionState): string | null {
	if (!state.ghost) return null;
	const now = standardDeviation(distributionNow(state));
	const name = state.activePreset ? ` (${state.activePreset})` : '';
	return `Before: σ ${sigmaValue(state.ghost.sigma)} (${state.ghost.preset}). Now: σ ${sigmaValue(now)}${name}.`;
}

// ---- Chart and stepper labels ----

/** The steppers' column headers and group name; the Symbols view writes X as a function, ω ↦ X(ω). */
export function stepperHeaders(setup: Setup, stage: Stage): { outcome: string; value: string; group: string } {
	const { valueHeader } = copyOf(setup);
	const group = `${valueHeader} for each ${setup.wording.outcomeWord}`;
	if (stage === 'symbols') return { outcome: 'ω', value: 'X(ω)', group };
	return { outcome: capitalize(setup.wording.outcomeWord), value: valueHeader, group };
}

export interface ChartLabels {
	/** The axis unit, e.g. "candies". */
	axis: string;
	/** Each bar's count over the total, e.g. "3/6", under its column. Empty while covered. */
	shares: { value: number; text: string }[];
	/** The ochre wedge's label on balance setups. */
	pencil: string | null;
	/** "μ = 1" on the pink triangle, once μ is shown. */
	mu: string | null;
	/** "σ ≈ 0.82" on the blue span, while the spread is shown. */
	sigma: string | null;
	/** "Before: σ ≈ 0.82" on the dashed ghost span. */
	ghost: string | null;
	/** "1 away" on each dotted distance arm; bars at the mean get none. */
	arms: { value: number; text: string }[];
}

/** Every word drawn on the chart. The chart is hidden from screen readers; the readouts say the same. */
export function chartLabels(state: DistributionState): ChartLabels {
	const setup = setupOf(state);
	const axis = copyOf(setup).unit.many;
	const empty: ChartLabels = { axis, shares: [], pencil: null, mu: null, sigma: null, ghost: null, arms: [] };
	if (isCovered(state)) return empty;
	const d = distributionNow(state);
	const center = mean(d);
	const spreadOn = setup.kind === 'spread' && state.spreadShown;
	return {
		...empty,
		shares: d.bars.map((bar) => ({ value: bar.value, text: `${bar.weight}/${d.totalWeight}` })),
		pencil: setup.kind === 'balance' ? 'your pencil' : null,
		mu: setup.kind !== 'goal' && state.revealed ? `μ = ${shortAmount(center)}` : null,
		sigma: spreadOn ? `σ ${sigmaValue(standardDeviation(d))}` : null,
		ghost: spreadOn && state.ghost ? `Before: σ ${sigmaValue(state.ghost.sigma)}` : null,
		arms: spreadOn
			? d.bars
					.map((bar) => ({ value: bar.value, distance: absoluteFraction(difference(fraction(bar.value, 1), center)) }))
					.filter(({ distance }) => distance.numerator !== 0)
					.map(({ value, distance }) => ({ value, text: `${shortAmount(distance)} away` }))
			: [],
	};
}

// ---- Steppers and refusals ----

export function rowText(state: DistributionState, id: OutcomeId): string {
	const setup = setupOf(state);
	const label = labelsOf(setup, [id])[0];
	return `${capitalize(copyOf(setup).name([label]))}: ${setup.wording.valueText(state.values[id])}.`;
}

export function stepperName(state: DistributionState, id: OutcomeId, direction: 1 | -1): string {
	const setup = setupOf(state);
	const label = labelsOf(setup, [id])[0];
	return direction > 0 ? setup.wording.raiseName(label) : setup.wording.lowerName(label);
}

export function boardLabel(setup: Setup): string {
	return setup.label;
}

const withArticle = (word: string) => `${/^[aeiou]/i.test(word) ? 'An' : 'A'} ${word}`;

/** The visible reason beside a refused control, and the whole announcement when it is pressed anyway. */
export function refusalText(setup: Setup, refusal: Refusal): string {
	const copy = copyOf(setup);
	const [lowest, highest] = setup.range;
	switch (refusal.kind) {
		case 'below-range':
			return `${withArticle(setup.wording.outcomeWord)} can't ${copy.verb.many} fewer than ${plural(lowest, copy.unit.one, copy.unit.many)}.`;
		case 'above-range':
			return `${setup.wording.valueText(highest)} is the most this board shows.`;
		case 'locked':
			// A goal setup locks its presets until Check passes; candy-balance locks its steppers until the reveal.
			return setup.kind === 'goal' ? `The presets open once ${CONTROL_LABELS.check} passes.` : `Press ${CONTROL_LABELS.balance} first, then change the values.`;
		case 'parked':
			return 'Move the pencil under the bars first.';
		case 'not-editable':
			return 'These values are fixed. Switch presets to compare.';
	}
}

// ---- Announcements ----

/** "The 1-candy bar now holds faces 4 and 5. P(X = 1) = 2/6 = 1/3.": where a stepped outcome landed. */
function joinedBarText(state: DistributionState, id: OutcomeId): string {
	const setup = setupOf(state);
	const d = distributionNow(state);
	const bar = d.bars.find((candidate) => candidate.members.includes(id));
	if (!bar) throw new Error(`DistributionBoard: outcome "${id}" is in no bar.`);
	const copy = copyOf(setup);
	return `The ${copy.barName(bar.value)} now holds ${copy.name(labelsOf(setup, bar.members))}. P(X = ${bar.value}) = ${briefChance(bar.weight, d.totalWeight)}.`;
}

function stepAnnouncement(state: DistributionState, id: OutcomeId): string {
	const setup = setupOf(state);
	const assigned = copyOf(setup).assigned(labelsOf(setup, [id])[0], setup.wording.valueText(state.values[id]));
	return isCovered(state) ? assigned : `${assigned} ${joinedBarText(state, id)}`;
}

function presetAnnouncement(state: DistributionState, name: string): string {
	const setup = setupOf(state);
	switch (setup.kind) {
		case 'balance':
			return NEW_GAME_LINE;
		case 'spread':
			return ghostLine(state) ?? `${name}. ${state.spreadShown ? spreadLines(state).join(' ') : meanSentence(state)}`;
		case 'goal':
			return `${name}. ${readoutLines(state).join(' ')}`;
	}
}

function checkAnnouncement(state: DistributionState): string {
	// A match or a shown answer moves focus to the verdict, which is read there (decision 0019); only the new goal,
	// a paragraph of its own, is announced.
	if (state.checked) return goalLine(state) ?? '';
	const line = feedbackLine(state) ?? '';
	// The second wrong Check reveals "Show the answer"; saying so also keeps it from repeating the first.
	return state.failedChecks === CHECKS_BEFORE_ANSWER ? `${line} You can now show the answer.` : line;
}

/** What the live region says after an action ends (− / + bursts are debounced by the component), notation in words. */
export function announcementFor(state: DistributionState, action: Action): string {
	return spokenMath(announcementText(state, action));
}

function announcementText(state: DistributionState, action: Action): string {
	const setup = setupOf(state);
	if (state.refusal && (action.type === 'step' || action.type === 'preset' || action.type === 'balance')) return refusalText(setup, state.refusal);
	switch (action.type) {
		case 'step':
			return stepAnnouncement(state, action.id);
		case 'preset':
			return presetAnnouncement(state, action.name);
		case 'check':
		case 'show-answer':
			return checkAnnouncement(state);
		case 'check-goal':
			// A passed goal moves focus to the goal line, which is read there.
			return state.goal === 'passed' ? '' : (goalLine(state) ?? '');
		case 'stage': {
			const symbols = symbolLines(state);
			return symbols.length > 0 ? symbols.join(' ') : `Showing ${STAGE_LABELS[state.stage].toLowerCase()}.`;
		}
		case 'pencil':
			return pencilLine(state) ?? `${capitalize(describePencil(setup, state.pencil))}.`;
		case 'balance':
			// Balance it moves focus to the balance sentence, which is read there.
			return state.revealed ? '' : (balanceLine(state) ?? '');
		case 'spread':
			return action.on ? spreadLines(state).join(' ') : 'Spread hidden.';
		case 'table':
			return tableFoldAnnouncement(action.open, tableFoldSentence(state));
		case 'reset':
			return 'Board reset.';
	}
}
