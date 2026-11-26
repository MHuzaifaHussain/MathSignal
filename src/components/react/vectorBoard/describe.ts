// Every string VectorBoard2D shows or says: the board label, status line, readouts, verdicts, table rows, handle
// names, labels on the plane, refusals and announcements. Pure, so scripts/check-boards.mjs pins the copy and checks
// that nothing names an answer before Check. Plain Unicode only, never KaTeX (decision 0007). Notation follows
// src/data/notation.mjs: ‖a‖ for a vector's length, |c| only for a number, · only for the dot product.
// Design and reasoning: decision 0014.
import { isPerfectSquare, toNumber, type Fraction } from '../boardMath.ts';
import { capitalize, fractionText, joinWords, plural } from '../boardText.ts';
import { canShowAnswer } from '../guided/guided.ts';
import type { SpokenLine } from '../guided/spokenLine.ts';
import { tableFoldAnnouncement } from '../guided/tableFold.ts';
import { formatNumber } from '../plotColors.ts';
import {
	LABEL_OFFSET,
	VIEW_LIMIT,
	add,
	angleOf,
	clipSegment,
	clipToView,
	combine,
	cross,
	decimalText,
	dot,
	equals,
	flagWeights,
	isZero,
	labelAnchor,
	labelAway,
	lengthSquared,
	lengthText,
	lineMultiple,
	numberText,
	rootSymbol,
	rootText,
	scale,
	shadowTip,
	spanKind,
	spanLineEnds,
	subtract,
	withinView,
	type Angle,
	type SpanKind,
	type Vec2,
} from './model.ts';
import {
	NORMS_LABELS,
	measureAnnouncement,
	normTableSentence,
	normsBoardLabel,
	normsChalkNote,
	normsOchre,
	normsPosition,
	normsPresetAnnouncement,
	normsReadouts,
	normsStageLabel,
	normsStatusLine,
	pinSentence,
	radiusAnnouncement,
	shapeGuessAnnouncement,
	shapeLabels,
	shapeVerdict,
} from './normsDescribe.ts';
import { isOnScale, type ScaleRange, type Setup, type SetupKind, type Stage } from './setups.ts';
import {
	AXES,
	DIRECTIONS,
	handleIds,
	handlePoint,
	handleRefusals,
	requireFlag,
	setupOf,
	signOf,
	stepRefusal,
	steppableVectors,
	type Action,
	type Axis,
	type Direction,
	type HandleId,
	type Refusal,
	type Sign,
	type VectorId,
	type VectorState,
	type Weight,
} from './state.ts';

export const STAGE_LABELS: Readonly<Record<Stage, string>> = { trips: 'Trips', arrows: 'Arrows', lists: 'Lists' };

/** A stage's name on this setup: city-walk calls Trips and Arrows "Blocks" and "Numbers" (decision 0021). */
export function stageLabel(setup: Setup, stage: Stage): string {
	return setup.kind === 'norms' ? normsStageLabel(stage) : STAGE_LABELS[stage];
}

/** The stage choice's options for this setup, in order. */
export function stageOptions(setup: Setup): readonly { value: Stage; label: string }[] {
	return setup.stages.map((value) => ({ value, label: stageLabel(setup, value) }));
}

export const CONTROL_LABELS = {
	check: 'Check',
	showAnswer: 'Show the answer',
	showAs: 'Show as',
	presets: 'Presets',
	presetsCaption: 'Try',
	otherOrder: 'Show b first too',
	scale: 'Scale c',
	scaleD: 'Scale d',
	signLegend: 'Your guess: a · b is',
	spanLegend: 'Your guess: the span of a and b is',
} as const;

export const SIGN_OPTIONS: readonly { value: Sign; label: string }[] = [
	{ value: 'positive', label: 'Positive' },
	{ value: 'zero', label: 'Zero' },
	{ value: 'negative', label: 'Negative' },
];

export const SPAN_OPTIONS: readonly { value: SpanKind; label: string }[] = [
	{ value: 'origin', label: 'Only the origin' },
	{ value: 'line', label: 'A line' },
	{ value: 'plane', label: 'The whole plane' },
];

const SPAN_GUESS_WORDS: Readonly<Record<SpanKind, string>> = { origin: 'only the origin', line: 'a line', plane: 'the whole plane' };

const LOCKED_TEXT = 'a and b are the question. Press Check first.';
const NO_SIGN_TEXT = 'Pick positive, zero or negative first.';
const NO_SPAN_TEXT = 'Pick only the origin, a line or the whole plane first.';
/** The status line once a and b are free to move, on align and span-choice. */
const DRAG_OR_PRESET = 'Drag the tips of a and b, or try a preset.';

// ---- Numbers and positions ----

export const pairText = (v: Vec2) => `(${numberText(v[0])}, ${numberText(v[1])})`;
/** A factor in a product: negative numbers get parentheses, "4 × (−1)". */
const factor = (n: number) => (n < 0 ? `(${numberText(n)})` : numberText(n));
const dotTerms = (a: Vec2, b: Vec2) => `${factor(a[0])} × ${factor(b[0])} + ${factor(a[1])} × ${factor(b[1])}`;
const dotExpression = (a: Vec2, b: Vec2) => `${dotTerms(a, b)} = ${numberText(dot(a, b))}`;
const equalsOrApprox = (value: number) => {
	const text = decimalText(value);
	return text.startsWith('≈') ? text : `= ${text}`;
};

function stepsText(count: number, positive: string, negative: string): string {
	return `${plural(Math.abs(count), 'step', 'steps')} ${count < 0 ? negative : positive}`;
}

/** "3 steps east, 2 steps north", for the Trips stage. */
export const stepsWords = (v: Vec2) => `${stepsText(v[0], 'east', 'west')}, ${stepsText(v[1], 'north', 'south')}`;

const DIRECTION_WORDS: Readonly<Record<Axis, Readonly<Record<Direction, string>>>> = {
	x: { 1: 'east', [-1]: 'west' },
	y: { 1: 'north', [-1]: 'south' },
};
const EDGE_WORDS: Readonly<Record<Axis, Readonly<Record<Direction, string>>>> = {
	x: { 1: 'right', [-1]: 'left' },
	y: { 1: 'top', [-1]: 'bottom' },
};

function angleWords(angle: Angle | null): string {
	if (!angle) return 'with no angle';
	return 'exact' in angle ? `exactly ${angle.exact}°` : `about ${angle.approx.toFixed(1)}°`;
}

// ---- Names ----

/** The short name a sentence uses: "a", "your guess", "your push", "a + b". */
function shortName(state: VectorState, id: HandleId): string {
	if (id === 'guess') return 'your guess';
	if (id === 'sum') return 'a + b';
	if (id === 'a' && setupOf(state).kind === 'cart') return 'your push';
	if (id === 'a' && setupOf(state).kind === 'norms') return 'your pin';
	return id;
}

/** A name that starts a sentence: "Your guess", but vector names stay lowercase ("a can't go further east"). */
function sentenceName(state: VectorState, id: HandleId): string {
	const name = shortName(state, id);
	return name.startsWith('your') ? capitalize(name) : name;
}

const isTrips = (state: VectorState) => state.stage === 'trips';

/** The track's name on the cart setup: û when it has length 1, b otherwise. */
function trackName(state: VectorState): string {
	return lengthSquared(state.b) === 1 ? 'û' : 'b';
}

export function boardLabel(state: VectorState): string {
	switch (setupOf(state).kind) {
		case 'add':
			return 'Two trips on a grid. Move the ochre ring to where they end, then press Check; or use the step buttons under the plane.';
		case 'scale':
			return 'A vector a and the scaled vector c a. Set c with the slider, then press Check; move a by its tip or with the step buttons under the plane.';
		case 'cart':
			return 'A cart on a track and your push. Drag the tip of your push, or use the step buttons under the plane, then press Check.';
		case 'align':
			return 'Two vectors a and b. Pick whether a · b is positive, zero or negative, then press Check.';
		case 'combine':
			return 'Two vectors a and b, scaled by c and d and added tip to tail. Set c and d with the sliders so c a + d b lands on the flag, then press Check.';
		case 'span-choice':
			return 'Two vectors a and b. Pick whether their span is only the origin, a line or the whole plane, then press Check.';
		case 'norms':
			return normsBoardLabel(state);
	}
}

