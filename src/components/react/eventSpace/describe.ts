// Every sentence EventSpace shows or speaks, built from state. The visible text and the live-region text come
// from the same functions, so what a screen reader hears always matches the screen.
import { formatFraction, fraction, type Fraction } from '../boardMath.ts';
import { approx, capitalize, equalsDecimal, joinWords, plural } from '../boardText.ts';
import { CHECKS_BEFORE_ANSWER } from '../guided/guided.ts';
import { complement, conditionalProbability, intersect, probability, union, WEIGHT_TOTAL, type Outcome, type OutcomeId } from './model.ts';
import { eventMembers, type Scenario } from './scenarios.ts';
import { CLEAR_PRESET } from './setups.ts';
import { isLocked, scenarioOf, setupOf, type Action, type EventKey, type EventSpaceState, type Refusal, type Stage } from './state.ts';

/** The "Show as" options' names, shown on the buttons and spoken when the view changes. */
export const STAGE_LABELS: Readonly<Record<Stage, string>> = { picture: 'Pictures', letters: 'Letters', sets: 'Sets' };

/** Member lists longer than this show the first ones and "and k more". */
const MAX_LISTED = 8;

function outcomesIn(scenario: Scenario, members: ReadonlySet<OutcomeId>): Outcome[] {
	return scenario.outcomes.filter((outcome) => members.has(outcome.id));
}

/** "{HH, HT, TH}" or "{(6,1), (5,2)}": labels with a comma get brackets so the list stays readable. */
function setText(scenario: Scenario, members: ReadonlySet<OutcomeId>): string {
	const labels = outcomesIn(scenario, members).map((outcome) => (outcome.label.includes(',') ? `(${outcome.label})` : outcome.label));
	const shown = labels.slice(0, MAX_LISTED).join(', ');
	return labels.length > MAX_LISTED ? `{${shown} and ${labels.length - MAX_LISTED} more}` : `{${shown}}`;
}

/** The name of the scenario event a set matches exactly, or its member list. */
function eventText(scenario: Scenario, members: ReadonlySet<OutcomeId>): string {
	const named = Object.entries(scenario.events).find(([id]) => {
		const candidate = eventMembers(scenario, id);
		return candidate.size === members.size && [...candidate].every((outcomeId) => members.has(outcomeId));
	});
	return named ? named[1].label : setText(scenario, members);
}

export function statusLine(state: EventSpaceState): string {
	const line = baseStatusLine(state);
	// The status line describes the grid, so it says when most of the grid is ruled out.
	return state.shrink ? `${line} Shrunk to B: ${plural(state.events.B.size, 'outcome', 'outcomes')} left.` : line;
}

function baseStatusLine(state: EventSpaceState): string {
	const setup = setupOf(state);
	const scenario = scenarioOf(state);
	if (setup.mode === 'weights') return `${scenario.outcomes.length} cups, one for each face, filled from a jug of ${WEIGHT_TOTAL} units.`;
	const space = `${scenario.outcomes.length} equally likely outcomes.`;
	if (setup.goal) {
		const event = `Event A: ${scenario.events[setup.goal].label}.`;
		return isLocked(state) ? `${space} ${event} Tap the squares that belong to A.` : `${space} ${event}`;
	}
	if (!Object.values(setup.events).some((event) => event?.editable)) {
		// Fixed data (the class of children): name the events instead of inviting taps.
		const named = (['A', 'B'] as const).filter((key) => setup.events[key]).map((key) => `${key}: ${eventText(scenario, state.events[key])}.`);
		return `${space} ${named.join(' ')}`;
	}
	return setup.events.B ? `${space} Editing ${state.editing}.` : `${space} Tap squares to build event A.`;
}

/** Only on a locked goal setup: how many squares are marked, with no hint about whether they are right. */
export function markedLine(state: EventSpaceState): string | null {
	if (!isLocked(state)) return null;
	return `You have marked ${plural(state.events.A.size, 'square', 'squares')}.`;
}

