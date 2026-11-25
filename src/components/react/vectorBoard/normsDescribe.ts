// Every string of VectorBoard2D's `city-walk` setup (kind `norms`): one pin measured three ways, walking the streets
// (L1), flying straight (L2) and a chess king's moves (L∞), and the shape of every point one length from home.
// describe.ts calls these for the norms kind, so the board's own switches stay the single entry points. Plain Unicode,
// never KaTeX (decision 0007). PROVISIONAL: the vector norms page spec doesn't exist yet, so this copy is re-pinned
// when it is written. Design and reasoning: decision 0021.
import { fraction, isPerfectSquare } from '../boardMath.ts';
import { joinWords, plural } from '../boardText.ts';
import { formatNumber } from '../plotColors.ts';
import { VIEW_LIMIT, numberText, rootText, type Vec2 } from './model.ts';
import { MEASURES, ballSide, exactPoint, latticeOnBall, normParts, type BallSide, type Measure } from './norms.ts';
import type { MeasureChoice, Setup, Stage } from './setups.ts';
import type { ShapeGuess, VectorState } from './state.ts';

/** The Blocks stage (id `trips`) speaks in blocks and words; the Numbers stage (id `arrows`) in coordinates and ‖v‖. */
export const NORMS_STAGE_LABELS: Readonly<Partial<Record<Stage, string>>> = { trips: 'Blocks', arrows: 'Numbers' };

export const NORMS_LABELS = {
	shapeLegend: "Corners 4 blocks' walk from home make a",
	measureLegend: 'Shape for',
	radius: 'Length r',
	noShape: 'Pick a shape first.',
} as const;

/** Named by orientation, so a reader who means the tilted square isn't marked wrong for "Square". */
export const SHAPE_OPTIONS: readonly { value: ShapeGuess; label: string }[] = [
	{ value: 'circle', label: 'Circle' },
	{ value: 'diamond', label: 'Diamond: tips on the streets' },
	{ value: 'square', label: 'Square: sides along the streets' },
];

const SHAPE_NAMES: Readonly<Record<Measure, string>> = { l1: 'diamond', l2: 'circle', linf: 'square' };
const NORM_SYMBOLS: Readonly<Record<Measure, string>> = { l1: '‖v‖₁', l2: '‖v‖₂', linf: '‖v‖∞' };
const BLOCKS_MEASURE_LABELS: Readonly<Record<MeasureChoice, string>> = { l1: 'Walk', l2: 'Bird', linf: 'King', all: 'All three' };
const NUMBERS_MEASURE_LABELS: Readonly<Record<MeasureChoice, string>> = { l1: 'L1', l2: 'L2', linf: 'L∞', all: 'All three' };
/** The dash pattern that tells the three shapes apart when they are drawn together. */
const LINE_STYLE_WORDS: Readonly<Record<Measure, string>> = { l1: 'solid', l2: 'dashed', linf: 'dotted' };
const BLOCKS_SHAPE_OWNERS: Readonly<Record<Measure, string>> = { l1: 'the walk', l2: 'the bird', linf: 'the king' };
/** The labels drawn beside each shape on the plane. */
const BLOCKS_PLANE_NAMES: Readonly<Record<Measure, string>> = { l1: 'walk', l2: 'bird', linf: 'king' };
const NUMBERS_PLANE_NAMES: Readonly<Record<Measure, string>> = { l1: 'L1', l2: 'L2', linf: 'L∞' };
const SHAPE_GUESS_WORDS: Readonly<Record<ShapeGuess, string>> = { diamond: 'a diamond', circle: 'a circle', square: 'a square' };

const isBlocks = (state: VectorState) => state.stage === 'trips';

export function measureOptions(state: VectorState): readonly { value: MeasureChoice; label: string }[] {
	const labels = isBlocks(state) ? BLOCKS_MEASURE_LABELS : NUMBERS_MEASURE_LABELS;
	return (['l1', 'l2', 'linf', 'all'] as const).map((value) => ({ value, label: labels[value] }));
}

export const radiusDescription = (value: number) => `length r, ${numberText(value)}`;

function requireGuessBall(setup: Setup): { measure: Measure; radius: number } {
	if (!setup.guessBall) throw new Error(`VectorBoard2D: setup "${setup.id}" has no guessed ball.`);
	return setup.guessBall;
}

// ---- Numbers ----