export function statusLine(state: VectorState): string {
	const setup = setupOf(state);
	switch (setup.kind) {
		case 'add':
			if (state.checked) return 'Move a or the end of b, with the handles or the steppers, or try a preset.';
			if (isTrips(state)) {
				return `Trip a: ${stepsWords(state.a)}. Trip b: ${stepsWords(state.b)}. Where do you end up? Move the ochre ring there, then press Check.`;
			}
			return `a = ${pairText(state.a)}, b = ${pairText(state.b)}, with b drawn from the tip of a. Where does b end? Move the ochre ring there, then press Check.`;
		case 'scale':
			return state.checked ? 'Change c or move a, or try a preset.' : 'Goal: find the c that turns a around without changing its length. Then press Check.';
		case 'cart': {
			if (state.checked) return 'Tilt your push, or try a preset.';
			const goal = setup.goal;
			if (!goal) throw new Error(`VectorBoard2D: setup "${setup.id}" has no cart goal.`);
			return `Goal: keep your push at length ${rootSymbol(goal.targetLengthSquared)}, and tilt it so the cart gets only ${numberText(goal.targetForward)} of it. Then press Check.`;
		}
		case 'align':
			return state.checked ? DRAG_OR_PRESET : 'Is a · b positive, zero or negative? Pick your guess, then press Check.';
		case 'combine':
			return state.checked ? 'Change c or d, drag the tips of a and b, or try a preset.' : 'Goal: set c and d so that c a + d b lands on the flag. Then press Check.';
		case 'span-choice':
			return state.checked ? DRAG_OR_PRESET : 'What can c a + d b reach: only the origin, a line or the whole plane? Pick your guess, then press Check.';
		case 'norms':
			return normsStatusLine(state, setup);
	}
}

// ---- Readouts ----

/** The second Arrows line on the add setup: how the length of a + b compares with the two lengths. */
function sumLengthLine(a: Vec2, b: Vec2): string {
	const sum = add(a, b);
	if (isZero(sum)) return 'Both trips: you end where you started. a + b = (0, 0), the zero vector.';
	const lengths = `${rootSymbol(lengthSquared(a))} + ${rootSymbol(lengthSquared(b))}`;
	if (!isZero(a) && !isZero(b) && cross(a, b) === 0 && dot(a, b) > 0) {
		const squared = lengthSquared(sum);
		const tail = isPerfectSquare(squared) ? '' : ` ≈ ${formatNumber(Math.sqrt(squared))}`;
		return `Both trips point the same way, so here the lengths do add: ${lengths} = ${rootSymbol(squared)}${tail}.`;
	}
	const total = Math.sqrt(lengthSquared(a)) + Math.sqrt(lengthSquared(b));
	const exact = isPerfectSquare(lengthSquared(a)) && isPerfectSquare(lengthSquared(b));
	return `Length of a + b: ${rootText(lengthSquared(sum))}. The two trips' lengths add to ${lengths} ${exact ? `= ${total}` : `≈ ${formatNumber(total)}`}.`;
}

function addReadouts(state: VectorState): string[] {
	if (!state.checked) return [];
	const sum = add(state.a, state.b);
	if (isTrips(state)) {
		const both = isZero(sum) ? 'Both trips: you end where you started.' : `Both trips: ${stepsWords(sum)}, the same as one straight trip.`;
		return [`Trip a: ${stepsWords(state.a)}.`, `Trip b: ${stepsWords(state.b)}.`, both];
	}
	return [`a = ${pairText(state.a)}, b = ${pairText(state.b)}, a + b = ${pairText(sum)}.`, sumLengthLine(state.a, state.b)];
}

const howLong = (size: number) => (size === 0.5 ? 'half as long' : `${numberText(size)} times as long`);

/** " Length 2 × √5 ≈ 4.47." when c stretches a, so the length is written as |c| times the length of a. */
function stretchedLength(c: number, a: Vec2): string {
	const size = Math.abs(c);
	if (size <= 1) return '';
	const squared = lengthSquared(a);
	const value = size * Math.sqrt(squared);
	return ` Length ${numberText(size)} × ${rootSymbol(squared)} ${isPerfectSquare(squared) ? `= ${numberText(value)}` : `≈ ${formatNumber(value)}`}.`;
}

/** What c a is, in words: the readout after Check. */
export function scaleSentence(c: number, a: Vec2): string {
	const scaled = scale(c, a);
	const head = `${numberText(c)} × a = ${pairText(scaled)}`;
	if (isZero(a)) return `${head}: a is the zero vector, so every c gives the zero vector.`;
	if (c === 1) return `${head}: the same as a.`;
	if (c === 0) return `${head}: the zero vector. It has no direction.`;
	if (c === -1) return `${head}: opposite direction, same length.`;
	const direction = c > 0 ? 'same direction as a' : 'opposite direction';
	return `${head}: ${direction}, ${howLong(Math.abs(c))}.${stretchedLength(c, a)}`;
}

function scaleReadouts(state: VectorState): string[] {
	if (!state.checked) return [`c = ${numberText(state.scalar)}. c a = ${pairText(scale(state.scalar, state.a))}.`];
	return [scaleSentence(state.scalar, state.a)];
}

/** The push's part along the track: push · track ÷ ‖track‖. Track lengths are whole numbers (validateSetup). */
const forwardPart = (push: Vec2, track: Vec2) => dot(push, track) / Math.sqrt(lengthSquared(track));
const railsPart = (push: Vec2, track: Vec2) => Math.abs(cross(track, push)) / Math.sqrt(lengthSquared(track));
const timesWord = (factorValue: number) => (factorValue === 2 ? 'twice' : `${numberText(factorValue)} times`);

function cartAlongLine(push: Vec2, track: Vec2): string {
	const forward = forwardPart(push, track);
	const trackLength = Math.sqrt(lengthSquared(track));
	let line: string;
	if (trackLength === 1) {
		let outcome = `The cart gets ${decimalText(forward)} of your push.`;
		if (forward === 0) outcome = "The cart doesn't move: your whole push goes into the rails.";
		if (forward < 0) outcome = 'The cart rolls backward.';
		line = `Along the track: a · û = ${dotExpression(push, track)}. ${outcome}`;
	} else {
		const value = dot(push, track);
		line =
			`a · b = ${dotExpression(push, track)}. That is ${timesWord(trackLength)} the part along the track, ${decimalText(forward)}, ` +
			`because b has length ${numberText(trackLength)}. Divide by the length of b: ${numberText(value)} ÷ ${numberText(trackLength)} ${equalsOrApprox(forward)}.`;
	}
	const tip = shadowTip(track, push);
	return tip && !withinView(tip) ? `${line} The shadow runs past the edge of the board.` : line;
}

function cartReadouts(state: VectorState): string[] {
	if (!state.checked) return [`Your push: ${pairText(state.a)}, length ${lengthText(state.a)}.`];
	if (isZero(state.a)) return ['Your push is the zero vector, so the cart gets nothing.'];
	const rails = railsPart(state.a, state.b);
	const railsLine = rails === 0 ? 'Into the rails: 0. Your whole push moves the cart.' : `Into the rails: ${decimalText(rails)}. That part doesn't move the cart.`;
	return [cartAlongLine(state.a, state.b), railsLine];
}

function zeroVectorSentence(a: Vec2, b: Vec2): string | null {
	if (isZero(a) && isZero(b)) return 'a · b = 0 because a and b are both the zero vector. The angle is undefined: neither has a direction.';
	if (isZero(b)) return 'a · b = 0 because b is the zero vector. The angle is undefined: b has no direction.';
	if (isZero(a)) return 'a · b = 0 because a is the zero vector. The angle is undefined: a has no direction.';
	return null;
}

function angleLine(angle: Angle): string {
	if ('approx' in angle) return `Angle: about ${angle.approx.toFixed(1)}°.`;
	if (angle.exact === 90) return 'Exactly 90°: a and b are perpendicular.';
	if (angle.exact === 180) return 'Exactly 180°: b points the opposite way.';
	if (angle.exact === 0) return 'Exactly 0°: b points the same way as a.';
	return `Exactly ${angle.exact}°.`;
}

function shadowLine(a: Vec2, b: Vec2): string {
	const squared = lengthSquared(a);
	const value = dot(a, b) / Math.sqrt(squared);
	const result = isPerfectSquare(squared) || value === 0 ? equalsOrApprox(value) : `≈ ${formatNumber(value)}`;
	return `Shadow of b along a: a · b ÷ ‖a‖ = ${numberText(dot(a, b))} ÷ ${rootSymbol(squared)} ${result}.`;
}

const sameAngle = (first: Angle | null, second: Angle | null) =>
	first !== null && second !== null && angleWords(first) === angleWords(second);

/** How many times longer b is than before, when it points the same way and a hasn't changed; null otherwise. */
function stretchFactor(state: VectorState): number | null {
	const before = state.before;
	if (!before || !equals(before.a, state.a) || isZero(before.b) || cross(before.b, state.b) !== 0 || dot(before.b, state.b) <= 0) return null;
	const ratio = Math.sqrt(lengthSquared(state.b) / lengthSquared(before.b));
	return Number.isInteger(ratio) && ratio > 1 ? ratio : null;
}

function beforeLine(state: VectorState): string | null {
	const before = state.before;
	if (!before) return null;
	const previousAngle = angleOf(before.a, before.b);
	const previousDot = numberText(dot(before.a, before.b));
	const opening = previousAngle ? `Before: a · b = ${previousDot} at ${angleWords(previousAngle)}.` : `Before: a · b = ${previousDot}, with no angle.`;
	const stretch = stretchFactor(state);
	if (stretch === null || !sameAngle(previousAngle, angleOf(state.a, state.b))) return opening;
	if (stretch === 2) return `${opening} Same angle, b twice as long, so a · b doubled.`;
	return `${opening} Same angle, b ${stretch} times as long, so a · b is ${stretch} times as big.`;
}

