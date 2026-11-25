// FunctionCurve's setups, presets, views and ladders. Every value the reader can pick is an index on a fixed grid,
// and every grid value is a Fraction built from integers, so nothing the board prints comes from a float.
// validateSetup runs at import. Design and reasoning: decision 0020.
import { compareFractions, fraction, toNumber, type Fraction } from '../boardMath.ts';
import { terminatesWithin } from '../boardText.ts';
import type { CheckMode } from '../guided/guided.ts';
import { CATALOG, evaluate, type CurveId, type ExactFunction } from './functions.ts';
import { CURVE_DECIMAL_PLACES, absolute, offBoard, type View } from './model.ts';

export type SetupId = 'ruler-to-tangent' | 'corner';
export type Stage = 'slide' | 'ruler' | 'tangent' | 'slope-curve';
export type PresetId = 'bowl' | 's-curve' | 'loss' | 'hinge' | 'v' | 'smooth';
export type Choice = 'one' | 'two';

const f = fraction;

/** Ruler lengths h, short ones in the middle. 0 is never on it: a ruler of length 0 has no slope. */
export const H_LADDER: readonly Fraction[] = [f(-1, 1), f(-1, 2), f(-1, 4), f(-1, 10), f(-1, 100), f(-1, 1000), f(1, 1000), f(1, 100), f(1, 10), f(1, 4), f(1, 2), f(1, 1)];
/** Before Check only rulers of length 0.25 or more, so the reader commits before seeing them close in. */
export const PRE_CHECK_H_INDICES: readonly number[] = [0, 1, 2, 9, 10, 11];
export const ALL_H_INDICES: readonly number[] = H_LADDER.map((_, index) => index);
/** h = 1, the page's prediction ruler; also where Reset puts it. */
export const OPENING_H_INDEX = 11;

/** The guess is a quarter-step index: index 8 is slope 2. */
export const GUESS_STEP = f(1, 4);
export const guessValue = (index: number): Fraction => f(index, 4);

/** The point's x is a half-step index, the same meaning on every range: xIndex = 2x. */
export const pointValue = (xIndex: number): Fraction => f(xIndex, 2);

export interface StripView {
	y: readonly [number, number];
	/** The only y values numbered on the strip: 0 and one value near each end of its range. */
	labels: readonly number[];
}

export interface CurveView {
	view: View;
	/** True where the reader judges steepness, so one unit is as long across as up; the view must then be square. */
	equalScale: boolean;
	/** Grid spacing; the axis numbers sit on these lines (none in Slide). */
	xLines: number;
	yLines: number;
	/** Axis names drawn on the plane, only where the letters differ from x and y. */
	axisNames: { x: string; y: string } | null;
	/** The point's range as half-step indices. */
	xIndexRange: readonly [number, number];
	strip: StripView;
}

const range = (low: Fraction, high: Fraction) => [low, high] as const;
const EQUAL_VIEW: View = { x: range(f(-5, 2), f(5, 2)), y: range(f(-1, 2), f(9, 2)) };

export const CURVE_VIEWS: Readonly<Record<CurveId, CurveView>> = {
	square: { view: EQUAL_VIEW, equalScale: true, xLines: 1, yLines: 1, axisNames: null, xIndexRange: [-4, 4], strip: { y: [-5, 5], labels: [-4, 0, 4] } },
	relu: { view: EQUAL_VIEW, equalScale: true, xLines: 1, yLines: 1, axisNames: null, xIndexRange: [-4, 4], strip: { y: [-1.5, 1.5], labels: [-1, 0, 1] } },
	abs: { view: EQUAL_VIEW, equalScale: true, xLines: 1, yLines: 1, axisNames: null, xIndexRange: [-4, 4], strip: { y: [-1.5, 1.5], labels: [-1, 0, 1] } },
	// The strip's range follows the view, not the slider: 3x² reaches 12 at the view's edge, x = ±2.
	cube: { view: { x: range(f(-2, 1), f(2, 1)), y: range(f(-4, 1), f(4, 1)) }, equalScale: false, xLines: 1, yLines: 2, axisNames: null, xIndexRange: [-3, 3], strip: { y: [-1, 13], labels: [0, 12] } },
	loss: {
		view: { x: range(f(-1, 2), f(13, 2)), y: range(f(-1, 2), f(21, 2)) },
		equalScale: false,
		xLines: 1,
		yLines: 2,
		axisNames: { x: 'w', y: 'loss' },
		xIndexRange: [0, 12],
		strip: { y: [-7.5, 7.5], labels: [-6, 0, 6] },
	},
};

