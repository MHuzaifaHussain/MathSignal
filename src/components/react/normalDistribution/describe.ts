// Every sentence the z mode shows or speaks (decision 0019). A line whose spoken form differs ("z is 6 divided by 8",
// "Phi of 0.75") is a { visible, spoken } pair, rendered with SpokenText. Exact numbers come from boardText's
// decimalText; a rounded number always says "≈" or "about". Gated lines read only `revealed`. Pure, for check-boards.
import { compareFractions, fraction, toNumber, type Fraction } from '../boardMath.ts';
import { decimalText, fractionText, terminatesWithin } from '../boardText.ts';
import type { SpokenLine } from '../distributionBoard/chartTypes.ts';
import { tableFoldAnnouncement } from '../guided/tableFold.ts';
import { formatNumber } from '../plotColors.ts';
import { distanceAt, indexFromSlider, standardNormalCdf, valueAt, zAt } from './model.ts';
import { answerFor, getZPreset, type ZPreset } from './setups.ts';
import { presetOf, revealed, setupOf, type ZAction, type ZState } from './state.ts';

/** Places an exact decimal may have before the text falls back to "≈". */
const EXACT_PLACES = 3;
/** Places of a rounded z after "≈". */
const ROUNDED_Z_PLACES = 2;
const PHI_PLACES = 4;
const PERCENT_PLACES = 1;
const UNIT_WORDS: Record<Exclude<ZPreset['unit'], ''>, string> = { cm: 'centimeters' };

/** The unit in words. Only a measured preset has one; validateSetup keeps the standard preset out of the verdicts. */
function unitWords(preset: ZPreset): string {
	if (preset.unit === '') throw new Error(`normalDistribution describe: preset ${preset.id} has no unit to name`);
	return UNIT_WORDS[preset.unit];
}

export const BOARD_LABEL =
	"A normal curve over a ruler in the group's units. Say who is taller for their age and press Check to add a z-score ruler under it. Move the value with the slider below or by dragging the ochre point.";

export const CONTROL_LABELS = {
	presets: 'Presets',
	presetsCaption: 'Preset',
	sliderMeasured: 'Height',
	sliderStandard: 'Value z',
	check: 'Check',
	/** CheckButtons needs it, but a one-shot Check never offers it. */
	showAnswer: 'Show the answer',
	shade: 'Shade the share below',
} as const;

export const CHECK_REFUSAL = 'Pick who is taller for their age first.';
export const SHADING_OFF = 'Shading off.';

const same = (text: string): SpokenLine => ({ visible: text, spoken: text });
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const isZero = (value: Fraction) => compareFractions(value, fraction(0, 1)) === 0;

/** "minus 1.5" for "−1.5": screen readers at default verbosity may skip the sign. */
const spokenSigned = (text: string) => (text.startsWith('−') ? `minus ${text.slice(1)}` : text);

const exact = (value: Fraction) => decimalText(value, EXACT_PLACES);
const withUnit = (preset: ZPreset, text: string) => (preset.unit ? `${text} ${preset.unit}` : text);

/** "= 0.125" when z has an exact decimal of up to 3 places, otherwise "≈ 0.58". */
export function zResultText(z: Fraction): string {
	return terminatesWithin(z, EXACT_PLACES) ? `= ${exact(z)}` : `≈ ${formatNumber(toNumber(z), ROUNDED_Z_PLACES)}`;
}

function zResultSpoken(z: Fraction): string {
	return terminatesWithin(z, EXACT_PLACES) ? `which is ${spokenSigned(exact(z))}` : `about ${spokenSigned(formatNumber(toNumber(z), ROUNDED_Z_PLACES))}`;
}

/** Φ's argument: "0.75", or "7/12" and "−7/12" when z has no short exact decimal. */
export function zArgumentText(z: Fraction): string {
	return terminatesWithin(z, EXACT_PLACES) ? exact(z) : fractionText(z);
}

function zArgumentSpoken(z: Fraction): string {
	if (terminatesWithin(z, EXACT_PLACES)) return spokenSigned(exact(z));
	const magnitude = `${Math.abs(z.numerator)} over ${z.denominator}`;
	return z.numerator < 0 ? `minus ${magnitude}` : magnitude;
}

export type ShareParts = { exact: true; phi: '0.5'; percent: '50' } | { exact: false; phi: string; percent: string };

/**
 * Φ(z) to 4 places and as a percent to 1 place. At z = 0, decided from the exact fraction, it is exactly 0.5 and 50%.
 * Throws if a share would print as 0 or 1, which would read as "none" or "all".
 */