export function feedbackLine(state: EventSpaceState): string | null {
	const feedback = state.feedback;
	if (!feedback) return null;
	const setup = setupOf(state);
	const scenario = scenarioOf(state);
	const byId = (id: OutcomeId) => scenario.outcomes.find((outcome) => outcome.id === id) as Outcome;
	switch (feedback.kind) {
		case 'correct':
			return `Yes: ${answerText(state)}`;
		case 'shown':
			return `The answer: ${answerText(state)}`;
		case 'missed-mirror': {
			const have = byId(feedback.have);
			const missing = byId(feedback.missing);
			return `Not yet. You have ${have.label} but not ${missing.label}. ${capitalize(missing.spoken)} is a different way to land from ${have.spoken}.`;
		}
		case 'extra': {
			const labels = feedback.extra.map((id) => byId(id).label);
			const reason = setup.goal ? scenario.events[setup.goal].outsideReason : undefined;
			if (labels.length === 1) return `${labels[0]} ${reason ?? "isn't in A"}; remove it.`;
			return `${joinWords(labels)} don't belong in A; remove them.`;
		}
		case 'partial':
			return `You have ${feedback.found} of the squares A needs, and ${feedback.wrong} that ${feedback.wrong === 1 ? "doesn't" : "don't"} belong.`;
	}
}

/** "HH, HT and TH. 3 of 4 squares, so P(A) = 3/4 = 0.75.": event A spelled out, after a pass or a shown answer. */
function answerText(state: EventSpaceState): string {
	const scenario = scenarioOf(state);
	const marked = outcomesIn(scenario, state.events.A);
	const total = scenario.outcomes.length;
	return `${joinWords(marked.map((outcome) => outcome.label))}. ${marked.length} of ${total} squares, so P(A) = ${formatFraction(fraction(marked.length, total))} ${equalsDecimal(marked.length, total)}.`;
}

/** The outcome to outline as "missed" after a Check that found the HT/TH mistake. */
export function missedOutcome(state: EventSpaceState): OutcomeId | null {
	return state.feedback?.kind === 'missed-mirror' ? state.feedback.missing : null;
}

/** "A = sum is 7: 6 of 36 = 1/6 (≈ 0.17)", shared by every two-event readout. */
function eventLine(scenario: Scenario, key: EventKey, members: ReadonlySet<OutcomeId>): string {
	const total = scenario.outcomes.length;
	return `${key} = ${eventText(scenario, members)}: ${members.size} of ${total} = ${formatFraction(fraction(members.size, total))} (${approx(members.size, total)})`;
}

function bothLine(scenario: Scenario, a: ReadonlySet<OutcomeId>, b: ReadonlySet<OutcomeId>): string {
	const both = intersect(a, b);
	const total = scenario.outcomes.length;
	if (both.size === 0) return `A and B: no shared outcome, 0 of ${total}`;
	return `A and B = ${setText(scenario, both)}: ${both.size} of ${total}`;
}

/** Readouts for the counting modes; empty while a goal setup is locked, so nothing gives the answer away. */
export function readoutLines(state: EventSpaceState): string[] {
	const setup = setupOf(state);
	const scenario = scenarioOf(state);
	if (!(setup.mode === 'count' || setup.mode === 'condition') || isLocked(state)) return [];
	const total = scenario.outcomes.length;
	const { A, B } = state.events;
	if (setup.mode === 'condition') return state.shrink ? [conditionalLine(state)] : [eventLine(scenario, 'A', A), eventLine(scenario, 'B', B), bothLine(scenario, A, B)];
	if (!setup.events.B) {
		const share = probability(A, scenario.outcomes);
		const members = A.size === 0 ? 'A is empty.' : `A = ${setText(scenario, A)}.`;
		return [`${members} ${A.size} of ${total} outcomes. P(A) = ${formatFraction(share)} ${equalsDecimal(A.size, total)}.`];
	}
	const both = intersect(A, B);
	const either = union(A, B);
	return [
		eventLine(scenario, 'A', A),
		eventLine(scenario, 'B', B),
		`not A: ${complement(A, scenario.outcomes).size} of ${total}`,
		bothLine(scenario, A, B),
		`A or B: ${A.size} + ${B.size} − ${both.size} = ${either.size} of ${total} ${equalsDecimal(either.size, total)}`,
	];
}

// ---- Condition mode ----

export const SHRINK_REFUSAL = "Undefined: B can't happen (probability 0).";

/**
 * "2/6 = 1/3 ≈ 0.33": the count first, then the reduced fraction when it differs, then two decimals, which
 * are left out for a whole number ("0/6 = 0", "6/6 = 1"), where they would add nothing.
 */
function shareText(value: Fraction, numerator: number, denominator: number): string {
	const counted = `${numerator}/${denominator}`;
	const reduced = formatFraction(value);
	const chain = reduced === counted ? counted : `${counted} = ${reduced}`;
	return value.denominator === 1 ? chain : `${chain} ${equalsDecimal(numerator, denominator)}`;
}