const blocks = (n: number) => plural(n, 'block', 'blocks');
const parts = (v: Vec2) => normParts(exactPoint(v));
const wholeOf = (value: { numerator: number; denominator: number }) => {
	if (value.denominator !== 1) throw new Error('VectorBoard2D: a grid pin has whole-number lengths.');
	return value.numerator;
};
const walkOf = (v: Vec2) => wholeOf(parts(v).l1);
const kingOf = (v: Vec2) => wholeOf(parts(v).linf);
const birdSquaredOf = (v: Vec2) => wholeOf(parts(v).l2Squared);

/** "3 + 4 = 7": the two street legs and their total, as whole blocks. */
const walkSum = (v: Vec2) => `${Math.abs(v[0])} + ${Math.abs(v[1])} = ${walkOf(v)}`;

function legWords(count: number, positive: string, negative: string): string | null {
	return count === 0 ? null : `${blocks(Math.abs(count))} ${count < 0 ? negative : positive}`;
}

/** "Your pin: 3 blocks east, 4 blocks north.", "Your pin: 4 blocks east." or "Your pin is at home." */
export function pinSentence(v: Vec2): string {
	const legs = [legWords(v[0], 'east', 'west'), legWords(v[1], 'north', 'south')].filter((leg): leg is string => leg !== null);
	return legs.length === 0 ? 'Your pin is at home.' : `Your pin: ${legs.join(', ')}.`;
}

const walkingTotal = (v: Vec2, lead: string) => (walkOf(v) === 0 ? `${lead}: 0 blocks.` : `${lead}: ${walkSum(v)} ${walkOf(v) === 1 ? 'block' : 'blocks'}.`);

/** "5" or "about 2.83": the bird's distance in words, for the Blocks stage. */
function birdWords(v: Vec2): string {
	const squared = birdSquaredOf(v);
	return isPerfectSquare(squared) ? numberText(Math.sqrt(squared)) : `about ${formatNumber(Math.sqrt(squared))}`;
}

const birdBlocks = (v: Vec2) => {
	const squared = birdSquaredOf(v);
	return isPerfectSquare(squared) ? blocks(Math.sqrt(squared)) : `about ${formatNumber(Math.sqrt(squared))} blocks`;
};

function kingLine(v: Vec2): string {
	const moves = plural(kingOf(v), 'move', 'moves');
	const [x, y] = v.map(Math.abs);
	if (x === 0 && y === 0) return `A chess king: ${moves}.`;
	if (x === y) return `A chess king: ${moves}, all diagonal.`;
	return `A chess king: ${moves}, the bigger of ${x} and ${y}.`;
}

/** A factor inside a formula: negative numbers get parentheses, "(−1)²". */
const squared = (n: number) => `${n < 0 ? `(${numberText(n)})` : numberText(n)}²`;

function normLine(v: Vec2, measure: Measure): string {
	const [x, y] = v.map(numberText);
	switch (measure) {
		case 'l1':
			return `‖v‖₁ = |${x}| + |${y}| = ${walkOf(v)}.`;
		case 'l2': {
			const n = birdSquaredOf(v);
			return `‖v‖₂ = √(${squared(v[0])} + ${squared(v[1])}) = √${n} ${isPerfectSquare(n) ? `= ${Math.sqrt(n)}` : `≈ ${formatNumber(Math.sqrt(n))}`}.`;
		}
		case 'linf':
			return `‖v‖∞ = max(|${x}|, |${y}|) = ${kingOf(v)}.`;
	}
}

/** A norm's value as text: "7", "5", "√8 ≈ 2.83". */
function normValue(v: Vec2, measure: Measure): string {
	switch (measure) {
		case 'l1':
			return String(walkOf(v));
		case 'l2':
			return rootText(birdSquaredOf(v));
		case 'linf':
			return String(kingOf(v));
	}
}

// ---- Shapes and where the pin is ----

export const sideOf = (state: VectorState, measure: Measure): BallSide => ballSide(exactPoint(state.a), measure, fraction(state.radius, 1));

const SIDE_WORDS: Readonly<Record<BallSide, string>> = { inside: 'inside', on: 'on', outside: 'outside' };