export function shareParts(z: Fraction): ShareParts {
	if (isZero(z)) return { exact: true, phi: '0.5', percent: '50' };
	const phiValue = standardNormalCdf(toNumber(z));
	const phi = phiValue.toFixed(PHI_PLACES);
	const percent = (phiValue * 100).toFixed(PERCENT_PLACES);
	if (['0.0000', '1.0000'].includes(phi) || ['0.0', '100.0'].includes(percent)) {
		throw new Error(`normalDistribution.shareParts: Φ(${fractionText(z)}) = ${phiValue} would print as ${phi} or ${percent}%`);
	}
	return { exact: false, phi, percent };
}

function valueTextAt(preset: ZPreset, index: number): string {
	return withUnit(preset, exact(valueAt(preset, index)));
}

export function groupLine(preset: ZPreset): SpokenLine {
	const mean = withUnit(preset, exact(fraction(preset.mean, 1)));
	const sd = withUnit(preset, exact(fraction(preset.sd, 1)));
	return {
		visible: `${preset.group}: mean μ = ${mean}, standard deviation σ = ${sd}.`,
		spoken: `${preset.group}: mean ${mean}, standard deviation ${sd}.`,
	};
}

export function valueLine(state: ZState): SpokenLine {
	const preset = presetOf(state);
	const z = zAt(preset, state.index);
	if (preset.kind === 'standard') {
		return {
			visible: `On the standard normal the value is its own z-score: z = ${exact(z)}.`,
			spoken: `On the standard normal the value is its own z-score: z is ${spokenSigned(exact(z))}.`,
		};
	}
	const value = valueTextAt(preset, state.index);
	const distance = distanceAt(preset, state.index);
	if (isZero(distance)) {
		return revealed(state) ? { visible: `${value} is the mean: z = 0.`, spoken: `${value} is the mean: z is 0.` } : same(`${value} is the mean.`);
	}
	const side = distance.numerator > 0 ? 'above' : 'below';
	const where = `${value} is ${withUnit(preset, exact(fraction(Math.abs(distance.numerator), distance.denominator)))} ${side} the mean`;
	if (!revealed(state)) return same(`${where}.`);
	const signed = exact(distance);
	return {
		visible: `${where}: z = ${signed} / ${preset.sd} ${zResultText(z)}.`,
		spoken: `${where}: z is ${spokenSigned(signed)} divided by ${preset.sd}, ${zResultSpoken(z)}.`,
	};
}

/** The share below the value, after Check and only while Shade is on. */
export function shareLine(state: ZState): SpokenLine | null {
	if (!revealed(state) || !state.shading) return null;
	const preset = presetOf(state);
	const z = zAt(preset, state.index);
	const share = shareParts(z);
	const amount = share.exact ? 'exactly' : 'about';
	const phiText = `Φ(${zArgumentText(z)}) ${share.exact ? '=' : '≈'} ${share.phi}.`;
	const phiSpoken = `Phi of ${zArgumentSpoken(z)} is ${share.exact ? '' : 'about '}${share.phi}.`;
	const valueText = valueTextAt(preset, state.index);
	if (preset.kind === 'standard') {
		const lead = `${share.exact ? 'Exactly' : 'About'} ${share.percent}% of a standard normal is below`;
		return { visible: `${lead} ${valueText}: ${phiText}`, spoken: `${lead} ${spokenSigned(valueText)}: ${phiSpoken}` };
	}
	const lead = `If ${preset.quantityPlural} in this group follow a normal curve, ${amount} ${share.percent}% are below ${valueText}:`;
	return { visible: `${lead} ${phiText}`, spoken: `${lead} ${phiSpoken}` };
}

export function readoutLines(state: ZState): SpokenLine[] {
	const share = shareLine(state);
	return [groupLine(presetOf(state)), valueLine(state), ...(share ? [share] : [])];
}

/** The visible reason Check is refused, or null. */
export function checkRefusal(state: ZState): string | null {
	return !revealed(state) && state.guess === null ? CHECK_REFUSAL : null;
}