/**
 * With the world shrunk to B: how much of B is also A, beside the unconditioned P(A). Only called while shrunk,
 * and the reducer never stays shrunk with B empty, so a missing P(A | B) is a bug and throws.
 */
export function conditionalLine(state: EventSpaceState): string {
	const scenario = scenarioOf(state);
	const { A, B } = state.events;
	const given = conditionalProbability(A, B);
	if (!given) throw new Error('EventSpace: conditionalLine needs a non-empty B; shrinking to an empty B is refused.');
	const both = intersect(A, B);
	const total = scenario.outcomes.length;
	const inA = both.size === 0 ? 'none of them also in A' : `${both.size} of them also in A, ${setText(scenario, both)}`;
	return `Inside B: ${plural(B.size, 'outcome', 'outcomes')}, ${inA}. P(A | B) = ${shareText(given, both.size, B.size)}, while P(A) = ${shareText(fraction(A.size, total), A.size, total)}.`;
}

/** The set "Look at" (or shrinking to B) focuses on, or null when everything is in view. */
export function focusSet(state: EventSpaceState): ReadonlySet<OutcomeId> | null {
	const { A, B } = state.events;
	if (state.shrink) return B;
	switch (state.lookAt) {
		case 'everything':
			return null;
		case 'A and B':
			return intersect(A, B);
		case 'A or B':
			return union(A, B);
		case 'not A':
			return complement(A, scenarioOf(state).outcomes);
	}
}

export function cellName(state: EventSpaceState, outcome: Outcome): string {
	const inA = state.events.A.has(outcome.id);
	const inB = state.events.B.has(outcome.id);
	const membership = inA && inB ? ' In A and B.' : inA ? ' In A.' : inB ? ' In B.' : '';
	const focus = focusSet(state);
	const outside = focus && !focus.has(outcome.id) ? (state.shrink ? ' Ruled out.' : ' Outside.') : '';
	const missed = missedOutcome(state) === outcome.id ? ' Missed.' : '';
	const tossed = state.tossCount > 0 ? ` Tossed ${plural(state.tallies[outcome.id] ?? 0, 'time', 'times')}.` : '';
	return `${outcome.label}. ${capitalize(outcome.spoken)}.${membership}${missed}${outside}${tossed}`;
}

/** The text on a preset button, e.g. "At least one head" or "Clear". */
export function presetLabel(scenario: Scenario, preset: string): string {
	return preset === CLEAR_PRESET ? 'Clear' : capitalize(scenario.events[preset].label);
}

/** The Sets view's symbolic line; null until Check passes, so the symbolic form still comes last. */
export function setsLine(state: EventSpaceState): string | null {
	if (state.stage !== 'sets' || isLocked(state)) return null;
	const scenario = scenarioOf(state);
	const all = new Set(scenario.outcomes.map((outcome) => outcome.id));
	const share = probability(state.events.A, scenario.outcomes);
	return `Ω = ${setText(scenario, all)}. A = ${setText(scenario, state.events.A)}. P(A) = |A| / |Ω| = ${formatFraction(share)}`;
}

// ---- Tosses ----

/** How often event A came up in the reader's tosses, beside the exact value, so a small sample can't mislead. */
function tossShare(state: EventSpaceState): { name: string; hits: number; share: string } {
	const scenario = scenarioOf(state);
	const hits = outcomesIn(scenario, state.events.A).reduce((total, outcome) => total + (state.tallies[outcome.id] ?? 0), 0);
	return { name: eventText(scenario, state.events.A), hits, share: approx(hits, state.tossCount) };
}

export function tossLine(state: EventSpaceState): string | null {
	if (state.tossCount === 0) return null;
	const total = scenarioOf(state).outcomes.length;
	const { name, hits, share } = tossShare(state);
	return `Tossed ${state.tossCount} times: ${name} ${plural(hits, 'time', 'times')} (${share}). Your count says ${approx(state.events.A.size, total)}.`;
}

// ---- Weights mode ----

const unitsPoured = (state: EventSpaceState) => Object.values(state.weights).reduce((total, units) => total + units, 0);

export function jugLine(state: EventSpaceState): string {
	return `Jug: ${WEIGHT_TOTAL - unitsPoured(state)} of ${WEIGHT_TOTAL} units left.`;
}