const pairsLine = (state: VectorState) => `a = ${pairText(state.a)}, b = ${pairText(state.b)}.`;

function alignReadouts(state: VectorState): string[] {
	if (!state.checked) return [pairsLine(state)];
	const zero = zeroVectorSentence(state.a, state.b);
	if (zero) return [zero];
	const angle = angleOf(state.a, state.b);
	if (!angle) throw new Error('VectorBoard2D: two nonzero vectors must have an angle.');
	const before = beforeLine(state);
	return [`a · b = ${dotExpression(state.a, state.b)}.`, angleLine(angle), shadowLine(state.a, state.b), ...(before ? [before] : [])];
}

// ---- Linear combinations and span ----

/** A weight as text: the slider's own form when it has one ("−3.5", "2"), else the exact fraction ("7/8"). */
export function weightText(value: Fraction): string {
	return value.denominator <= 2 ? numberText(toNumber(value)) : fractionText(value);
}

/** "1 × a + (−1) × b": the second weight gets parentheses when negative, as a factor does. */
const combinationText = (c: string, d: string) => `${c} × a + ${d.startsWith('−') ? `(${d})` : d} × b`;

const sumOf = (state: VectorState): Vec2 => combine(state.scalar, state.a, state.scalarD, state.b);

function requireRange(setup: Setup): ScaleRange {
	if (!setup.scaleRange) throw new Error(`VectorBoard2D: setup "${setup.id}" has no slider range.`);
	return setup.scaleRange;
}

/** "b = −2 × a" when the multiple is whole or half, as the slider writes it, and "b = a" for 1; null otherwise. */
function multipleWords(name: 'a' | 'b', other: 'a' | 'b', multiple: Fraction | null): string | null {
	if (!multiple || multiple.denominator > 2) return null;
	if (multiple.numerator === 1 && multiple.denominator === 1) return `${name} = ${other}`;
	return `${name} = ${weightText(multiple)} × ${other}`;
}

/**
 * What every c a + d b can reach, the same on both span setups. One switch on spanKind, then the line cases in a
 * fixed order: a zero vector first, so a multiple is never written "b = 0 × a".
 */
export function spanSentence(a: Vec2, b: Vec2): string {
	switch (spanKind(a, b)) {
		case 'origin':
			return 'a and b are both the zero vector, so every c a + d b is (0, 0). The span is just the origin.';
		case 'plane':
			return 'a and b point along different lines, so their span is the whole plane.';
		case 'line': {
			if (isZero(a)) return 'a is the zero vector, so it adds nothing: the span is the line through b.';
			if (isZero(b)) return 'b is the zero vector, so it adds nothing: the span is the line through a.';
			const named = multipleWords('b', 'a', lineMultiple(a, b)) ?? multipleWords('a', 'b', lineMultiple(b, a));
			if (named) return `${named}, so a and b lie on one line through the origin, and every c a + d b stays on it. The span is that line.`;
			return 'a and b lie on one line through the origin, so every c a + d b stays on it. The span is that line.';
		}
	}
}

/**
 * Whether the flag can be reached, and with which weights. When the slider can't set them it says so, so a reader who
 * drags a and b doesn't read the slider's steps as "unreachable".
 */
export function flagSentence(state: VectorState): string {
	const setup = setupOf(state);
	const { target } = requireFlag(setup);
	const { a, b } = state;
	switch (spanKind(a, b)) {
		case 'origin':
			return 'The flag is not at the origin, so no c and d reach it.';
		case 'line': {
			const direction = isZero(a) ? b : a;
			return cross(direction, target) === 0 ? 'The flag is on that line, so some c and d reach it.' : 'The flag is off that line, so no c and d reach it.';
		}
		case 'plane': {
			const weights = flagWeights(target, a, b);
			if (!weights) throw new Error('VectorBoard2D: a and b span the plane, so the flag must have weights.');
			const sentence = `The flag is ${combinationText(weightText(weights[0]), weightText(weights[1]))}`;
			const range = requireRange(setup);
			if (weights.every((weight) => isOnScale(range, toNumber(weight)))) return `${sentence}.`;
			return `${sentence}, which the slider can't set: it moves in steps of ${numberText(range.step)} from ${numberText(range.min)} to ${numberText(range.max)}.`;
		}
	}
}

/** What the slider sent past ±5, or null when everything is on the board. Only combine setups can send anything off. */
export function edgeSentence(state: VectorState): string | null {
	if (setupOf(state).kind !== 'combine') return null;
	const scaled = scale(state.scalar, state.a);
	const sum = sumOf(state);
	const off = [...(withinView(scaled) ? [] : [`c a = ${pairText(scaled)}`]), ...(withinView(sum) ? [] : [`c a + d b = ${pairText(sum)}`])];
	if (off.length === 0) return null;
	return `${joinWords(off)} ${off.length === 1 ? 'is' : 'are'} past the edge of the board, so the drawing stops at the edge.`;
}

/** The reader's own c, d and sum, and anything past the edge: all a slider commit says. */
function combineSliderLines(state: VectorState): string[] {
	const { target } = requireFlag(setupOf(state));
	const edge = edgeSentence(state);
	const first = `c = ${numberText(state.scalar)}, d = ${numberText(state.scalarD)}. c a + d b = ${pairText(sumOf(state))}. The flag is at ${pairText(target)}.`;
	return edge ? [first, edge] : [first];
}

/** After Check the span, and the flag's weights while no verdict is showing (the verdict already says them). */
function combineReadouts(state: VectorState): string[] {
	const lines = combineSliderLines(state);
	if (!state.checked) return lines;
	return [...lines, spanSentence(state.a, state.b), ...(state.feedback === null ? [flagSentence(state)] : [])];
}

/** The span sentence waits for Check, and stays out while the verdict, which already says it, is showing. */
function spanChoiceReadouts(state: VectorState): string[] {
	if (!state.checked || state.feedback !== null) return [pairsLine(state)];
	return [pairsLine(state), spanSentence(state.a, state.b)];
}

/** The readout sentences under the plane. Before Check they name only what the reader set, never the answer. */
export function readoutLines(state: VectorState): string[] {
	switch (setupOf(state).kind) {
		case 'add':
			return addReadouts(state);
		case 'scale':
			return scaleReadouts(state);
		case 'cart':
			return cartReadouts(state);
		case 'align':
			return alignReadouts(state);
		case 'combine':
			return combineReadouts(state);
		case 'span-choice':
			return spanChoiceReadouts(state);
		case 'norms':
			return normsReadouts(state);
	}
}

// ---- Check ----

function tripMatch(state: VectorState): string {
	const sum = add(state.a, state.b);
	return (
		`East: ${numberText(state.a[0])} + ${factor(state.b[0])} = ${numberText(sum[0])}. North: ${numberText(state.a[1])} + ${factor(state.b[1])} = ${numberText(sum[1])}. ` +
		`Both trips end where one trip of ${numberText(sum[0])} east and ${numberText(sum[1])} north would.`
	);
}

const TRIP_MISSES = {
	swapped: 'Not quite. Your guess swaps east and north. Add the east steps of both trips first.',
	'first-trip': "Not quite. That's where trip a ends. Trip b starts there, so keep walking.",
	'second-trip': "Not quite. That's where trip b ends on its own. Walk trip a first, then trip b from where a stops.",
	difference: "Not quite. The second trip adds its steps; it doesn't take them away.",
	product: "Not quite. Steps add up; they don't multiply.",
	start: 'Not quite. Your guess is still at the start. Move it to where you think the two trips end.',
	other: 'Not quite. Add the east steps of both trips, then the north steps.',
} as const;

const turnedAround = (state: VectorState) => `${numberText(state.scalar)} × a = ${pairText(scale(state.scalar, state.a))}: the same length as a, pointing the opposite way.`;

function cartLengthClaim(state: VectorState): string {
	const goal = setupOf(state).goal;
	if (!goal) throw new Error(`VectorBoard2D: setup "${state.setupId}" has no cart goal.`);
	const push = state.a;
	const squares = `${factor(push[0])} × ${factor(push[0])} + ${factor(push[1])} × ${factor(push[1])}`;
	return `${pairText(push)} has length ${rootSymbol(goal.targetLengthSquared)}, since ${squares} = ${goal.targetLengthSquared}, and ${decimalText(forwardPart(push, state.b))} of it points along the track.`;
}

