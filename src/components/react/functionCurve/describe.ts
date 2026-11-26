// Every sentence FunctionCurve shows or speaks, as { visible, spoken } pairs: the screen writes "x = −0.5" and "y = x²",
// a screen reader hears "x equals minus 0.5" and "y equals x squared". Pure, so scripts/check-boards.mjs pins every
// string. Board strings are plain Unicode, never KaTeX (decision 0007). Design and reasoning: decision 0020.
import { absoluteFraction, compareFractions, fraction, type Fraction } from '../boardMath.ts';
import { capitalize, joinWords } from '../boardText.ts';
import { canShowAnswer } from '../guided/guided.ts';
import type { SpokenLine } from '../guided/spokenLine.ts';
import { tableFoldAnnouncement } from '../guided/tableFold.ts';
import { evaluate, slopeAt, type ExactFunction } from './functions.ts';
import { cornerLine, miss, numberText, offBoard, ruler, spokenNumber, type Miss } from './model.ts';
import { H_LADDER, PRE_CHECK_H_INDICES, PRESETS, SLIDE_X_INDICES, curveOf, guessValue, pointValue, viewOf, type Choice, type PresetId, type Stage } from './setups.ts';
import { allowedHIndices, covered, curveFor, hOf, lineSlopeOf, lineSlopesOf, pointOf, setupOf, type Action, type CurveState } from './state.ts';

type Part = string | SpokenLine;

/** Joins plain text and spoken pairs into one pair. */
export function line(...parts: Part[]): SpokenLine {
	const visible = parts.map((part) => (typeof part === 'string' ? part : part.visible)).join('');
	const spoken = parts.map((part) => (typeof part === 'string' ? part : part.spoken)).join('');
	return { visible, spoken };
}

const EQUALS: SpokenLine = { visible: ' = ', spoken: ' equals ' };
const num = spokenNumber;
const isOne = (value: Fraction) => value.numerator === value.denominator;
const squares = (value: Fraction) => (isOne(value) ? 'square' : 'squares');

export const STAGE_LABELS: Readonly<Record<Stage, string>> = { slide: 'Slide', ruler: 'Ruler', tangent: 'Tangent', 'slope-curve': 'Slope curve' };

export const CONTROL_LABELS = {
	h: 'Ruler length h',
	lineSlope: 'Line slope s',
	showAs: 'Show as',
	check: 'Check',
	showAnswer: 'Show the answer',
	lines: 'Lines under the corner',
	presets: 'Curve presets',
	presetsCaption: 'Curves',
} as const;

export const CHOICE_OPTIONS: readonly { value: Choice; label: string }[] = [
	{ value: 'one', label: 'One slope' },
	{ value: 'two', label: 'Two different slopes' },
];

const variableOf = (state: CurveState) => curveFor(state).variable;
/** "x = 1", spoken "x equals 1". */
const at = (variable: string, value: Fraction): SpokenLine => line(variable, EQUALS, num(value));
const pointAt = (state: CurveState) => at(variableOf(state), pointOf(state));

/** The point the setup asks about: x = 1 on ruler-to-tangent, x = 0 on corner. */
function questionPoint(state: CurveState): { f: ExactFunction; a: Fraction } {
	const preset = PRESETS[setupOf(state).openingPreset];
	return { f: curveOf(preset.id), a: pointValue(preset.xIndex) };
}

/** The guess slider's label, "Your slope at x = 1". */
export function guessLabel(state: CurveState): string {
	const { f, a } = questionPoint(state);
	return `Your slope at ${f.variable} = ${numberText(a)}`;
}

/** The choice's legend, "Slope at x = 0". */
export function choiceLegend(state: CurveState): string {
	const { f, a } = questionPoint(state);
	return `Slope at ${f.variable} = ${numberText(a)}`;
}

export const pointLabel = (state: CurveState): string => `Point ${variableOf(state)}`;

export function statusLine(state: CurveState): SpokenLine | null {
	if (!covered(state)) return null;
	const { f, a } = questionPoint(state);
	if (setupOf(state).guess) return line('Find the slope exactly at ', at(f.variable, a), ': try rulers on both sides, set your guess, then press Check.');
	return line('Try rulers on both sides of ', at(f.variable, a), ', then choose One slope or Two different slopes and press Check.');
}

export function boardLabel(state: CurveState): SpokenLine {
	const f = curveFor(state);
	const from = line(' with a ruler from ', pointAt(state), '.');
	if (!covered(state)) {
		return line('The curve ', f.name, from, ` Move the point with the ${pointLabel(state)} slider and choose the ruler with Ruler length h.`);
	}
	if (setupOf(state).guess) {
		return line('The curve ', f.name, from, ' Choose the ruler with the Ruler length h slider, set Your slope at ', pointAt(state), ', then press Check.');
	}
	return line('The ', f.name, ' curve', from, ' Try ruler lengths on both sides with the Ruler length h slider, choose One slope or Two different slopes, then press Check.');
}

