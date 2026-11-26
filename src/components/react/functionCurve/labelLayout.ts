// Where FunctionCurve's plane labels go at a given plane size: each label tries its sides in order and takes the first
// spot whose box clears the plane's edges, the axis numbers, the dots, every drawn line and the labels placed before
// it. Pure, so scripts/check-boards.mjs places every label of every reachable state on the plane sizes phones and
// desktops draw. Design and reasoning: decision 0020.
import { pieceCurve } from './functions.ts';
import { LABEL_DISTANCE, axisNumber, fitLabel, planeScale, textBox, viewNumbers, type Attach, type LabelBox, type Scale, type View } from './model.ts';
import { planeMarks, type Mark, type MarkColor, type Vec } from './marks.ts';
import { viewOf, type CurveView } from './setups.ts';
import type { CurveState } from './state.ts';

/** Every side a label can take, clockwise from the right. */
const SIDES: readonly Attach[] = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
/** Extra pixels tried beyond a label's first distance, nearest first, when every side is blocked. */
const FARTHER_STEPS = [0, 10, 20] as const;

/**
 * Mafs' axis numbers: 18px text (the board's font size), measured in Chromium on 2026-11-26 with their 3px halo: about
 * 11.5px a character, an x-axis number's ink from 4.9px to 21.9px below the axis and centered on its value, a y-axis
 * number's from 5px right of the axis and 7.1px below its value to 9.9px above.
 */
const AXIS_NUMBER_CHARACTER_WIDTH = 11.5;
const X_NUMBER_EXTENT = [-21.9, -4.9] as const;
const Y_NUMBER_OFFSET = 5;
const Y_NUMBER_EXTENT = [-7.1, 9.9] as const;
/** A Mafs Point's radius; a MovablePoint's translucent ring is wider. */
const DOT_RADIUS = 6;
const HANDLE_RING_RADIUS = 15;
/** Room a label keeps from a dot, past its radius. */
const DOT_CLEARANCE = 3;
/** Room a label's box (its halo included) keeps from lines, numbers and other labels, in pixels. */
const LABEL_CLEARANCE = 2;
/** Samples per curve piece when testing a label against it. */
const CURVE_SAMPLES = 96;

export interface PlacedLabel {
	text: string;
	color: MarkColor;
	attach: Attach;
	/** The point given to Mafs' Text, with attachDistance 0. */
	textAt: readonly [number, number];
	box: LabelBox;
	/** What the box still touches, if no spot was clear; empty when it is placed cleanly. */
	collisions: readonly string[];
}

interface Obstacles {
	boxes: { name: string; box: LabelBox }[];
	dots: { name: string; at: Vec; radius: number }[];
	lines: { name: string; points: Vec[] }[];
}

const multiplesInside = (low: number, high: number, step: number): number[] => {
	const values: number[] = [];
	for (let value = Math.ceil(low / step) * step; value < high; value += step) {
		if (value > low && Math.abs(value) > 1e-9) values.push(value);
	}
	return values;
};

/**
 * The axis values the plane numbers: every grid line inside the view but 0. Where the axes are named, the top y
 * number gives way to the name ("loss" sits where 10 would).
 */
export function numberedValues(curveView: CurveView): { x: readonly number[]; y: readonly number[] } {
	const { x, y } = viewNumbers(curveView.view);
	const ys = multiplesInside(y[0], y[1], curveView.yLines);
	return { x: multiplesInside(x[0], x[1], curveView.xLines), y: curveView.axisNames ? ys.slice(0, -1) : ys };
}

function axisNumberBoxes(curveView: CurveView, planeSize: number): Obstacles['boxes'] {
	const scale = planeScale(curveView.view, planeSize);
	const values = numberedValues(curveView);
	const width = (value: number) => Array.from(axisNumber(value)).length * AXIS_NUMBER_CHARACTER_WIDTH;
	const xBoxes = values.x.map((value) => ({
		name: `x-axis number ${axisNumber(value)}`,
		box: { left: value - (width(value) / 2) * scale.x, right: value + (width(value) / 2) * scale.x, bottom: X_NUMBER_EXTENT[0] * scale.y, top: X_NUMBER_EXTENT[1] * scale.y },
	}));
	const yBoxes = values.y.map((value) => ({
		name: `y-axis number ${axisNumber(value)}`,
		box: { left: Y_NUMBER_OFFSET * scale.x, right: (Y_NUMBER_OFFSET + width(value)) * scale.x, bottom: value + Y_NUMBER_EXTENT[0] * scale.y, top: value + Y_NUMBER_EXTENT[1] * scale.y },
	}));
	return [...xBoxes, ...yBoxes];
}