function cartMiss(state: VectorState, result: 'wrong-length' | 'too-much' | 'too-little' | 'backward'): string {
	const goal = setupOf(state).goal;
	if (!goal) throw new Error(`VectorBoard2D: setup "${state.setupId}" has no cart goal.`);
	const push = pairText(state.a);
	const target = rootSymbol(goal.targetLengthSquared);
	const forward = decimalText(forwardPart(state.a, state.b));
	switch (result) {
		case 'wrong-length':
			return `Not quite. Your push ${push} has length ${lengthText(state.a)}, not ${target}. Stay on the dotted circle.`;
		case 'too-much':
			return `Not quite. ${push} has length ${target}, but ${forward} of it points along the track. Tilt it further from the track.`;
		case 'too-little':
			return `Not quite. ${push} has length ${target}, but ${forward} of it points along the track. Tilt it back toward the track.`;
		case 'backward':
			return `Not quite. ${push} has length ${target}, but its part along the track is ${forward}: it rolls the cart backward. Point it forward.`;
	}
}

function scaleMiss(state: VectorState, result: 'unchanged' | 'zero' | 'same-direction' | 'flipped-longer' | 'flipped-shorter'): string {
	const c = numberText(state.scalar);
	switch (result) {
		case 'unchanged':
			return 'Not quite. 1 × a is a itself. Find a c that turns it around.';
		case 'zero':
			return 'Not quite. 0 × a is the zero vector: it has no direction and no length left.';
		case 'same-direction':
			return 'Not quite. A positive c keeps the direction of a. Try a negative c.';
		case 'flipped-longer':
		case 'flipped-shorter':
			return `Not quite. A negative c turns a around, but c = ${c} also makes it ${howLong(Math.abs(state.scalar))}.`;
	}
}

function signVerdict(state: VectorState, guess: Sign, correct: boolean): string {
	const value = dot(state.a, state.b);
	const expression = dotExpression(state.a, state.b);
	const angle = angleOf(state.a, state.b);
	const zero = zeroVectorSentence(state.a, state.b);
	if (zero) return `${correct ? 'Yes.' : 'Not quite.'} ${zero}`;
	const angleText = angleWords(angle);
	if (correct) {
		if (value === 0) return `Yes. a · b = ${expression}, so it is zero. The angle is exactly 90°: a and b are perpendicular.`;
		const over = value < 0;
		const near = angle && 'approx' in angle && Math.abs(angle.approx - 90) < 10;
		const relation = `${near ? 'just ' : ''}${over ? 'over' : 'under'} a right angle`;
		return `Yes. a · b = ${expression}, so it is ${over ? 'negative' : 'positive'}. The angle is ${angleText}, ${relation}.`;
	}
	if (value === 0) return `Not quite. a · b = ${expression}, so it is exactly 0: the angle is exactly 90°.`;
	if (guess === 'zero') return `Not quite. It looks like a right angle, but a · b = ${expression}, not 0. The angle is ${angleText}.`;
	const actual = value < 0 ? 'negative' : 'positive';
	return `Not quite. a · b = ${expression}. It is ${actual} because the angle, ${angleText}, is ${value < 0 ? 'over' : 'under'} 90°.`;
}

const combineTerms = (state: VectorState) => combinationText(numberText(state.scalar), numberText(state.scalarD));

/** "1 × a + 2 × b = (2, 1) + (2, 4) = (4, 5), the flag." */
function combineMatch(state: VectorState): string {
	return `${combineTerms(state)} = ${pairText(scale(state.scalar, state.a))} + ${pairText(scale(state.scalarD, state.b))} = ${pairText(sumOf(state))}, the flag.`;
}

function combineMiss(state: VectorState, result: 'swapped' | 'other'): string {
	const reached = `${combineTerms(state)} = ${pairText(sumOf(state))}`;
	if (result === 'swapped') return `Not quite. ${reached}, the flag with east and north swapped. Look again at which weight scales a.`;
	return `Not quite. ${reached}, and the flag is at ${pairText(requireFlag(setupOf(state)).target)}.`;
}

/** The one-shot span verdict. validateSetup keeps the question to b = k a with k whole and |k| at least 2. */
function spanVerdict(state: VectorState, guess: SpanKind, correct: boolean): string {
	const { a, b } = state;
	if (correct) return `Yes. ${spanSentence(a, b)}`;
	const multiple = lineMultiple(a, b);
	if (isZero(a) || !multiple || multiple.denominator !== 1) {
		throw new Error(`VectorBoard2D: the span verdicts are written for b = k a with k whole, not a = ${pairText(a)}, b = ${pairText(b)}.`);
	}
	const k = multiple.numerator;
	if (guess === 'plane') {
		const way = k < 0 ? 'points exactly opposite a' : 'points the same way as a';
		return `Not quite. b = ${numberText(k)} × a ${way}, so every c a + d b = (c ${k < 0 ? '−' : '+'} ${Math.abs(k)}d) × a stays on the line through a. The span is that line.`;
	}
	return `Not quite. c a alone already reaches every point of the line through a, such as 1 × a = ${pairText(a)} and −1 × a = ${pairText(scale(-1, a))}. The span is that line.`;
}

function shownAnswer(state: VectorState): string {
	switch (setupOf(state).kind) {
		case 'add':
			return `Here it is. ${tripMatch(state)}`;
		case 'scale':
			return `Here it is. ${turnedAround(state)}`;
		case 'cart':
			return `Here it is. ${cartLengthClaim(state)}`;
		case 'combine':
			return `Here it is. ${combineMatch(state)}`;
		case 'align':
		case 'span-choice':
		case 'norms':
			throw new Error(`VectorBoard2D: the ${state.setupId} setup reveals on any answer, so it never shows one.`);
	}
}

/** Check's verdict, or null when there is none. A second miss adds that the answer can now be shown. */
export function feedbackLine(state: VectorState): string | null {
	const feedback = state.feedback;
	if (!feedback) return null;
	let line: string;
	switch (feedback.kind) {
		case 'shown':
			return shownAnswer(state);
		case 'trip':
			line = feedback.result === 'match' ? `Yes. ${tripMatch(state)}` : TRIP_MISSES[feedback.result];
			break;
		case 'scale':
			line = feedback.result === 'match' ? `Yes. ${turnedAround(state)}` : scaleMiss(state, feedback.result);
			break;
		case 'cart':
			line = feedback.result === 'match' ? `Yes. ${cartLengthClaim(state)}` : cartMiss(state, feedback.result);
			break;
		case 'sign':
			return signVerdict(state, feedback.guess, feedback.correct);
		case 'combine':
			line = feedback.result === 'match' ? `Yes. ${combineMatch(state)}` : combineMiss(state, feedback.result);
			break;
		case 'span':
			return spanVerdict(state, feedback.guess, feedback.correct);
		case 'shape':
			return shapeVerdict(setupOf(state), feedback.guess);
	}
	return canShowAnswer(state) ? `${line} You can now show the answer.` : line;
}

/** Why Check needs a guess first, by kind: the sign on align, the span on span-choice, the shape on norms. */
function noGuessText(kind: SetupKind): string {
	if (kind === 'norms') return NORMS_LABELS.noShape;
	return kind === 'span-choice' ? NO_SPAN_TEXT : NO_SIGN_TEXT;
}

/** The visible reason Check is refused, or null. */
export function checkRefusal(state: VectorState): string | null {
	if (state.checked) return null;
	const kind = setupOf(state).kind;
	switch (kind) {
		case 'align':
			return state.signGuess === null ? noGuessText(kind) : null;
		case 'span-choice':
			return state.spanGuess === null ? noGuessText(kind) : null;
		case 'norms':
			return state.shapeGuess === null ? noGuessText(kind) : null;
		case 'add':
		case 'scale':
		case 'cart':
		case 'combine':
			return null;
	}
}

export function presetsFor(state: VectorState): readonly { id: string; label: string }[] {
	return state.checked ? setupOf(state).presets.map(({ id, label }) => ({ id, label })) : [];
}

// ---- The plane ----

export type OchreElement = 'guess' | 'sum' | 'scaled' | 'shadow' | 'flag' | 'span' | 'route' | 'ball' | null;

/**
 * The one element drawn in ochre ("look here"), or null when there is nothing to point at. On span-reach it is always
 * the flag, the referent of the flag sentence and of every preset. On span-shape it is the span after Check: the line,
 * or a ring at the origin; the whole plane is said in words, never tinted.
 */
export function ochreElement(state: VectorState): OchreElement {
	switch (setupOf(state).kind) {
		case 'add':
			if (!state.checked) return 'guess';
			return isZero(add(state.a, state.b)) ? null : 'sum';
		case 'scale':
			return isZero(scale(state.scalar, state.a)) ? null : 'scaled';
		case 'cart':
			return state.checked && !isZero(state.a) && dot(state.a, state.b) !== 0 ? 'shadow' : null;
		case 'align':
			return state.checked && !isZero(state.a) && dot(state.a, state.b) !== 0 ? 'shadow' : null;
		case 'combine':
			return 'flag';
		case 'span-choice':
			return state.checked && spanKind(state.a, state.b) !== 'plane' ? 'span' : null;
		case 'norms':
			return normsOchre(state);
	}
}

const HANDLE_TAIL = '. It also moves with the buttons under the plane';

