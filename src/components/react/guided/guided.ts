// The rules every guided board shares: how Check counts, when "Show the answer" is offered, and which stages
// wait for the answer. Pure, so scripts/check-boards.mjs checks them. Each board keeps its own state shape and
// spreads these results into it. Design and reasoning: decision 0013.

/** Wrong Checks before the "Show the answer" button appears. */
export const CHECKS_BEFORE_ANSWER = 2;

/** The part of a board's state that Check reads and writes. */
export interface CheckProgress {
	/** True once Check has passed (or the answer was shown). */
	readonly checked: boolean;
	readonly failedChecks: number;
}

/**
 * `retry`: a wrong answer counts as a miss and the reader tries again. `once`: any committed answer reveals,
 * for a one-shot guess such as picking a sign.
 */
export type CheckMode = 'retry' | 'once';

/** The progress after one press of Check. The reducer must ignore Check once it has passed. */
export function recordCheck(progress: CheckProgress, passed: boolean, mode: CheckMode): CheckProgress {
	if (progress.checked) throw new Error('recordCheck: Check has already passed; the reducer must ignore Check from here on.');
	const failedChecks = passed ? progress.failedChecks : progress.failedChecks + 1;
	return { checked: passed || mode === 'once', failedChecks };
}

export function canShowAnswer(progress: CheckProgress): boolean {
	return !progress.checked && progress.failedChecks >= CHECKS_BEFORE_ANSWER;
}

export interface StageRules<S extends string> {
	/** Whether the setup offers a "Show as" choice at all. */
	stages: boolean;
	/** Stages that would give the answer away, so they wait until the answer is uncovered. */
	waitsForCheck: readonly S[];
	/** True while the board still holds the answer back. */
	covered: boolean;
}

/** A stage that isn't allowed yet is left out of the choice, never shown disabled (a native radio can't refuse). */
export function stageAllowed<S extends string>(stage: S, rules: StageRules<S>): boolean {
	return rules.stages && !(rules.covered && rules.waitsForCheck.includes(stage));
}