/** "Your pin is outside the diamond and the circle but inside the square." Shapes keep their order, grouped by side. */
function allRelation(state: VectorState): string {
	const groups = new Map<BallSide, string[]>();
	for (const measure of MEASURES) {
		const side = sideOf(state, measure);
		groups.set(side, [...(groups.get(side) ?? []), `the ${SHAPE_NAMES[measure]}`]);
	}
	if (groups.size === 1) return `Your pin is ${SIDE_WORDS[[...groups.keys()][0]]} all three.`;
	const clauses = [...groups].map(([side, shapes]) => `${SIDE_WORDS[side]} ${joinWords(shapes)}`);
	return `Your pin is ${clauses.length === 2 ? clauses.join(' but ') : joinWords(clauses)}.`;
}

/** "Your pin is outside the diamond." for one shape, or the grouped sentence for all three. */
function pinRelation(state: VectorState): string {
	if (state.measure === 'all') return allRelation(state);
	return `Your pin is ${SIDE_WORDS[sideOf(state, state.measure)]} the ${SHAPE_NAMES[state.measure]}.`;
}

const BLOCKS_SIDE_ENDINGS: Readonly<Record<BallSide, string>> = { inside: 'Your pin is inside it.', on: 'Your pin is on it.', outside: 'Your pin is outside it.' };
const NUMBERS_SIDE_ENDINGS: Readonly<Record<BallSide, string>> = { inside: 'so it is inside.', on: 'so it is on it.', outside: 'so it is outside.' };

/** What one shape is, without "The ochre": "diamond: every corner 4 blocks from home by the shortest walk". */
function shapeWhat(state: VectorState, measure: Measure): string {
	const r = state.radius;
	if (!isBlocks(state)) return `${SHAPE_NAMES[measure]}: every point with ${NORM_SYMBOLS[measure]} = ${r}`;
	switch (measure) {
		case 'l1':
			return `diamond: every corner ${blocks(r)} from home by the shortest walk`;
		case 'l2':
			return `circle: every point exactly ${blocks(r)} from home, flying straight`;
		case 'linf':
			return `square: every corner ${plural(r, 'king move', 'king moves')} from home at the fewest`;
	}
}

function allShapesLine(state: VectorState): string {
	const r = state.radius;
	const shapes = MEASURES.map((measure) =>
		isBlocks(state)
			? `the ${SHAPE_NAMES[measure]} for ${BLOCKS_SHAPE_OWNERS[measure]} (${LINE_STYLE_WORDS[measure]})`
			: `the ${SHAPE_NAMES[measure]} ${NORM_SYMBOLS[measure]} = ${r} (${LINE_STYLE_WORDS[measure]})`,
	);
	return `The three shapes at length ${r}: ${joinWords(shapes)}. ${allRelation(state)}`;
}

/** The shape line under the readouts after Check. */
export function shapeLine(state: VectorState): string {
	if (state.measure === 'all') return allShapesLine(state);
	const measure = state.measure;
	const side = sideOf(state, measure);
	if (isBlocks(state)) return `The ochre ${shapeWhat(state, measure)}. ${BLOCKS_SIDE_ENDINGS[side]}`;
	return `The ochre ${shapeWhat(state, measure)}. Your pin has ${NORM_SYMBOLS[measure]} = ${normValue(state.a, measure)}, ${NUMBERS_SIDE_ENDINGS[side]}`;
}

// ---- Presets ----

/**
 * Each preset's lesson, shown under the shape line while the preset's values are untouched (activePreset). It leaves
 * out the numbers and the pin's side, which the readouts above it already say.
 */
function presetLesson(state: VectorState): string | null {
	const v = state.a;
	const blocksStage = isBlocks(state);
	switch (state.activePreset) {
		case 'straight-street':
			return `On a straight street all three ${blocksStage ? '' : 'norms '}agree: ${walkOf(v)}. The three shapes touch here.`;
		case 'diagonal':
			return `On the diagonal the three ${blocksStage ? 'measures' : 'norms'} differ most.`;
		case 'nested-shapes': {
			const head = `At length ${state.radius} the diamond sits inside the circle, and the circle inside the square`;
			if (!blocksStage) return `${head}: ‖v‖∞ = ${kingOf(v)} ≤ ‖v‖₂ = ${normValue(v, 'l2')} ≤ ‖v‖₁ = ${walkOf(v)}.`;
			return `${head}: the king's count is never more than the bird's, and the bird's never more than the walk.`;
		}
		default:
			return null;
	}
}

