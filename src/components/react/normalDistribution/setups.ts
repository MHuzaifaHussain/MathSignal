// The z mode's groups and its one setup (decision 0019), checked when this module loads so a bad setup fails the
// build. Also the prop guard that picks the bell or the z mode: MDX props aren't type-checked, so it is the only one.
import { compareFractions, fraction, type Fraction } from '../boardMath.ts';
import { maxIndex, valueAt, distanceAt, zAt } from './model.ts';

export type ZPresetId = 'nine-140' | 'eleven-150' | 'standard-075';
export type ZSetupId = 'taller-for-age';
export type ZGuess = 'first' | 'second' | 'same';

export interface ZPreset {
	id: ZPresetId;
	/** Button text, also used in "Already showing …". */
	label: string;
	/** Readout group name, e.g. "Nine-year-olds". */
	group: string;
	kind: 'measured' | 'standard';
	/** '' only on the standard preset. */
	unit: 'cm' | '';
	quantity: 'height' | 'value';
	quantityPlural: 'heights' | 'values';
	/** Whole numbers, sd > 0. */
	mean: number;
	sd: number;
	/** The value grid's spacing. It divides sd, so every ruler tick is a slider stop; whole on measured presets. */
	step: Fraction;
	/** The opening value is mean + openingIndex · step. */
	openingIndex: number;
	/** "nine-year-old", for measured presets a question asks about. */
	childNoun?: string;
}

export interface ZSetup {
	id: ZSetupId;
	presets: readonly ZPresetId[];
	opening: ZPresetId;
	/** Presets left out of the buttons until Check, because they would answer the question. */
	waitsForCommit: readonly ZPresetId[];
	question: {
		legend: string;
		options: readonly { value: ZGuess; label: string }[];
		/** The two children compared: `first` and `second` in the options. */
		children: readonly [ZPresetId, ZPresetId];
	};
}

export const Z_PRESETS: Readonly<Record<ZPresetId, ZPreset>> = {
	'nine-140': {
		id: 'nine-140',
		label: 'Nine-year-old, 140 cm',
		group: 'Nine-year-olds',
		kind: 'measured',
		unit: 'cm',
		quantity: 'height',
		quantityPlural: 'heights',
		mean: 134,
		sd: 8,
		step: fraction(1, 1),
		openingIndex: 6,
		childNoun: 'nine-year-old',
	},
	'eleven-150': {
		id: 'eleven-150',
		label: 'Eleven-year-old, 150 cm',
		group: 'Eleven-year-olds',
		kind: 'measured',
		unit: 'cm',
		quantity: 'height',
		quantityPlural: 'heights',
		mean: 144,
		sd: 12,
		step: fraction(1, 1),
		openingIndex: 6,
		childNoun: 'eleven-year-old',
	},
	'standard-075': {
		id: 'standard-075',
		label: 'Standard normal, z = 0.75',
		group: 'Standard normal',
		kind: 'standard',
		unit: '',
		quantity: 'value',
		quantityPlural: 'values',
		mean: 0,
		sd: 1,
		step: fraction(1, 20),
		openingIndex: 15,
	},
};

export const Z_SETUPS: Readonly<Record<ZSetupId, ZSetup>> = {
	'taller-for-age': {
		id: 'taller-for-age',
		presets: ['nine-140', 'eleven-150', 'standard-075'],
		opening: 'nine-140',
		waitsForCommit: ['eleven-150', 'standard-075'],
		question: {
			legend: 'Who is taller for their age: the 140 cm nine-year-old or the 150 cm eleven-year-old?',
			options: [
				{ value: 'first', label: 'The nine-year-old' },
				{ value: 'second', label: 'The eleven-year-old' },
				{ value: 'same', label: 'Both the same' },
			],
			children: ['nine-140', 'eleven-150'],
		},
	},
};

const MIN_PRESETS = 2;
const MAX_PRESETS = 4;

/** The comparison's answer, decided exactly from the two children's z-scores. */
export function answerFor(setup: ZSetup, presets: Readonly<Record<string, ZPreset>> = Z_PRESETS): ZGuess {
	const [first, second] = setup.question.children.map((id) => presets[id]);
	const order = compareFractions(zAt(first, first.openingIndex), zAt(second, second.openingIndex));
	return order > 0 ? 'first' : order < 0 ? 'second' : 'same';
}

function validatePreset(preset: ZPreset): void {
	const fail = (why: string) => {
		throw new Error(`normalDistribution setups: preset ${preset.id} ${why}`);
	};
	if (!Number.isInteger(preset.sd) || preset.sd <= 0) fail(`needs a whole sd above 0, got ${preset.sd}`);
	if (!Number.isInteger(preset.mean)) fail(`needs a whole mean, got ${preset.mean}`);
	if (!(preset.step.numerator > 0)) fail('needs a positive step');
	if (preset.kind === 'measured' && preset.step.denominator !== 1) fail('is measured, so its step must be whole');
	if ((preset.kind === 'standard') !== (preset.unit === '')) fail('has a unit only when it is measured');
	if (preset.kind === 'standard' && (preset.mean !== 0 || preset.sd !== 1)) fail('is the standard normal, so its mean is 0 and its sd 1');
	const sdSteps = fraction(preset.sd * preset.step.denominator, preset.step.numerator);
	if (sdSteps.denominator !== 1) fail(`has a step that doesn't divide its sd ${preset.sd}`);
	const limit = maxIndex(preset);
	if (!Number.isInteger(preset.openingIndex) || Math.abs(preset.openingIndex) > limit) fail(`opens at index ${preset.openingIndex}, outside the whole numbers from −${limit} to ${limit}`);
}

