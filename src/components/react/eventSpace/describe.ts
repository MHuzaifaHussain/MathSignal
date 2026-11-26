// Every sentence EventSpace shows or speaks, built from state. The visible text and the live-region text come
// from the same functions, so what a screen reader hears always matches the screen.
import { compareFractions, formatFraction, fraction, type Fraction } from '../boardMath.ts';
import { approx, capitalize, equalsDecimal, joinWords, plural } from '../boardText.ts';
import { CHECKS_BEFORE_ANSWER } from '../guided/guided.ts';
import type { SpokenLine } from '../guided/spokenLine.ts';
import { compareEvents, complement, conditionalProbability, eventSize, intersect, probability, union, WEIGHT_TOTAL, type EventComparison, type Outcome, type OutcomeId } from './model.ts';
import { eventMembers, type Scenario } from './scenarios.ts';
import { CLEAR_PRESET } from './setups.ts';
import { activeWeightPreset, isLocked, scenarioOf, setupOf, weightsOf, type Action, type EventKey, type EventSpaceState, type Refusal, type ShrinkRefusal, type Stage } from './state.ts';

/** The "Show as" options' names, shown on the buttons and spoken when the view changes. */
export const STAGE_LABELS: Readonly<Record<Stage, string>> = { picture: 'Pictures', letters: 'Letters', sets: 'Sets' };

/** Member lists longer than this show the first ones and "and k more". */
const MAX_LISTED = 8;

function outcomesIn(scenario: Scenario, members: ReadonlySet<OutcomeId>): Outcome[] {
	return scenario.outcomes.filter((outcome) => members.has(outcome.id));
}

/** "{HH, HT, TH}" or "{(6,1), (5,2)}": labels with a comma get brackets so the list stays readable. */
function setText(scenario: Scenario, members: ReadonlySet<OutcomeId>): string {
	const labels = outcomesIn(scenario, members)
		.map((outcome) => outcome.setLabel ?? outcome.label)
		.map((label) => (label.includes(',') ? `(${label})` : label));
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
	const space = weightsOf(state)
		? `${scenario.outcomes.length} outcomes, one for each face. ${weightsSentence(state)}`
		: `${scenario.outcomes.length} equally likely outcomes.`;
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

/** An event's size and the whole it is out of: outcomes, or units on a weighted die. */
function sizeOf(state: EventSpaceState, members: ReadonlySet<OutcomeId>): { size: number; total: number } {
	const scenario = scenarioOf(state);
	const weights = weightsOf(state);
	return { size: eventSize(members, scenario.outcomes, weights), total: weights ? WEIGHT_TOTAL : scenario.outcomes.length };
}

/** "6 of 36" in a readout, or "4 of 12 units" on a weighted die. */
function countText(state: EventSpaceState, members: ReadonlySet<OutcomeId>): string {
	const { size, total } = sizeOf(state, members);
	return weightsOf(state) ? `${size} of ${total} units` : `${size} of ${total}`;
}

/** "6 of 36 outcomes" in a sentence, or "4 of 12 units" on a weighted die. */
function countWords(state: EventSpaceState, members: ReadonlySet<OutcomeId>): string {
	return weightsOf(state) ? countText(state, members) : `${countText(state, members)} outcomes`;
}

/** "A = sum is 7: 6 of 36 = 1/6 (≈ 0.17)", shared by every two-event readout. */
function eventLine(state: EventSpaceState, key: EventKey): string {
	const members = state.events[key];
	const { size, total } = sizeOf(state, members);
	return `${key} = ${eventText(scenarioOf(state), members)}: ${countText(state, members)} = ${formatFraction(fraction(size, total))} (${approx(size, total)})`;
}

function bothLine(state: EventSpaceState): string {
	const both = intersect(state.events.A, state.events.B);
	if (both.size === 0) return `A and B: no shared outcome, ${countText(state, both)}`;
	return `A and B = ${setText(scenarioOf(state), both)}: ${countText(state, both)}`;
}

/** Readouts for the counting modes; empty while a goal setup is locked, so nothing gives the answer away. */
export function readoutLines(state: EventSpaceState): string[] {
	const setup = setupOf(state);
	const scenario = scenarioOf(state);
	if (setup.mode === 'weights' || isLocked(state)) return [];
	const total = scenario.outcomes.length;
	const { A, B } = state.events;
	if (setup.mode === 'condition' || setup.mode === 'compare') {
		if (state.shrink) return [conditionalLine(state)];
		const lines = [eventLine(state, 'A'), eventLine(state, 'B')];
		// A compare setup holds the A ∩ B line until Compare is on, and a holdOverlap setup until the world is
		// shrunk: beside B's count it would answer the page's question first.
		const held = (setup.mode === 'compare' && !state.compare) || setup.holdOverlap;
		return held ? lines : [...lines, bothLine(state)];
	}
	if (!setup.events.B) {
		const share = probability(A, scenario.outcomes);
		const members = A.size === 0 ? 'A is empty.' : `A = ${setText(scenario, A)}.`;
		return [`${members} ${A.size} of ${total} outcomes. P(A) = ${formatFraction(share)} ${equalsDecimal(A.size, total)}.`];
	}
	const both = intersect(A, B);
	const either = union(A, B);
	return [
		eventLine(state, 'A'),
		eventLine(state, 'B'),
		`not A: ${complement(A, scenario.outcomes).size} of ${total}`,
		bothLine(state),
		`A or B: ${A.size} + ${B.size} − ${both.size} = ${either.size} of ${total} ${equalsDecimal(either.size, total)}`,
	];
}

// ---- Condition mode ----

const SHRINK_REFUSALS: Readonly<Record<ShrinkRefusal, string>> = {
	'b-empty': "Undefined: B can't happen (probability 0).",
	'compare-off': 'Turn on Compare A and B first: shrinking to B would answer the question for you.',
};

/** The visible reason "Shrink the world to B" is refused, also spoken when a refused press ends. */
export function shrinkRefusalText(reason: ShrinkRefusal): string {
	return SHRINK_REFUSALS[reason];
}

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
	const weights = weightsOf(state);
	const units = weights ? ` ${weights[outcome.id]} of ${WEIGHT_TOTAL} units.` : '';
	return `${outcome.label}. ${capitalize(outcome.spoken)}.${membership}${missed}${outside}${tossed}${units}`;
}