export function totalLine(state: EventSpaceState): string {
	const poured = unitsPoured(state);
	if (poured === WEIGHT_TOTAL) return `All ${WEIGHT_TOTAL} units poured: the cups add up to 1.`;
	return `${poured} of ${WEIGHT_TOTAL} units poured. The cups add up to ${poured}/${WEIGHT_TOTAL}, not 1, so this isn't a probability yet.`;
}

/** Axiom 3 written out: the event's probability is the sum of its outcomes' shares. */
export function additivityLine(state: EventSpaceState): string {
	const scenario = scenarioOf(state);
	const members = outcomesIn(scenario, state.events.A);
	const units = members.map((outcome) => state.weights[outcome.id] ?? 0);
	const sum = units.reduce((total, value) => total + value, 0);
	const name = eventText(scenario, state.events.A);
	const terms = units.map((value) => `${value}/${WEIGHT_TOTAL}`).join(' + ') || '0';
	if (unitsPoured(state) !== WEIGHT_TOTAL) return `${capitalize(name)} holds ${terms} = ${sum}/${WEIGHT_TOTAL} of the jug.`;
	return `P(${name}) = ${terms} = ${sum}/${WEIGHT_TOTAL} ${equalsDecimal(sum, WEIGHT_TOTAL)}.`;
}

export function cupName(state: EventSpaceState, outcome: Outcome): string {
	return `Cup ${outcome.label}: ${state.weights[outcome.id] ?? 0} of ${WEIGHT_TOTAL} units.`;
}

export function refusalText(reason: Refusal['reason']): string {
	return reason === 'cup-empty' ? "A cup can't hold less than nothing." : 'The jug is empty.';
}

// ---- Announcements ----

/** What the live region says after an action ends (toggles are debounced by the component). */
export function announcementFor(state: EventSpaceState, action: Action): string {
	const scenario = scenarioOf(state);
	const total = scenario.outcomes.length;
	switch (action.type) {
		case 'toggle': {
			if (isLocked(state)) return markedLine(state) ?? '';
			if (state.shrinkRefused) return SHRINK_REFUSAL;
			// While shrunk, the screen shows P(A | B), so that is what is spoken.
			if (state.shrink) return conditionalLine(state);
			const members = state.events[state.editing];
			return `${state.editing}: ${members.size} of ${total} outcomes, P of ${state.editing} = ${formatFraction(fraction(members.size, total))}.`;
		}
		case 'check': {
			const line = feedbackLine(state) ?? '';
			// The second wrong Check reveals "Show the answer"; saying so also keeps it from repeating the first.
			return state.feedback?.kind !== 'correct' && state.failedChecks === CHECKS_BEFORE_ANSWER ? `${line} You can now show the answer.` : line;
		}
		case 'show-answer':
			return feedbackLine(state) ?? '';
		case 'preset': {
			if (isLocked(state)) return 'Check your answer first.';
			if (state.shrinkRefused) return SHRINK_REFUSAL;
			if (state.shrink) return conditionalLine(state);
			const members = state.events[action.event];
			return members.size === 0 ? `${action.event} cleared.` : `${action.event} set to ${eventText(scenario, members)}: ${members.size} of ${total} outcomes.`;
		}
		case 'edit':
			return `Editing ${state.editing}.`;
		case 'look':
			return `Looking at ${state.lookAt}.`;
		case 'reset':
			return 'Board reset.';
		case 'pour': {
			if (state.refusal) return refusalText(state.refusal.reason);
			const outcome = scenario.outcomes.find((candidate) => candidate.id === action.id);
			return `${outcome ? cupName(state, outcome) : ''} ${plural(WEIGHT_TOTAL - unitsPoured(state), 'unit', 'units')} left in the jug.`.trim();
		}
		case 'weight-preset':
			return `${action.name}. ${totalLine(state)}`;
		case 'toss': {
			const { name, hits, share } = tossShare(state);
			return `Tossed ${state.tossCount} times in all. ${capitalize(name)} ${plural(hits, 'time', 'times')}, ${share}.`;
		}
		case 'wrong-model':
			return state.wrongModel ? scenario.wrongModel?.caption ?? '' : 'Back to the real outcomes.';
		case 'stage':
			return setsLine(state) ?? `Showing ${STAGE_LABELS[state.stage].toLowerCase()}.`;
		case 'shrink':
			if (state.shrinkRefused) return SHRINK_REFUSAL;
			return state.shrink ? conditionalLine(state) : 'Back to all outcomes.';
	}
}