/** What a preset press says: the preset's whole sentence, numbers and the pin's side included. */
function presetSentence(state: VectorState): string | null {
	const v = state.a;
	const blocksStage = isBlocks(state);
	const numbers = `‖v‖₁ = ${walkOf(v)}, ‖v‖₂ = ${normValue(v, 'l2')}, ‖v‖∞ = ${kingOf(v)}`;
	const words = `Walking ${blocks(walkOf(v))}, flying ${birdWords(v)}, king ${plural(kingOf(v), 'move', 'moves')}`;
	switch (state.activePreset) {
		case 'friends-house':
			return `${blocksStage ? words : numbers}. ${pinRelation(state)}`;
		case 'straight-street':
			return presetLesson(state);
		case 'diagonal':
			return blocksStage
				? `Walking ${walkSum(v)} blocks, flying ${birdWords(v)} blocks, king ${plural(kingOf(v), 'move', 'moves')}. ${presetLesson(state)} ${pinRelation(state)}`
				: `${numbers}. ${presetLesson(state)} ${pinRelation(state)}`;
		case 'nested-shapes': {
			const head = `At length ${state.radius} the diamond sits inside the circle, and the circle inside the square. ${pinRelation(state).slice(0, -1)}`;
			if (!blocksStage) return `${head}: ‖v‖∞ = ${kingOf(v)} ≤ ‖v‖₂ = ${normValue(v, 'l2')} ≤ ‖v‖₁ = ${walkOf(v)}.`;
			return `${head}. King ${kingOf(v)}, bird ${birdWords(v)}, walk ${walkOf(v)}: the king's count is never more than the bird's, and the bird's never more than the walk.`;
		}
		default:
			return null;
	}
}

// ---- The board's sentences ----

export function normsBoardLabel(state: VectorState): string {
	if (!state.checked) return 'A street grid with your pin. Move the pin, pick the shape the 4-block corners make, then press Check; or use the buttons under the plane.';
	return 'A street grid with your pin and the shape of every point one length from home. Move the pin, change the shape or the length r, or use the buttons under the plane.';
}

export function normsStatusLine(state: VectorState, setup: Setup): string {
	if (state.checked) return 'Move your pin, change the shape or the length r, or try a preset.';
	const r = requireGuessBall(setup).radius;
	return `${pinSentence(state.a)} ${walkingTotal(state.a, 'Walking the streets')} Which corners are ${blocks(r)} from home by the shortest walk? Pick a shape, then press Check.`;
}

/** Nothing before Check: the status line already says the pin and its walk, the only measure the reader may see. */
export function normsReadouts(state: VectorState): string[] {
	if (!state.checked) return [];
	const v = state.a;
	const measures = isBlocks(state)
		? [walkingTotal(v, 'Walking the streets'), `Flying straight: ${birdBlocks(v)}.`, kingLine(v)]
		: MEASURES.map((measure) => normLine(v, measure));
	const lesson = presetLesson(state);
	return [...measures, shapeLine(state), ...(lesson ? [lesson] : [])];
}

/** The one-shot verdict. validateSetup keeps the question to the walking diamond at an even length r. */
export function shapeVerdict(setup: Setup, guess: ShapeGuess): string {
	const r = requireGuessBall(setup).radius;
	const half = r / 2;
	const corners = latticeOnBall('l1', r, VIEW_LIMIT).length;
	const sameWalk = `The corner ${half} east and ${half} north is a ${half} + ${half} = ${r} block walk, the same as ${r} east`;
	switch (guess) {
		case 'diamond':
			return `Yes. The ${corners} corners ${blocks(r)} from home by the shortest walk make a diamond, with its tips on the four streets through home, ${blocks(r)} out. ${sameWalk}.`;
		case 'circle':
			return `Not quite. A circle is what the bird gets. ${sameWalk}, yet it sits closer in. The walking corners make a diamond.`;
		case 'square':
			return (
				`Not quite. The corner ${r} east and ${r} north is a ${r} + ${r} = ${2 * r} block walk, not ${r}. ` +
				'A diamond is a square turned on its corner. The walking corners make that one, with its tips on the streets, not the one with its sides along them.'
			);
	}
}

/** What a pin move says when it ends. Before Check only the walk; after it every measure and where the pin is. */
export function normsPosition(state: VectorState): string {
	const v = state.a;
	if (!state.checked) return `${pinSentence(v)} ${walkingTotal(v, 'Walking')}`;
	if (isBlocks(state)) return `${pinSentence(v)} Walking ${blocks(walkOf(v))}, flying ${birdWords(v)}, king ${plural(kingOf(v), 'move', 'moves')}. ${pinRelation(state)}`;
	return `Your pin: (${numberText(v[0])}, ${numberText(v[1])}). ‖v‖₁ = ${walkOf(v)}, ‖v‖₂ = ${normValue(v, 'l2')}, ‖v‖∞ = ${kingOf(v)}. ${pinRelation(state)}`;
}