/** The note under the h slider. */
export function hNote(state: CurveState): SpokenLine {
	const first = line('h', EQUALS, '0 is left out: rise 0 over run 0 has no value.');
	return covered(state) ? line(first, ' Shorter rulers appear after Check.') : first;
}

/** Line A, the point. */
export function pointLine(state: CurveState): SpokenLine {
	const f = curveFor(state);
	const a = pointOf(state);
	const y = evaluate(f, a);
	if (state.stage === 'slide') return line(`You sit ${numberText(a)} ${squares(a)} across, ${numberText(y)} ${squares(y)} up.`);
	if (f.id === 'loss') return line('Loss at ', at('w', a), ': ', num(y), '.');
	return line('Point: ', at('x', a), ', ', at('y', y), '.');
}

/** Line B, the ruler. */
export function rulerLine(state: CurveState): SpokenLine {
	const r = ruler(curveFor(state), pointOf(state), hOf(state));
	if (state.stage === 'slide') {
		const up = `: ${numberText(r.slope)} up for every 1 across.`;
		if (r.run.numerator > 0) return line(`A pencil to ${numberText(r.end.x)} across climbs ${numberText(r.rise)} ${squares(r.rise)} in ${numberText(r.run)}${up}`);
		const drop = absoluteFraction(r.rise);
		return line(`A pencil back to ${numberText(r.end.x)} across drops ${numberText(drop)} ${squares(drop)} in ${numberText(absoluteFraction(r.run))}${up}`);
	}
	return line('Ruler to ', at(variableOf(state), r.end.x), ': rise ', num(r.rise), ' over run ', num(r.run), ', slope ', num(r.slope), '.');
}

/** The edge sentence, when the ruler's other end is off the board. */
export function edgeLine(state: CurveState): SpokenLine | null {
	const r = ruler(curveFor(state), pointOf(state), hOf(state));
	if (!offBoard(viewOf(state.preset).view, r.end)) return null;
	if (state.stage === 'slide') return line("The pencil's other end is off the paper.");
	const height = curveFor(state).id === 'loss' ? line(', loss ', num(r.end.y)) : line(', ', at('y', r.end.y));
	return {
		visible: `The ruler's other end, (${numberText(r.end.x)}, ${numberText(r.end.y)}), is off the board.`,
		spoken: line("The ruler's other end, at ", at(variableOf(state), r.end.x), height, ', is off the board.').spoken,
	};
}

/** " This ruler's slope, 2.01, is 0.01 above it." */
function comparison(rulerSlope: Fraction, result: Miss): SpokenLine {
	const start = line(" This ruler's slope, ", num(rulerSlope), ', ');
	if (result.kind === 'matches') return line(start, 'matches it.');
	return line(start, 'is ', num(result.size), ` ${result.kind} it.`);
}

/** "rulers to the right give 1, rulers to the left give 0" */
const twoSides = (right: Fraction, left: Fraction) => line('rulers to the right give ', num(right), ', rulers to the left give ', num(left));

function lossDirection(slope: Fraction): SpokenLine {
	const sign = compareFractions(slope, fraction(0, 1));
	if (sign === 0) return line('Slope 0: the loss is flat here.');
	return line('Slope ', num(slope), `: a step to the right ${sign < 0 ? 'lowers' : 'raises'} the loss.`);
}

/** Line C, in the Tangent and Slope curve stages only. */
export function tangentLine(state: CurveState): SpokenLine | null {
	if (covered(state) || (state.stage !== 'tangent' && state.stage !== 'slope-curve')) return null;
	const f = curveFor(state);
	const a = pointOf(state);
	const slope = slopeAt(f, a);
	const where = pointAt(state);
	if (state.stage === 'slope-curve') {
		if (slope.kind === 'corner') {
			return line('Slope curve: ', f.name, ' has no slope at ', where, '. ', capitalized(twoSides(slope.right, slope.left)), '.');
		}
		return line('Slope curve: at ', where, ' the slope of ', f.name, ' is ', num(slope.value), '.');
	}
	if (slope.kind === 'corner') return line('No tangent at ', where, ': ', twoSides(slope.right, slope.left), '.');
	const result = miss(f, a, hOf(state));
	if (!result) throw new Error(`FunctionCurve: ${f.id} has a tangent at ${numberText(a)} but no miss`);
	const opening = f.id === 'loss' ? lossDirection(slope.value) : line('Tangent at ', where, ': slope ', num(slope.value), '.');
	return line(opening, comparison(ruler(f, a, hOf(state)).slope, result));
}