/** The verdict after Check. Which one is "Yes." comes from answerFor, never from a fixed option. */
export function verdictLine(state: ZState): SpokenLine | null {
	if (!revealed(state) || state.guess === null) return null;
	const setup = setupOf(state);
	const [first, second] = setup.question.children.map((id) => ({ preset: getZPreset(id), index: getZPreset(id).openingIndex }));
	const distance = withUnit(first.preset, exact(distanceAt(first.preset, first.index)));
	const zVisible = ({ preset, index }: typeof first) => `z = ${exact(distanceAt(preset, index))} / ${preset.sd} ${zResultText(zAt(preset, index))}`;
	const zSpoken = ({ preset, index }: typeof first) => {
		const z = zAt(preset, index);
		const value = terminatesWithin(z, EXACT_PLACES) ? spokenSigned(exact(z)) : `about ${spokenSigned(formatNumber(toNumber(z), ROUNDED_Z_PLACES))}`;
		return { value, ratio: `${spokenSigned(exact(distanceAt(preset, index)))} divided by ${preset.sd}` };
	};
	const [firstSpoken, secondSpoken] = [zSpoken(first), zSpoken(second)];
	const numbersVisible = `${zVisible(first)} for the ${first.preset.childNoun} and only ${zVisible(second)} for the ${second.preset.childNoun}.`;
	const numbersSpoken = `z is ${firstSpoken.value} for the ${first.preset.childNoun}, ${firstSpoken.ratio}, and only ${secondSpoken.value} for the ${second.preset.childNoun}, ${secondSpoken.ratio}.`;
	const both = `Both stand ${distance} above their class's mean`;
	const answer = answerFor(setup);
	const winner = answer === 'first' ? first : second;
	const closing = `The ${winner.preset.childNoun} is taller for their age.`;
	const lead =
		state.guess === answer
			? `Yes. ${both}, but the ${lowerFirst(winner.preset.group)} are less spread out:`
			: state.guess === 'same'
				? `Not quite. ${both}, but the ${lowerFirst(second.preset.group)} are more spread out:`
				: `Not quite. The ${second.preset.childNoun} is taller in ${unitWords(second.preset)}, but ${lowerFirst(both)}:`;
	return { visible: `${lead} ${numbersVisible} ${closing}`, spoken: `${lead} ${numbersSpoken} ${closing}` };
}

/** The ChalkNote, only on the standard preset. */
export function chalkNote(state: ZState): { long: string; short: string } | null {
	return presetOf(state).kind === 'standard' ? { long: 'same shape, new ruler', short: 'same shape, new ruler' } : null;
}

/** The slider's label and its value as text and in words. */
export function sliderLabel(preset: ZPreset): string {
	return preset.kind === 'standard' ? CONTROL_LABELS.sliderStandard : CONTROL_LABELS.sliderMeasured;
}

export function sliderFormat(preset: ZPreset, value: number): string {
	return valueTextAt(preset, indexFromSlider(preset, value));
}

export function sliderDescribe(preset: ZPreset, value: number): string {
	const text = spokenSigned(valueTextAt(preset, indexFromSlider(preset, value)));
	return preset.kind === 'standard' ? `z ${text}` : `${preset.quantity} ${text}`;
}

export function tableCaption(state: ZState): string {
	return `The ${presetOf(state).quantity} on the board, step by step`;
}

/** The fold's rows, header then cell. The z-score and share rows wait for Check (a fold is not a spoiler gate). */
export function tableRows(state: ZState): [string, string][] {
	const preset = presetOf(state);
	const distance = distanceAt(preset, state.index);
	const rows: [string, string][] = [
		['Mean μ', withUnit(preset, exact(fraction(preset.mean, 1)))],
		['Standard deviation σ', withUnit(preset, exact(fraction(preset.sd, 1)))],
		[`${preset.quantity === 'height' ? 'Height' : 'Value'} x`, valueTextAt(preset, state.index)],
		['Distance from the mean, x − μ', withUnit(preset, exact(distance))],
	];
	if (!revealed(state)) return rows;
	const z = zAt(preset, state.index);
	rows.push(['z-score, (x − μ) / σ', `${exact(distance)} / ${preset.sd} ${zResultText(z)}`]);
	if (!state.shading) {
		rows.push(['Share below, Φ(z)', `Turn on ${CONTROL_LABELS.shade}.`]);
		return rows;
	}
	const share = shareParts(z);
	rows.push(['Share below, Φ(z)', share.exact ? `= ${share.phi}, exactly ${share.percent}%` : `≈ ${share.phi}, about ${share.percent}%`]);
	return rows;
}

/** The body of the Table view announcement: what the table lists now. */
export function tableFoldBody(state: ZState): string {
	const thing = presetOf(state).quantity;
	return revealed(state)
		? `It lists the mean, the standard deviation, the ${thing}, its distance from the mean, its z-score and the share below.`
		: `It lists the mean, the standard deviation, the ${thing} and its distance from the mean.`;
}

/**
 * What the live region says after an action, or null when it says nothing: a guess (the radio speaks for itself) and
 * a Check that passed (focus moves to the verdict, which is read there). `previous` is the state before the action.
 */
export function announcementFor(previous: ZState, state: ZState, action: ZAction): string | null {
	const spokenLines = () => readoutLines(state).map((line) => line.spoken);
	switch (action.type) {
		case 'preset':
			return state === previous ? `Already showing ${presetOf(state).label}.` : spokenLines().join(' ');
		case 'value':
			return spokenLines().slice(1).join(' ');
		case 'guess':
			return null;
		case 'check':
			return revealed(state) ? null : checkRefusal(state);
		case 'shade':
			return action.on ? (shareLine(state)?.spoken ?? null) : SHADING_OFF;
		case 'table':
			return tableFoldAnnouncement(action.open, tableFoldBody(state));
		case 'reset':
			return `Back to the start. ${spokenLines().join(' ')}`;
	}
}
