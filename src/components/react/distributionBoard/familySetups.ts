// The family-mode setups (decision 0018): binomial distributions entered by n and p = j/20, on a fixed 0..10 axis
// and a fixed scale. Every setup is validated over every state the reader can reach before it renders.
import { compareFractions, fraction, multiplyFractions, subtractFractions, type Fraction } from '../boardMath.ts';
import { fitsAt320 } from './columnAxis.ts';
import { binomial, binomialMoments } from './families.ts';
import { isFamilySetupId, type FamilySetupId } from './setupIds.ts';

export { isFamilySetupId, type FamilySetupId };
/** `guess`: lock in a guess before the board shows 4 or more coins. `spread`: n and p sliders and the spread switch. */
export type FamilyKind = 'guess' | 'spread';
export type GuessId = 'one-in-two' | 'one-in-five' | 'one-in-fifty';

export interface FamilyPreset {
	name: string;
	n: number;
	j: number;
}

export interface Gridline {
	value: Fraction;
	label: string;
	solid: boolean;
}

export interface FamilySetup {
	id: FamilySetupId;
	kind: FamilyKind;
	nRange: readonly [number, number];
	nOpening: number;
	/** p = j/20; a guess setup fixes j at 10, a fair coin. */
	jRange: readonly [number, number];
	jOpening: number;
	/** The bar "Read the bar for" opens on. */
	readOpening: number;
	axis: readonly [number, number];
	/** The fixed top of the scale. Every reachable column fits under it, so the scale never moves. */
	yMax: Fraction;
	gridlines: readonly Gridline[];
	presets: readonly FamilyPreset[];
	/** The guess setup's options, in order, and the right one. */
	guess?: { options: readonly GuessId[]; answer: GuessId; checkN: number; checkRead: number };
}

const MAX_PRESETS = 4;
const AXIS: readonly [number, number] = [0, 10];
const HALF = fraction(1, 2);
const dotted = (value: Fraction, label: string): Gridline => ({ value, label, solid: false });

export const FAMILY_SETUPS: Readonly<Record<FamilySetupId, FamilySetup>> = {
	'coins-binomial': {
		id: 'coins-binomial',
		kind: 'guess',
		nRange: [1, 10],
		nOpening: 3,
		jRange: [10, 10],
		jOpening: 10,
		readOpening: 2,
		axis: AXIS,
		yMax: HALF,
		gridlines: [dotted(fraction(1, 4), '0.25'), dotted(HALF, '0.5')],
		presets: [
			{ name: '1 coin', n: 1, j: 10 },
			{ name: '3 coins', n: 3, j: 10 },
			{ name: '10 coins', n: 10, j: 10 },
		],
		guess: { options: ['one-in-two', 'one-in-five', 'one-in-fifty'], answer: 'one-in-five', checkN: 10, checkRead: 6 },
	},
	'binomial-spread': {
		id: 'binomial-spread',
		kind: 'spread',
		nRange: [1, 10],
		nOpening: 10,
		jRange: [1, 19],
		jOpening: 10,
		readOpening: 5,
		axis: AXIS,
		yMax: fraction(1, 1),
		gridlines: [dotted(fraction(1, 4), '0.25'), dotted(HALF, '0.5'), dotted(fraction(3, 4), '0.75')],
		presets: [
			{ name: 'Fair coin', n: 10, j: 10 },
			{ name: 'Right 9 in 10', n: 10, j: 18 },
			{ name: 'Rare: 1 in 10', n: 10, j: 2 },
			{ name: 'One flip', n: 1, j: 10 },
		],
	},
};

const inRange = (value: number, [low, high]: readonly [number, number]) => Number.isInteger(value) && value >= low && value <= high;

/** Every (n, j) the reader can reach with the sliders and presets. */
export function reachableStates(setup: FamilySetup): { n: number; j: number }[] {
	const states: { n: number; j: number }[] = [];
	for (let n = setup.nRange[0]; n <= setup.nRange[1]; n += 1) {
		for (let j = setup.jRange[0]; j <= setup.jRange[1]; j += 1) states.push({ n, j });
	}
	return states;
}

/** True when μ ± σ stays inside the drawn extent [first − 1/2, last + 1/2], compared exactly through σ². */
export function spreadFits(n: number, j: number, [first, last]: readonly [number, number]): boolean {
	const { mean, variance } = binomialMoments(n, j);
	const room = [subtractFractions(mean, fraction(2 * first - 1, 2)), subtractFractions(fraction(2 * last + 1, 2), mean)];
	return room.every((distance) => distance.numerator >= 0 && compareFractions(variance, multiplyFractions(distance, distance)) <= 0);
}

/** Throws, naming the setup and the first problem, so a bad setup fails before the board renders. */
export function validateFamilySetup(setup: FamilySetup): FamilySetup {
	const fail = (problem: string) => {
		throw new Error(`DistributionBoard: family setup "${setup.id}" ${problem}.`);
	};
	if (!inRange(setup.nOpening, setup.nRange)) fail(`opens at n = ${setup.nOpening}, outside ${setup.nRange.join('..')}`);
	if (!inRange(setup.jOpening, setup.jRange)) fail(`opens at j = ${setup.jOpening}, outside ${setup.jRange.join('..')}`);
	if (!inRange(setup.readOpening, [0, setup.nOpening])) fail(`reads ${setup.readOpening} at the opening, outside 0..${setup.nOpening}`);
	if (setup.nRange[1] > setup.axis[1]) fail(`reaches n = ${setup.nRange[1]}, past the axis end ${setup.axis[1]}`);
	fitsAt320(setup.axis[1] - setup.axis[0] + 1, setup.id);
	if (setup.presets.length > MAX_PRESETS) fail(`has ${setup.presets.length} presets, more than ${MAX_PRESETS}`);
	const keys = setup.presets.map((preset) => `${preset.n}/${preset.j}`);
	if (new Set(keys).size !== keys.length) fail('has two presets with the same n and p');
	for (const preset of setup.presets) {
		if (!inRange(preset.n, setup.nRange) || !inRange(preset.j, setup.jRange)) fail(`has preset "${preset.name}" outside its ranges`);
	}
	if (setup.kind === 'guess' && !setup.guess) fail('is a guess setup with no guess');
	for (const { n, j } of reachableStates(setup)) {
		const tallest = binomial(n, j).bars.find((bar) => compareFractions(bar.probability, setup.yMax) > 0);
		if (tallest) fail(`draws a column above its scale at n = ${n}, j = ${j}`);
		if (!spreadFits(n, j, setup.axis)) fail(`draws μ ± σ off the chart at n = ${n}, j = ${j}`);
	}
	return setup;
}

const validated = new Map<FamilySetupId, FamilySetup>();

export function getFamilySetup(id: FamilySetupId): FamilySetup {
	const known = validated.get(id);
	if (known) return known;
	const setup = FAMILY_SETUPS[id];
	if (!setup) throw new Error(`DistributionBoard: unknown family setup "${id}". Known: ${Object.keys(FAMILY_SETUPS).join(', ')}.`);
	validated.set(id, validateFamilySetup(setup));
	return setup;
}
