// How DistributionBoard writes its numbers, shared by every mode's describe module so the rules can't drift.
// Pure TypeScript; scripts/check-boards.mjs pins the strings.
//
// - Chances read count, reduced fraction, decimal: "3/6 = 1/2 = 0.50", always two decimals.
// - Amounts computed from the bars drop trailing zeros: "7/2 = 3.5", "2".
// "≈" appears only when the decimal is rounded.
import { formatFraction, fraction, toNumber, type Fraction } from '../boardMath.ts';
import { equalsDecimal } from '../boardText.ts';
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
