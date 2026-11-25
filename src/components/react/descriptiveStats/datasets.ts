// The data sets DescriptiveStats setups draw from. Each list is in the order the page's story tells it (children in
// the order they arrived), so "child 5" always means the same child. Pure and exact: whole numbers only.
// Design and reasoning: decision 0015.

/** Our class: 9 children's heights in cm, numbered in the order they arrived. Mean 134, median 133, no mode. */
export const CLASS_HEIGHTS: readonly number[] = [133, 122, 140, 128, 148, 125, 137, 131, 142];

/**
 * Our class and a tenth child, 136 cm, who arrives last. With an even count no child stands in the middle: the
 * median is halfway between child 1 (133 cm) and child 10 (136 cm), 134.5 cm, a height nobody has. Mean 134.2.
 */
export const CLASS_OF_TEN: readonly number[] = [...CLASS_HEIGHTS, 136];

/**
 * Another class of 9 in which two heights repeat: 127 cm and 141 cm are each held by 2 children, so there are two
 * modes. The repeats sit away from the middle, so the middle child is still one child (child 7, 132 cm). Mean 134.
 */
export const SHARED_HEIGHTS: readonly number[] = [141, 127, 136, 149, 123, 130, 132, 127, 141];

/** Our class with one very tall child: child 5 is 162 cm instead of 148. Quartiles and fences don't move. */
export const CLASS_TALL: readonly number[] = CLASS_HEIGHTS.map((height) => (height === 148 ? 162 : height));

/** A tight class: the same mean (134) and median, modes 130 and 138, and a quarter of the variance (16). */
export const TIGHT_CLASS: readonly number[] = [128, 130, 130, 132, 134, 136, 138, 138, 140];

/** Every child 134 cm: no spread at all. */
export const EVERYONE_134: readonly number[] = CLASS_HEIGHTS.map(() => 134);

/** 9 cafe customers' savings in thousands of dollars. Mean 4, median 4, mode 5. */
export const CAFE_SAVINGS: readonly number[] = [1, 2, 3, 4, 4, 5, 5, 5, 7];

/** A test's marks, with the index of Ana's mark. */
export interface MarkList {
	values: readonly number[];
	/** Out of how many marks. */
	outOf: number;
	/** Index of Ana's mark in `values`. */
	ana: number;
}

/** Test A, out of 50: mean 30, σ 6. Ana scored 36. */
export const TEST_A: MarkList = { values: [21, 24, 24, 27, 30, 33, 36, 36, 39], outOf: 50, ana: 6 };

/** Test B, out of 80: mean 50, σ 8. Ana scored 58. */
export const TEST_B: MarkList = { values: [38, 41, 44, 47, 49, 53, 56, 58, 64], outOf: 80, ana: 7 };

/** Test B with one very low mark: the 38 becomes 10. Ana's 58 is unchanged. */
export const TEST_B_LOW: readonly number[] = TEST_B.values.map((mark) => (mark === 38 ? 10 : mark));

/** The 8 ordinary pumpkins at the village fair, in kg. */
export const PUMPKIN_BASE: readonly number[] = [4, 5, 5, 6, 6, 6, 7, 7];

/**
 * The 9 pumpkins with `count` giants weighing `giant` kg. A second giant replaces a 7 kg pumpkin rather than joining
 * the line, so there are always 9 (mean 11, σ ≈ 10.19 and each z ≈ 1.87 at 30 kg). The giants always weigh the same.
 */
export function pumpkins(giant: number, count: 1 | 2): number[] {
	if (count !== 1 && count !== 2) throw new Error(`DescriptiveStats: pumpkins take 1 or 2 giants, got ${count}.`);
	const ordinary = count === 1 ? PUMPKIN_BASE : PUMPKIN_BASE.slice(0, -1);
	return [...ordinary, ...Array.from({ length: count }, () => giant)];
}
