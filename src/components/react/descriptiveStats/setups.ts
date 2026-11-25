// The board configurations pages pick with <DescriptiveStats setup="…" />. Each one fixes its data set, axis,
// slider, presets and stages. validateSetup runs at import, so a setup the board can't draw at 320px, or whose
// slider can carry a dot off the chart, fails the build. Design and reasoning: decision 0015.
import { CAFE_SAVINGS, CLASS_HEIGHTS, CLASS_OF_TEN, CLASS_TALL, EVERYONE_134, SHARED_HEIGHTS, TEST_A, TEST_B, TEST_B_LOW, TIGHT_CLASS, pumpkins, type MarkList } from './datasets.ts';
import { MAX_STACK, MIN_DISTINCT_PX, closestPair, type Axis } from './layout.ts';
import { mean, middleCount, middleIndices, minMax, populationSD, sortedValues, zScore } from './model.ts';
import { toNumber } from '../boardMath.ts';

export type SetupId = 'class-lineup' | 'cafe-millionaire' | 'class-spread' | 'class-box' | 'marks-scaling' | 'pumpkin-outliers';
/**
 * lineup: find the middle of the class, then see the summary. newcomer: one value joins and the three centers react.
 * spread: σ around the mean, with s beside it. box: quartiles and the box plot. scaling: two tests on raw, min–max
 * and z scales. outliers: the IQR rule against |z|.
 */
export type SetupKind = 'lineup' | 'newcomer' | 'spread' | 'box' | 'scaling' | 'outliers';
/** Pictures, Numbers and Symbols fade from concrete to abstract; Line-up, Quartiles and Box plot are the C page's steps. */
export type Stage = 'pictures' | 'numbers' | 'symbols' | 'line-up' | 'quartiles' | 'box';
export type Scale = 'raw' | 'minmax' | 'z';
export type Cutoff = 2 | 3;

/** The words a setup's sentences use for its items and their unit. */
export interface Words {
	item: string;
	items: string;
	/** Column header for the item, e.g. "Child". */
	itemTitle: string;
	/** Column header for the value, e.g. "Height (cm)". */
	valueTitle: string;
	/** What the values are, in a sentence: "heights", "savings". */
	values: string;
	/** Written after a number: "cm", "kg", "thousand dollars". */
	unit: string;
	/** Squared unit, for variance: "cm²". */
	unitSquared: string;
}

export interface Preset {
	id: string;
	label: string;
	/** The whole list (class presets), or test B's marks on the scaling setup. */
	values?: readonly number[];
	/** The newcomer's savings, or null for nobody new. */
	newcomer?: number | null;
	giant?: number;
	giants?: 1 | 2;
}

export interface SliderRange {
	min: number;
	max: number;
	step: number;
	largeStep: number;
}

export interface Setup {
	id: SetupId;
	kind: SetupKind;
	/** The board's accessible name. */
	label: string;
	words: Words;
	/** The list the board opens on (test B on the scaling setup). */
	opening: readonly number[];
	axis: Axis;
	/** Values past the axis's right end are drawn as edge arrows that carry their number. */
	lane: boolean;
	/** The tray slider: a child's height, the newcomer's savings, or the giant's weight. */
	slider?: SliderRange;
	presets: readonly Preset[];
	/** The stages the stage choice offers, in order; empty when the setup has no choice. */
	stages: readonly Stage[];
	/** "Show as" for concreteness stages, "Step" for the box plot's steps. */
	stageLegend: 'Show as' | 'Step';
	openingStage: Stage;
	/** Stages that would give the answer away, so they wait for Check. */
	waitsForCheck: readonly Stage[];
	/** Spread setups: keep the mean at `mean` and bring σ under `sigmaBelow`. */
	goal?: { mean: number; sigmaBelow: number };
	/** Newcomer setups: the savings the newcomer has when the switch first turns on. */
	newcomerOpening?: number;
	/** Scaling setups: test A, fixed, and the axes of each scale. */
	testA?: MarkList;
	anaB?: number;
	scaleAxes?: { rawA: Axis; rawB: Axis; minmax: Axis; z: Axis };
}

export const MAX_PRESETS = 4;
export const CUTOFFS: readonly Cutoff[] = [2, 3];
export const SCALES: readonly Scale[] = ['raw', 'minmax', 'z'];

const HEIGHT_WORDS: Words = { item: 'child', items: 'children', itemTitle: 'Child', valueTitle: 'Height (cm)', values: 'heights', unit: 'cm', unitSquared: 'cm²' };

