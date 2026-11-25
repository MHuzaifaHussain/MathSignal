// Every sentence the family mode shows or speaks (decision 0018), built from state, so the visible text and the
// live region can't drift. Plain Unicode, no KaTeX: "C(10, 6)", "2¹⁰", "0.9⁹".
//
// Number rules: fair-coin chances read count, reduced fraction and two decimals ("210/1024 = 105/512 ≈ 0.21");
// other chances read decimals only, two places in sentences and four in the table; a nonzero chance too small to
// show reads "under 0.01" (or "under 0.0001"), never "≈ 0.00". Amounts go through amountText ("2.5", "19/400 ≈ 0.05").
import { fraction, toNumber, type Fraction } from '../boardMath.ts';
import { amountText, decimalText, fractionText, groupThousands, joinWords, plural, terminatesWithin } from '../boardText.ts';
import { tableFoldAnnouncement } from '../guided/tableFold.ts';
import { formatNumber } from '../plotColors.ts';
import { chanceOf, chooseCount, tallestValues } from './families.ts';
import type { FamilySetup, GuessId } from './familySetups.ts';
import { activePreset, familyDistribution, familyMoments, familySetupOf, isCovered, visibleGhost, type FamilyAction, type FamilyRefusal, type FamilyState } from './familyState.ts';
import type { Bar } from './model.ts';
import { chanceChain, powerText, rootText, SENTENCE_PLACES, sigmaValue, TABLE_PLACES, underText, underThreshold } from './numberFormat.ts';
import { coinSequences, MAX_LISTED_COINS, type CoinSequence } from './sources.ts';
import type { SpokenLine } from './SpokenText.tsx';

interface WordPair {
	one: string;
	many: string;
}

/** The words one setup's sentences use; kind `guess` counts heads on coins, kind `spread` successes in trials. */
interface FamilyWords {
	trial: WordPair;
	success: WordPair;
}

const WORDS: Readonly<Record<FamilySetup['kind'], FamilyWords>> = {
	guess: { trial: { one: 'coin', many: 'coins' }, success: { one: 'head', many: 'heads' } },
	spread: { trial: { one: 'trial', many: 'trials' }, success: { one: 'success', many: 'successes' } },
};

/** The board's control names and fixed lines. Sentences that name a control quote these. */
export const FAMILY_LABELS = {
	coins: 'Number of coins',
	trials: 'Number of trials n',
	chance: 'Chance of success p',
	read: 'Read the bar for',
	guess: 'Your guess for 6 heads in 10 flips',
	check: 'Check',
	showAnswer: 'Show the answer',
	spread: 'Show the spread',
	presets: 'Presets',
	covered: 'The chart for 4 or more coins appears once you lock in your guess.',
	tableCaption: 'Every bar as a table.',
} as const;

export const GUESS_LABELS: Readonly<Record<GuessId, string>> = {
	'one-in-two': 'About 1 time in 2',
	'one-in-five': 'About 1 time in 5',
	'one-in-fifty': 'About 1 time in 50',
};

/** What a wrong pick hears before the shared answer; the right pick hears "Yes, …". */
const VERDICT_LEADS: Readonly<Record<GuessId, string>> = {
	'one-in-two': 'Not quite: it is less than half as often as that.',
	'one-in-five': 'Yes, about 1 time in 5.',
	'one-in-fifty': 'Not quite: it is about 10 times as often as that.',
};

export const FAMILY_BOARD_LABELS: Readonly<Record<FamilySetup['kind'], string>> = {
	guess:
		'Fair coins and the number of heads. Set how many coins and read the bar for any number of heads. From 4 coins on, lock in your guess first.',
	spread:
		'Trials with a chance of success you set, with the mean marked. Turn on the spread and switch presets to compare how far the number of successes spreads.',
};

const wordsOf = (state: FamilyState) => WORDS[familySetupOf(state).kind];
const count = (words: WordPair, value: number) => plural(value, words.one, words.many);
const isFair = (state: FamilyState) => familySetupOf(state).kind === 'guess';

