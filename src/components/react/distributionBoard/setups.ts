// The board configurations pages pick with <DistributionBoard setup="…" />. Each one fixes the outcome source,
// the value range, the presets and how the reader may edit (design doc: "Setups" and "Validation").
import { plural } from '../boardText.ts';
import { compareFractions, fraction, multiplyFractions, type Fraction } from '../boardMath.ts';
import { mean, variance, distributionOf } from './model.ts';
import { outcomesOf, type SourceId } from './sources.ts';

export type SetupId = 'candy-build' | 'coins-heads' | 'candy-balance' | 'candy-spread';
/** goal: build the card's values and press Check. balance: find the mean with the pencil. spread: compare presets' σ. */
export type SetupKind = 'goal' | 'balance' | 'spread';
/** When the − / + steppers change values: always, only once "Balance it" has revealed μ, or never (fixed data). */
export type Editing = 'always' | 'after-balance' | 'never';

export interface Wording {
	/** "face" or "outcome". */
	outcomeWord: string;
	/** "1 candy", "0 candies", or "X = 1". */
	valueText: (value: number) => string;
	/** The + button's name, e.g. "More candies for face 4". */
	raiseName: (outcomeLabel: string) => string;
	/** The − button's name, e.g. "Fewer candies for face 4". */
	lowerName: (outcomeLabel: string) => string;
}

/** A follow-up goal once the card matches: make P(X = value) equal chance. */
export interface GoalAfterCard {
	value: number;
	chance: Fraction;
}

export interface Setup {
	id: SetupId;
	kind: SetupKind;
	source: SourceId;
	/** The board's accessible name. */
	label: string;
	/** The smallest and largest value a stepper can set, inclusive. */
	range: readonly [number, number];
	/** W: the pencil sits at k/W, so every mean the presets can have must be a whole number of 1/W steps. */
	stepDenominator: number;
	/** Goal setups: the values Check compares against, in outcome order. */
	card?: readonly number[];
	goalAfterCard?: GoalAfterCard;
	presets: readonly string[];
	/** The values the board opens on, in outcome order. */
	opening: readonly number[];
	stages: boolean;
	editing: Editing;
	wording: Wording;
}

/** Every outcome at 0. Its length comes from the setup's source, so one name serves the die and the coins. */
export const ALL_ZERO = 'All zero';
export const MAX_PRESETS = 4;
export const MAX_TILE_COLUMNS = 7;
/** Beyond the tile limits, bars become plain columns, up to this many. */
export const MAX_BAR_COLUMNS = 21;
/** How far the plank tips toward the heavy side once "Balance it" is pressed, in degrees. */
export const TILT_DEGREES = 6;

/** Values per die face 1..6, or per coin outcome HH, HT, TH, TT (design doc: "Preset values"). */
export const PRESETS: Readonly<Record<string, readonly number[]>> = {
	'Game card': [0, 0, 0, 1, 1, 5],
	'Plain die': [1, 2, 3, 4, 5, 6],
	'One big prize': [0, 0, 0, 0, 0, 6],
	Lopsided: [0, 0, 0, 1, 1, 4],
	'All win 1': [1, 1, 1, 1, 1, 1],
	Steady: [2, 2, 2, 2, 2, 2],
	'Many amounts': [1, 1, 2, 2, 3, 3],
	'All or nothing': [0, 0, 0, 4, 4, 4],
	'Number of heads': [2, 1, 1, 0],
	'Coins match': [1, 0, 0, 1],
	[ALL_ZERO]: [],
};

const DIE_RANGE = [0, 6] as const;
const DIE_STEPS = 6;
const COIN_STEPS = 4;

const CANDY_WORDING: Wording = {
	outcomeWord: 'face',
	valueText: (value) => plural(value, 'candy', 'candies'),
	raiseName: (label) => `More candies for face ${label}`,
	lowerName: (label) => `Fewer candies for face ${label}`,
};

const HEADS_WORDING: Wording = {
	outcomeWord: 'outcome',
	valueText: (value) => `X = ${value}`,
	raiseName: (label) => `Raise X for ${label}`,
	lowerName: (label) => `Lower X for ${label}`,
};

