/**
 * Where the plane's labels are drawn, at the plane's measured size. On span-reach and span-shape the plane carries up
 * to four arrows, the flag, the span line and both axes' numbers, so each label tries a fixed list of spots beside
 * what it names and takes the first whose box (the labelHalfSize estimate, after fitLabel) clears every other label,
 * every arrow, ring and dot, the span line and the axis numbers (decision 0014). Other setups draw planeLabels as
 * fitted, unchanged. Pure geometry: VectorPlane draws the result and check:boards sweeps it.
 */
import {
	VIEW_LIMIT,
	VIEW_PADDING,
	add,
	fitLabel,
	fittedLabelSpan,
	isZero,
	labelHalfSize,
	labelAway,
	labelReach,
	lengthSquared,
	numberText,
	scale,
	subtract,
	type FittedLabel,
	type Vec2,
} from './model.ts';
import { combinePieces, planeLabels, spanLine, sumDot, type PlaneLabel } from './describe.ts';
import { handleIds, requireFlag, setupOf, type VectorState } from './state.ts';

/** Stroke widths in pixels. The one ochre element is heavier, so it stands out by weight as well as hue. */
export const ARROW_WEIGHT = 2.5;
export const OCHRE_WEIGHT = 3;
/** a and b on span-reach: the muted references the scaled arrows are copied from. */
export const MUTED_WEIGHT = 1.5;
/** The span line on span-reach, muted and dotted. On span-shape it is the ochre element, at OCHRE_WEIGHT. */
export const SPAN_LINE_WEIGHT = 2;
/** Ring radii in grid units: a zero vector, the add guess, and the flag and origin ring (the guess ring's size). */
export const ZERO_RING_RADIUS = 0.2;
export const GUESS_RING_RADIUS = 0.32;
export const TARGET_RING_RADIUS = GUESS_RING_RADIUS;
/** The small ink dot at c a + d b, which marks the sum even when d b is cut at the edge. */
export const SUM_DOT_RADIUS = 0.12;

/** Mafs' arrowhead is an 8 by 8 marker in stroke widths, so it grows with the arrow's weight. */
const ARROWHEAD_LENGTH_STROKES = 8;
const ARROWHEAD_HALF_WIDTH_STROKES = 4;
/** Mafs' handle dot radius, in pixels, plus room for its hover ring. */
const HANDLE_RADIUS_PX = 8;
/**
 * The axis numbers' boxes as measured in the browser (2026-11-26): Mafs' axis text takes the board's 18px font, each
 * character about 11.4px wide and the box 24px tall. An x-axis number's box starts 1.4px below the axis, a y-axis
 * number's 5px right of it, each centered on its number.
 */
const AXIS_NUMBER_CHAR_PX = 11.4;
const AXIS_NUMBER_HEIGHT_PX = 24;
const X_NUMBER_DROP_PX = 1.4;
const Y_NUMBER_INSET_PX = 5;
/** Air kept around each axis number, in pixels. */
const NUMBER_AIR_PX = 1;
/** Air kept between a label's box and a line, beyond the line's half width, in pixels. */
const LINE_CLEARANCE_PX = 2;
/** Roomier gaps tried after the tight one, in grid units. */
const LOOSE_GAPS = [0.35, 0.7] as const;
/** Where along an arrow a label may sit, as a share of its length: the middle first. */
const ARROW_SPOTS = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9] as const;
/** Where along the span line its label may sit, as a share of one half: 0.8 first, as planeLabels puts it. */
const SPAN_SPOTS = [0.8, 0.6, 0.4, 0.9] as const;
/** Directions tried around a ring (a zero vector or the flag): up, down, left, right, then the diagonals. */
const RING_DIRECTIONS: readonly Vec2[] = [
	[0, 1],
	[0, -1],
	[-1, 0],
	[1, 0],
	[-1, 1],
	[1, 1],
	[-1, -1],
	[1, -1],
];

/** An axis-aligned box in grid units. */
export interface LabelBox {
	left: number;
	right: number;
	bottom: number;
	top: number;
}

/** Something drawn on the plane that a label must not cover: a convex outline, or a disk. */
export type Obstacle = { id: string; kind: 'polygon'; points: readonly Vec2[]; bounds: LabelBox; normals: readonly Vec2[] } | { id: string; kind: 'disk'; center: Vec2; radius: number };