/** "0.5", "0.35": p and 1 − p, exact on the 0.05 grid. */
const chanceText = (value: Fraction) => decimalText(value, SENTENCE_PLACES);

function barAt(state: FamilyState, k: number): Bar {
	const bar = familyDistribution(state).bars.find((candidate) => candidate.value === k);
	if (!bar) throw new Error(`DistributionBoard: no bar at ${k} for n = ${state.n}.`);
	return bar;
}

/** A chance in a sentence on a non-fair setup: "≈ 0.39", "= 0.50", or ", under 0.01". */
function decimalChance(bar: Bar, total: number): string {
	if (underThreshold(bar.weight, total, SENTENCE_PLACES)) return `, ${underText(SENTENCE_PLACES)}`;
	const sign = terminatesWithin(bar.probability, SENTENCE_PLACES) ? '=' : '≈';
	return ` ${sign} ${formatNumber(toNumber(bar.probability), SENTENCE_PLACES)}`;
}

/** A chance in the four-place table: "0.3874", "0.5000", "under 0.0001". */
function tableChance(bar: Bar, total: number): string {
	return underThreshold(bar.weight, total, TABLE_PLACES) ? underText(TABLE_PLACES) : formatNumber(toNumber(bar.probability), TABLE_PLACES);
}

const sigmaIsOne = (variance: Fraction) => variance.numerator === variance.denominator;

// ---- Status and the n ≤ 3 sequence list ----

export function statusLine(state: FamilyState): SpokenLine {
	if (!isFair(state)) {
		const p = chanceText(chanceOf(state.j));
		const text = state.n === 1 ? `1 trial, a success with chance ${p}.` : `${state.n} trials, each a success with chance ${p}.`;
		return { visible: text, spoken: text };
	}
	const total = groupThousands(2 ** state.n);
	if (state.n === 1) {
		const text = `1 fair coin. ${total} equally likely sequences; X counts the heads.`;
		return { visible: text, spoken: text };
	}
	const power = powerText('2', state.n);
	const line = (written: string) => `${state.n} fair coins. ${written} = ${total} equally likely sequences; X counts the heads.`;
	return { visible: line(power.visible), spoken: line(power.spoken) };
}

/** The read-only rows at n ≤ 3 ("HHT: 2 heads"), or none. Hidden while covered, which n ≤ 3 never is. */
export function sequenceItems(state: FamilyState): SpokenLine[] {
	if (!isFair(state) || state.n > MAX_LISTED_COINS || isCovered(state)) return [];
	return coinSequences(state.n).map((sequence) => {
		const heads = count(WORDS.guess.success, sequence.heads);
		return { visible: `${sequence.label}: ${heads}`, spoken: `${sequence.spoken}: ${heads}` };
	});
}

