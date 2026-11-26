// What FunctionCurve's plane and slope strip draw, in order, as plain data: every mark's color, line style and weight
// is decided here, and CurvePlane.tsx and SlopeStrip.tsx only map the list to Mafs. So scripts/check-boards.mjs can
// enumerate every reachable state and check that exactly one mark is ochre and every label is ink.
// Design and reasoning: decision 0020.
import { absoluteFraction, toNumber, type Fraction } from '../boardMath.ts';
import type { LineStyle } from '../planeLines.tsx';
import { derivativeCoefficients, evaluate, slopeAt, type Piece } from './functions.ts';
import { axisNumber, numberText, ruler, type Attach, type CurvePoint } from './model.ts';
import { viewOf } from './setups.ts';
import { covered, curveFor, hOf, lineSlopeOf, pointOf, type CurveState } from './state.ts';

/** 'axis' is the axes' own color, for the strip's numbers, drawn here so they clear the open dots (STRIP_NUMBER_OFFSET). */
export type MarkColor = 'ink' | 'muted' | 'ochre' | 'axis';
/** What fills a dot's middle: the board's own color, so an open dot reads as "no value here". */
export type MarkFill = 'board';
export type Vec = readonly [number, number];

export interface MarkLabel {
	text: string;
	at: Vec;
	attach: Attach;
	color: MarkColor;
	/** Other anchors along what the label names, tried in order when every side of `at` is blocked (labelLayout.ts). */
	alsoAt: readonly Vec[];
}

interface MarkStyle {
	color: MarkColor;
	lineStyle: LineStyle;
	weight: number;
	label?: MarkLabel;
}

export type Mark = MarkStyle &
	(
		| { kind: 'curve'; coefficients: readonly Fraction[]; domain: Vec }
		| { kind: 'ground'; from: Vec; to: Vec }
		| { kind: 'ruler'; from: Vec; to: Vec }
		| { kind: 'run-leg' | 'rise-leg'; from: Vec; to: Vec }
		| { kind: 'tangent'; point: Vec; slope: number }
		| { kind: 'corner-line'; slope: number }
		| { kind: 'ruler-end' | 'point'; at: Vec; movable: boolean }
		| { kind: 'open-dot'; at: Vec; fill: MarkFill }
		| { kind: 'value-dot'; at: Vec }
		| { kind: 'axis-name'; at: Vec }
		| { kind: 'axis-number'; at: Vec }
	);

/**
 * Line weights in pixels. The tangent and the corner line are heavier, so the one ochre line stands out by weight too.
 * A filled dot has no stroke weight; an open dot's ring is 2px.
 */
export const WEIGHTS = { curve: 2.5, ruler: 2.5, tangent: 3, leg: 2, cornerLine: 3, ground: 1.5, dot: 0, openDot: 2 } as const;

/**
 * How far from the y-axis the strip's numbers start, right or left, in pixels: clear of an open dot on the axis (Mafs'
 * 6px radius and half its 2px ring) and of the numbers' own 1.5px halo. Mafs' own axis numbers start 5px out, under
 * the dot.
 */
export const STRIP_NUMBER_OFFSET = 10;

/** Rise and run legs are labeled only when they are long enough to hold a label (|h| ≥ 0.5). */
const LABELED_RUN = 0.5;

export type OchreElement = 'corner-line' | 'tangent' | 'ruler';

/** True when the plane draws the tangent: Tangent or Slope curve, a tangent exists here, and the corner line is off. */
export function drawsTangent(state: CurveState): boolean {
	if (covered(state) || state.linesOn) return false;
	if (state.stage !== 'tangent' && state.stage !== 'slope-curve') return false;
	return slopeAt(curveFor(state), pointOf(state)).kind === 'exact';
}

/** The one ochre element: the corner line while its switch is on, else the tangent when drawn, else the ruler. */
export function ochreElement(state: CurveState): OchreElement {
	if (state.linesOn) return 'corner-line';
	return drawsTangent(state) ? 'tangent' : 'ruler';
}

const asVec = (point: CurvePoint): Vec => [toNumber(point.x), toNumber(point.y)];
const label = (text: string, at: Vec, attach: Attach, alsoAt: readonly Vec[] = []): MarkLabel => ({ text, at, attach, color: 'ink', alsoAt });