const SETUPS: Record<SetupId, Setup> = {
	'candy-build': {
		id: 'candy-build',
		kind: 'goal',
		source: 'one-die',
		label: "A die whose faces win candies. Set each face's candies; the bars show how likely each amount is.",
		range: DIE_RANGE,
		stepDenominator: DIE_STEPS,
		card: PRESETS['Game card'],
		goalAfterCard: { value: 1, chance: fraction(1, 2) },
		presets: ['Game card', ALL_ZERO],
		opening: [0, 0, 0, 0, 0, 0],
		stages: true,
		editing: 'always',
		wording: CANDY_WORDING,
	},
	'coins-heads': {
		id: 'coins-heads',
		kind: 'goal',
		source: 'two-coins',
		label: 'The four outcomes of tossing two coins. Set X, the number of heads, for each; the bars show how likely each value is.',
		range: [0, 2],
		stepDenominator: COIN_STEPS,
		card: PRESETS['Number of heads'],
		presets: ['Number of heads', 'Coins match', ALL_ZERO],
		opening: [0, 0, 0, 0],
		stages: true,
		editing: 'always',
		wording: HEADS_WORDING,
	},
	'candy-balance': {
		id: 'candy-balance',
		kind: 'balance',
		source: 'one-die',
		label: 'A die whose faces win candies, with a pencil under the chart. Slide the pencil to where the bars balance.',
		range: DIE_RANGE,
		stepDenominator: DIE_STEPS,
		presets: ['Plain die', 'One big prize', 'Lopsided', 'All win 1'],
		opening: PRESETS['Plain die'],
		stages: false,
		editing: 'after-balance',
		wording: CANDY_WORDING,
	},
	'candy-spread': {
		id: 'candy-spread',
		kind: 'spread',
		source: 'one-die',
		label: 'A die whose faces win candies, with the mean marked. Switch presets to compare how far the amounts spread.',
		range: DIE_RANGE,
		stepDenominator: DIE_STEPS,
		presets: ['Steady', 'Many amounts', 'All or nothing'],
		opening: PRESETS['Many amounts'],
		stages: false,
		editing: 'never',
		wording: CANDY_WORDING,
	},
};

function setupError(setup: Setup, detail: string): Error {
	return new Error(`DistributionBoard: setup "${setup.id}" ${detail}`);
}

/** A preset's values for this setup, in outcome order. An unknown name is a bug, so it throws. */
export function presetValues(setup: Setup, name: string, presetTable: Readonly<Record<string, readonly number[]>> = PRESETS): readonly number[] {
	if (name === ALL_ZERO) return outcomesOf(setup.source).map(() => 0);
	const values = presetTable[name];
	if (!values) throw setupError(setup, `uses preset "${name}", which isn't defined.`);
	return values;
}

const rangeText = (setup: Setup) => `${setup.range[0]}..${setup.range[1]}`;
/** Value lists paired with how an error names them, e.g. ['preset "Lopsided"', [0, 0, 0, 1, 1, 4]]. */
type NamedValues = readonly (readonly [string, readonly number[]])[];

/** Length, whole numbers and range: everything a list of values needs before it can become a distribution. */
function checkValues(setup: Setup, what: string, values: readonly number[] | undefined): readonly number[] {
	const outcomeCount = outcomesOf(setup.source).length;
	if (!values) throw setupError(setup, `has no ${what}.`);
	if (values.length !== outcomeCount) {
		throw setupError(setup, `${what} has ${values.length} values; source "${setup.source}" has ${outcomeCount} outcomes.`);
	}
	for (const value of values) {
		if (!Number.isInteger(value)) throw setupError(setup, `${what} has the value ${value}, which isn't a whole number.`);
		if (value < setup.range[0] || value > setup.range[1]) throw setupError(setup, `${what} has the value ${value}, outside the range ${rangeText(setup)}.`);
	}
	return values;
}

function checkShape(setup: Setup): void {
	const [lowest, highest] = setup.range;
	if (!Number.isInteger(lowest) || !Number.isInteger(highest) || lowest >= highest) throw setupError(setup, `has an invalid range ${rangeText(setup)}.`);
	const columns = highest - lowest + 1;
	if (columns > MAX_TILE_COLUMNS) throw setupError(setup, `range ${rangeText(setup)} needs ${columns} tile columns; the most is ${MAX_TILE_COLUMNS}.`);
	if (!Number.isInteger(setup.stepDenominator) || setup.stepDenominator <= 0) {
		throw setupError(setup, `needs a positive whole step denominator, got ${setup.stepDenominator}.`);
	}
	if (setup.presets.length > MAX_PRESETS) throw setupError(setup, `has ${setup.presets.length} presets; the most is ${MAX_PRESETS}.`);
}