/** A straight line through `point` with this slope, cut to the view's x range. */
const lineAcross = (view: View, point: Vec, slope: number): Vec[] => {
	const { x } = viewNumbers(view);
	return x.map((at) => [at, point[1] + slope * (at - point[0])] as Vec);
};

function markLine(mark: Mark, view: View): Vec[] | null {
	switch (mark.kind) {
		case 'curve': {
			const y = pieceCurve(mark.coefficients);
			const [from, to] = mark.domain;
			return Array.from({ length: CURVE_SAMPLES + 1 }, (_, index) => {
				const at = from + ((to - from) * index) / CURVE_SAMPLES;
				return [at, y(at)] as Vec;
			});
		}
		case 'ground':
		case 'ruler':
		case 'run-leg':
		case 'rise-leg':
			return [mark.from, mark.to];
		case 'tangent':
			return lineAcross(view, mark.point, mark.slope);
		case 'corner-line':
			return lineAcross(view, [0, 0], mark.slope);
		default:
			return null;
	}
}

function obstaclesFor(state: CurveState, marks: readonly Mark[], planeSize: number): Obstacles {
	const curveView = viewOf(state.preset);
	const lines: Obstacles['lines'] = [];
	const dots: Obstacles['dots'] = [];
	for (const mark of marks) {
		const points = markLine(mark, curveView.view);
		if (points) lines.push({ name: mark.kind, points });
		if (mark.kind === 'point' || mark.kind === 'ruler-end') {
			dots.push({ name: mark.kind, at: mark.at, radius: mark.kind === 'point' && mark.movable ? HANDLE_RING_RADIUS : DOT_RADIUS });
		}
	}
	return { boxes: state.stage === 'slide' ? [] : axisNumberBoxes(curveView, planeSize), dots, lines };
}

const grow = (box: LabelBox, byX: number, byY: number): LabelBox => ({ left: box.left - byX, right: box.right + byX, bottom: box.bottom - byY, top: box.top + byY });

const boxesOverlap = (one: LabelBox, two: LabelBox) => one.left < two.right && two.left < one.right && one.bottom < two.top && two.bottom < one.top;

/** True when the segment from `from` to `to` passes through the box (Liang–Barsky clipping). */
function segmentHitsBox(from: Vec, to: Vec, box: LabelBox): boolean {
	if (Math.max(from[0], to[0]) < box.left || Math.min(from[0], to[0]) > box.right) return false;
	if (Math.max(from[1], to[1]) < box.bottom || Math.min(from[1], to[1]) > box.top) return false;
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	let enter = 0;
	let leave = 1;
	const edges: [number, number][] = [
		[-dx, from[0] - box.left],
		[dx, box.right - from[0]],
		[-dy, from[1] - box.bottom],
		[dy, box.top - from[1]],
	];
	for (const [direction, room] of edges) {
		if (direction === 0) {
			if (room < 0) return false;
			continue;
		}
		const at = room / direction;
		if (direction < 0) enter = Math.max(enter, at);
		else leave = Math.min(leave, at);
		if (enter > leave) return false;
	}
	return true;
}

/** True when a dot of this radius (in pixels) reaches into the box; distances are measured in pixels. */
function dotHitsBox(at: Vec, radiusPixels: number, box: LabelBox, scale: Scale): boolean {
	const nearestX = Math.min(Math.max(at[0], box.left), box.right);
	const nearestY = Math.min(Math.max(at[1], box.bottom), box.top);
	return Math.hypot((nearestX - at[0]) / scale.x, (nearestY - at[1]) / scale.y) < radiusPixels;
}

/** Everything this box touches: lines, dots, axis numbers and labels already placed. */
function collisionsOf(box: LabelBox, obstacles: Obstacles, placed: readonly PlacedLabel[], scale: Scale): string[] {
	const padded = grow(box, LABEL_CLEARANCE * scale.x, LABEL_CLEARANCE * scale.y);
	const hits: string[] = [];
	for (const line of obstacles.lines) {
		if (line.points.some((point, index) => index > 0 && segmentHitsBox(line.points[index - 1], point, padded))) hits.push(line.name);
	}
	for (const dot of obstacles.dots) {
		if (dotHitsBox(dot.at, dot.radius + DOT_CLEARANCE, box, scale)) hits.push(dot.name);
	}
	for (const other of obstacles.boxes) {
		if (boxesOverlap(padded, other.box)) hits.push(other.name);
	}
	for (const other of placed) {
		if (boxesOverlap(padded, other.box)) hits.push(`label "${other.text}"`);
	}
	return hits;
}