const SETUP_LIST: readonly Setup[] = [
	{
		id: 'class-lineup',
		kind: 'lineup',
		label: 'A class of children as bars drawn to their height. Find the middle of the class.',
		words: HEIGHT_WORDS,
		opening: CLASS_HEIGHTS,
		axis: { min: 120, max: 150, tickStep: 5, narrowTickStep: 10 },
		lane: false,
		// Each preset is a new class to line up, chosen for what lining up shows: one middle child when n is odd,
		// two when n is even (the median is halfway between them), and repeated heights standing side by side (the
		// mode, here two). The "Line them up" switch stays the step that sorts them.
		presets: [
			{ id: 'our-class', label: 'Our class', values: CLASS_HEIGHTS },
			{ id: 'ten-children', label: 'Ten children', values: CLASS_OF_TEN },
			{ id: 'shared-heights', label: 'Shared heights', values: SHARED_HEIGHTS },
		],
		stages: ['pictures', 'numbers', 'symbols'],
		stageLegend: 'Show as',
		openingStage: 'pictures',
		waitsForCheck: ['symbols'],
	},
	{
		id: 'cafe-millionaire',
		kind: 'newcomer',
		label: "Nine cafe customers' savings as a dot plot, with the mean, median and mode. A newcomer can walk in.",
		words: { item: 'customer', items: 'customers', itemTitle: 'Customer', valueTitle: 'Savings (thousand dollars)', values: 'savings', unit: 'thousand dollars', unitSquared: '' },
		opening: CAFE_SAVINGS,
		axis: { min: 0, max: 10, tickStep: 1, narrowTickStep: 2 },
		lane: true,
		slider: { min: 0, max: 1000, step: 1, largeStep: 50 },
		presets: [
			{ id: 'nobody', label: 'Nobody new', newcomer: null },
			{ id: 'neighbor', label: 'A neighbor (6)', newcomer: 6 },
			{ id: 'millionaire', label: 'The millionaire (1,000)', newcomer: 1000 },
		],
		stages: [],
		stageLegend: 'Show as',
		openingStage: 'numbers',
		waitsForCheck: [],
		newcomerOpening: 1000,
	},
	{
		id: 'class-spread',
		kind: 'spread',
		label: "Our class's heights as a dot plot, with the mean and the standard deviation. Move one child at a time.",
		words: HEIGHT_WORDS,
		opening: CLASS_HEIGHTS,
		axis: { min: 110, max: 160, tickStep: 5, narrowTickStep: 10 },
		lane: false,
		slider: { min: 110, max: 160, step: 1, largeStep: 5 },
		presets: [
			{ id: 'our-class', label: 'Our class', values: CLASS_HEIGHTS },
			{ id: 'tight-class', label: 'Tight class', values: TIGHT_CLASS },
			{ id: 'everyone-134', label: 'Everyone 134 cm', values: EVERYONE_134 },
		],
		stages: ['numbers', 'symbols'],
		stageLegend: 'Show as',
		openingStage: 'numbers',
		waitsForCheck: [],
		goal: { mean: 134, sigmaBelow: 8 },
	},
	{
		id: 'class-box',
		kind: 'box',
		label: "Our class's heights lined up, split into quarters and drawn as a box plot.",
		words: HEIGHT_WORDS,
		opening: CLASS_HEIGHTS,
		axis: { min: 110, max: 170, tickStep: 10, narrowTickStep: 10 },
		lane: false,
		presets: [
			{ id: 'our-class', label: 'Our class', values: CLASS_HEIGHTS },
			{ id: 'one-very-tall', label: 'One very tall child', values: CLASS_TALL },
		],
		stages: ['line-up', 'quartiles', 'box'],
		stageLegend: 'Step',
		openingStage: 'line-up',
		waitsForCheck: [],
	},
	{
		id: 'marks-scaling',
		kind: 'scaling',
		label: "Two tests' marks, out of 50 and out of 80, on raw, min–max and z-score scales. Ana's marks are marked.",
		words: { item: 'mark', items: 'marks', itemTitle: 'Student', valueTitle: 'Mark', values: 'marks', unit: 'marks', unitSquared: '' },
		opening: TEST_B.values,
		axis: { min: 0, max: 80, tickStep: 10, narrowTickStep: 20 },
		lane: false,
		presets: [
			{ id: 'two-tests', label: 'Two tests', values: TEST_B.values },
			{ id: 'low-mark', label: 'One very low mark on B', values: TEST_B_LOW },
		],
		stages: [],
		stageLegend: 'Show as',
		openingStage: 'numbers',
		waitsForCheck: [],
		testA: TEST_A,
		anaB: TEST_B.ana,
		scaleAxes: {
			rawA: { min: 0, max: 50, tickStep: 10, narrowTickStep: 10 },
			rawB: { min: 0, max: 80, tickStep: 10, narrowTickStep: 20 },
			minmax: { min: 0, max: 1, tickStep: 0.25, narrowTickStep: 0.5 },
			z: { min: -3, max: 3, tickStep: 1, narrowTickStep: 1 },
		},
	},
	{
		id: 'pumpkin-outliers',
		kind: 'outliers',
		label: 'Nine pumpkins at the village fair as a dot plot and a box plot, with the IQR rule and the z-score rule.',
		words: { item: 'pumpkin', items: 'pumpkins', itemTitle: 'Pumpkin', valueTitle: 'Weight (kg)', values: 'weights', unit: 'kg', unitSquared: 'kg²' },
		opening: pumpkins(8, 1),
		axis: { min: 0, max: 30, tickStep: 5, narrowTickStep: 10 },
		lane: true,
		slider: { min: 8, max: 60, step: 1, largeStep: 5 },
		presets: [
			{ id: 'no-giant', label: 'No giant (8 kg)', giant: 8, giants: 1 },
			{ id: 'one-giant', label: 'One giant (30 kg)', giant: 30, giants: 1 },
			{ id: 'two-giants', label: 'Two giants (30 kg each)', giant: 30, giants: 2 },
		],
		stages: [],
		stageLegend: 'Show as',
		openingStage: 'numbers',
		waitsForCheck: [],
	},
];

