// The data sets the regression board's setups will draw from, exact. Our class reuses DescriptiveStats' nine heights
// (decision 0015), in arrival order, and adds their arm spans, so "child 2" is the same child on every board.
// Anscombe's y values are stored as hundredths, so they stay exact. Design and reasoning: decision 0022.
import { fraction } from '../boardMath.ts';
import { CLASS_HEIGHTS } from '../descriptiveStats/datasets.ts';
import { wholePoints, type DataPoint } from './model.ts';

/** Arm spans in cm of Our class, child 1 to 9. Mean 132; with the heights, Sxx = 576, Syy = 900, Sxy = 576. */
export const CLASS_ARM_SPANS: readonly number[] = [123, 124, 139, 132, 149, 116, 126, 137, 142];

/** Child 2's arm span, 124 cm, typed as 160 cm. */
export const TYPO_CHILD = 2;
export const TYPO_ARM_SPAN = 160;

const withArmSpan = (child: number, armSpan: number) => CLASS_ARM_SPANS.map((span, i) => (i === child - 1 ? armSpan : span));

export const OUR_CLASS: readonly DataPoint[] = wholePoints(CLASS_HEIGHTS, CLASS_ARM_SPANS);
/** Every arm span is the height − 2 cm. */
export const PERFECT_LINE: readonly DataPoint[] = wholePoints(CLASS_HEIGHTS, CLASS_HEIGHTS.map((height) => height - 2));
/** The same nine arm spans, paired with different children: Sxy = 0. */
export const SHUFFLED_ARMS: readonly DataPoint[] = wholePoints(CLASS_HEIGHTS, [123, 124, 142, 149, 139, 132, 126, 137, 116]);
export const ONE_TYPO: readonly DataPoint[] = wholePoints(CLASS_HEIGHTS, withArmSpan(TYPO_CHILD, TYPO_ARM_SPAN));

/** Nine runners: weeks of training (1 to 9) and the time for one lap in seconds. */
export const RUNNER_WEEKS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Each week brings a faster lap, but the gains shrink to 1 s a week (8, 5, 3, 2, 1, 1, 1, 1). */
export const CURVE_TIMES: readonly number[] = [60, 52, 47, 44, 42, 41, 40, 39, 38];
export const RUNNERS_CURVE: readonly DataPoint[] = wholePoints(RUNNER_WEEKS, CURVE_TIMES);
/** Runner 1 takes 120 s: still the slowest, so the ranks don't change. */
export const RUNNERS_SLOW_START: readonly DataPoint[] = wholePoints(RUNNER_WEEKS, CURVE_TIMES.map((time, i) => (i === 0 ? 120 : time)));
/** Every week takes 2 s off. */
export const RUNNERS_STRAIGHT: readonly DataPoint[] = wholePoints(RUNNER_WEEKS, RUNNER_WEEKS.map((week) => 62 - 2 * week));
/** Runner 9 fell and took 70 s, now the slowest. */
export const RUNNERS_FALL: readonly DataPoint[] = wholePoints(RUNNER_WEEKS, CURVE_TIMES.map((time, i) => (i === 8 ? 70 : time)));

/** Foot length (cm) and reading level (1 to 10), three children per age. */
export const SHOE_AGES = ['6', '6', '6', '8', '8', '8', '10', '10', '10'] as const;
export const SHOE_READING: readonly DataPoint[] = wholePoints([16, 17, 18, 19, 20, 21, 22, 23, 24], [2, 3, 2, 4, 5, 4, 6, 7, 6]);
/** Feet 19, 20 and 21 cm at every age, same reading levels. */
export const SAME_FEET: readonly DataPoint[] = wholePoints([19, 20, 21, 19, 20, 21, 19, 20, 21], [2, 3, 2, 4, 5, 4, 6, 7, 6]);

/** Practice hours a week and quiz score (out of 10), three students per team. */
export const TEAMS = ['Seniors', 'Seniors', 'Seniors', 'Middles', 'Middles', 'Middles', 'Juniors', 'Juniors', 'Juniors'] as const;
const TEAM_SCORES = [8, 9, 10, 5, 6, 7, 2, 3, 4];
export const TEAM_PRACTICE: readonly DataPoint[] = wholePoints([1, 2, 3, 4, 5, 6, 7, 8, 9], TEAM_SCORES);
/** Every team practices 4, 5 and 6 hours, with the same scores. */
export const PRACTICE_ALIKE: readonly DataPoint[] = wholePoints([4, 5, 6, 4, 5, 6, 4, 5, 6], TEAM_SCORES);

/** Anscombe's quartet (1973): x, and y in hundredths, as in the Rdatasets copy. */
const ANSCOMBE_X = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
const ANSCOMBE_X4 = [8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8];
const ANSCOMBE_Y_HUNDREDTHS: readonly (readonly number[])[] = [
	[804, 695, 758, 881, 833, 996, 724, 426, 1084, 482, 568],
	[914, 814, 874, 877, 926, 810, 613, 310, 913, 726, 474],
	[746, 677, 1274, 711, 781, 884, 608, 539, 815, 642, 573],
	[658, 576, 771, 884, 847, 704, 525, 1250, 556, 791, 689],
];

const hundredths = (xs: readonly number[], ys: readonly number[]): readonly DataPoint[] => xs.map((x, i) => [fraction(x, 1), fraction(ys[i], 100)]);

/** Sets I to IV. */
export const ANSCOMBE: readonly (readonly DataPoint[])[] = ANSCOMBE_Y_HUNDREDTHS.map((ys, set) => hundredths(set === 3 ? ANSCOMBE_X4 : ANSCOMBE_X, ys));
