// Small wording helpers shared by the boards' sentences. Their decimals always go through formatNumber, so a
// value is never written as an exact equation when it has been rounded.
import { formatFraction, type Fraction } from './boardMath.ts';
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