function setupError(setup: Setup, message: string): Error {
	return new Error(`DescriptiveStats: setup "${setup.id}" ${message}`);
}

/** Every list a setup can show: its opening, each preset's, and the slider's extremes where the slider moves a value. */
export function listsOf(setup: Setup): { name: string; values: readonly number[] }[] {
	const lists = [{ name: 'the opening', values: setup.opening }];
	for (const preset of setup.presets) {
		if (preset.values) lists.push({ name: `preset "${preset.label}"`, values: preset.values });
		if (preset.newcomer !== undefined) lists.push({ name: `preset "${preset.label}"`, values: preset.newcomer === null ? setup.opening : [...setup.opening, preset.newcomer] });
		if (preset.giant !== undefined && preset.giants !== undefined) lists.push({ name: `preset "${preset.label}"`, values: pumpkins(preset.giant, preset.giants) });
	}
	return lists;
}

/** Values the slider can put on the chart, which the axis must hold unless the setup has a lane. */
function sliderValues(setup: Setup): number[] {
	return setup.slider ? [setup.slider.min, setup.slider.max] : [];
}

function validateAxis(setup: Setup, name: string, axis: Axis): void {
	const steps = (axis.max - axis.min) / axis.tickStep;
	if (!(axis.max > axis.min) || Math.abs(steps - Math.round(steps)) > 1e-9) {
		throw setupError(setup, `has an axis (${name}) whose ticks don't fit from ${axis.min} to ${axis.max} in steps of ${axis.tickStep}.`);
	}
}

const round = (value: number) => Number(value.toFixed(2));

/** Dots past the axis need a lane, and none may sit below it; different values must stay apart at 320px. */
function validatePlacement(setup: Setup, name: string, axis: Axis, values: readonly number[], lane: boolean): void {
	const low = values.find((value) => value < axis.min);
	if (low !== undefined) throw setupError(setup, `${name}: ${low} is below the axis, which starts at ${axis.min}.`);
	const high = values.find((value) => value > axis.max);
	if (high !== undefined && !lane) throw setupError(setup, `${name}: ${high} is past the axis, which ends at ${axis.max}, and the setup has no off-chart lane.`);
	if (values.length > MAX_STACK) throw setupError(setup, `${name}: has ${values.length} values; a chart row holds at most ${MAX_STACK}.`);
	const closest = closestPair(values.filter((value) => value <= axis.max), axis);
	if (closest && closest.pixels < MIN_DISTINCT_PX) {
		const apart = closest.pixels.toFixed(1);
		throw setupError(setup, `${name}: ${round(closest.low)} and ${round(closest.high)} sit ${apart}px apart at 320px; values closer than ${MIN_DISTINCT_PX}px can't be told apart.`);
	}
}

function validateScaling(setup: Setup): void {
	const { testA, scaleAxes, anaB } = setup;
	if (!testA || !scaleAxes || anaB === undefined) throw setupError(setup, 'needs test A, Ana\'s mark on test B and the scale axes.');
	for (const [name, axis] of Object.entries(scaleAxes)) validateAxis(setup, name, axis);
	const sigmaA = populationSD(testA.values);
	if (sigmaA.exact && sigmaA.value.numerator === 0) throw setupError(setup, 'has a test A with no spread, so z-scores divide by zero.');
	validatePlacement(setup, 'test A raw', scaleAxes.rawA, testA.values, false);
	for (const { name, values } of listsOf(setup)) {
		if (values[anaB] === undefined) throw setupError(setup, `${name}: Ana's mark on test B is missing.`);
		validatePlacement(setup, `${name} raw`, scaleAxes.rawB, values, false);
		for (const list of [testA.values, values]) {
			validatePlacement(setup, `${name} min–max`, scaleAxes.minmax, list.map((value) => toNumber(minMax(value, list))), false);
			validatePlacement(setup, `${name} z`, scaleAxes.z, list.map((value) => { const z = zScore(value, list); return z.exact ? toNumber(z.value) : z.value; }), false);
		}
	}
}