function aHandleName(kind: SetupKind): string {
	switch (kind) {
		case 'add':
			return 'Tip of trip a';
		case 'cart':
			return 'Tip of your push';
		case 'norms':
			return 'Your pin';
		case 'scale':
		case 'align':
		case 'combine':
		case 'span-choice':
			return 'Tip of vector a';
	}
}

/** The Mafs handles in render order, with their names: the single source for the plane and Board's handleLabels. */
export function handlesFor(state: VectorState): readonly { id: HandleId; point: Vec2; label: string }[] {
	const names: Readonly<Record<HandleId, string>> = {
		guess: 'Your guess for where the two trips end',
		a: aHandleName(setupOf(state).kind),
		b: 'Tip of vector b',
		sum: 'End of trip b, where both trips end',
	};
	return handleIds(state).map((id) => ({ id, point: handlePoint(state, id), label: `${names[id]}${HANDLE_TAIL}` }));
}

export interface PlaneLabel {
	id: string;
	text: string;
	at: Vec2;
	/** The unit step from the arrow this label names to the label, or null when it names no arrow (fitLabel). */
	away: Vec2 | null;
}

const ORIGIN: Vec2 = [0, 0];
const zeroLabel = (id: string, at: Vec2): PlaneLabel => ({ id, text: 'zero vector', at: labelAnchor(at, at, 1), away: labelAway(at, at, 1) });

function arrowLabel(id: string, text: string, tail: Vec2, tip: Vec2, side: 1 | -1): PlaneLabel {
	return equals(tail, tip) ? zeroLabel(id, tail) : { id, text, at: labelAnchor(tail, tip, side), away: labelAway(tail, tip, side) };
}

/** A point on the angle's bisector, for the θ label. */
function bisectorPoint(a: Vec2, b: Vec2, radius: number): Vec2 {
	const unitA = scale(1 / Math.sqrt(lengthSquared(a)), a);
	const unitB = scale(1 / Math.sqrt(lengthSquared(b)), b);
	const middle = add(unitA, unitB);
	const length = Math.sqrt(lengthSquared(middle));
	return length === 0 ? [-unitA[1] * radius, unitA[0] * radius] : scale(radius / length, middle);
}

/** Radius of the angle arc, in grid units; the θ label sits a little further out. */
export const ARC_RADIUS = 0.8;
const THETA_RADIUS = 1.35;

/** True when the angle is drawn as an arc (strictly between 0° and 180°, and not a right angle). */
export function showsArc(state: VectorState): boolean {
	const angle = angleOf(state.a, state.b);
	if (!state.checked || setupOf(state).kind !== 'align' || !angle) return false;
	return 'approx' in angle || angle.exact === 45 || angle.exact === 135;
}

/** True when a right-angle mark replaces the arc. */
export function showsRightAngle(state: VectorState): boolean {
	const angle = angleOf(state.a, state.b);
	return state.checked && setupOf(state).kind === 'align' && angle !== null && 'exact' in angle && angle.exact === 90;
}

/**
 * The cart's shadow as drawn after Check, or null before Check or for a zero push. On the tilted track a push near
 * (5, 5) throws the true tip past the edge: the drawing then stops at the edge, and the line into the rails, which
 * lies past the edge too, is left out (`onBoard` false). The readout says the shadow runs past the edge.
 */
export function cartShadow(state: VectorState): { tip: Vec2; onBoard: boolean } | null {
	const tip = shadowTip(state.b, state.a);
	if (!state.checked || !tip || isZero(state.a)) return null;
	return { tip: clipToView(tip), onBoard: withinView(tip) };
}

/** The rails label is placed on the first two thirds of its line, so it sits a third of the way up. */
const RAILS_LABEL_SPAN = 2 / 3;

/** A clipped arrow of span-reach: c a from the origin, d b from the tip of c a. Dashed for d b, as b is. */
export interface CombinePiece {
	id: 'scaled' | 'scaledB';
	from: Vec2;
	to: Vec2;
	/** False when the tip is past the edge (a head there would claim the arrow ends there) or the piece is too short. */
	head: boolean;
}

/** A tipped piece shorter than this, in grid units, is drawn without a head; the sum dot marks where it ends. */
const MIN_HEADED_PIECE = 0.6;
/** A clipped piece shorter than this, in grid units, is too short to carry a label. */
const MIN_LABELED_PIECE = 1;

const pieceLength = (piece: { from: Vec2; to: Vec2 }) => Math.sqrt(lengthSquared(subtract(piece.to, piece.from)));

/**
 * The scaled arrows as drawn: each clipped to the board, and left out when it has no length (c = 0, d = 0 or a zero
 * vector, never a zero ring) or no part on the board.
 */
export function combinePieces(state: VectorState): readonly CombinePiece[] {
	if (setupOf(state).kind !== 'combine') return [];
	const scaled = scale(state.scalar, state.a);
	const ends: readonly (readonly [CombinePiece['id'], Vec2, Vec2])[] = [
		['scaled', ORIGIN, scaled],
		['scaledB', scaled, sumOf(state)],
	];
	return ends.flatMap(([id, from, to]) => {
		if (equals(from, to)) return [];
		const clipped = clipSegment(from, to);
		if (!clipped) return [];
		return [{ id, from: clipped.from, to: clipped.to, head: clipped.tipShown && pieceLength(clipped) >= MIN_HEADED_PIECE }];
	});
}

/** Where the small ink dot marks c a + d b on span-reach: whenever the sum is on the board, even when d b isn't drawn. */
export function sumDot(state: VectorState): Vec2 | null {
	if (setupOf(state).kind !== 'combine') return null;
	const sum = sumOf(state);
	return withinView(sum) ? sum : null;
}

/** The span line's two ends after Check, when a and b line up; null otherwise. Never the grid points the slider reaches. */
export function spanLine(state: VectorState): readonly [Vec2, Vec2] | null {
	const kind = setupOf(state).kind;
	if (!state.checked || (kind !== 'combine' && kind !== 'span-choice')) return null;
	if (spanKind(state.a, state.b) !== 'line') return null;
	return spanLineEnds(isZero(state.a) ? state.b : state.a);
}

/** How far the flag's label sits from the ring's center, in grid units: clear of the ring at every plane size. */
const FLAG_LABEL_GAP = 1.2;
/** Where along the span line its label sits, as a share of the positive half. */
const SPAN_LABEL_AT = 0.8;

/**
 * a and b from the origin, labeled on opposite sides; when b runs back along a its direction is reversed, so the same
 * physical side needs the other sign. Two zero vectors share one label.
 */
function pairLabels(a: Vec2, b: Vec2, aSide: 1 | -1): PlaneLabel[] {
	if (isZero(a) && isZero(b)) return [{ id: 'zero', text: 'a and b: zero vectors', at: labelAnchor(ORIGIN, ORIGIN, 1), away: labelAway(ORIGIN, ORIGIN, 1) }];
	const reversed = cross(a, b) === 0 && dot(a, b) < 0;
	const bSide = reversed ? aSide : aSide === 1 ? -1 : 1;
	return [arrowLabel('a', 'a', ORIGIN, a, aSide), arrowLabel('b', 'b', ORIGIN, b, bSide)];
}

/**
 * The span label, on side −1 at 0.8 of one half of the line: the half whose spot is farther from every tip and handle
 * the plane draws (`marks`), so the label never sits on a handle. The positive half wins a tie.
 */
function spanLabel(end: Vec2, marks: readonly Vec2[]): PlaneLabel {
	const clearance = (spot: Vec2) => Math.min(...marks.map((mark) => lengthSquared(subtract(spot, mark))));
	const half = clearance(scale(-SPAN_LABEL_AT, end)) > clearance(scale(SPAN_LABEL_AT, end)) ? scale(-1, end) : end;
	const away = labelAway(ORIGIN, half, -1);
	return { id: 'span', text: 'span', at: add(scale(SPAN_LABEL_AT, half), scale(LABEL_OFFSET, away)), away };
}

/** The flag's label sits left of the ring, or right of it when the flag is at x ≤ 0. */
function flagLabel(target: Vec2): PlaneLabel {
	const side = target[0] > 0 ? -1 : 1;
	return { id: 'flag', text: 'flag', at: [target[0] + side * FLAG_LABEL_GAP, target[1]], away: null };
}

function combineLabels(state: VectorState): PlaneLabel[] {
	// a and b are muted references here: a's label goes on its right, so c a (on top of a when c = 1) can take the left.
	const labels = pairLabels(state.a, state.b, -1);
	for (const piece of combinePieces(state)) {
		if (pieceLength(piece) < MIN_LABELED_PIECE) continue;
		labels.push(piece.id === 'scaled' ? arrowLabel('scaled', 'c a', piece.from, piece.to, 1) : arrowLabel('scaledB', 'd b', piece.from, piece.to, -1));
	}
	const target = requireFlag(setupOf(state)).target;
	labels.push(flagLabel(target));
	const line = spanLine(state);
	if (line) labels.push(spanLabel(line[1], [state.a, state.b, scale(state.scalar, state.a), sumOf(state), target]));
	return labels;
}

