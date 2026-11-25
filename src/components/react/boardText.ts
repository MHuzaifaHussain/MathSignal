// Small wording helpers shared by the boards' sentences. Their decimals always go through formatNumber, so a
// value is never written as an exact equation when it has been rounded.
import { fraction, formatFraction, toNumber, type Fraction } from './boardMath.ts';
import { formatNumber } from './plotColors.ts';

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
export const decimal = (numerator: number, denominator: number) => formatNumber(numerator / denominator, 2);
/** True when two decimal places don't show the value exactly (1/6 → 0.17). */
export const isRounded = (numerator: number, denominator: number) => Math.abs(Number(decimal(numerator, denominator)) - numerator / denominator) > 1e-12;
/** "0.75", or "≈ 0.17" when rounded, so the board never writes a false equation. */
export const approx = (numerator: number, denominator: number) => `${isRounded(numerator, denominator) ? '≈ ' : ''}${decimal(numerator, denominator)}`;
/** "= 0.75", or "≈ 0.17" when rounded, for the end of an equation. */
export const equalsDecimal = (numerator: number, denominator: number) => `${isRounded(numerator, denominator) ? '≈' : '='} ${decimal(numerator, denominator)}`;

/** "1,206", "−12", "48": a count with thousands separators. Whole numbers only; a fraction is never grouped. */
export function groupThousands(value: number): string {
	if (!Number.isInteger(value)) throw new Error(`boardText.groupThousands: takes whole numbers, got ${value}.`);
	const digits = String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return value < 0 ? `−${digits}` : digits;
}

export function joinWords(words: readonly string[]): string {
	if (words.length <= 1) return words.join('');
	return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * An exact fraction as reader text: "105/512", "3" for 3/1, "0", and "−3/4" with a real minus sign on the numerator.
 * The reduced form comes from boardMath's formatFraction, which keeps the plain hyphen for its error messages.
 */
export function fractionText(value: Fraction): string {
	const text = formatFraction(value);
	return value.numerator < 0 ? `−${text.slice(1)}` : text;
}

/** The most decimal places an amount is written with before it falls back to a fraction and a rounded value. */
const AMOUNT_DECIMAL_PLACES = 3;
/** Decimal places of the rounded value after "≈" in an amount that doesn't terminate. */
const APPROXIMATE_DECIMAL_PLACES = 2;

/** The value reduced, after checking it holds safe integers, so a hand-built object literal can't slip through. */
function reduced(value: Fraction, caller: string): Fraction {
	const { numerator, denominator } = value;
	if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
		throw new Error(`boardText.${caller}: ${numerator}/${denominator} is not a fraction of safe integers`);
	}
	return fraction(numerator, denominator);
}

function assertDigits(digits: number, caller: string): void {
	if (!Number.isInteger(digits) || digits < 0) throw new Error(`boardText.${caller}: digits must be a whole number from 0 up, got ${digits}`);
}

/** How many times `factor` divides `n`, and what is left. */
function stripFactor(n: number, factor: number): { count: number; rest: number } {
	let count = 0;
	let rest = n;
	while (rest % factor === 0) {
		rest /= factor;
		count += 1;
	}
	return { count, rest };
}

/** True when the value has an exact decimal of at most `digits` places: its reduced denominator divides 10^digits. */
export function terminatesWithin(value: Fraction, digits: number): boolean {
	assertDigits(digits, 'terminatesWithin');
	const twos = stripFactor(reduced(value, 'terminatesWithin').denominator, 2);
	const fives = stripFactor(twos.rest, 5);
	return fives.rest === 1 && Math.max(twos.count, fives.count) <= digits;
}

/**
 * The exact decimal of a value that terminates within `digits` places: "0.875", "−1.5", "3", "0". Every digit comes
 * from integer long division (in BigInt, so no remainder overflows), never from float rounding; trailing zeros are
 * dropped and a negative value takes a real minus sign. Throws, naming the fraction, when it doesn't terminate.
 */
export function decimalText(value: Fraction, digits: number): string {
	assertDigits(digits, 'decimalText');
	const exact = reduced(value, 'decimalText');
	if (!terminatesWithin(exact, digits)) {
		throw new Error(`boardText.decimalText: ${formatFraction(exact)} has no exact decimal within ${digits} places`);
	}
	const denominator = BigInt(exact.denominator);
	const magnitude = BigInt(Math.abs(exact.numerator));
	let remainder = magnitude % denominator;
	let fractionDigits = '';
	while (remainder !== 0n) {
		remainder *= 10n;
		fractionDigits += String(remainder / denominator);
		remainder %= denominator;
	}
	const sign = exact.numerator < 0 ? '−' : '';
	const whole = String(magnitude / denominator);
	return fractionDigits === '' ? `${sign}${whole}` : `${sign}${whole}.${fractionDigits}`;
}

/**
 * An amount as reader text: a whole number ("5"), else its exact decimal of up to 3 places ("2.275"), else the
 * reduced fraction and its value to 2 places ("19/400 ≈ 0.05"), so a rounded amount never reads as exact.
 */
export function amountText(value: Fraction): string {
	const exact = reduced(value, 'amountText');
	if (terminatesWithin(exact, AMOUNT_DECIMAL_PLACES)) return decimalText(exact, AMOUNT_DECIMAL_PLACES);
	return `${fractionText(exact)} ≈ ${formatNumber(toNumber(exact), APPROXIMATE_DECIMAL_PLACES)}`;
}