function checkGoal(setup: Setup): void {
	if (setup.kind !== 'goal') {
		if (setup.card || setup.goalAfterCard) throw setupError(setup, `is a ${setup.kind} setup, so it can't have a card or a goal.`);
		return;
	}
	if (!setup.card) throw setupError(setup, 'is a goal setup with no card to check against.');
	checkValues(setup, 'card', setup.card);
	const goalValue = setup.goalAfterCard?.value;
	if (goalValue !== undefined && (goalValue < setup.range[0] || goalValue > setup.range[1])) {
		throw setupError(setup, `has a follow-up goal for the value ${goalValue}, outside the range ${rangeText(setup)}.`);
	}
}

/** The pencil moves in steps of 1/W, so a mean it can't land on exactly could never read as balanced. */
function checkBalance(setup: Setup, named: NamedValues): void {
	if (setup.stepDenominator % 2 !== 0) {
		throw setupError(setup, `needs an even step denominator so the parked pencil, −W/2, is a whole step; got ${setup.stepDenominator}.`);
	}
	const outcomes = outcomesOf(setup.source);
	for (const [name, values] of named) {
		const balancePoint = mean(distributionOf(outcomes, zipValues(setup, values)));
		if ((balancePoint.numerator * setup.stepDenominator) % balancePoint.denominator !== 0) {
			throw setupError(setup, `${name} has mean ${balancePoint.numerator}/${balancePoint.denominator}, which the pencil can't reach in steps of 1/${setup.stepDenominator}.`);
		}
	}
}

/** μ ± σ must stay on the axis: μ − lowest ≥ 0 and σ² ≤ (μ − lowest)², and the same toward the highest end. */
function checkSpread(setup: Setup, named: NamedValues): void {
	const outcomes = outcomesOf(setup.source);
	for (const [name, values] of named) {
		const distribution = distributionOf(outcomes, zipValues(setup, values));
		const center = mean(distribution);
		const spread = variance(distribution);
		const room = setup.range.map((end) => fraction(Math.abs(center.numerator - end * center.denominator), center.denominator));
		if (room.some((distance) => compareFractions(spread, multiplyFractions(distance, distance)) > 0)) {
			throw setupError(setup, `${name} puts μ ± σ off the axis ${rangeText(setup)}.`);
		}
	}
}

/** Throws, naming the setup, if any part of its configuration can't work. The preset table is a parameter so the board check can feed it bad presets. */
export function validateSetup(setup: Setup, presetTable: Readonly<Record<string, readonly number[]>> = PRESETS): Setup {
	checkShape(setup);
	const named: NamedValues = [
		['opening', checkValues(setup, 'opening', setup.opening)],
		...setup.presets.map((name): NamedValues[number] => {
			const what = `preset "${name}"`;
			return [what, checkValues(setup, what, presetValues(setup, name, presetTable))];
		}),
	];
	checkGoal(setup);
	if (setup.kind === 'balance') checkBalance(setup, named);
	if (setup.kind === 'spread') checkSpread(setup, named);
	return setup;
}

/** Values in outcome order become a mapping by outcome id. */
export function zipValues(setup: Setup, values: readonly number[]): Record<string, number> {
	return Object.fromEntries(outcomesOf(setup.source).map((outcome, index) => [outcome.id, values[index]]));
}

/** Every setup, validated once at import, so a bad one fails the build and renders don't repeat the work. */
const VALIDATED_SETUPS: Readonly<Record<SetupId, Setup>> = Object.freeze(
	Object.fromEntries(Object.entries(SETUPS).map(([id, setup]) => [id, validateSetup(setup)])) as Record<SetupId, Setup>,
);

export function getSetup(id: string): Setup {
	// Own keys only, so "toString" and friends count as unknown rather than reaching Object.prototype.
	if (!Object.hasOwn(VALIDATED_SETUPS, id)) {
		throw new Error(`DistributionBoard: unknown setup "${id}". Known setups: ${Object.keys(VALIDATED_SETUPS).join(', ')}.`);
	}
	return VALIDATED_SETUPS[id as SetupId];
}