/** "A; B; and C": spoken sequences hold commas of their own, so the list is joined with semicolons. */
function joinSpoken(items: readonly string[]): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join('; ')}; and ${items[items.length - 1]}`;
}

const sequencesWith = (n: number, k: number): readonly CoinSequence[] => coinSequences(n).filter((sequence) => sequence.heads === k);

// ---- Readouts ----

/** "Reading the bar for 2 heads.": the read pair's output. */
export function readOutput(state: FamilyState): string {
	return `Reading the bar for ${count(wordsOf(state).success, state.read)}.`;
}

/** The read bar's sentence, or null while covered. */
export function readLine(state: FamilyState): SpokenLine | null {
	if (isCovered(state)) return null;
	const { n, read: k } = state;
	const heads = count(wordsOf(state).success, k);
	if (isFair(state)) {
		const total = 2 ** n;
		const ways = chooseCount(n, k);
		const chance = `P(X = ${k}) = ${chanceChain(ways, total)}.`;
		if (n <= MAX_LISTED_COINS) {
			const sequences = sequencesWith(n, k);
			const tail = `${ways} of ${total} sequences, so ${chance}`;
			return {
				visible: `${heads}: ${joinWords(sequences.map((sequence) => sequence.label))}. ${tail}`,
				spoken: `${heads}: ${joinSpoken(sequences.map((sequence) => sequence.spoken))}. ${tail}`,
			};
		}
		const text = `${heads}: C(${n}, ${k}) = ${ways} of ${groupThousands(total)} sequences, so ${chance}`;
		return { visible: text, spoken: text };
	}
	const p = chanceOf(state.j);
	const success = powerText(chanceText(p), k);
	const failure = powerText(chanceText(fraction(p.denominator - p.numerator, p.denominator)), n - k);
	const tail = `${decimalChance(barAt(state, k), familyDistribution(state).totalWeight)}.`;
	return {
		visible: `${heads}: C(${n}, ${k}) × ${success.visible} × ${failure.visible}${tail}`,
		spoken: `${heads}: C(${n}, ${k}) × ${success.spoken} × ${failure.spoken}${tail}`,
	};
}

export function tallestLine(state: FamilyState): string | null {
	if (isCovered(state)) return null;
	const values = tallestValues(state.n, state.j);
	const d = familyDistribution(state);
	const bar = barAt(state, values[0]);
	const chance = isFair(state) ? ` = ${chanceChain(bar.weight, d.totalWeight)}` : decimalChance(bar, d.totalWeight);
	const words = wordsOf(state).success;
	if (values.length === 1) return `Tallest bar: ${count(words, values[0])}, P(X = ${values[0]})${chance}.`;
	return `Tallest bars: ${values[0]} and ${values[1]} ${words.many}, each P${chance}.`;
}

export function totalLine(state: FamilyState): string | null {
	if (isCovered(state) || !isFair(state)) return null;
	const total = 2 ** state.n;
	return `The bars add up to ${total}/${total} = 1.`;
}

export function meanLine(state: FamilyState): string | null {
	if (isFair(state)) return null;
	const { mean } = familyMoments(state);
	const amount = amountText(mean);
	const unit = mean.numerator === mean.denominator ? 'success' : 'successes';
	return `Mean: μ = np = ${state.n} × ${chanceText(chanceOf(state.j))} = ${amount} ${unit}.`;
}

export function spreadLine(state: FamilyState): string | null {
	if (isFair(state) || !state.spreadShown) return null;
	const p = chanceOf(state.j);
	const q = fraction(p.denominator - p.numerator, p.denominator);
	const { variance } = familyMoments(state);
	const unit = sigmaIsOne(variance) ? 'success' : 'successes';
	return (
		`Variance: np(1 − p) = ${state.n} × ${chanceText(p)} × ${chanceText(q)} = ${amountText(variance)}. ` +
		`Standard deviation: σ = ${rootText(variance)} ${sigmaValue(variance)} ${unit}.`
	);
}

/** "n = 10, p = 0.85" when no preset matches the sliders. */
function stateName(state: FamilyState): string {
	return activePreset(state)?.name ?? `n = ${state.n}, p = ${chanceText(chanceOf(state.j))}`;
}

export function ghostLine(state: FamilyState): string | null {
	const ghost = visibleGhost(state);
	if (!ghost) return null;
	return `Before: σ ${sigmaValue(ghost.variance)} (${ghost.preset}). Now: σ ${sigmaValue(familyMoments(state).variance)} (${stateName(state)}).`;
}

/** The readouts under the chart, in order. */
export function readoutLines(state: FamilyState): SpokenLine[] {
	const plain = (text: string | null) => (text ? [{ visible: text, spoken: text }] : []);
	const read = readLine(state);
	const readLines = read ? [read] : [];
	// The coin board reads its bar first; the spread board leads with μ and σ, its lesson.
	if (isFair(state)) return [...readLines, ...plain(tallestLine(state)), ...plain(totalLine(state))];
	return [...plain(meanLine(state)), ...plain(spreadLine(state)), ...plain(ghostLine(state)), ...plain(tallestLine(state)), ...readLines];
}

// ---- Guess and Check ----

export function guessLine(state: FamilyState): string | null {
	if (!state.checked || !state.guess) return null;
	return `Your guess: ${GUESS_LABELS[state.guess].toLowerCase()}.`;
}

export function verdictLine(state: FamilyState): string | null {
	const guess = familySetupOf(state).guess;
	if (!guess || !state.checked || !state.guess) return null;
	const n = guess.checkN;
	const k = guess.checkRead;
	const ways = chooseCount(n, k);
	const total = 2 ** n;
	return (
		`${VERDICT_LEADS[state.guess]} C(${n}, ${k}) = ${ways} of the ${groupThousands(total)} equally likely sequences have exactly ` +
		`${count(WORDS.guess.success, k)}, so P(X = ${k}) = ${chanceChain(ways, total)}.`
	);
}

// ---- Refusals ----

export function refusalText(state: FamilyState, refusal: FamilyRefusal): string {
	const words = wordsOf(state);
	switch (refusal) {
		case 'no-guess':
			return 'Pick a guess first.';
		case 'locked':
			return 'Lock in your guess first.';
		case 'read-below':
			return `Can't read fewer than 0 ${words.success.many}.`;
		case 'read-above':
			return `${count(words.trial, state.n)} can't show more than ${count(words.success, state.n)}.`;
	}
}