/**
 * Throws, naming the problem, unless the setup can be shown and its question has one answer. It also checks the two
 * facts the verdict sentences state: both children stand the same positive distance above their mean, and the second
 * child is taller in units while the first is taller for their age.
 */
export function validateSetup(setup: ZSetup, presets: Readonly<Record<string, ZPreset>> = Z_PRESETS): void {
	const fail = (why: string) => {
		throw new Error(`normalDistribution setups: ${setup.id} ${why}`);
	};
	if (setup.presets.length < MIN_PRESETS || setup.presets.length > MAX_PRESETS) fail(`needs ${MIN_PRESETS} to ${MAX_PRESETS} presets, got ${setup.presets.length}`);
	if (new Set(setup.presets).size !== setup.presets.length) fail('lists a preset twice');
	for (const id of [...setup.presets, ...setup.waitsForCommit]) {
		if (!Object.hasOwn(presets, id)) fail(`names an unknown preset "${id}"`);
	}
	for (const id of setup.waitsForCommit) {
		if (!setup.presets.includes(id)) fail(`holds back ${id}, which isn't in its presets`);
	}
	for (const id of setup.presets) validatePreset(presets[id]);
	if (!setup.presets.includes(setup.opening)) fail(`opens on ${setup.opening}, which isn't in its presets`);
	if (setup.waitsForCommit.includes(setup.opening)) fail(`opens on ${setup.opening}, which waits for Check`);
	const children = setup.question.children.map((id) => presets[id]);
	for (const [index, child] of children.entries()) {
		const id = setup.question.children[index];
		if (!setup.presets.includes(id) || child.kind !== 'measured' || !child.childNoun) fail(`asks about ${id}, which isn't a measured preset in its list`);
	}
	if (!setup.question.children.includes(setup.opening)) fail(`opens on ${setup.opening}, which isn't one of the two children asked about`);
	const [first, second] = children;
	const firstDistance = distanceAt(first, first.openingIndex);
	if (compareFractions(firstDistance, distanceAt(second, second.openingIndex)) !== 0 || firstDistance.numerator <= 0) {
		fail('asks about two children who don\'t stand the same distance above their means');
	}
	if (compareFractions(zAt(first, first.openingIndex), zAt(second, second.openingIndex)) === 0) fail('asks about two children with the same z-score, so the question has no answer');
	if (answerFor(setup, presets) !== 'first' || compareFractions(valueAt(second, second.openingIndex), valueAt(first, first.openingIndex)) <= 0) {
		fail('must ask about a first child who is taller for their age and a second who is taller in units, as the verdicts say');
	}
}

for (const setup of Object.values(Z_SETUPS)) validateSetup(setup);

export const getZSetup = (id: ZSetupId): ZSetup => Z_SETUPS[id];
export const getZPreset = (id: ZPresetId): ZPreset => Z_PRESETS[id];

export type NormalBoardChoice = { mode: 'bell' } | { mode: 'z'; setup: ZSetupId };

const MODES = ['bell', 'z'] as const;

/**
 * The bell with no props (or mode="bell"), or the z mode with a known setup. Runs at build time and again at
 * hydration. Keys whose value is undefined are ignored, and `children` is always allowed and ignored, because Astro's
 * React client may pass one at hydration that the server render didn't have. Anything else throws, naming the prop.
 */
export function resolveNormalProps(props: Readonly<Record<string, unknown>>): NormalBoardChoice {
	const fail = (why: string) => {
		throw new Error(`NormalDistribution: ${why}`);
	};
	for (const [key, value] of Object.entries(props)) {
		if (value !== undefined && key !== 'children' && key !== 'mode' && key !== 'setup') fail(`unknown prop "${key}"; the props are mode ("bell" or "z") and setup (${Object.keys(Z_SETUPS).join(', ')})`);
	}
	const { mode, setup } = props;
	if (mode !== undefined && !MODES.includes(mode as (typeof MODES)[number])) fail(`mode must be "bell" or "z", got ${JSON.stringify(mode)}`);
	if (mode === 'z') {
		if (setup === undefined) fail(`mode="z" needs a setup: ${Object.keys(Z_SETUPS).join(', ')}`);
		if (typeof setup !== 'string' || !Object.hasOwn(Z_SETUPS, setup)) fail(`unknown setup ${JSON.stringify(setup)}; the setups are ${Object.keys(Z_SETUPS).join(', ')}`);
		return { mode: 'z', setup: setup as ZSetupId };
	}
	if (setup !== undefined) fail('a setup needs mode="z"');
	return { mode: 'bell' };
}