/** A convex outline with its bounding box and edge normals worked out once, for the separating-axis test. */
function polygon(id: string, points: readonly Vec2[]): Obstacle {
	const xs = points.map((point) => point[0]);
	const ys = points.map((point) => point[1]);
	const normals = points.map((point, index): Vec2 => {
		const edge = subtract(points[(index + 1) % points.length], point);
		return [-edge[1], edge[0]];
	});
	return { id, kind: 'polygon', points, bounds: { left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) }, normals };
}

/** A label as VectorPlane draws it. */
export interface PlacedLabel extends FittedLabel {
	id: string;
	text: string;
}

const ORIGIN: Vec2 = [0, 0];
const length = (v: Vec2) => Math.sqrt(lengthSquared(v));

/** Grid units per pixel on a square plane `planeSize` pixels wide. */
const unitsPerPixel = (planeSize: number) => (2 * (VIEW_LIMIT + VIEW_PADDING)) / planeSize;

/** The box a fitted label covers, in grid units. */
export function fittedBox(label: FittedLabel, text: string, planeSize: number): LabelBox {
	const [left, right] = fittedLabelSpan(label, text, planeSize);
	const [, halfHeight] = labelHalfSize(text, planeSize);
	return { left, right, bottom: label.at[1] - halfHeight, top: label.at[1] + halfHeight };
}

const boxCorners = (box: LabelBox): Vec2[] => [
	[box.left, box.bottom],
	[box.right, box.bottom],
	[box.right, box.top],
	[box.left, box.top],
];

export const boxesOverlap = (one: LabelBox, two: LabelBox): boolean => one.left < two.right && two.left < one.right && one.bottom < two.top && two.bottom < one.top;

/** The lowest and highest of `points` projected on `axis`. */
function projectionRange(points: readonly Vec2[], axis: Vec2): Vec2 {
	let low = Infinity;
	let high = -Infinity;
	for (const point of points) {
		const value = axis[0] * point[0] + axis[1] * point[1];
		if (value < low) low = value;
		if (value > high) high = value;
	}
	return [low, high];
}

/** Separating-axis test: a convex outline and a box overlap unless some axis (the box's or an edge normal) parts them. */
function polygonHitsBox(obstacle: Extract<Obstacle, { kind: 'polygon' }>, box: LabelBox): boolean {
	if (!boxesOverlap(obstacle.bounds, box)) return false;
	const corners = boxCorners(box);
	for (const normal of obstacle.normals) {
		const [ownLow, ownHigh] = projectionRange(obstacle.points, normal);
		const [otherLow, otherHigh] = projectionRange(corners, normal);
		if (ownHigh <= otherLow || otherHigh <= ownLow) return false;
	}
	return true;
}

function diskHitsBox(center: Vec2, radius: number, box: LabelBox): boolean {
	const nearest: Vec2 = [Math.min(Math.max(center[0], box.left), box.right), Math.min(Math.max(center[1], box.bottom), box.top)];
	return lengthSquared(subtract(center, nearest)) < radius * radius;
}

export const obstacleHitsBox = (obstacle: Obstacle, box: LabelBox): boolean =>
	obstacle.kind === 'disk' ? diskHitsBox(obstacle.center, obstacle.radius, box) : polygonHitsBox(obstacle, box);

/** A line `weightPx` wide as a rectangle, grown by the clearance on every side. Nothing for a line of no length. */
function lineObstacle(id: string, from: Vec2, to: Vec2, weightPx: number, planeSize: number): Obstacle[] {
	const direction = subtract(to, from);
	const size = length(direction);
	if (size === 0) return [];
	const reach = (weightPx / 2 + LINE_CLEARANCE_PX) * unitsPerPixel(planeSize);
	const along = scale(reach / size, direction);
	const across: Vec2 = [-along[1], along[0]];
	const start = subtract(from, along);
	const end = add(to, along);
	return [polygon(id, [add(start, across), add(end, across), subtract(end, across), subtract(start, across)])];
}