const capitalized = (part: SpokenLine): SpokenLine => ({ visible: capitalize(part.visible), spoken: capitalize(part.spoken) });

/** The readout of "Lines under the corner", while it is on. */
export function cornerLineReadout(state: CurveState): SpokenLine | null {
	if (!state.linesOn) return null;
	const s = lineSlopeOf(state);
	switch (cornerLine(curveFor(state), s)) {
		case 'under':
			return line('A line of slope ', num(s), ' through the corner stays on or below the curve everywhere.');
		case 'above-right':
			return line('Slope ', num(s), ': the line rises above the curve to the right of 0.');
		case 'above-left':
			return line('Slope ', num(s), ': the line rises above the curve to the left of 0.');
	}
}

/** Lines A and B, the edge sentence, line C and the corner-line readout, in that order. */
export function readoutLines(state: CurveState): readonly SpokenLine[] {
	return [pointLine(state), rulerLine(state), edgeLine(state), tangentLine(state), cornerLineReadout(state)].filter((entry): entry is SpokenLine => entry !== null);
}

export function noticeLine(state: CurveState): SpokenLine | null {
	switch (state.notice) {
		case null:
			return null;
		case 'slide-preset':
			return line('Showing Ruler: the slide picture is only for ', curveOf('bowl').name, '.');
		case 'slide-range':
			return line('Showing Ruler: the slide picture covers seats from ', at('x', pointValue(SLIDE_X_INDICES[0])), ' to ', at('x', pointValue(SLIDE_X_INDICES[1])), '.');
	}
}

/** The slopes of the pre-Check rulers at the question point: right side from longest to shortest, then the left side. */
function preCheckSlopes(state: CurveState): { right: readonly Fraction[]; left: readonly Fraction[] } {
	const { f, a } = questionPoint(state);
	const slopes = PRE_CHECK_H_INDICES.map((index) => ({ h: H_LADDER[index], slope: ruler(f, a, H_LADDER[index]).slope }));
	const right = slopes.filter((entry) => entry.h.numerator > 0).reverse();
	const left = slopes.filter((entry) => entry.h.numerator < 0);
	return { right: right.map((entry) => entry.slope), left: left.map((entry) => entry.slope) };
}

const listed = (values: readonly Fraction[]) => joinWords(values.map(numberText));

/** Check's verdict, or null while there is none. */
export function feedbackLine(state: CurveState): SpokenLine | null {
	const setup = setupOf(state);
	const { f, a } = questionPoint(state);
	if (setup.guess) {
		const answer = numberText(guessValue(setup.guess.answerIndex));
		const { right, left } = preCheckSlopes(state);
		const evidence = `Rulers to the right gave ${listed(right)}; rulers to the left gave ${listed(left)}. Both sides close in on ${answer}.`;
		if (state.answerShown) return line(`Here it is: ${answer}. ${evidence}`);
		if (state.checked) return line(`Yes, ${answer}. ${evidence}`);
		if (!state.missShown) return null;
		const nudge = canShowAnswer(state) ? ' You can now show the answer.' : '';
		return line(
			`Not yet: ${numberText(guessValue(state.guessIndex))} is not where the rulers close in. Compare a ruler to the right with one to the left: the slope at `,
			at(f.variable, a),
			` sits between them.${nudge}`,
		);
	}
	if (!state.checked) return null;
	const corner = slopeAt(f, a);
	if (corner.kind !== 'corner') throw new Error(`FunctionCurve: setup "${setup.id}" asks about a point with no corner`);
	const sides = line('Every ruler to the right gives ', num(corner.right), ' and every ruler to the left gives ', num(corner.left), ', however short');
	if (state.choice === setup.answerChoice) return line('Yes. ', sides, '. ', capitalized(f.name), ' has no single slope at ', at(f.variable, a), '.');
	return line('Not quite. ', sides, ', so there is no single slope at ', at(f.variable, a), '.');
}

/** The RefusalNote while Check waits for a choice. */
export function checkRefusal(state: CurveState): string | null {
	if (!setupOf(state).choices || state.checked || state.choice !== null) return null;
	return 'Pick One slope or Two different slopes first.';
}

/** The handwritten note, in the Tangent stage of ruler-to-tangent only. */
export function chalkNote(state: CurveState): { long: string; short: string } | null {
	if (covered(state) || !setupOf(state).guess || state.stage !== 'tangent') return null;
	return { long: "shorter ruler, closer to the curve's own tilt", short: 'shorter ruler, closer tilt' };
}

export function presetsFor(state: CurveState): readonly { id: PresetId; label: string }[] {
	if (covered(state)) return [];
	return setupOf(state).presets.map((id) => ({ id, label: PRESETS[id].label }));
}

// ---- Table view ----