function spanChoiceLabels(state: VectorState): PlaneLabel[] {
	const labels = pairLabels(state.a, state.b, 1);
	const line = spanLine(state);
	if (line) labels.push(spanLabel(line[1], [state.a, state.b]));
	return labels;
}

/** Every text label drawn on the plane, in board ink. Before Check none of them names the answer. */
export function planeLabels(state: VectorState): readonly PlaneLabel[] {
	const setup = setupOf(state);
	const { a, b } = state;
	const trips = isTrips(state);
	const labels: PlaneLabel[] = [];
	if (trips) labels.push({ id: 'east', text: 'east', at: [VIEW_LIMIT - 0.2, -0.45], away: null }, { id: 'north', text: 'north', at: [0.75, VIEW_LIMIT - 0.2], away: null });
	switch (setup.kind) {
		case 'add': {
			const sum = add(a, b);
			// b's label goes on the other side of the line from a's. When b runs straight back along a, its direction is
			// reversed, so the same physical side needs the other sign.
			const bSide = cross(a, b) === 0 && dot(a, b) < 0 ? 1 : -1;
			labels.push(arrowLabel('a', trips ? 'trip a' : 'a', ORIGIN, a, 1), arrowLabel('b', trips ? 'trip b' : 'b', a, sum, bSide));
			if (!state.checked) labels.push({ id: 'guess', text: 'your guess', at: labelAnchor(state.guess, state.guess, 1), away: labelAway(state.guess, state.guess, 1) });
			else labels.push(arrowLabel('sum', trips ? 'both trips' : 'a + b', ORIGIN, sum, -1));
			break;
		}
		case 'scale': {
			const scaled = scale(state.scalar, a);
			labels.push(arrowLabel('a', 'a', ORIGIN, a, 1));
			if (!isZero(a)) labels.push(arrowLabel('scaled', 'c a', ORIGIN, scaled, -1));
			break;
		}
		case 'cart': {
			const trackLength = Math.sqrt(lengthSquared(b));
			// The shadow's label goes inside the triangle the push makes with the track; the track's goes outside it.
			const pushSide = cross(b, a) >= 0 ? 1 : -1;
			// The push's own label goes on its side away from the track.
			const pushLabelSide = cross(a, b) > 0 ? -1 : 1;
			labels.push(arrowLabel('a', 'your push', ORIGIN, a, pushLabelSide), arrowLabel('track', `${trackName(state)}, length ${numberText(trackLength)}`, ORIGIN, b, pushSide === 1 ? -1 : 1));
			const goal = setup.goal;
			if (goal) {
				const radius = Math.sqrt(goal.targetLengthSquared);
				labels.push({ id: 'circle', text: `length ${numberText(radius)}`, at: [-radius * 0.72, radius * 0.72 + 0.35], away: null });
			}
			const shadow = cartShadow(state);
			if (shadow) {
				if (!isZero(shadow.tip)) labels.push(arrowLabel('shadow', 'moves the cart', ORIGIN, shadow.tip, pushSide));
				// The rails label sits a third of the way up the line from the track: the push arrow meets the line at its
				// other end, so a label moved inside the triangle near an edge (fitLabel) stays clear of the push.
				if (shadow.onBoard && !equals(shadow.tip, a)) {
					const labelSpan = add(shadow.tip, scale(RAILS_LABEL_SPAN, subtract(a, shadow.tip)));
					labels.push(arrowLabel('rails', 'into the rails', shadow.tip, labelSpan, cross(b, a) > 0 ? -1 : 1));
				}
			}
			break;
		}
		case 'align': {
			labels.push(arrowLabel('a', 'a', ORIGIN, a, 1), arrowLabel('b', 'b', ORIGIN, b, -1));
			// A shadow shorter than one grid unit sits too close to the center for a label; the readout names it.
			const tip = state.checked ? shadowTip(a, b) : null;
			if (tip && lengthSquared(tip) >= 1) labels.push(arrowLabel('shadow', 'shadow of b', ORIGIN, tip, cross(a, b) > 0 ? -1 : 1));
			if (showsArc(state)) labels.push({ id: 'theta', text: 'θ', at: bisectorPoint(a, b, THETA_RADIUS), away: null });
			break;
		}
		case 'combine':
			labels.push(...combineLabels(state));
			break;
		case 'span-choice':
			labels.push(...spanChoiceLabels(state));
			break;
		case 'norms':
			if (trips) labels.push({ id: 'home', text: 'home', at: [-0.8, -0.45], away: null });
			labels.push(arrowLabel('a', 'v', ORIGIN, a, 1), ...shapeLabels(state).map((label) => ({ ...label, away: null })));
			break;
	}
	return labels;
}

interface ChalkText {
	long: string;
	short: string;
}

/** The align note follows the current a and b, so it never contradicts the readouts after a preset or a drag. */
const ALIGN_NOTES: Readonly<Record<Sign, ChalkText>> = {
	positive: { long: 'narrower than a right angle: positive', short: 'under a right angle: positive' },
	zero: { long: 'a right angle: zero', short: 'right angle: zero' },
	negative: { long: 'wider than a right angle: negative', short: 'past a right angle: negative' },
};

const ADD_NOTES = {
	lengthsDont: { long: "the trips add, the lengths don't", short: "trips add, lengths don't" },
	sameDirection: { long: 'same direction: the lengths add too', short: 'same way: lengths add' },
} as const satisfies Record<string, ChalkText>;

/**
 * The add note follows a and b too, so it agrees with the Arrows readout (sumLengthLine): the lengths add when both
 * trips point the same way. A zero trip or a zero sum has nothing to compare, so it gets no note.
 */
function addNote(a: Vec2, b: Vec2): ChalkText | null {
	if (isZero(a) || isZero(b) || isZero(add(a, b))) return null;
	return cross(a, b) === 0 && dot(a, b) > 0 ? ADD_NOTES.sameDirection : ADD_NOTES.lengthsDont;
}

/** The span note follows the current a and b, like the align note. */
const SPAN_NOTES: Readonly<Record<SpanKind, ChalkText>> = {
	origin: { long: 'no direction: just the origin', short: 'just the origin' },
	line: { long: 'one direction: a line', short: 'just a line' },
	plane: { long: 'two directions: every point', short: 'every point' },
};

/** Notes drawn on the board after Check. Qualitative only, never a number (ChalkNote). */
export function chalkNote(state: VectorState): ChalkText | null {
	if (!state.checked) return null;
	switch (setupOf(state).kind) {
		case 'span-choice':
			return SPAN_NOTES[spanKind(state.a, state.b)];
		case 'combine':
			// span-reach's plane is already busy with four arrows, the flag and the span line.
			return null;
		case 'add':
			return addNote(state.a, state.b);
		case 'cart':
			return { long: 'only the part along the track moves it', short: 'only the track part counts' };
		case 'align':
			// A zero vector has no angle, so there is nothing to say about one.
			return angleOf(state.a, state.b) ? ALIGN_NOTES[signOf(dot(state.a, state.b))] : null;
		case 'norms':
			return normsChalkNote;
		case 'scale':
			return null;
	}
}

/** Where the chalk note sits on the plane. */
export type ChalkCorner = 'top-left' | 'bottom-left';

/**
 * The top-left corner holds the north label on trips boards and the y-axis's top number and "length 5" on the cart,
 * so those notes move to the lower-left quadrant, which none of their openings or presets that show a note reaches.
 */
export function chalkNoteCorner(state: VectorState): ChalkCorner {
	const kind = setupOf(state).kind;
	return kind === 'add' || kind === 'cart' ? 'bottom-left' : 'top-left';
}

// ---- The coordinate table ----

export interface TableRow {
	id: VectorId | 'sum' | 'scaled' | 'track' | 'scaledB' | 'combo';
	name: string;
	x: string;
	y: string;
	/** Empty for the guess (its length says nothing about the trips) and for city-walk's pin. */
	length: string;
	/** The row as one sentence, for screen readers. */
	spoken: string;
	/** The vector this row's − / + buttons move, or null when the row has none. */
	stepId: VectorId | null;
}

const COORDINATE_COLUMNS = { x: 'x (east)', y: 'y (north)' } as const;
/** city-walk's Blocks stage counts the pin's blocks, not a trip's steps. */
const BLOCKS_COLUMNS = { x: 'Blocks east', y: 'Blocks north' } as const;

/** The coordinate table's headers. city-walk has no coordinate table: it folds NormTable (NORM_TABLE_HEADERS) instead. */
export function tableHeaders(state: VectorState) {
	if (setupOf(state).kind === 'norms') throw new Error('VectorBoard2D: city-walk has no coordinate table; its strip uses stepperHeaders and its fold NORM_TABLE_HEADERS.');
	if (isTrips(state)) return { caption: 'Where each trip goes', vector: 'Trip', x: 'Steps east', y: 'Steps north', length: 'Length' };
	const caption = setupOf(state).kind === 'cart' ? `Your push a and the track ${trackName(state)}` : 'The vectors on the board';
	return { caption, vector: 'Vector', ...COORDINATE_COLUMNS, length: 'Length' };
}

