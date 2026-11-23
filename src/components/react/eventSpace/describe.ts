// Every sentence EventSpace shows or speaks, built from state. The visible text and the live-region text come
// from the same functions, so what a screen reader hears always matches the screen.
import { complement, formatFraction, fraction, intersect, probability, union, WEIGHT_TOTAL, type Outcome, type OutcomeId } from './model.ts';
import { eventMembers, type Scenario } from './scenarios.ts';
import { CLEAR_PRESET } from './setups.ts';
import { isLocked, scenarioOf, setupOf, type Action, type EventKey, type EventSpaceState, type Refusal } from './state.ts';
import { formatNumber } from '../plotColors.ts';

/** Member lists longer than this show the first ones and "and k more". */
const MAX_LISTED = 8;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const decimal = (numerator: number, denominator: number) => formatNumber(numerator / denominator, 2);

function joinWords(words: readonly string[]): string {
	if (words.length <= 1) return words.join('');
	return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

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
	const setup = setupOf(state);
	const scenario = scenarioOf(state);
	if (setup.mode === 'weights') return `${scenario.outcomes.length} cups, one for each face, filled from a jug of ${WEIGHT_TOTAL} units.`;
	const space = `${scenario.outcomes.length} equally likely outcomes.`;
	if (setup.goal) {
		const event = `Event A: ${scenario.events[setup.goal].label}.`;
		return isLocked(state) ? `${space} ${event} Tap the squares that belong to A.` : `${space} ${event}`;
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
		case 'correct': {
			const marked = outcomesIn(scenario, state.events.A);
			const total = scenario.outcomes.length;
			const share = fraction(marked.length, total);
			return `Yes: ${joinWords(marked.map((outcome) => outcome.label))}. ${marked.length} of ${total} squares, so P(A) = ${formatFraction(share)} = ${decimal(marked.length, total)}.`;
		}
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
			return `You have ${feedback.found} of the squares A needs, and ${feedback.wrong} that don't belong.`;
	}
}

/** The outcome to outline as "missed" after a Check that found the HT/TH mistake. */
export function missedOutcome(state: EventSpaceState): OutcomeId | null {
	return state.feedback?.kind === 'missed-mirror' ? state.feedback.missing : null;
}

/** Count-mode readouts; empty while a goal setup is locked, so nothing gives the answer away. */
export function readoutLines(state: EventSpaceState): string[] {
	const setup = setupOf(state);
	const scenario = scenarioOf(state);
	if (setup.mode !== 'count' || isLocked(state)) return [];
	const total = scenario.outcomes.length;
	const { A, B } = state.events;
	if (!setup.events.B) {
		const share = probability(A, scenario.outcomes);
		const members = A.size === 0 ? 'A is empty.' : `A = ${setText(scenario, A)}.`;
		return [`${members} ${A.size} of ${total} outcomes. P(A) = ${formatFraction(share)} = ${decimal(A.size, total)}.`];
	}
	const eventLine = (key: EventKey, members: ReadonlySet<OutcomeId>) =>
		`${key} = ${eventText(scenario, members)}: ${members.size} of ${total} = ${formatFraction(fraction(members.size, total))} (${decimal(members.size, total)})`;
	const both = intersect(A, B);
	const either = union(A, B);
	return [
		eventLine('A', A),
		eventLine('B', B),
		`not A: ${complement(A, scenario.outcomes).size} of ${total}`,
		`A and B = ${setText(scenario, both)}: ${both.size} of ${total}`,
		`A or B: ${A.size} + ${B.size} − ${both.size} = ${either.size} of ${total} = ${decimal(either.size, total)}`,
	];
}

/** The set "Look at" focuses on, or null when everything is in view. */
export function focusSet(state: EventSpaceState): ReadonlySet<OutcomeId> | null {
	const { A, B } = state.events;
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
	const outside = focus && !focus.has(outcome.id) ? ' Outside.' : '';
	const missed = missedOutcome(state) === outcome.id ? ' Missed.' : '';
	const tossed = state.tossCount > 0 ? ` Tossed ${plural(state.tallies[outcome.id] ?? 0, 'time', 'times')}.` : '';
	return `${outcome.label}. ${capitalize(outcome.spoken)}.${membership}${missed}${outside}${tossed}`;
}

/** The text on a preset button, e.g. "At least one head" or "Clear". */
export function presetLabel(scenario: Scenario, preset: string): string {
	return preset === CLEAR_PRESET ? 'Clear' : capitalize(scenario.events[preset].label);
}

// ---- Tosses ----

/** How often event A came up in the reader's tosses, beside the exact value, so a small sample can't mislead. */
function tossShare(state: EventSpaceState): { name: string; hits: number; share: string } {
	const scenario = scenarioOf(state);
	const hits = outcomesIn(scenario, state.events.A).reduce((total, outcome) => total + (state.tallies[outcome.id] ?? 0), 0);
	return { name: eventText(scenario, state.events.A), hits, share: decimal(hits, state.tossCount) };
}

export function tossLine(state: EventSpaceState): string | null {
	if (state.tossCount === 0) return null;
	const total = scenarioOf(state).outcomes.length;
	const { name, hits, share } = tossShare(state);
	return `Tossed ${state.tossCount} times: ${name} ${plural(hits, 'time', 'times')} (${share}). Your count says ${decimal(state.events.A.size, total)}.`;
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
	return `P(${name}) = ${terms} = ${sum}/${WEIGHT_TOTAL} = ${decimal(sum, WEIGHT_TOTAL)}.`;
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
			const members = state.events[state.editing];
			return `${state.editing}: ${members.size} of ${total} outcomes, P of ${state.editing} = ${formatFraction(fraction(members.size, total))}.`;
		}
		case 'check':
		case 'show-answer':
			return feedbackLine(state) ?? '';
		case 'preset': {
			if (isLocked(state)) return 'Check your answer first.';
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
			return `${outcome ? cupName(state, outcome) : ''} ${WEIGHT_TOTAL - unitsPoured(state)} units left in the jug.`.trim();
		}
		case 'weight-preset':
			return `${action.name}. ${totalLine(state)}`;
		case 'toss': {
			const { name, hits, share } = tossShare(state);
			return `Tossed ${state.tossCount} times in all. ${capitalize(name)} ${plural(hits, 'time', 'times')}, ${share}.`;
		}
		case 'wrong-model':
			return state.wrongModel ? scenario.wrongModel?.caption ?? '' : 'Back to the four real outcomes.';
	}
}