/** Points along a segment, as fractions of the way from `from` to `to`. */
const along = (from: Vec, to: Vec, fractions: readonly number[]): Vec[] => fractions.map((t) => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
/** Where else a leg's label may sit: a third and two thirds of the way along it. */
const LEG_FRACTIONS = [1 / 3, 2 / 3] as const;

/** Points on the line through `point` with this slope at these x offsets from it, keeping those inside the view. */
function onLine(state: CurveState, point: Vec, slope: number, offsets: readonly number[]): Vec[] {
	const view = viewOf(state.preset).view;
	const inside = (value: number, [low, high]: readonly [Fraction, Fraction]) => value >= toNumber(low) && value <= toNumber(high);
	return offsets.map((offset): Vec => [point[0] + offset, point[1] + slope * offset]).filter((at) => inside(at[0], view.x) && inside(at[1], view.y));
}

/** The stretch of x a piece covers on the board: an open end runs to the view's edge. */
const pieceDomain = (piece: Piece, left: number, right: number): Vec => [
	piece.from === null ? left : toNumber(piece.from),
	piece.to === null ? right : toNumber(piece.to),
];

function curveMarks(state: CurveState): Mark[] {
	const f = curveFor(state);
	const view = viewOf(state.preset).view;
	const left = toNumber(view.x[0]);
	const right = toNumber(view.x[1]);
	if (state.stage === 'slide') {
		// The slide starts at the ground: x² for x ≥ 0 in ink, and the ground left of it muted.
		return [
			{ kind: 'ground', from: [left, 0], to: [0, 0], color: 'muted', lineStyle: 'solid', weight: WEIGHTS.ground },
			{ kind: 'curve', coefficients: f.pieces[0].coefficients, domain: [0, right], color: 'ink', lineStyle: 'solid', weight: WEIGHTS.curve },
		];
	}
	// Each piece is its own plot over its own stretch, so a corner stays sharp.
	return f.pieces.map((piece) => ({
		kind: 'curve' as const,
		coefficients: piece.coefficients,
		domain: pieceDomain(piece, left, right),
		color: 'ink' as const,
		lineStyle: 'solid' as const,
		weight: WEIGHTS.curve,
	}));
}

function legLabels(state: CurveState, rise: Fraction): { run: string; rise: string } {
	const h = hOf(state);
	if (state.stage === 'slide') {
		const up = rise.numerator >= 0;
		return { run: `${numberText(absoluteFraction(h))} across`, rise: `${numberText(absoluteFraction(rise))} ${up ? 'up' : 'down'}` };
	}
	return { run: `run ${numberText(h)}`, rise: `rise ${numberText(rise)}` };
}

function rulerMarks(state: CurveState, ochre: OchreElement): Mark[] {
	const f = curveFor(state);
	const r = ruler(f, pointOf(state), hOf(state));
	const start = asVec(r.start);
	const end = asVec(r.end);
	const corner: Vec = [end[0], start[1]];
	const labeled = Math.abs(toNumber(r.run)) >= LABELED_RUN;
	const words = legLabels(state, r.rise);
	const runMiddle: Vec = [(start[0] + corner[0]) / 2, start[1]];
	const riseMiddle: Vec = [corner[0], (corner[1] + end[1]) / 2];
	// The run label sits on the side of the run leg away from the rise; the rise label outside the triangle.
	const runAttach: Attach = r.rise.numerator > 0 ? 's' : 'n';
	const riseAttach: Attach = r.run.numerator > 0 ? 'e' : 'w';
	return [
		{ kind: 'run-leg', from: start, to: corner, color: 'muted', lineStyle: 'dotted', weight: WEIGHTS.leg, label: labeled ? label(words.run, runMiddle, runAttach, along(start, corner, LEG_FRACTIONS)) : undefined },
		{
			kind: 'rise-leg',
			from: corner,
			to: end,
			color: 'muted',
			lineStyle: 'dotted',
			weight: WEIGHTS.leg,
			label: labeled && r.rise.numerator !== 0 ? label(words.rise, riseMiddle, riseAttach, along(corner, end, LEG_FRACTIONS)) : undefined,
		},
		{ kind: 'ruler', from: start, to: end, color: ochre === 'ruler' ? 'ochre' : 'ink', lineStyle: 'dashed', weight: WEIGHTS.ruler },
		{ kind: 'ruler-end', at: end, movable: false, color: 'ink', lineStyle: 'solid', weight: WEIGHTS.dot },
	];
}

/** "tangent" sits along the line, a unit to the side of the point that stays inside the view. */
function tangentMark(state: CurveState, slope: Fraction): Mark {
	const at = asVec(pointOnCurve(state));
	const view = viewOf(state.preset).view;
	const toLeft = at[0] - 1 >= toNumber(view.x[0]) + 0.5 && toNumber(slope) > 0;
	const side = toLeft ? -1 : 1;
	const labelAt: Vec = [at[0] + side, at[1] + side * toNumber(slope)];
	return {
		kind: 'tangent',
		point: at,
		slope: toNumber(slope),
		color: 'ochre',
		lineStyle: 'solid',
		weight: WEIGHTS.tangent,
		// Above-left or below-right of a rising line, above-right of a falling or flat one, so the word clears the line.
		label: label('tangent', labelAt, toNumber(slope) > 0 ? (toLeft ? 'nw' : 'se') : 'ne', onLine(state, at, toNumber(slope), [0.5, 1.5, -0.5, -1, -1.5].map((offset) => side * offset))),
	};
}

const pointOnCurve = (state: CurveState): CurvePoint => {
	const x = pointOf(state);
	return { x, y: evaluate(curveFor(state), x) };
};

/** The line s·x through the corner, labeled below it on the side where it stays inside the view. */
function cornerLineMark(state: CurveState): Mark {
	const s = lineSlopeOf(state);
	const value = toNumber(s);
	const labelX = value >= 0 ? 1.6 : -1.6;
	return {
		kind: 'corner-line',
		slope: value,
		color: 'ochre',
		lineStyle: 'solid',
		weight: WEIGHTS.cornerLine,
		label: label(
			`slope ${numberText(s)} line`,
			[labelX, labelX * value],
			value >= 0 ? 'se' : 'sw',
			onLine(state, [0, 0], value, [1.2, 2, 0.8, -1.2, -1.6, -2].map((x) => Math.sign(labelX) * x)),
		),
	};
}

function pointMark(state: CurveState): Mark {
	const point = pointOnCurve(state);
	const start = asVec(point);
	const text = state.stage === 'slide' ? 'you' : `(${numberText(point.x)}, ${numberText(point.y)})`;
	return { kind: 'point', at: start, movable: !covered(state), color: 'ink', lineStyle: 'solid', weight: WEIGHTS.dot, label: label(text, start, 'w') };
}

function axisNameMarks(state: CurveState): Mark[] {
	const curveView = viewOf(state.preset);
	if (!curveView.axisNames || state.stage === 'slide') return [];
	const right = toNumber(curveView.view.x[1]);
	const top = toNumber(curveView.view.y[1]);
	return [
		{ kind: 'axis-name', at: [right, 0], color: 'ink', lineStyle: 'solid', weight: WEIGHTS.dot, label: label(curveView.axisNames.x, [right, 0], 'n') },
		{ kind: 'axis-name', at: [0, top], color: 'ink', lineStyle: 'solid', weight: WEIGHTS.dot, label: label(curveView.axisNames.y, [0, top], 'e') },
	];
}

/**
 * Everything the plane draws, bottom to top: the curve, the rise and run legs, the ruler and its end, the tangent or
 * the corner line, then the point on top. Exactly one mark is ochre.
 */
export function planeMarks(state: CurveState): readonly Mark[] {
	const ochre = ochreElement(state);
	const slope = slopeAt(curveFor(state), pointOf(state));
	const marks: Mark[] = [...axisNameMarks(state), ...curveMarks(state), ...rulerMarks(state, ochre)];
	if (drawsTangent(state) && slope.kind === 'exact') marks.push(tangentMark(state, slope.value));
	if (state.linesOn) marks.push(cornerLineMark(state));
	marks.push(pointMark(state));
	return marks;
}

/**
 * The slope strip under the plane in the Slope curve stage: f′ piece by piece in ink, open dots where it jumps (no
 * value is drawn at a corner), and an ink dot at (a, f′(a)) where the slope exists.
 */
export function stripMarks(state: CurveState): readonly Mark[] {
	if (state.stage !== 'slope-curve' || covered(state)) return [];
	const f = curveFor(state);
	const view = viewOf(state.preset).view;
	const left = toNumber(view.x[0]);
	const right = toNumber(view.x[1]);
	const marks: Mark[] = f.pieces.map((piece) => ({
		kind: 'curve' as const,
		coefficients: derivativeCoefficients(piece.coefficients),
		domain: pieceDomain(piece, left, right),
		color: 'ink' as const,
		lineStyle: 'solid' as const,
		weight: WEIGHTS.curve,
	}));
	for (const piece of f.pieces.slice(1)) {
		const at = piece.from as Fraction;
		const slope = slopeAt(f, at);
		if (slope.kind !== 'corner') continue;
		for (const value of [slope.left, slope.right]) {
			marks.push({ kind: 'open-dot', at: [toNumber(at), toNumber(value)], fill: 'board', color: 'ink', lineStyle: 'solid', weight: WEIGHTS.openDot });
		}
	}
	const here = slopeAt(f, pointOf(state));
	if (here.kind === 'exact') {
		marks.push({ kind: 'value-dot', at: [toNumber(pointOf(state)), toNumber(here.value)], color: 'ink', lineStyle: 'solid', weight: WEIGHTS.dot });
	}
	const { strip } = viewOf(state.preset);
	for (const value of strip.labels.filter((entry) => entry !== 0)) {
		const side: Attach = strip.leftNumbers.includes(value) ? 'w' : 'e';
		const number: MarkLabel = { text: axisNumber(value), at: [0, value], attach: side, color: 'axis', alsoAt: [] };
		marks.push({ kind: 'axis-number', at: [0, value], color: 'axis', lineStyle: 'solid', weight: WEIGHTS.dot, label: number });
	}
	const top = viewOf(state.preset).strip.y[1];
	// "slope" hangs below and right of the strip's top-left corner, so it sits inside the strip.
	marks.push({ kind: 'axis-name', at: [left, top], color: 'ink', lineStyle: 'solid', weight: WEIGHTS.dot, label: label('slope', [left, top], 'se') });
	return marks;
}
