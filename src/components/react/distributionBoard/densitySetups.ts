// The density-mode setups and their sand shapes (decision 0018). Each setup is validated before it renders: every
// shape holds area 1 and fits under the setup's fixed scale, and every bar width fits 320 px.
import { compareFractions, divideFractions, fraction, toNumber, type Fraction } from '../boardMath.ts';
import { fitsAt320 } from './columnAxis.ts';
import { bins, QUARTERS_PER_CM, RULER_CM, supportOf, validateShape, type PiecewiseLinear } from './density.ts';
import type { Gridline } from './familySetups.ts';

export type ShapeId = 'even' | 'heap' | 'narrow' | 'lopsided';
export type DensitySetupId = 'sand-pour' | 'sand-interval';
export type DensityStage = 'bars' | 'curve';
/** Bars per centimeter: 1 cm, 0.5 cm or 0.25 cm wide. */
export type BinsPerCm = 1 | 2 | 4;

export interface SandShape {
	id: ShapeId;
	/** The preset's name, and the shape's name in sentences. */
	name: string;
	shape: PiecewiseLinear;
}

const knot = (x: Fraction, height: Fraction) => ({ x, height });
const whole = (value: number) => fraction(value, 1);

export const SHAPES: Readonly<Record<ShapeId, SandShape>> = {
	even: { id: 'even', name: 'Even sand', shape: { ends: 'closed-block', knots: [knot(whole(0), fraction(1, 4)), knot(whole(4), fraction(1, 4))] } },
	heap: { id: 'heap', name: 'Sand heap', shape: { ends: 'zero', knots: [knot(whole(0), whole(0)), knot(whole(2), fraction(1, 2)), knot(whole(4), whole(0))] } },
	narrow: { id: 'narrow', name: 'Narrow sand', shape: { ends: 'closed-block', knots: [knot(whole(0), whole(2)), knot(fraction(1, 2), whole(2))] } },
	lopsided: { id: 'lopsided', name: 'Lopsided heap', shape: { ends: 'zero', knots: [knot(whole(0), whole(0)), knot(whole(1), fraction(1, 2)), knot(whole(4), whole(0))] } },
};

export interface DensitySetup {
	id: DensitySetupId;
	/** The presets, in order; each is a shape. */
	shapes: readonly ShapeId[];
	openingShape: ShapeId;
	stages: readonly DensityStage[];
	/** The bar widths the reader can pick, as bars per cm; the first is the opening one. */
	binWidths: readonly BinsPerCm[];
	/** From and To in whole quarters of a centimeter (0..16), or null on a setup with no interval. */
	openingInterval: readonly [number, number] | null;
	spreadSwitch: boolean;
	yMax: Fraction;
	gridlines: readonly Gridline[];
}

/** Narrowest bars the curve's table is measured in. */
export const CURVE_BINS_PER_CM: BinsPerCm = 4;
const MAX_PRESETS = 4;
/** Board 2 asks about the Lopsided heap, so board 1 must never show it. */
const KEPT_FOR_LATER: Readonly<Partial<Record<DensitySetupId, ShapeId>>> = { 'sand-pour': 'lopsided' };

export const DENSITY_SETUPS: Readonly<Record<DensitySetupId, DensitySetup>> = {
	'sand-pour': {
		id: 'sand-pour',
		shapes: ['even', 'heap', 'narrow'],
		openingShape: 'even',
		stages: ['bars', 'curve'],
		binWidths: [1, 2, 4],
		openingInterval: null,
		spreadSwitch: false,
		yMax: whole(2),
		// The top, 2 per cm, is left unlabeled: it would answer the page's question before the reader commits.
		gridlines: [{ value: whole(1), label: '1', solid: true }],
	},
	'sand-interval': {
		id: 'sand-interval',
		shapes: ['even', 'heap', 'lopsided'],
		openingShape: 'even',
		stages: ['curve'],
		binWidths: [CURVE_BINS_PER_CM],
		openingInterval: [4, 8],
		spreadSwitch: true,
		yMax: fraction(1, 2),
		gridlines: [
			{ value: fraction(1, 4), label: '1/4', solid: false },
			{ value: fraction(1, 2), label: '1/2', solid: false },
		],
	},
};

const QUARTER_STOPS = RULER_CM * QUARTERS_PER_CM;

/** Throws, naming the setup and the first problem. */
export function validateDensitySetup(setup: DensitySetup): DensitySetup {
	const fail = (problem: string) => {
		throw new Error(`DistributionBoard: density setup "${setup.id}" ${problem}.`);
	};
	if (setup.shapes.length > MAX_PRESETS) fail(`has ${setup.shapes.length} presets, more than ${MAX_PRESETS}`);
	if (!setup.shapes.includes(setup.openingShape)) fail(`opens on "${setup.openingShape}", which is not one of its shapes`);
	const kept = KEPT_FOR_LATER[setup.id];
	if (kept && setup.shapes.includes(kept)) fail(`lists "${kept}", which a later board asks about`);
	for (const perCm of setup.binWidths) fitsAt320(RULER_CM * perCm, setup.id);
	for (const id of setup.shapes) {
		const { name, shape } = SHAPES[id];
		validateShape(name, shape);
		const [start, end] = supportOf(shape);
		if (start.numerator < 0 || toNumber(end) > RULER_CM) fail(`pours "${name}" off the ruler`);
		const peak = shape.knots.reduce((tallest, current) => (compareFractions(current.height, tallest) > 0 ? current.height : tallest), fraction(0, 1));
		if (compareFractions(peak, setup.yMax) > 0) fail(`draws "${name}" above its scale`);
		for (const perCm of setup.stages.includes('bars') ? setup.binWidths : []) {
			const tallest = bins(shape, divideFractions(whole(1), whole(perCm))).find((bin) => compareFractions(bin.height, setup.yMax) > 0);
			if (tallest) fail(`draws a bar of "${name}" above its scale at ${perCm} bars per cm`);
		}
	}
	const interval = setup.openingInterval;
	if (interval && !interval.every((end) => Number.isInteger(end) && end >= 0 && end <= QUARTER_STOPS)) fail('opens on an interval off the quarter grid');
	if (interval && interval[0] > interval[1]) fail('opens on a backward interval');
	return setup;
}

const validated = new Map<DensitySetupId, DensitySetup>();

export function isDensitySetupId(id: string): id is DensitySetupId {
	return Object.hasOwn(DENSITY_SETUPS, id);
}

export function getDensitySetup(id: DensitySetupId): DensitySetup {
	const known = validated.get(id);
	if (known) return known;
	if (!isDensitySetupId(id)) throw new Error(`DistributionBoard: unknown density setup "${id}". Known: ${Object.keys(DENSITY_SETUPS).join(', ')}.`);
	const setup = validateDensitySetup(DENSITY_SETUPS[id]);
	validated.set(id, setup);
	return setup;
}

export const shapeOf = (id: ShapeId) => SHAPES[id];
export const shapeByName = (setup: DensitySetup, name: string) => setup.shapes.map(shapeOf).find((shape) => shape.name === name) ?? null;