export interface CurvePreset {
	id: PresetId;
	label: string;
	curve: CurveId;
	/** Where the preset puts the point, as a half-step index. */
	xIndex: number;
}

export const PRESETS: Readonly<Record<PresetId, CurvePreset>> = {
	bowl: { id: 'bowl', label: 'Bowl: x² at 1', curve: 'square', xIndex: 2 },
	's-curve': { id: 's-curve', label: 'S-curve: x³ at 1', curve: 'cube', xIndex: 2 },
	loss: { id: 'loss', label: 'Loss: (w − 3)² at 0', curve: 'loss', xIndex: 0 },
	hinge: { id: 'hinge', label: 'Hinge: ReLU at 0', curve: 'relu', xIndex: 0 },
	v: { id: 'v', label: 'V: |x| at 0', curve: 'abs', xIndex: 0 },
	smooth: { id: 'smooth', label: 'Smooth: x² at 0', curve: 'square', xIndex: 0 },
};

/** Slopes of the line through the corner, by preset. Both hold 0.5, where the switch opens. */
export const LINE_SLOPES: Readonly<Partial<Record<PresetId, readonly Fraction[]>>> = {
	hinge: [f(-1, 2), f(0, 1), f(1, 4), f(1, 2), f(3, 4), f(1, 1), f(3, 2)],
	v: [f(-3, 2), f(-1, 1), f(-1, 2), f(0, 1), f(1, 2), f(1, 1), f(3, 2)],
};
export const OPENING_LINE_SLOPE = f(1, 2);

/** The seats the Slide picture covers (x from 1 to 2), as half-step indices: every pencil there slopes up. */
export const SLIDE_X_INDICES: readonly [number, number] = [2, 4];
export const SLIDE_PRESET: PresetId = 'bowl';

export interface GuessRule {
	/** Index range of the guess slider; the value is index × GUESS_STEP. */
	maxIndex: number;
	openingIndex: number;
	answerIndex: number;
}

export interface Setup {
	id: SetupId;
	presets: readonly PresetId[];
	openingPreset: PresetId;
	checkMode: CheckMode;
	/** The slope guess (ruler-to-tangent) or null for the one-shot choice (corner). */
	guess: GuessRule | null;
	choices: readonly Choice[] | null;
	answerChoice: Choice | null;
	/** Every stage the setup has, in order; stageAllowed in state.ts decides which are offered now. */
	stages: readonly Stage[];
	waitsForCheck: readonly Stage[];
	openingStage: Stage;
}

export const SETUPS: Readonly<Record<SetupId, Setup>> = {
	'ruler-to-tangent': {
		id: 'ruler-to-tangent',
		presets: ['bowl', 's-curve', 'loss'],
		openingPreset: 'bowl',
		checkMode: 'retry',
		guess: { maxIndex: 16, openingIndex: 0, answerIndex: 8 },
		choices: null,
		answerChoice: null,
		stages: ['slide', 'ruler', 'tangent', 'slope-curve'],
		waitsForCheck: ['tangent', 'slope-curve'],
		openingStage: 'slide',
	},
	corner: {
		id: 'corner',
		presets: ['hinge', 'v', 'smooth'],
		openingPreset: 'hinge',
		checkMode: 'once',
		guess: null,
		choices: ['one', 'two'],
		answerChoice: 'two',
		stages: ['ruler', 'tangent', 'slope-curve'],
		waitsForCheck: ['tangent', 'slope-curve'],
		openingStage: 'ruler',
	},
};