function row(state: VectorState, id: TableRow['id'], name: string, v: Vec2, stepId: VectorId | null): TableRow {
	const norms = setupOf(state).kind === 'norms';
	let spoken = isTrips(state) ? `${name}: ${stepsWords(v)}.` : id === 'guess' ? `${name}: ${pairText(v)}.` : `${name} = ${pairText(v)}.`;
	if (norms) spoken = isTrips(state) ? pinSentence(v) : `${name}: ${pairText(v)}.`;
	// The guess's length says nothing about the trips, and the pin's straight length is city-walk's answer (its own
	// NormTable gives it after Check), so both rows leave it empty.
	return { id, name, x: numberText(v[0]), y: numberText(v[1]), length: id === 'guess' || norms ? '' : lengthText(v), spoken, stepId };
}

/** The rows of the coordinate table, in order. The a + b row exists only after Check. */
export function tableRows(state: VectorState): readonly TableRow[] {
	const kind = setupOf(state).kind;
	const steppable = steppableVectors(state);
	const can = (id: VectorId) => (steppable.includes(id) ? id : null);
	const trips = isTrips(state);
	switch (kind) {
		case 'add': {
			const rows = [row(state, 'a', trips ? 'Trip a' : 'a', state.a, can('a')), row(state, 'b', trips ? 'Trip b' : 'b', state.b, can('b'))];
			if (!state.checked) return [row(state, 'guess', 'Your guess', state.guess, 'guess'), ...rows];
			return [...rows, row(state, 'sum', trips ? 'Both trips' : 'a + b', add(state.a, state.b), null)];
		}
		case 'scale':
			return [row(state, 'a', 'a', state.a, 'a'), row(state, 'scaled', 'c a', scale(state.scalar, state.a), null)];
		case 'cart':
			return [row(state, 'a', 'a', state.a, 'a'), row(state, 'track', trackName(state), state.b, null)];
		case 'align':
		case 'span-choice':
			return [row(state, 'a', 'a', state.a, can('a')), row(state, 'b', 'b', state.b, can('b'))];
		case 'norms':
			return [row(state, 'a', 'Your pin', state.a, 'a')];
		case 'combine': {
			const scaled = scale(state.scalar, state.a);
			const scaledB = scale(state.scalarD, state.b);
			return [
				row(state, 'a', 'a', state.a, can('a')),
				row(state, 'b', 'b', state.b, can('b')),
				row(state, 'scaled', 'c a', scaled, null),
				row(state, 'scaledB', 'd b', scaledB, null),
				row(state, 'combo', 'c a + d b', add(scaled, scaledB), null),
			];
		}
	}
}

/** The rows the step strip under the plane shows: the table's rows that have − / + buttons, in the table's order. */
export function stepperRows(state: VectorState): readonly (TableRow & { stepId: VectorId })[] {
	return tableRows(state).filter((tableRow): tableRow is TableRow & { stepId: VectorId } => tableRow.stepId !== null);
}

/**
 * The strip's column words over the two stepper columns: the coordinate table's own headers ("Steps east", "x (east)"),
 * or on city-walk, which has no coordinate table, "Blocks east" in Blocks and the plain coordinates in Numbers.
 */
export function stepperHeaders(state: VectorState): { x: string; y: string } {
	if (setupOf(state).kind === 'norms') return isTrips(state) ? BLOCKS_COLUMNS : COORDINATE_COLUMNS;
	const { x, y } = tableHeaders(state);
	return { x, y };
}

/** "Your guess" becomes "your guess" inside a sentence; vector names such as "a" or "c a" are already lowercase. */
const inSentence = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);
/** "Steps east" becomes "steps east", and "x (east)" just "x". */
const headerWords = (header: string) => inSentence(header.replace(/ \(.*\)$/, ''));

/** The body said after "Table shown under the switch.": the table's rows and columns, in spoken form. */
export function tableFoldSentence(state: VectorState): string {
	// city-walk folds its own table of the three measures, not the coordinate table (NormTable).
	if (setupOf(state).kind === 'norms') return normTableSentence(state);
	const headers = tableHeaders(state);
	const rows = joinWords(tableRows(state).map((tableRow) => inSentence(tableRow.name)));
	const columns = joinWords([headers.x, headers.y, headers.length].map(headerWords));
	return spoken(`It has a row each for ${rows}, with ${columns}.`);
}

/** Which table rows the Lists stage writes as columns: every row but the guess, and on combine only a, b and the sum. */
function listsColumn(kind: SetupKind, id: TableRow['id']): boolean {
	switch (kind) {
		case 'combine':
			return id === 'a' || id === 'b' || id === 'combo';
		case 'add':
		case 'scale':
		case 'cart':
		case 'align':
		case 'span-choice':
		case 'norms':
			return id !== 'guess';
	}
}

/** The column vectors of the Lists stage, as an empty list in other stages. */
export function columnVectors(state: VectorState): readonly { name: string; x: string; y: string; spoken: string }[] {
	if (state.stage !== 'lists') return [];
	const kind = setupOf(state).kind;
	return tableRows(state)
		.filter((tableRow) => listsColumn(kind, tableRow.id))
		.map((tableRow) => ({ name: tableRow.name, x: tableRow.x, y: tableRow.y, spoken: `${tableRow.name} is the column ${tableRow.x}, ${tableRow.y}` }));
}

/** The Lists stage's sum or scaling, component by component. */
export function listsLine(state: VectorState): string | null {
	if (state.stage !== 'lists') return null;
	const { a, b } = state;
	switch (setupOf(state).kind) {
		case 'add':
			return state.checked ? `a + b = (${numberText(a[0])} + ${factor(b[0])}, ${numberText(a[1])} + ${factor(b[1])}) = ${pairText(add(a, b))}` : null;
		case 'scale': {
			const c = factor(state.scalar);
			return `c a = (${c} × ${factor(a[0])}, ${c} × ${factor(a[1])}) = ${pairText(scale(state.scalar, a))}`;
		}
		case 'combine': {
			// Only the reader's own c and d, so it needs no Check.
			const c = factor(state.scalar);
			const d = factor(state.scalarD);
			return `c a + d b = (${c} × ${factor(a[0])} + ${d} × ${factor(b[0])}, ${c} × ${factor(a[1])} + ${d} × ${factor(b[1])}) = ${pairText(sumOf(state))}`;
		}
		case 'cart':
		case 'align':
		case 'span-choice':
		case 'norms':
			return null;
	}
}

// ---- Steppers and refusals ----

export function stepperName(state: VectorState, id: VectorId, axis: Axis, direction: Direction): string {
	return `Move ${shortName(state, id)} 1 ${DIRECTION_WORDS[axis][direction]}`;
}

/** One group per axis inside each vector's row of the step strip: "Move a east or west". */
export function stepperGroupName(state: VectorState, id: VectorId, axis: Axis): string {
	return `Move ${shortName(state, id)} ${axis === 'x' ? 'east or west' : 'north or south'}`;
}

export function refusalText(state: VectorState, refusal: Refusal): string {
	if (refusal.kind === 'locked') return LOCKED_TEXT;
	if (refusal.kind === 'no-guess') return noGuessText(setupOf(state).kind);
	const name = sentenceName(state, refusal.id);
	const way = DIRECTION_WORDS[refusal.axis][refusal.direction];
	if (refusal.kind === 'edge') return `${name} can't go further ${way}: the board ends at ${numberText(refusal.direction * VIEW_LIMIT)}.`;
	if (refusal.kind === 'sum-edge') return `${name} can't go further ${way}: a + b would leave the board.`;
	const setup = setupOf(state);
	const limit = refusal.id === 'b' ? setup.limitB : setup.limitA;
	return `${name} can't go further ${way}: its entries stay between ${numberText(-limit)} and ${limit}.`;
}

/** A stable key per distinct reason, so the board can give each visible note an id. */
export function refusalKey(refusal: Refusal): string {
	if (refusal.kind === 'locked' || refusal.kind === 'no-guess') return refusal.kind;
	return `${refusal.kind}-${refusal.id}-${refusal.axis}-${refusal.direction}`;
}

/** The visible notes for every stepper refused right now, one per distinct reason. */
export function refusalNotes(state: VectorState): readonly { key: string; text: string }[] {
	const notes = new Map<string, string>();
	for (const id of steppableVectors(state)) {
		for (const axis of AXES) {
			for (const direction of DIRECTIONS) {
				const refusal = stepRefusal(state, id, axis, direction);
				if (refusal) notes.set(refusalKey(refusal), refusalText(state, refusal));
			}
		}
	}
	return [...notes].map(([key, text]) => ({ key, text }));
}

// ---- Announcements ----