/** The arrowhead Mafs draws at `tip`, as a triangle grown by the clearance. */
function headObstacle(id: string, from: Vec2, tip: Vec2, weightPx: number, planeSize: number): Obstacle[] {
	const direction = subtract(tip, from);
	const size = length(direction);
	if (size === 0) return [];
	const pixel = unitsPerPixel(planeSize);
	const unit = scale(1 / size, direction);
	const normal: Vec2 = [-unit[1], unit[0]];
	const clearance = LINE_CLEARANCE_PX * pixel;
	const front = add(tip, scale(clearance, unit));
	const back = subtract(tip, scale((ARROWHEAD_LENGTH_STROKES * weightPx + clearance) * pixel, unit));
	const half = (ARROWHEAD_HALF_WIDTH_STROKES * weightPx + clearance) * pixel;
	return [polygon(id, [front, add(back, scale(half, normal)), subtract(back, scale(half, normal))])];
}

const disk = (id: string, center: Vec2, radius: number, weightPx: number, planeSize: number): Obstacle => ({
	id,
	kind: 'disk',
	center,
	radius: radius + (weightPx / 2 + LINE_CLEARANCE_PX) * unitsPerPixel(planeSize),
});

/** An arrow from the origin, or the ring a zero vector is drawn as. */
function arrowObstacles(id: string, tail: Vec2, tip: Vec2, weightPx: number, planeSize: number): Obstacle[] {
	if (isZero(subtract(tip, tail))) return [disk(id, tail, ZERO_RING_RADIUS, 2, planeSize)];
	return [...lineObstacle(id, tail, tip, weightPx, planeSize), ...headObstacle(id, tail, tip, weightPx, planeSize)];
}

/** Every whole number but 0, the ones Mafs writes on each axis. */
const AXIS_NUMBERS = Array.from({ length: 2 * VIEW_LIMIT + 1 }, (_, index) => index - VIEW_LIMIT)
	.filter((n) => n !== 0)
	.map((n) => ({ n, text: numberText(n) }));

/** Each axis number's box: below the x-axis and centered on its x, right of the y-axis and centered on its y. */
export function axisNumberBoxes(planeSize: number): LabelBox[] {
	const pixel = unitsPerPixel(planeSize);
	// Each box grows by a pixel on every side, so a label never sits flush against a number.
	const air = NUMBER_AIR_PX * pixel;
	const height = AXIS_NUMBER_HEIGHT_PX * pixel;
	const top = -X_NUMBER_DROP_PX * pixel;
	const inset = Y_NUMBER_INSET_PX * pixel;
	return AXIS_NUMBERS.flatMap(({ n, text }) => {
		const width = Array.from(text).length * AXIS_NUMBER_CHAR_PX * pixel;
		return [
			{ left: n - width / 2 - air, right: n + width / 2 + air, top: top + air, bottom: top - height - air },
			{ left: inset - air, right: inset + width + air, bottom: n - height / 2 - air, top: n + height / 2 + air },
		];
	});
}

/**
 * The rows the axis numbers take, kept whole end to end, because a label between two numbers reads as one of them:
 * the x-axis numbers' row and the y-axis numbers' column.
 */
export function axisNumberRows(planeSize: number): LabelBox[] {
	const boxes = axisNumberBoxes(planeSize);
	const edge = VIEW_LIMIT + VIEW_PADDING;
	const xRow = boxes.filter((_, index) => index % 2 === 0);
	const yColumn = boxes.filter((_, index) => index % 2 === 1);
	return [
		{ left: -edge, right: edge, top: Math.max(...xRow.map((box) => box.top)), bottom: Math.min(...xRow.map((box) => box.bottom)) },
		{ left: Math.min(...yColumn.map((box) => box.left)), right: Math.max(...yColumn.map((box) => box.right)), bottom: -edge, top: edge },
	];
}