/** True when the table compares each ruler with the tangent: Tangent or Slope curve, at a point that has one. */
export function tableShowsMiss(state: CurveState): boolean {
	if (covered(state) || (state.stage !== 'tangent' && state.stage !== 'slope-curve')) return false;
	return slopeAt(curveFor(state), pointOf(state)).kind === 'exact';
}

export function tableHeaders(state: CurveState): { caption: SpokenLine; columns: readonly [string, string, string] } {
	const caption = line('Rulers of length h from ', pointAt(state), ' on ', curveFor(state).name);
	return { caption, columns: tableShowsMiss(state) ? ['h', 'Slope', 'Miss'] : ['h', 'Rise', 'Slope'] };
}

/** One row of the table; every cell is a spoken pair, so "−0.001" is read as "minus 0.001". */
export interface TableRow {
	hIndex: number;
	/** The ruler's length, with " (shown)" on the ruler the plane draws. */
	header: SpokenLine;
	cells: readonly [SpokenLine, SpokenLine];
}

const missCell = (result: Miss): SpokenLine => (result.kind === 'matches' ? line('matches') : line(num(result.size), ` ${result.kind}`));

export function tableRows(state: CurveState): readonly TableRow[] {
	const f = curveFor(state);
	const a = pointOf(state);
	const withMiss = tableShowsMiss(state);
	return allowedHIndices(state).map((hIndex) => {
		const h = H_LADDER[hIndex];
		const r = ruler(f, a, h);
		const result = withMiss ? miss(f, a, h) : null;
		const cells: readonly [SpokenLine, SpokenLine] = result ? [num(r.slope), missCell(result)] : [num(r.rise), num(r.slope)];
		return { hIndex, header: line(num(h), hIndex === state.hIndex ? ' (shown)' : ''), cells };
	});
}

/** The body of the Table view announcement, after the shared opening. */
export function tableFoldBody(state: CurveState): SpokenLine {
	const count = allowedHIndices(state).length;
	const holds = tableShowsMiss(state) ? "their slope and how far each misses the tangent's slope" : 'their rise and slope';
	return line(`It lists the ${count} rulers from `, pointAt(state), `, with ${holds}.`);
}

// ---- Slider value text ----

export const guessFormat = (index: number): string => numberText(guessValue(index));
export const guessDescription = (index: number): string => `your slope ${num(guessValue(index)).spoken}`;

export const hFormat = (state: CurveState) => (position: number): string => numberText(H_LADDER[allowedHIndices(state)[position]]);
export function hDescription(state: CurveState) {
	return (position: number): string => {
		const h = H_LADDER[allowedHIndices(state)[position]];
		const end = ruler(curveFor(state), pointOf(state), h).end.x;
		return line('h', EQUALS, num(h), ', ruler to ', at(variableOf(state), end)).spoken;
	};
}

export const pointFormat = (xIndex: number): string => numberText(pointValue(xIndex));
export function pointDescription(state: CurveState) {
	return (xIndex: number): string => {
		const f = curveFor(state);
		const x = pointValue(xIndex);
		const y = evaluate(f, x);
		return (f.id === 'loss' ? line(at('w', x), ', loss ', num(y)) : line(at('x', x), ', ', at('y', y))).spoken;
	};
}

export const lineSlopeFormat = (state: CurveState) => (index: number): string => numberText(lineSlopesOf(state.preset)[index]);
export const lineSlopeDescription = (state: CurveState) => (index: number): string => `line slope ${num(lineSlopesOf(state.preset)[index]).spoken}`;

// ---- Announcements ----

const spokenAll = (lines: readonly SpokenLine[]) => lines.map((entry) => entry.spoken).join(' ');

/** What the live region says when an interaction ends; null when the control speaks for itself (a radio). */
export function announcementFor(state: CurveState, action: Action): string | null {
	switch (action.type) {
		case 'guess': {
			const { f, a } = questionPoint(state);
			return line('Your slope at ', at(f.variable, a), ': ', num(guessValue(state.guessIndex)), '.').spoken;
		}
		case 'h':
			return spokenAll(readoutLines(state).slice(1));
		case 'point':
		case 'stage':
		case 'preset': {
			// A notice ("Showing Ruler: …") comes first, once, then every readout line.
			const notice = noticeLine(state);
			return spokenAll(notice ? [notice, ...readoutLines(state)] : readoutLines(state));
		}
		case 'check':
		case 'show-answer': {
			const refusal = state.refused ? checkRefusal(state) : null;
			return refusal ?? feedbackLine(state)?.spoken ?? null;
		}
		case 'lines':
		case 'line-slope':
			return cornerLineReadout(state)?.spoken ?? null;
		case 'table':
			return tableFoldAnnouncement(action.open, tableFoldBody(state).spoken);
		case 'reset':
			return statusLine(state)?.spoken ?? null;
		case 'choice':
			return null;
	}
}