/**
 * The sentences for a handle's refusals. An edge is named for what reaches it (a + b on a sum-edge); when one thing
 * reaches an x edge and a y edge, the two become one corner sentence: "a + b is at the top-right corner of the board."
 */
function edgeSentences(state: VectorState, refusals: readonly Refusal[]): string[] {
	const edges = new Map<string, Partial<Record<Axis, Direction>>>();
	const others: string[] = [];
	for (const refusal of refusals) {
		if (refusal.kind !== 'edge' && refusal.kind !== 'sum-edge') {
			others.push(refusalText(state, refusal));
			continue;
		}
		const name = refusal.kind === 'sum-edge' ? 'a + b' : sentenceName(state, refusal.id);
		edges.set(name, { ...edges.get(name), [refusal.axis]: refusal.direction });
	}
	const sentences = [...edges].map(([name, { x, y }]) => {
		if (x !== undefined && y !== undefined) return `${name} is at the ${EDGE_WORDS.y[y]}-${EDGE_WORDS.x[x]} corner of the board.`;
		const where = x !== undefined ? EDGE_WORDS.x[x] : y !== undefined ? EDGE_WORDS.y[y] : null;
		if (!where) throw new Error(`VectorBoard2D: edge sentence for "${name}" has no edge.`);
		return `${name} is at the ${where} edge of the board.`;
	});
	return [...sentences, ...others];
}

function cartShort(state: VectorState): string {
	const forward = forwardPart(state.a, state.b);
	if (forward === 0) return "The cart doesn't move.";
	if (forward < 0) return `Its part along the track is ${decimalText(forward)}: the cart rolls backward.`;
	return `The cart gets ${decimalText(forward)} of it.`;
}

function alignShort(state: VectorState): string {
	const angle = angleOf(state.a, state.b);
	if (!angle) {
		if (isZero(state.a) && isZero(state.b)) return 'The angle is undefined: neither has a direction.';
		return `The angle is undefined: ${isZero(state.b) ? 'b' : 'a'} has no direction.`;
	}
	if ('approx' in angle) return `Angle about ${angle.approx.toFixed(1)}°.`;
	if (angle.exact === 90) return 'Exactly 90°: perpendicular.';
	if (angle.exact === 0) return 'Exactly 0°: same direction.';
	if (angle.exact === 180) return 'Exactly 180°: opposite directions.';
	return `Exactly ${angle.exact}°.`;
}

/** Where a and b are now on combine: the sum, anything past the edge, and after Check the span. */
function combinePosition(state: VectorState): string {
	const edge = edgeSentence(state);
	const parts = [`${pairsLine(state)} c a + d b = ${pairText(sumOf(state))}.`, ...(edge ? [edge] : []), ...(state.checked ? [spanSentence(state.a, state.b)] : [])];
	return parts.join(' ');
}

function positionSentence(state: VectorState, handle: HandleId): string {
	const { a, b } = state;
	if (handle === 'guess') return `Your guess: ${isTrips(state) ? stepsWords(state.guess) : pairText(state.guess)}.`;
	switch (setupOf(state).kind) {
		case 'add': {
			const sum = add(a, b);
			if (isTrips(state)) return handle === 'a' ? `Trip a: ${stepsWords(a)}. Both trips: ${stepsWords(sum)}.` : `Trip b: ${stepsWords(b)}. Both trips: ${stepsWords(sum)}.`;
			return handle === 'a' ? `a = ${pairText(a)}. a + b = ${pairText(sum)}.` : `b = ${pairText(b)}. a + b = ${pairText(sum)}.`;
		}
		case 'scale':
			return `a = ${pairText(a)}. ${state.checked ? scaleSentence(state.scalar, a) : `c a = ${pairText(scale(state.scalar, a))}.`}`;
		case 'cart':
			return `Your push: ${pairText(a)}, length ${lengthText(a)}.${state.checked && !isZero(a) ? ` ${cartShort(state)}` : ''}`;
		case 'align':
			return `a = ${pairText(a)}, b = ${pairText(b)}. a · b = ${numberText(dot(a, b))}. ${alignShort(state)}`;
		case 'combine':
			return combinePosition(state);
		case 'span-choice':
			return state.checked ? `${pairsLine(state)} ${spanSentence(a, b)}` : pairsLine(state);
		case 'norms':
			return normsPosition(state);
	}
}

/**
 * A "the" that spoken() puts at the start of a sentence. Only that word is capitalized: vector names such
 * as a, b and v keep their case, since a capital reads as a matrix.
 */
const SENTENCE_START_THE = /(^|\. )the (?=(?:L1 norm|L2 norm|L-infinity norm|length) of )/g;

/**
 * The live region's wording of the board's symbols. Screen readers at their default punctuation level skip ‖ and ·,
 * which would turn "a · b ÷ ‖a‖" into "a b divided by a", so announcements say them as the notation registry does:
 * "a dot b", "the length of a", "u hat", "theta". The visible text keeps the symbols.
 */
export function spoken(text: string): string {
	return text
		.replace(/‖v‖₁/g, 'the L1 norm of v')
		.replace(/‖v‖₂/g, 'the L2 norm of v')
		.replace(/‖v‖∞/g, 'the L-infinity norm of v')
		.replace(/‖([^‖]+)‖/g, 'the length of $1')
		// Absolute values: without the bars "|−3| + |4|" would be heard as "minus 3 + 4".
		.replace(/\|([^|]+)\|/g, 'the size of $1')
		.replace(/max\(([^()]+)\)/g, 'the larger of $1')
		.replace(/ · /g, ' dot ')
		.replace(/û/g, 'u hat')
		.replace(/θ/g, 'theta')
		.replace(SENTENCE_START_THE, '$1The ');
}

/** A visible line with its symbols in words for screen readers, for SpokenText: readouts, the verdict, table headers. */
export function spokenLine(text: string): SpokenLine {
	return { visible: text, spoken: spoken(text) };
}

/** What a handle's move says when it ends: where things are now, any edge it reached, and stacked handles. */
export function handleAnnouncement(state: VectorState, handle: HandleId): string {
	const parts = [positionSentence(state, handle), ...edgeSentences(state, handleRefusals(state, handle))];
	const points = handleIds(state).map((id) => handlePoint(state, id));
	if (points.length === 2 && equals(points[0], points[1])) parts.push(`Both handles are at ${pairText(points[0])}.`);
	return spoken(parts.join(' '));
}

const HANDLE_OF_VECTOR = (state: VectorState, id: VectorId): HandleId => (id === 'b' && setupOf(state).kind === 'add' ? 'sum' : id);

/** What the live region says once an interaction ends, with symbols in their spoken form. */
export function announcementFor(state: VectorState, action: Action): string {
	return spoken(announcementText(state, action));
}

function announcementText(state: VectorState, action: Action): string {
	switch (action.type) {
		case 'move':
			return handleAnnouncement(state, action.id);
		case 'step':
			return state.refusal ? refusalText(state, state.refusal) : handleAnnouncement(state, HANDLE_OF_VECTOR(state, action.id));
		case 'sign':
			return `Your guess: a · b is ${action.sign}.`;
		case 'span-guess':
			return `Your guess: the span is ${SPAN_GUESS_WORDS[action.guess]}.`;
		case 'shape-guess':
			return shapeGuessAnnouncement(action.guess);
		case 'measure':
			return measureAnnouncement(state);
		case 'radius':
			return radiusAnnouncement(state);
		case 'check':
		case 'show-answer':
			if (state.refusal) return refusalText(state, state.refusal);
			// Once checked, focus moves to the verdict, which is read there (decision 0019).
			return state.checked ? '' : (feedbackLine(state) ?? '');
		case 'preset':
			return setupOf(state).kind === 'norms' ? normsPresetAnnouncement(state) : readoutLines(state).join(' ');
		case 'stage':
			return `Showing ${stageLabel(setupOf(state), action.stage).toLowerCase()}.`;
		case 'scalar':
			// On combine the span and flag sentences don't change with c or d, so a commit says only the reader's values.
			return (setupOf(state).kind === 'combine' ? combineSliderLines(state) : readoutLines(state)).join(' ');
		case 'other-order':
			return action.on ? 'Showing b first too: walking b, then a, ends at the same spot.' : 'Showing one route: a, then b.';
		case 'table':
			return tableFoldAnnouncement(action.open, tableFoldSentence(state));
		case 'reset':
			return `Board reset. ${statusLine(state)}`;
	}
}

/** A weight slider's spoken value: "scale c, 1", "scale d, −0.5". */
export const weightDescription = (weight: Weight) => (value: number) => `scale ${weight}, ${numberText(value)}`;
/** The slider's spoken value and readout. */
export const scalarDescription = weightDescription('c');
export const scalarFormat = (c: number) => numberText(c);
/** Each weight slider's visible label: the c slider keeps the scale setup's "Scale c". */
export const WEIGHT_LABELS: Readonly<Record<Weight, string>> = { c: CONTROL_LABELS.scale, d: CONTROL_LABELS.scaleD };