/** Everything span-reach or span-shape draws, as VectorPlane's CombineScene and SpanScene draw it. */
export function planeObstacles(state: VectorState, planeSize: number): Obstacle[] {
	const kind = setupOf(state).kind;
	const obstacles: Obstacle[] = [];
	const line = spanLine(state);
	if (line) obstacles.push(...lineObstacle('span', line[0], line[1], kind === 'combine' ? SPAN_LINE_WEIGHT : OCHRE_WEIGHT, planeSize));
	if (kind === 'combine') {
		obstacles.push(...arrowObstacles('a', ORIGIN, state.a, MUTED_WEIGHT, planeSize), ...arrowObstacles('b', ORIGIN, state.b, MUTED_WEIGHT, planeSize));
		for (const piece of combinePieces(state)) {
			obstacles.push(...lineObstacle(piece.id, piece.from, piece.to, ARROW_WEIGHT, planeSize));
			if (piece.head) obstacles.push(...headObstacle(piece.id, piece.from, piece.to, ARROW_WEIGHT, planeSize));
		}
		const dot = sumDot(state);
		if (dot) obstacles.push(disk('sum', dot, SUM_DOT_RADIUS, 1, planeSize));
		obstacles.push(disk('flag', requireFlag(setupOf(state)).target, TARGET_RING_RADIUS, OCHRE_WEIGHT, planeSize));
	} else {
		if (state.checked && isZero(state.a) && isZero(state.b)) obstacles.push(disk('origin', ORIGIN, TARGET_RING_RADIUS, OCHRE_WEIGHT, planeSize));
		obstacles.push(...arrowObstacles('a', ORIGIN, state.a, ARROW_WEIGHT, planeSize), ...arrowObstacles('b', ORIGIN, state.b, ARROW_WEIGHT, planeSize));
	}
	const handleRadius = HANDLE_RADIUS_PX * unitsPerPixel(planeSize);
	for (const id of handleIds(state)) if (id === 'a' || id === 'b') obstacles.push({ id: `handle ${id}`, kind: 'disk', center: state[id], radius: handleRadius });
	return obstacles;
}

interface Spot {
	at: Vec2;
	away: Vec2 | null;
}

/** How far a label's center must sit from a line, along `normal`, for its box to clear the line. */
function clearGap(text: string, normal: Vec2, weightPx: number, planeSize: number): number {
	const [halfWidth, halfHeight] = labelHalfSize(text, planeSize);
	return Math.abs(normal[0]) * halfWidth + Math.abs(normal[1]) * halfHeight + (weightPx / 2 + LINE_CLEARANCE_PX) * unitsPerPixel(planeSize);
}

/** The gaps a label tries, nearest first: just clear of the line, then a little and a lot roomier (grid units). */
const GAP_STEPS = [0, ...LOOSE_GAPS] as const;

/**
 * Spots beside a line from `tail` to `tip`, nearest first. At each gap step: beside the line at each share along it,
 * on the label's own side and then the other, then just past the tip (straight on, or shifted to either side) when
 * `tipDrawn`. A line cut at the board's edge has no tip on the board, so nothing past it names the line.
 */
function lineSpots(text: string, tail: Vec2, tip: Vec2, side: 1 | -1, shares: readonly number[], weightPx: number, planeSize: number, tipDrawn: boolean): Spot[] {
	const sides = ([side, side === 1 ? -1 : 1] as const).map((sideTried) => {
		const away = labelAway(tail, tip, sideTried);
		return { away, gap: clearGap(text, away, weightPx, planeSize) };
	});
	const direction = subtract(tip, tail);
	const onward = scale(1 / length(direction), direction);
	const onwardGap = clearGap(text, onward, weightPx, planeSize);
	const spots: { tier: number; spot: Spot }[] = [];
	GAP_STEPS.forEach((extra, tier) => {
		for (const share of shares) {
			const middle = add(tail, scale(share, direction));
			for (const { away, gap } of sides) spots.push({ tier, spot: { at: add(middle, scale(gap + extra, away)), away } });
		}
		if (!tipDrawn) return;
		const past = add(tip, scale(onwardGap + extra, onward));
		spots.push({ tier, spot: { at: past, away: null } });
		GAP_STEPS.forEach((sideExtra, sideTier) => {
			for (const { away, gap } of sides) spots.push({ tier: Math.max(tier, sideTier), spot: { at: add(past, scale(gap + sideExtra, away)), away: null } });
		});
	});
	return spots.sort((one, two) => one.tier - two.tier).map(({ spot }) => spot);
}

/**
 * A ring has no arrow to sit beside, so its label may also go one step farther out than an arrow's, past the axis
 * numbers' row when the ring is at the origin.
 */
const RING_GAPS = [0, ...LOOSE_GAPS, 1.05] as const;

/**
 * Spots around a ring of `radius` at `center`, nearest first: just clear of it in each direction, then farther out.
 * Moving out goes sideways for a spot left or right of the ring and up or down for every other, so a corner spot keeps
 * its box's near edge at the ring's side.
 */
