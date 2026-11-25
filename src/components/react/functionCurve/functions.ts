// FunctionCurve's exact catalog: every curve is a piecewise polynomial with Fraction coefficients, so every point,
// rise and slope is exact and prints as a terminating decimal. The derivative comes from the coefficients, and a
// corner is a boundary where the two pieces' derivatives differ. Pure, so scripts/check-boards.mjs checks it.
// Design and reasoning: decision 0020.
import { addFractions, compareFractions, fraction, multiplyFractions, toNumber, type Fraction } from '../boardMath.ts';
import type { SpokenLine } from '../guided/spokenLine.ts';

export type CurveId = 'square' | 'cube' | 'loss' | 'relu' | 'abs';
/** The catalog's curves, plus the one-input slices of slice mode's hill (hill.ts). */
export type FunctionId = CurveId | 'hill-east' | 'hill-north';
export type Variable = 'x' | 'w' | 'y';

/** One polynomial piece on [from, to]; null is an open end. coefficients[i] multiplies the variable to the power i. */
export interface Piece {
	from: Fraction | null;
	to: Fraction | null;
	coefficients: readonly Fraction[];
}

export interface ExactFunction {
	id: FunctionId;
	name: SpokenLine;
	variable: Variable;
	/** In order from left to right, each starting where the previous one ends. */
	pieces: readonly Piece[];
}

export type Slope = { kind: 'exact'; value: Fraction } | { kind: 'corner'; left: Fraction; right: Fraction };

const whole = (value: number) => fraction(value, 1);
const ZERO = whole(0);

/** Horner's rule, exactly. */
function evaluatePolynomial(coefficients: readonly Fraction[], at: Fraction): Fraction {
	let result = ZERO;
	for (let power = coefficients.length - 1; power >= 0; power -= 1) {
		result = addFractions(multiplyFractions(result, at), coefficients[power]);
	}
	return result;
}

/** The coefficients of a polynomial's derivative: i·cᵢ moves down to power i − 1. */
export function derivativeCoefficients(coefficients: readonly Fraction[]): readonly Fraction[] {
	return coefficients.slice(1).map((coefficient, index) => multiplyFractions(coefficient, whole(index + 1)));
}

const contains = (piece: Piece, at: Fraction) =>
	(piece.from === null || compareFractions(at, piece.from) >= 0) && (piece.to === null || compareFractions(at, piece.to) <= 0);

/** Every piece whose closed interval holds `at`: one inside a piece, two at a boundary. */
function piecesAt(f: ExactFunction, at: Fraction): readonly Piece[] {
	const found = f.pieces.filter((piece) => contains(piece, at));
	if (found.length === 0) throw new Error(`functions: ${f.id} has no piece at ${toNumber(at)}`);
	return found;
}

/** f(at), exactly. At a boundary both pieces agree (validateCatalog checks it), so the first is used. */
export function evaluate(f: ExactFunction, at: Fraction): Fraction {
	return evaluatePolynomial(piecesAt(f, at)[0].coefficients, at);
}

/** The slope at `at`: exact inside a piece or where two pieces meet smoothly, a corner where they meet at an angle. */
export function slopeAt(f: ExactFunction, at: Fraction): Slope {
	const [left, right] = piecesAt(f, at);
	const leftSlope = evaluatePolynomial(derivativeCoefficients(left.coefficients), at);
	if (!right) return { kind: 'exact', value: leftSlope };
	const rightSlope = evaluatePolynomial(derivativeCoefficients(right.coefficients), at);
	if (compareFractions(leftSlope, rightSlope) === 0) return { kind: 'exact', value: leftSlope };
	return { kind: 'corner', left: leftSlope, right: rightSlope };
}

/** A piece as a float function, for Mafs to sample. Never used for a number the reader sees. */
export function pieceCurve(coefficients: readonly Fraction[]): (at: number) => number {
	const floats = coefficients.map(toNumber);
	return (at) => floats.reduceRight((result, coefficient) => result * at + coefficient, 0);
}

const piece = (from: Fraction | null, to: Fraction | null, ...coefficients: number[]): Piece => ({ from, to, coefficients: coefficients.map(whole) });

export const CATALOG: Readonly<Record<CurveId, ExactFunction>> = {
	square: { id: 'square', name: { visible: 'y = x²', spoken: 'y equals x squared' }, variable: 'x', pieces: [piece(null, null, 0, 0, 1)] },
	cube: { id: 'cube', name: { visible: 'y = x³', spoken: 'y equals x cubed' }, variable: 'x', pieces: [piece(null, null, 0, 0, 0, 1)] },
	loss: {
		id: 'loss',
		name: { visible: 'L(w) = (w − 3)²', spoken: 'L of w equals w minus 3, squared' },
		variable: 'w',
		pieces: [piece(null, null, 9, -6, 1)],
	},
	relu: { id: 'relu', name: { visible: 'ReLU', spoken: 'relu' }, variable: 'x', pieces: [piece(null, ZERO, 0), piece(ZERO, null, 0, 1)] },
	abs: {
		id: 'abs',
		name: { visible: '|x|', spoken: 'the absolute value of x' },
		variable: 'x',
		pieces: [piece(null, ZERO, 0, -1), piece(ZERO, null, 0, 1)],
	},
};

/** Where each curve's corners are; every other boundary must be smooth. */
export const CORNERS: Readonly<Record<CurveId, readonly Fraction[]>> = { square: [], cube: [], loss: [], relu: [ZERO], abs: [ZERO] };

/**
 * Throws, naming the curve, unless its pieces run from an open left end to an open right end without gaps, meet
 * with equal values at every boundary, and have corners exactly where `corners` lists them.
 */
export function validateFunction(f: ExactFunction, corners: readonly Fraction[]): void {
	const fail = (why: string) => {
		throw new Error(`functions: ${f.id} ${why}`);
	};
	if (f.pieces.length === 0) fail('has no pieces');
	if (f.pieces[0].from !== null || f.pieces[f.pieces.length - 1].to !== null) fail('must have open ends on both sides');
	const found: Fraction[] = [];
	f.pieces.slice(1).forEach((next, index) => {
		const previous = f.pieces[index];
		if (previous.to === null || next.from === null || compareFractions(previous.to, next.from) !== 0) fail(`has a gap after piece ${index}`);
		const boundary = next.from as Fraction;
		if (compareFractions(evaluatePolynomial(previous.coefficients, boundary), evaluatePolynomial(next.coefficients, boundary)) !== 0) {
			fail(`jumps at ${toNumber(boundary)}`);
		}
		if (slopeAt(f, boundary).kind === 'corner') found.push(boundary);
	});
	const same = found.length === corners.length && found.every((at, index) => compareFractions(at, corners[index]) === 0);
	if (!same) fail(`has corners at [${found.map(toNumber).join(', ')}], expected [${corners.map(toNumber).join(', ')}]`);
}

for (const id of Object.keys(CATALOG) as CurveId[]) validateFunction(CATALOG[id], CORNERS[id]);
