// Small wording helpers shared by the boards' sentences. Their decimals always go through formatNumber, so a
// value is never written as an exact equation when it has been rounded.
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