function ringSpots(text: string, center: Vec2, radius: number, planeSize: number): Spot[] {
	const [halfWidth, halfHeight] = labelHalfSize(text, planeSize);
	const clearance = (OCHRE_WEIGHT / 2 + LINE_CLEARANCE_PX) * unitsPerPixel(planeSize);
	return RING_GAPS.flatMap((extra) =>
		RING_DIRECTIONS.map((direction) => ({
			at: add(center, [
				direction[0] * (radius + halfWidth + clearance + (direction[1] === 0 ? extra : 0)),
				direction[1] * (radius + halfHeight + clearance + extra),
			]),
			away: null,
		})),
	);
}

/** The side of the line from `tail` to `tip` that `away` points to: +1 left, −1 right. */
const sideOf = (tail: Vec2, tip: Vec2, away: Vec2 | null): 1 | -1 => {
	if (!away) return 1;
	const direction = subtract(tip, tail);
	return direction[0] * away[1] - direction[1] * away[0] >= 0 ? 1 : -1;
};

/** What a label names, as a segment (a ring or the flag is a segment of no length), and the spots it may take. */
interface LabelSpots {
	names: readonly [Vec2, Vec2];
	spots: Spot[];
}

/** The spots one label may take, planeLabels' own spot first, so a plane with room draws what it always drew. */
function spotsFor(state: VectorState, label: PlaneLabel, planeSize: number): LabelSpots {
	const own: Spot = { at: label.at, away: label.away };
	const kind = setupOf(state).kind;
	const weight = kind === 'combine' ? MUTED_WEIGHT : ARROW_WEIGHT;
	switch (label.id) {
		case 'flag': {
			const target = requireFlag(setupOf(state)).target;
			return { names: [target, target], spots: [own, ...ringSpots(label.text, target, TARGET_RING_RADIUS, planeSize)] };
		}
		case 'zero':
			return { names: [ORIGIN, ORIGIN], spots: [own, ...ringSpots(label.text, ORIGIN, ZERO_RING_RADIUS, planeSize)] };
		case 'span': {
			const line = spanLine(state);
			if (!line) throw new Error('VectorBoard2D: a span label with no span line.');
			const lineWeight = kind === 'combine' ? SPAN_LINE_WEIGHT : OCHRE_WEIGHT;
			const halves = [line[1], line[0]].flatMap((end) => lineSpots(label.text, ORIGIN, end, -1, SPAN_SPOTS, lineWeight, planeSize, false));
			return { names: line, spots: [own, ...halves] };
		}
		case 'a':
		case 'b': {
			const tip = state[label.id];
			if (isZero(tip)) return { names: [ORIGIN, ORIGIN], spots: [own, ...ringSpots(label.text, ORIGIN, ZERO_RING_RADIUS, planeSize)] };
			return { names: [ORIGIN, tip], spots: [own, ...lineSpots(label.text, ORIGIN, tip, sideOf(ORIGIN, tip, label.away), ARROW_SPOTS, weight, planeSize, true)] };
		}
		case 'scaled':
		case 'scaledB': {
			const piece = combinePieces(state).find((candidate) => candidate.id === label.id);
			if (!piece) throw new Error(`VectorBoard2D: a "${label.text}" label with no arrow drawn.`);
			const spots = lineSpots(label.text, piece.from, piece.to, sideOf(piece.from, piece.to, label.away), ARROW_SPOTS, ARROW_WEIGHT, planeSize, piece.head);
			return { names: [piece.from, piece.to], spots: [own, ...spots] };
		}
		default:
			throw new Error(`VectorBoard2D: no spots for the "${label.id}" label on ${state.setupId}.`);
	}
}

/**
 * The arrows the plane names (a, b, c a, d b) as drawn, by label id. Whenever some clear layout allows it, no other
 * arrow is clearly nearer an arrow's label than its own, so the label doesn't read as the other arrow's name.
 */
export function arrowSegments(state: VectorState): { id: string; from: Vec2; to: Vec2 }[] {
	const drawn = [
		{ id: 'a', from: ORIGIN, to: state.a },
		{ id: 'b', from: ORIGIN, to: state.b },
		...combinePieces(state).map((piece) => ({ id: piece.id, from: piece.from, to: piece.to })),
	];
	return drawn.filter((arrow) => !isZero(subtract(arrow.to, arrow.from)));
}

/**
 * How much nearer another arrow may be before a label reads as its name, in grid units. Arrows share the origin and
 * often overlap (c a lies on a), so a label near them is near several at once; only a clearly nearer one counts.
 */
export const NEARNESS_MARGIN = 0.3;