/** The read pair's button names. */
export function readButtonName(state: FamilyState, direction: 1 | -1): string {
	return `${direction < 0 ? 'Fewer' : 'More'} ${wordsOf(state).success.many} to read`;
}

// ---- Slider text ----

export const formatCoins = (n: number) => count(WORDS.guess.trial, n);
export const formatTrials = (n: number) => String(n);
export const describeTrials = (n: number) => count(WORDS.spread.trial, n);
export const formatChance = (j: number) => formatNumber(toNumber(chanceOf(j)), SENTENCE_PLACES);
export const describeChance = (j: number) => `chance of success ${formatChance(j)}`;

// ---- Chart labels ----

export interface FamilyChartLabels {
	axis: string;
	gridlines: readonly { value: number; label: string; solid: boolean }[];
	mu: string | null;
	sigma: string | null;
	ghost: string | null;
}

export function chartLabels(state: FamilyState): FamilyChartLabels {
	const setup = familySetupOf(state);
	const gridlines = setup.gridlines.map((line) => ({ value: toNumber(line.value), label: line.label, solid: line.solid }));
	const axis = `Number of ${wordsOf(state).success.many}`;
	if (isFair(state)) return { axis, gridlines, mu: null, sigma: null, ghost: null };
	const { mean, variance } = familyMoments(state);
	const ghost = visibleGhost(state);
	return {
		axis,
		gridlines,
		mu: `μ = ${amountText(mean)}`,
		sigma: state.spreadShown ? `σ ${sigmaValue(variance)}` : null,
		ghost: ghost ? `Before: σ ${sigmaValue(ghost.variance)}` : null,
	};
}

// ---- Table ----

export interface FamilyTable {
	caption: string;
	headers: readonly string[];
	rows: readonly (readonly string[])[];
}

/** One row per value 0..n; empty while covered, so no table and no switch render then. */
export function tableOf(state: FamilyState): FamilyTable {
	const d = familyDistribution(state);
	if (isFair(state)) {
		const total = 2 ** state.n;
		const rows = isCovered(state)
			? []
			: d.bars.map((bar) => {
					const sequences = state.n <= MAX_LISTED_COINS ? sequencesWith(state.n, bar.value).map((sequence) => sequence.label).join(', ') : `${bar.weight} of ${groupThousands(total)}`;
					return [String(bar.value), sequences, chanceChain(bar.weight, total)];
				});
		return { caption: FAMILY_LABELS.tableCaption, headers: ['Heads', 'Sequences', 'P(X = k)'], rows };
	}
	return {
		caption: `Every bar for n = ${state.n} and p = ${chanceText(chanceOf(state.j))}, chances to ${TABLE_PLACES} decimal places.`,
		headers: ['Successes', 'P(X = k)'],
		rows: d.bars.map((bar) => [String(bar.value), tableChance(bar, d.totalWeight)]),
	};
}