export const MAX_PRESETS = 4;
const QUARTER = f(1, 4);

/** The shared grids validateSetup checks a setup against; check-boards passes broken ones to see it throw. */
export interface SetupGrids {
	ladder?: readonly Fraction[];
	preCheck?: readonly number[];
	views?: Readonly<Record<CurveId, CurveView>>;
}

export const curveOf = (preset: PresetId): ExactFunction => CATALOG[PRESETS[preset].curve];
export const viewOf = (preset: PresetId): CurveView => CURVE_VIEWS[PRESETS[preset].curve];

/**
 * Throws, naming the setup, when a ladder holds 0 or a value that doesn't print exactly, a pre-Check ruler is shorter
 * than 0.25, an equal-scale view isn't square, a preset's point is outside its range or can leave the board, the opening
 * guess is the answer, or there are more than MAX_PRESETS presets.
 */
export function validateSetup(setup: Setup, grids: SetupGrids = {}): void {
	const { ladder = H_LADDER, preCheck = PRE_CHECK_H_INDICES, views = CURVE_VIEWS } = grids;
	const fail = (why: string) => {
		throw new Error(`FunctionCurve setup "${setup.id}": ${why}`);
	};
	for (const h of ladder) {
		if (h.numerator === 0) fail('the h ladder holds 0');
		if (!terminatesWithin(h, CURVE_DECIMAL_PLACES)) fail(`the h ladder holds ${toNumber(h)}, which has no exact decimal`);
	}
	for (const index of preCheck) {
		const h = ladder[index];
		if (!h) fail(`pre-Check index ${index} is not on the ladder`);
		if (compareFractions(absolute(h), QUARTER) < 0) fail(`the pre-Check ladder holds ${toNumber(h)}, shorter than 0.25`);
	}
	if (setup.presets.length > MAX_PRESETS) fail(`has ${setup.presets.length} presets, more than ${MAX_PRESETS}`);
	if (!setup.presets.includes(setup.openingPreset)) fail(`opens on preset "${setup.openingPreset}", which it doesn't offer`);
	if (setup.guess && setup.guess.openingIndex === setup.guess.answerIndex) fail('the opening guess is the answer');
	for (const id of setup.presets) {
		const preset = PRESETS[id];
		const curveView = views[preset.curve];
		const { view } = curveView;
		if (curveView.equalScale) {
			const width = toNumber(view.x[1]) - toNumber(view.x[0]);
			const height = toNumber(view.y[1]) - toNumber(view.y[0]);
			if (width !== height) fail(`preset "${id}" has an equal-scale view that isn't square`);
		}
		const [low, high] = curveView.xIndexRange;
		if (preset.xIndex < low || preset.xIndex > high) fail(`preset "${id}" puts the point outside its range`);
		// The point has no edge sentence (only the ruler's other end does), so it must be on the board everywhere it can go.
		for (let xIndex = low; xIndex <= high; xIndex += 1) {
			const x = pointValue(xIndex);
			if (offBoard(view, { x, y: evaluate(CATALOG[preset.curve], x) })) fail(`preset "${id}" can put the point off the board, at ${toNumber(x)}`);
		}
		for (const slope of LINE_SLOPES[id] ?? []) {
			if (!terminatesWithin(slope, CURVE_DECIMAL_PLACES)) fail(`preset "${id}" has a line slope with no exact decimal`);
		}
	}
}

for (const setup of Object.values(SETUPS)) validateSetup(setup);

export function getSetup(id: string): Setup {
	if (!Object.hasOwn(SETUPS, id)) throw new Error(`FunctionCurve: unknown setup "${id}"`);
	return SETUPS[id as SetupId];
}