/** A label's box stays at most this far from what it names, in grid units, so it still reads as that thing's name. */
export const NAMING_REACH = 1.5;

const distanceToBox = (point: Vec2, box: LabelBox): number =>
	Math.hypot(Math.max(box.left - point[0], 0, point[0] - box.right), Math.max(box.bottom - point[1], 0, point[1] - box.top));

/** True when the segment from `from` along `direction` enters the box (Liang–Barsky clipping). */
function segmentCrossesBox(from: Vec2, direction: Vec2, box: LabelBox): boolean {
	let enter = 0;
	let leave = 1;
	const edges: readonly (readonly [number, number])[] = [
		[-direction[0], from[0] - box.left],
		[direction[0], box.right - from[0]],
		[-direction[1], from[1] - box.bottom],
		[direction[1], box.top - from[1]],
	];
	for (const [toward, room] of edges) {
		if (toward === 0) {
			if (room < 0) return false;
			continue;
		}
		const share = room / toward;
		if (toward < 0) enter = Math.max(enter, share);
		else leave = Math.min(leave, share);
		if (enter > leave) return false;
	}
	return true;
}

/** The shortest distance from a segment to a box, in grid units: 0 when they touch. */
export function segmentToBox(from: Vec2, to: Vec2, box: LabelBox): number {
	const direction = subtract(to, from);
	const size = lengthSquared(direction);
	if (size === 0) return distanceToBox(from, box);
	if (segmentCrossesBox(from, direction, box)) return 0;
	const toSegment = (point: Vec2) => {
		const share = Math.min(Math.max(((point[0] - from[0]) * direction[0] + (point[1] - from[1]) * direction[1]) / size, 0), 1);
		return length(subtract(point, add(from, scale(share, direction))));
	};
	return Math.min(distanceToBox(from, box), distanceToBox(to, box), ...boxCorners(box).map(toSegment));
}

/** The flag's label goes first, so it keeps its pinned spot; the rest follow planeLabels' order. */
const placementOrder = (labels: readonly PlaneLabel[]) => [...labels.filter((label) => label.id === 'flag'), ...labels.filter((label) => label.id !== 'flag')];

/** Room kept between two labels, in pixels, so two names side by side never read as one ("a c a"). */
const LABEL_AIR_PX = 8;

const grow = (box: LabelBox, by: number): LabelBox => ({ left: box.left - by, right: box.right + by, bottom: box.bottom - by, top: box.top + by });

/** Covering an arrow, ring or dot costs more than covering an axis number, when nothing is clear. */
const DRAWN_HIT_COST = 3;

/** How many partial layouts the search may try before it settles for the fewest overlaps. */
const SEARCH_BUDGET = 4000;

interface Option {
	fitted: FittedLabel;
	box: LabelBox;
	/** The box grown by half of LABEL_AIR_PX on every side, for keeping two labels apart. */
	spaced: LabelBox;
	/** False when another arrow is clearly nearer the box than the label's own (NEARNESS_MARGIN); true for other labels. */
	nearest: boolean;
	/** What the box covers, weighted: arrows, rings and dots (DRAWN_HIT_COST each), axis-number rows and numbers; infinite past NAMING_REACH. */
	hits: number;
}

/** One label's options in spot order, each worked out on first use: most labels take their first spot. */
type LazyOptions = readonly (() => Option)[];

const lazily = (make: () => Option): (() => Option) => {
	let made: Option | null = null;
	return () => (made ??= make());
};

/**
 * The first layout, in spot order, where no label covers another label or anything drawn (a depth-first search over
 * each label's clear spots), or null when there is none within the budget or some label has no clear spot at all.
 */
function clearLayout(options: readonly LazyOptions[], boxOf: (option: Option) => LabelBox, nearestOnly: boolean): Option[] | null {
	const usable = (option: Option) => option.hits === 0 && (option.nearest || !nearestOnly);
	if (options.some((labelOptions) => !labelOptions.some((option) => usable(option())))) return null;
	let budget = SEARCH_BUDGET;
	const search = (index: number, chosen: readonly Option[]): Option[] | null => {
		if (index === options.length) return [...chosen];
		for (const make of options[index]) {
			const option = make();
			if (!usable(option) || chosen.some((other) => boxesOverlap(boxOf(other), boxOf(option)))) continue;
			if (--budget < 0) return null;
			const found = search(index + 1, [...chosen, option]);
			if (found) return found;
		}
		return null;
	};
	return search(0, []);
}