/** The Table view body: "It lists the 11 numbers of heads 10 coins can show, each with its sequences and its chance." */
export function tableFoldSentence(state: FamilyState): string {
	const words = wordsOf(state);
	const holds = isFair(state) ? 'each with its sequences and its chance' : 'each with its chance';
	return `It lists the ${state.n + 1} numbers of ${words.success.many} ${count(words.trial, state.n)} can show, ${holds}.`;
}

// ---- Announcements ----

/** "P(X = 6) = 105/512, about 0.21", "P(X = 1) = 1/2 = 0.50", "P(X = 0) = 1/1024, under 0.01". */
function briefRead(state: FamilyState): string {
	const bar = barAt(state, state.read);
	const total = familyDistribution(state).totalWeight;
	const reduced = fractionText(bar.probability);
	if (underThreshold(bar.weight, total, SENTENCE_PLACES)) return `P(X = ${state.read}) = ${reduced}, ${underText(SENTENCE_PLACES)}`;
	const decimal = formatNumber(toNumber(bar.probability), SENTENCE_PLACES);
	return terminatesWithin(bar.probability, SENTENCE_PLACES) ? `P(X = ${state.read}) = ${reduced} = ${decimal}` : `P(X = ${state.read}) = ${reduced}, about ${decimal}`;
}

/** The coin board's n sentence after its leading count: "Reading the bar for 6 heads: …", or the cover line. */
function coinsReadSentence(previous: FamilyState, state: FamilyState): string {
	if (isCovered(state)) return 'The chart is covered until you lock in your guess.';
	const words = WORDS.guess;
	const clamped = previous.read > state.n ? `, the most ${count(words.trial, state.n)} can show` : '';
	return `Reading the bar for ${count(words.success, state.read)}${clamped}: ${briefRead(state)}.`;
}

function clampSentence(previous: FamilyState, state: FamilyState): string | null {
	if (previous.read <= state.n) return null;
	const words = WORDS.spread;
	return `Now reading the bar for ${count(words.success, state.read)}, the most ${count(words.trial, state.n)} can show.`;
}

function spreadTrialsSentence(previous: FamilyState, state: FamilyState): string {
	return [statusLine(state).spoken, meanLine(state), spreadLine(state), clampSentence(previous, state)].filter(Boolean).join(' ');
}

function presetSentence(previous: FamilyState, state: FamilyState, name: string): string {
	if (state.refusal) return refusalText(state, state.refusal);
	if (activePreset(previous)?.name === name) return `${name} is already showing.`;
	if (isFair(state)) return `${name}. ${coinsReadSentence(previous, state)}`;
	const spread = state.spreadShown ? (ghostLine(state) ?? spreadLine(state)) : null;
	return [`${name}.`, meanLine(state), spread, clampSentence(previous, state)].filter(Boolean).join(' ');
}

/**
 * What the live region says after `action` took `previous` to `state`. Picking a guess says nothing: the native
 * radio already speaks, and the guess is no answer yet.
 */
export function familyAnnouncement(previous: FamilyState, state: FamilyState, action: FamilyAction): string {
	if (state.refusal && (action.type === 'read' || action.type === 'check')) return refusalText(state, state.refusal);
	switch (action.type) {
		case 'n':
		case 'p':
			if (isFair(state)) return `${formatCoins(state.n)}. ${coinsReadSentence(previous, state)}`;
			return spreadTrialsSentence(previous, state);
		case 'read':
			return readLine(state)?.spoken ?? '';
		case 'guess':
			return '';
		case 'check':
			return verdictLine(state) ?? '';
		case 'preset':
			return presetSentence(previous, state, action.name);
		case 'spread':
			return action.on ? (spreadLine(state) ?? '') : 'Spread hidden.';
		case 'table':
			return tableFoldAnnouncement(action.open, tableFoldSentence(state));
		case 'reset':
			return 'Board reset.';
	}
}