/** Throws, naming the setup and the cause, when a setup can't be drawn or answered. */
export function validateSetup(setup: Setup): Setup {
	if (setup.presets.length > MAX_PRESETS) throw setupError(setup, `has ${setup.presets.length} presets; at most ${MAX_PRESETS} fit at 375px.`);
	if (new Set(setup.presets.map((preset) => preset.id)).size !== setup.presets.length) throw setupError(setup, 'has two presets with the same id.');
	validateAxis(setup, 'main', setup.axis);
	if (setup.stages.length > 0 && !setup.stages.includes(setup.openingStage)) throw setupError(setup, `opens on stage "${setup.openingStage}", which it doesn't offer.`);
	const unknownWait = setup.waitsForCheck.find((stage) => !setup.stages.includes(stage));
	if (unknownWait) throw setupError(setup, `holds back stage "${unknownWait}", which it doesn't offer.`);
	if (setup.waitsForCheck.length > 0 && setup.kind !== 'lineup') throw setupError(setup, 'holds stages back for Check, but only line-up setups have a Check.');
	if (setup.kind === 'lineup' && setup.presets.some((preset) => !preset.values)) throw setupError(setup, 'has a preset without a class to line up.');
	const lists = listsOf(setup);
	const counts = new Set(lists.map((list) => list.values.length));
	if (setup.kind === 'spread' && counts.size !== 1) throw setupError(setup, 'needs the same number of children in every preset, because "Child to move" lists them.');
	for (const { name, values } of lists) {
		sortedValues(values);
		if (setup.kind === 'box' && values.length % 4 !== 1) {
			throw setupError(setup, `${name}: a box setup needs n = 4k + 1 values so the quartiles land on data points; it has ${values.length}.`);
		}
		if (setup.kind === 'lineup' && middleIndices(values).length !== middleCount(values)) {
			const middle = middleCount(values) === 1 ? 'the middle height must belong to one child' : 'the two middle heights must each belong to one child';
			throw setupError(setup, `${name}: ${middle}, so no two children may tie in the middle.`);
		}
		if (setup.kind !== 'scaling') validatePlacement(setup, name, setup.axis, values, setup.lane);
	}
	if (setup.slider) {
		const { min, max } = setup.slider;
		for (const value of sliderValues(setup)) validatePlacement(setup, `the slider's ${value === min ? 'lowest' : 'highest'} value`, setup.axis, [value], setup.lane);
		for (const preset of setup.presets) {
			const moved = [...(setup.kind === 'spread' ? (preset.values ?? []) : []), ...(preset.newcomer ? [preset.newcomer] : []), ...(preset.giant !== undefined ? [preset.giant] : [])];
			const outside = moved.find((value) => value < min || value > max);
			if (outside !== undefined) throw setupError(setup, `preset "${preset.label}": ${outside} is outside the slider's ${min} to ${max}.`);
		}
		if (setup.newcomerOpening !== undefined && (setup.newcomerOpening < min || setup.newcomerOpening > max)) {
			throw setupError(setup, `opens the newcomer at ${setup.newcomerOpening}, outside the slider's ${min} to ${max}.`);
		}
	}
	if (setup.kind === 'spread') {
		if (!setup.goal) throw setupError(setup, 'needs a goal.');
		const opening = mean(setup.opening);
		if (opening.denominator !== 1 || opening.numerator !== setup.goal.mean) throw setupError(setup, `opens with mean ${toNumber(opening)}, not the goal's ${setup.goal.mean}.`);
	}
	if (setup.kind === 'newcomer' && setup.newcomerOpening === undefined) throw setupError(setup, 'needs the savings the newcomer opens with.');
	if (setup.kind === 'scaling') validateScaling(setup);
	return setup;
}

const SETUPS = new Map<string, Setup>(SETUP_LIST.map((setup) => [setup.id, validateSetup(setup)]));

export const SETUP_IDS: readonly SetupId[] = SETUP_LIST.map((setup) => setup.id);

export function getSetup(id: string): Setup {
	const setup = SETUPS.get(id);
	if (!setup) throw new Error(`DescriptiveStats: unknown setup "${id}". Known setups: ${SETUP_IDS.join(', ')}.`);
	return setup;
}

export function presetById(setup: Setup, id: string): Preset | undefined {
	return setup.presets.find((preset) => preset.id === id);
}