/**
 * The visible note in a weighted cell, "2/12": units out of the jug, written as the die-pour board writes them,
 * because "2 units" doesn't fit a 36px cell. Null when every outcome counts the same.
 */
export function unitsNote(state: EventSpaceState, outcome: Outcome): string | null {
	const weights = weightsOf(state);
	return weights ? `${weights[outcome.id]}/${WEIGHT_TOTAL}` : null;
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

// ---- Compare mode ----

export const COMPARE_LABEL = 'Compare A and B';
export const COMPARE_COVERED_NOTE = `Turn on ${COMPARE_LABEL} to see whether A and B are independent and whether they are mutually exclusive.`;

/** "Fair die: every face carries 2 of 12 units, …" or "Loaded toward six: the faces carry 1, 1, … and 7 of 12 units." */
function weightsSentence(state: EventSpaceState): string {
	const units = scenarioOf(state).outcomes.map((outcome) => state.weights[outcome.id]);
	const name = activeWeightPreset(state);
	if (units.every((value) => value === units[0])) {
		return `${name}: every face carries ${units[0]} of ${WEIGHT_TOTAL} units, so the outcomes are equally likely.`;
	}
	return `${name}: the faces carry ${joinWords(units.map(String))} of ${WEIGHT_TOTAL} units.`;
}

function comparisonOf(state: EventSpaceState): EventComparison {
	return compareEvents(state.events.A, state.events.B, scenarioOf(state).outcomes, weightsOf(state));
}

/** A fraction with its two decimals, "1/12 (≈ 0.08)", or alone when it is a whole number. */
function withDecimal(value: Fraction): string {
	const text = formatFraction(value);
	return value.denominator === 1 ? text : `${text} (${approx(value.numerator, value.denominator)})`;
}

function independenceLine({ independent, pA, pB }: EventComparison): string {
	if (!independent) return 'Independent: no.';
	const aImpossible = pA.numerator === 0;
	const bImpossible = pB.numerator === 0;
	if (aImpossible && bImpossible) return 'Independent: yes, but only because neither A nor B can happen.';
	if (bImpossible) return "Independent: yes, but only because B can't happen.";
	if (aImpossible) return "Independent: yes, but only because A can't happen.";
	return 'Independent: yes.';
}

function exclusivityLine(state: EventSpaceState, { exclusive }: EventComparison): string {
	if (exclusive) return 'Mutually exclusive: yes, A and B share no outcome.';
	const both = intersect(state.events.A, state.events.B);
	return `Mutually exclusive: no, A and B share ${plural(both.size, 'outcome', 'outcomes')}, ${setText(scenarioOf(state), both)}.`;
}

/** Decimals only when the two sides differ, so the reader sees by how much; an equal line needs none. */
function productLine({ independent, pA, pB, pBoth, product }: EventComparison): string {
	const factors = `${formatFraction(pA)} × ${formatFraction(pB)}`;
	if (independent) return `P(A and B) = ${formatFraction(pBoth)}, and P(A) × P(B) = ${factors} = ${formatFraction(product)}: equal.`;
	return `P(A and B) = ${withDecimal(pBoth)}, but P(A) × P(B) = ${factors} = ${withDecimal(product)}: not equal.`;
}

function givenLine({ given, pA }: EventComparison): string {
	if (!given) return "P(A | B) is undefined, because B can't happen.";
	if (compareFractions(given, pA) === 0) {
		return `P(A | B) = ${formatFraction(given)} and P(A) = ${formatFraction(pA)}: learning that B happened leaves the chance of A unchanged.`;
	}
	return `P(A | B) = ${withDecimal(given)}, while P(A) = ${withDecimal(pA)}: learning that B happened changes the chance of A.`;
}

/**
 * With Compare on: the verdict, exclusivity, the product and the conditional, in that order. Null while Compare is
 * off. While shrunk the conditional is left out, because "Inside B" already gives P(A | B) beside P(A).
 */
export function compareLines(state: EventSpaceState): string[] | null {
	if (!state.compare) return null;
	const comparison = comparisonOf(state);
	const lines = [independenceLine(comparison), exclusivityLine(state, comparison), productLine(comparison)];
	return state.shrink ? lines : [...lines, givenLine(comparison)];
}

/** The verdict in short, added to what a change announces while Compare is on. */
function withVerdict(state: EventSpaceState, line: string): string {
	if (!state.compare) return line;
	const comparison = comparisonOf(state);
	return `${line} ${independenceLine(comparison)} Mutually exclusive: ${comparison.exclusive ? 'yes' : 'no'}.`;
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
	// A one-cup event's single term is already its sum; writing "= sum" again would repeat the fraction.
	const sumWritten = units.length === 1 ? terms : `${terms} = ${sum}/${WEIGHT_TOTAL}`;
	if (unitsPoured(state) !== WEIGHT_TOTAL) return `${capitalize(name)} holds ${sumWritten} of the jug.`;
	return `P(${name}) = ${sumWritten} ${equalsDecimal(sum, WEIGHT_TOTAL)}.`;
}

export function cupName(state: EventSpaceState, outcome: Outcome): string {
	return `Cup ${outcome.label}: ${state.weights[outcome.id] ?? 0} of ${WEIGHT_TOTAL} units.`;
}

export function refusalText(reason: Refusal['reason']): string {
	return reason === 'cup-empty' ? "A cup can't hold less than nothing." : 'The jug is empty.';
}

// ---- Announcements ----

/** Turning Compare on speaks the verdict, exclusivity and the product; the conditional line stays on screen only. */
const VERDICT_LINES_SPOKEN = 3;

/**
 * The on-screen probability symbols as words, so a screen reader says "P of A given B" rather than
 * "P left paren A vertical line B". The visible lines keep the symbols, as the toggle's "P of A" already does.
 */
const SPOKEN_SYMBOLS: readonly (readonly [RegExp, string])[] = [
	[/P\(([AB]) \| ([AB])\)/g, 'P of $1 given $2'],
	[/P\(([AB]) and ([AB])\)/g, 'P of $1 and $2'],
	[/P\(([AB])\)/g, 'P of $1'],
	// Named events on the cups board: "P(even)", "P(at most 2)".
	[/P\(([^()|]+)\)/g, 'P of $1'],
	[/ × /g, ' times '],
	[/\|([AΩ])\|/g, 'the size of $1'],
	[/ \/ /g, ' over '],
	[/Ω/g, 'omega'],
];

export function spokenSymbols(line: string): string {
	return SPOKEN_SYMBOLS.reduce((text, [symbol, words]) => text.replace(symbol, words), line);
}

/** A visible line with its symbols said in words, for SpokenText: the verdict, readouts and sets lines in browse mode. */
export function spokenLine(line: string): SpokenLine {
	return { visible: line, spoken: spokenSymbols(line) };
}

/** What the live region says after an action ends (toggles are debounced by the component). */
export function announcementFor(state: EventSpaceState, action: Action): string {
	return spokenSymbols(announcementText(state, action));
}

function announcementText(state: EventSpaceState, action: Action): string {
	const scenario = scenarioOf(state);
	switch (action.type) {
		case 'toggle': {
			if (isLocked(state)) return markedLine(state) ?? '';
			const members = state.events[state.editing];
			const { size, total } = sizeOf(state, members);
			const count = `${state.editing}: ${countWords(state, members)}, P of ${state.editing} = ${formatFraction(fraction(size, total))}.`;
			return withVerdict(state, eventChange(state, count));
		}
		case 'check': {
			// A passed Check moves focus to the verdict, which is read there (decision 0019).
			if (state.checked) return '';
			const line = feedbackLine(state) ?? '';
			// The second wrong Check reveals "Show the answer"; saying so also keeps it from repeating the first.
			return state.feedback?.kind !== 'correct' && state.failedChecks === CHECKS_BEFORE_ANSWER ? `${line} You can now show the answer.` : line;
		}
		case 'show-answer':
			return state.checked ? '' : (feedbackLine(state) ?? '');
		case 'preset': {
			if (isLocked(state)) return 'Check your answer first.';
			const members = state.events[action.event];
			const count = members.size === 0 ? `${action.event} cleared.` : `${action.event} set to ${eventText(scenario, members)}: ${countWords(state, members)}.`;
			return withVerdict(state, eventChange(state, count));
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
			if (setupOf(state).mode !== 'compare') return `${action.name}. ${totalLine(state)}`;
			return state.compare ? withVerdict(state, `${action.name}.`) : weightsSentence(state);
		case 'toss': {
			const { name, hits, share } = tossShare(state);
			return `Tossed ${state.tossCount} times in all. ${capitalize(name)} ${plural(hits, 'time', 'times')}, ${share}.`;
		}
		case 'wrong-model':
			return state.wrongModel ? scenario.wrongModel?.caption ?? '' : 'Back to the real outcomes.';
		case 'stage':
			return setsLine(state) ?? `Showing ${STAGE_LABELS[state.stage].toLowerCase()}.`;
		case 'shrink':
			if (state.shrinkRefusal) return shrinkRefusalText(state.shrinkRefusal);
			return state.shrink ? conditionalLine(state) : 'Back to all outcomes.';
		case 'compare':
			return state.compare ? (compareLines(state) ?? []).slice(0, VERDICT_LINES_SPOKEN).join(' ') : 'Comparison hidden.';
	}
}

/**
 * What a change to A or B says before any verdict: why shrinking was undone, the new P(A | B) while shrunk (the
 * screen shows it), or else `count`.
 */
function eventChange(state: EventSpaceState, count: string): string {
	if (state.shrinkRefusal) return shrinkRefusalText(state.shrinkRefusal);
	return state.shrink ? conditionalLine(state) : count;
}
