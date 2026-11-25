// How DistributionBoard writes its numbers, shared by every mode's describe module so the rules can't drift.
// Pure TypeScript; scripts/check-boards.mjs pins the strings.
//
// - Chances read count, reduced fraction, decimal: "3/6 = 1/2 = 0.50", always two decimals.
// - Amounts computed from the bars drop trailing zeros: "7/2 = 3.5", "2".
// "≈" appears only when the decimal is rounded.
import { formatFraction, fraction, squareRoot, toNumber, type Fraction } from '../boardMath.ts';
import { amountText, decimalText, equalsDecimal, fractionText, terminatesWithin } from '../boardText.ts';
import { formatNumber } from '../plotColors.ts';

const DECIMALS = 2;
/** Below this, a decimal is taken as exact rather than rounded. */
const ROUNDING_TOLERANCE = 1e-12;

export const plainDecimal = (value: number) => formatNumber(value, DECIMALS);
export const isRoundedValue = (value: number) => Math.abs(Number(plainDecimal(Math.abs(value))) - Math.abs(value)) > ROUNDING_TOLERANCE;
/** Two decimals with trailing zeros dropped: 3.50 → "3.5", 2.00 → "2". */
export const trimmedDecimal = (value: number) => plainDecimal(value).replace(/\.?0+$/, '');
export const isWhole = (value: Fraction) => value.denominator === 1;

/** "3/6 = 1/2" when the fraction reduces, else "1/6 ≈ 0.17": the short form for Check and goal sentences. */
export function briefChance(count: number, total: number): string {
	const counted = `${count}/${total}`;
	const reduced = formatFraction(fraction(count, total));
	return reduced === counted ? `${counted} ${equalsDecimal(count, total)}` : `${counted} = ${reduced}`;
}

/** "3/6 = 1/2 = 0.50": the full readout chain, without decimals for a whole number ("6/6 = 1"). */
export function fullChance(count: number, total: number): string {
	const counted = `${count}/${total}`;
	const value = fraction(count, total);
	const reduced = formatFraction(value);
	const chain = reduced === counted ? counted : `${counted} = ${reduced}`;
	return isWhole(value) ? chain : `${chain} ${equalsDecimal(count, total)}`;
}

/** "1", "7/2 = 3.5" or "7/6 ≈ 1.17": an amount computed from the bars. */
export function amountChain(value: Fraction): string {
	if (isWhole(value)) return String(value.numerator);
	const number = toNumber(value);
	return `${formatFraction(value)} ${isRoundedValue(number) ? '≈' : '='} ${trimmedDecimal(number)}`;
}

/** "1", "3.5" or "7/6": an amount inside a longer calculation, exact without a chain. */
export function shortAmount(value: Fraction): string {
	if (isWhole(value)) return String(value.numerator);
	const number = toNumber(value);
	return isRoundedValue(number) ? formatFraction(value) : trimmedDecimal(number);
}

// ---- Family and density modes (decision 0018) ----
// The outcome mode keeps amountChain ("7/2 = 3.5") because its shipped strings must not change; the new modes write
// amounts with the shared boardText.amountText ("3.5", "19/400 ≈ 0.05"), as every new board does.

/** Digits for "under 0.01" in sentences and "under 0.0001" in four-place tables. */
export const SENTENCE_PLACES = 2;
export const TABLE_PLACES = 4;

/**
 * True when 0 < weight/total < 1/(2·10^places): a nonzero chance whose rounded decimal would read 0. Compared in
 * BigInt, because 20¹⁰ × 20,000 passes 2⁵³.
 */
export function underThreshold(weight: number, total: number, places: number): boolean {
	if (!Number.isSafeInteger(weight) || !Number.isSafeInteger(total) || weight < 0 || total < 1) {
		throw new Error(`underThreshold: need whole numbers with weight ≥ 0 and total ≥ 1, got ${weight}/${total}`);
	}
	return weight > 0 && 2n * 10n ** BigInt(places) * BigInt(weight) < BigInt(total);
}

/** "under 0.01" or "under 0.0001". */
export const underText = (places: number) => `under ${(0).toFixed(places - 1)}1`;

/** fullChance, except that a chance too small for two decimals reads "1/1024, under 0.01", never "≈ 0.00". */
export function chanceChain(count: number, total: number): string {
	if (!underThreshold(count, total, SENTENCE_PLACES)) return fullChance(count, total);
	const counted = `${count}/${total}`;
	const reduced = formatFraction(fraction(count, total));
	return `${reduced === counted ? counted : `${counted} = ${reduced}`}, ${underText(SENTENCE_PLACES)}`;
}

/** An exact chance: "3/4 = 0.75", "3/8 ≈ 0.38", "1", "0", or "1/1000, under 0.01". */
export function fractionChance(value: Fraction): string {
	if (isWhole(value)) return String(value.numerator);
	const text = formatFraction(value);
	if (underThreshold(value.numerator, value.denominator, SENTENCE_PLACES)) return `${text}, ${underText(SENTENCE_PLACES)}`;
	return `${text} ${equalsDecimal(value.numerator, value.denominator)}`;
}

const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const MAX_POWER = 10;

/** "0.9⁹", spoken "0.9 to the power 9". Exponents run 0 to 10. */
export function powerText(base: string, exponent: number): { visible: string; spoken: string } {
	if (!Number.isInteger(exponent) || exponent < 0 || exponent > MAX_POWER) throw new Error(`powerText: the exponent must be a whole number from 0 to ${MAX_POWER}, got ${exponent}`);
	const superscript = [...String(exponent)].map((digit) => SUPERSCRIPT_DIGITS[Number(digit)]).join('');
	return { visible: `${base}${superscript}`, spoken: `${base} to the power ${exponent}` };
}

/** Places an amount under a root keeps before it is written as a fraction, as amountText does. */
const ROOT_PLACES = 3;

/** "√2.5", "√1", but "√(19/400)": the variance as amountText writes it, with parentheses around a fraction. */
export function rootText(variance: Fraction): string {
	return terminatesWithin(variance, ROOT_PLACES) ? `√${decimalText(variance, ROOT_PLACES)}` : `√(${fractionText(variance)})`;
}

/** "= 0.5" or "≈ 1.58": σ's value after its root, "=" only when the root is exact. */
export function sigmaValue(variance: Fraction): string {
	const sigma = squareRoot(variance);
	return sigma.exact ? `= ${amountText(sigma.value)}` : `≈ ${formatNumber(sigma.value, SENTENCE_PLACES)}`;
}