/** One label at a time, each on the spot with the fewest overlaps so far (the earliest on a tie). */
function leastCrowdedLayout(options: readonly LazyOptions[]): Option[] {
	const chosen: Option[] = [];
	for (const labelOptions of options) {
		const score = (option: Option) => option.hits + DRAWN_HIT_COST * chosen.filter((other) => boxesOverlap(other.box, option.box)).length;
		const best = labelOptions.map((make) => make()).reduce((kept, option) => (score(option) < score(kept) ? option : kept));
		chosen.push(best);
	}
	return chosen;
}

/**
 * A spot that names no side of an arrow (around a ring, or past a tip) is moved straight inward until its box is
 * inside the plane, and stays centered: fitLabel would grow it toward the center from the spot instead.
 */
function centeredInside(at: Vec2, text: string, planeSize: number): FittedLabel {
	const [halfWidth, halfHeight] = labelHalfSize(text, planeSize);
	const reach = labelReach(planeSize);
	if (2 * halfWidth > 2 * reach) return fitLabel(at, null, text, planeSize);
	const keep = (value: number, half: number) => Math.min(Math.max(value, -reach + half), reach - half);
	return { at: [keep(at[0], halfWidth), keep(at[1], halfHeight)], attach: 'center' };
}

/** span-reach and span-shape: every label on a clear spot when one exists, else on its least crowded spot. */
function placeCrowded(state: VectorState, planeSize: number): PlacedLabel[] {
	const obstacles = planeObstacles(state, planeSize);
	const rows = axisNumberRows(planeSize);
	// Counted on top of their rows, so a label that can't clear a row at least misses the numbers themselves.
	const numbers = axisNumberBoxes(planeSize);
	const labels = placementOrder(planeLabels(state));
	const arrows = arrowSegments(state);
	const options = labels.map((label): LazyOptions => {
		const { names, spots } = spotsFor(state, label, planeSize);
		const rivals = arrows.filter((arrow) => arrow.id !== label.id);
		const ownArrow = arrows.some((arrow) => arrow.id === label.id);
		if (spots.length === 0) throw new Error(`VectorBoard2D: the "${label.text}" label has no spot to try.`);
		return spots.map((spot) => lazily((): Option => {
			const fitted = spot.away === null ? centeredInside(spot.at, label.text, planeSize) : fitLabel(spot.at, spot.away, label.text, planeSize);
			const box = fittedBox(fitted, label.text, planeSize);
			// A spot too far from what it names is never taken, not even when nothing is clear.
			const spaced = grow(box, (LABEL_AIR_PX / 2) * unitsPerPixel(planeSize));
			const reach = segmentToBox(names[0], names[1], box);
			const nearest = !ownArrow || rivals.every((rival) => segmentToBox(rival.from, rival.to, box) + NEARNESS_MARGIN >= reach);
			if (reach > NAMING_REACH) return { fitted, box, spaced, nearest, hits: Number.POSITIVE_INFINITY };
			const drawn = obstacles.filter((obstacle) => obstacleHitsBox(obstacle, box)).length;
			const hits = DRAWN_HIT_COST * drawn + rows.filter((row) => boxesOverlap(row, box)).length + numbers.filter((number) => boxesOverlap(number, box)).length;
			return { fitted, box, spaced, nearest, hits };
		}));
	});
	// Clear layouts first, preferring labels nearest their own arrows, then air between labels; else the least crowded.
	const spaced = (option: Option) => option.spaced;
	const plain = (option: Option) => option.box;
	const layout =
		clearLayout(options, spaced, true) ??
		clearLayout(options, plain, true) ??
		clearLayout(options, spaced, false) ??
		clearLayout(options, plain, false) ??
		leastCrowdedLayout(options);
	return labels.map((label, index) => ({ id: label.id, text: label.text, ...layout[index].fitted }));
}

/** Every label the plane draws at this size, fitted inside the plane (fitLabel); span setups also keep them apart. */
export function placedLabels(state: VectorState, planeSize: number): PlacedLabel[] {
	const kind = setupOf(state).kind;
	if (kind === 'combine' || kind === 'span-choice') return placeCrowded(state, planeSize);
	return planeLabels(state).map((label) => ({ id: label.id, text: label.text, ...fitLabel(label.at, label.away, label.text, planeSize) }));
}