/** The sides a label tries: its own first, then the others nearest to it, alternating clockwise and back. */
export function sidesFrom(preferred: Attach): readonly Attach[] {
	const start = SIDES.indexOf(preferred);
	const order: Attach[] = [preferred];
	for (let step = 1; step <= SIDES.length / 2; step += 1) {
		for (const side of [SIDES[(start + step) % SIDES.length], SIDES[(start - step + SIDES.length) % SIDES.length]]) {
			if (!order.includes(side)) order.push(side);
		}
	}
	return order;
}

/** A label's first distance from its anchor: a dot's labels start outside the dot (or the handle's ring). */
function firstDistance(mark: Mark): number {
	if (mark.kind !== 'point') return LABEL_DISTANCE;
	return (mark.movable ? HANDLE_RING_RADIUS : DOT_RADIUS) + DOT_CLEARANCE;
}

/**
 * The order labels claim their spots: axis names (they have one place), the point's label, the ochre line's (tangent
 * or corner line), then the legs'.
 */
const PLACING_ORDER: readonly Mark['kind'][] = ['axis-name', 'point', 'tangent', 'corner-line', 'rise-leg', 'run-leg'];

/**
 * Labels that are left out when no spot is clear: each repeats a readout (the point, the rise and run, the tangent's
 * slope, the line's slope s), so a crowded small plane drops them rather than draw them over something. The axis names
 * and "you" on the slide, which the page refers to, are never left out.
 */
const OPTIONAL_LABELS: ReadonlySet<Mark['kind']> = new Set(['tangent', 'rise-leg', 'run-leg', 'corner-line']);

const isOptional = (state: CurveState, mark: Mark) => OPTIONAL_LABELS.has(mark.kind) || (mark.kind === 'point' && state.stage !== 'slide');

/**
 * The first clear spot for a label: the nearest distance first, then its own anchor before the others along what it
 * names, then its own side first. When none is clear, the spot touching the fewest things, with what it touches.
 */
function bestSpot(mark: Mark, view: View, planeSize: number, obstacles: Obstacles, placed: readonly PlacedLabel[]): PlacedLabel {
	const scale = planeScale(view, planeSize);
	const label = mark.label!;
	const sides = mark.kind === 'axis-name' ? [label.attach] : sidesFrom(label.attach);
	const anchors = [label.at, ...label.alsoAt];
	let best: PlacedLabel | null = null;
	for (const extra of FARTHER_STEPS) {
		for (const anchor of anchors) {
			for (const attach of sides) {
				const fitted = fitLabel(view, anchor, attach, label.text, planeSize, firstDistance(mark) + extra);
				const box = textBox(scale, fitted.textAt, attach, label.text);
				const collisions = collisionsOf(box, obstacles, placed, scale);
				const spot = { text: label.text, color: label.color, attach, textAt: fitted.textAt, box, collisions };
				if (collisions.length === 0) return spot;
				if (!best || collisions.length < best.collisions.length) best = spot;
			}
		}
	}
	return best!;
}

/**
 * The plane's labels at this size, in drawing order, each on the first clear spot (bestSpot). An optional label with
 * no clear spot is left out; any other keeps its least-crowded spot and lists what it touches, which check-boards
 * forbids on every reachable state.
 */
export function planeLabels(state: CurveState, planeSize: number): readonly PlacedLabel[] {
	const view = viewOf(state.preset).view;
	const marks = planeMarks(state);
	const obstacles = obstaclesFor(state, marks, planeSize);
	const labeled = marks.filter((mark) => mark.label);
	const ordered = [...labeled].sort((one, two) => PLACING_ORDER.indexOf(one.kind) - PLACING_ORDER.indexOf(two.kind));
	const placed: PlacedLabel[] = [];
	const byMark = new Map<Mark, PlacedLabel>();
	for (const mark of ordered) {
		const spot = bestSpot(mark, view, planeSize, obstacles, placed);
		if (spot.collisions.length > 0 && isOptional(state, mark)) continue;
		placed.push(spot);
		byMark.set(mark, spot);
	}
	return labeled.flatMap((mark) => byMark.get(mark) ?? []);
}

/** The values Mafs numbers on an axis, as its label function: "" for every grid line left unnumbered. */
export function axisLabels(values: readonly number[]): (value: number) => string {
	return (value) => (values.some((numbered) => Math.abs(numbered - value) < 1e-9) ? axisNumber(value) : '');
}