export const radiusAnnouncement = (state: VectorState) => `Length r = ${state.radius}. ${pinRelation(state)}`;

export function measureAnnouncement(state: VectorState): string {
	if (state.measure === 'all') return `Showing all three shapes at length ${state.radius}.`;
	return `Showing the ${shapeWhat(state, state.measure)}.`;
}

export const shapeGuessAnnouncement = (guess: ShapeGuess) => `Your guess: ${SHAPE_GUESS_WORDS[guess]}.`;

/** The preset's own sentence, or the readouts when it has none. */
export const normsPresetAnnouncement = (state: VectorState) => presetSentence(state) ?? normsReadouts(state).join(' ');

export const normsChalkNote = { long: 'same length, three shapes', short: 'three rulers' } as const;

// ---- The plane ----

/** The ochre element: the walking route before Check, then the chosen shape; nothing for "All three" or a pin at home. */
export function normsOchre(state: VectorState): 'route' | 'ball' | null {
	if (!state.checked) return state.a[0] === 0 && state.a[1] === 0 ? null : 'route';
	return state.measure === 'all' ? null : 'ball';
}

/** The shapes drawn after Check, in drawing order; none before it. */
export function drawnMeasures(state: VectorState): readonly Measure[] {
	if (!state.checked) return [];
	return state.measure === 'all' ? MEASURES : [state.measure];
}

/** The whole-number corners on the drawn shape, as small dots; none for "All three" or before Check. */
export function cornerDots(state: VectorState): readonly Vec2[] {
	if (!state.checked || state.measure === 'all') return [];
	return latticeOnBall(state.measure, state.radius, VIEW_LIMIT);
}

/**
 * Where each shape's label sits: down the lower-left diagonal, away from the presets' pins, with the diamond's just
 * inside its edge and the circle's and square's just outside theirs, so the three stay apart at every length.
 */
export function shapeLabels(state: VectorState): readonly { id: string; text: string; at: Vec2 }[] {
	const names = isBlocks(state) ? BLOCKS_PLANE_NAMES : NUMBERS_PLANE_NAMES;
	const r = state.radius;
	const along: Readonly<Record<Measure, number>> = { l1: r / 2 - 0.35, l2: r * Math.SQRT1_2 + 0.35, linf: r + 0.35 };
	return drawnMeasures(state).map((measure) => ({ id: `ball-${measure}`, text: names[measure], at: [-along[measure], -along[measure]] }));
}

// ---- The folded table ----

export interface NormRow {
	measure: Measure;
	name: string;
	how: string;
	length: string;
}

const ROW_NAMES: Readonly<Record<Measure, string>> = { l1: 'Walk (L1)', l2: 'Bird (L2)', linf: 'King (L∞)' };

export const NORM_TABLE_HEADERS = { caption: 'Your pin measured three ways', measure: 'Measure', how: 'How', length: 'Length' } as const;

/** Before Check only the walk, which the status line already says; the bird and the king are the answer. */
export function normRows(state: VectorState): readonly NormRow[] {
	const v = state.a;
	const [x, y] = v.map(numberText);
	const how: Readonly<Record<Measure, string>> = { l1: `|${x}| + |${y}|`, l2: `√(${squared(v[0])} + ${squared(v[1])})`, linf: `max(|${x}|, |${y}|)` };
	const shown = state.checked ? MEASURES : (['l1'] as const);
	return shown.map((measure) => ({ measure, name: ROW_NAMES[measure], how: how[measure], length: normValue(v, measure) }));
}

/** The body said after "Table shown under the switch.". */
export function normTableSentence(state: VectorState): string {
	if (!state.checked) return 'It has one row, the walk, with how it is counted and its length.';
	return 'It has a row each for the walk, the bird and the king, with how each is counted and its length.';
}

/** The name a stage goes by on this setup, for the stage choice and its announcement. */
export function normsStageLabel(stage: Stage): string {
	const label = NORMS_STAGE_LABELS[stage];
	if (!label) throw new Error(`VectorBoard2D: the norms setup has no "${stage}" stage.`);
	return label;
}
