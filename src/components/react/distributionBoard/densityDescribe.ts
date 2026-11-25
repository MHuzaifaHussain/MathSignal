// Every sentence the density mode shows or speaks (decision 0018), built from state. Shares and heights stay
// fractions ("7/32 of the sand", "7/16 per cm"); positions and widths are decimals in cm, exact on the quarter grid.
import { compareFractions, fraction, toNumber, type Fraction } from '../boardMath.ts';
import { AMOUNT_DECIMAL_PLACES, amountText, decimalText, fractionText, terminatesWithin } from '../boardText.ts';
import { tableFoldAnnouncement } from '../guided/tableFold.ts';
import { formatNumber } from '../plotColors.ts';
import { areaBetween, bins, heightAt, meanOf, RULER_CM, supportOf, varianceOf, type Bin, type PiecewiseLinear } from './density.ts';
import { CURVE_BINS_PER_CM, type BinsPerCm, type DensityStage } from './densitySetups.ts';
import { binWidthOf, densitySetupOf, quartersToCm, sandOf, shapeNow, type DensityAction, type DensityState } from './densityState.ts';
import { fractionChance, rootText, SENTENCE_PLACES, sigmaValue, underText, underThreshold } from './numberFormat.ts';
import type { SpokenLine } from './chartTypes.ts';

const ONE = fraction(1, 1);
/** Positions on the quarter grid need at most two decimals ("1.75"). */
const POSITION_PLACES = 2;

export const DENSITY_LABELS = {
	showAs: 'Show as',
	binWidth: 'Bar width',
	from: 'From',
	to: 'To',
	spread: 'Show the mean and spread',
	presets: 'Presets',
	axis: 'Position on the ruler (cm)',
	heightAxis: 'Height (per cm)',
} as const;

export const STAGE_LABELS: Readonly<Record<DensityStage, string>> = { bars: 'Bars', curve: 'Curve' };

export const DENSITY_BOARD_LABELS = {
	pour: 'Sand poured along a 4 cm ruler, drawn as bars or as a curve. Make the bars thinner to see the height of the pile.',
	interval: 'The pile of sand as a curve, with a shaded stretch of the ruler. Set From and To; the shaded area is the chance.',
} as const;

const STATUS = 'One bag of sand poured along a 4 cm ruler. X = where one grain, picked at random, lies.';

/** "1", "0.5", "1.75": a position or width in cm. */
export const cm = (value: Fraction) => decimalText(value, POSITION_PLACES);
export const binWidthLabel = (binsPerCm: BinsPerCm) => `${cm(binWidthOf(binsPerCm))} cm`;
export const formatQuarters = (quarters: number) => `${cm(quartersToCm(quarters))} cm`;
export const describeFrom = (quarters: number) => `from ${formatQuarters(quarters)}`;
export const describeTo = (quarters: number) => `to ${formatQuarters(quarters)}`;

const isOne = (value: Fraction) => compareFractions(value, ONE) === 0;
const peakOf = (shape: PiecewiseLinear) => shape.knots.reduce((tallest, knot) => (compareFractions(knot.height, tallest.height) > 0 ? knot : tallest));

/** "Sand heap: piled highest at 2 cm.", built from the shape so the sentence can't disagree with the picture. */
function shapeSentence(state: DensityState): string {
	const { name, shape } = sandOf(state);
	const [start, end] = supportOf(shape);
	if (shape.ends === 'closed-block') {
		const whole = start.numerator === 0 && toNumber(end) === RULER_CM;
		return whole ? `${name}: spread evenly from 0 to ${RULER_CM} cm.` : `${name}: all of it between ${cm(start)} and ${cm(end)} cm.`;
	}
	return `${name}: piled highest at ${cm(peakOf(shape).x)} cm.`;
}

export function statusLine(state: DensityState): string {
	return `${STATUS} ${shapeSentence(state)}`;
}

// ---- Bars ----

const binsNow = (state: DensityState): Bin[] => bins(shapeNow(state), binWidthOf(state.binsPerCm));
const binName = (bin: Bin) => `${cm(bin.from)} to ${cm(bin.to)} cm`;

/** The tallest bar's sentence. The template covers one tallest bar, two, or every bar alike; anything else throws. */
export function tallestLine(state: DensityState): string {
	const all = binsNow(state);
	const width = binWidthOf(state.binsPerCm);
	const top = all.reduce((tallest, bin) => (compareFractions(bin.share, tallest.share) > 0 ? bin : tallest));
	const tallest = all.filter((bin) => compareFractions(bin.share, top.share) === 0);
	const share = fractionText(top.share);
	const height = `${fractionText(top.height)} per cm${compareFractions(top.height, ONE) > 0 ? ', taller than 1' : ''}`;
	const division = `${share} ÷ ${cm(width)} = ${height}`;
	if (tallest.length === all.length) return `Every bar holds ${share} of the sand. Height = sand ÷ width = ${division}.`;
	if (tallest.length === 1) {
		const holds = isOne(top.share) ? 'all the sand' : `${share} of the sand`;
		return `The tallest bar, ${binName(top)}, holds ${holds}. Height = ${division}.`;
	}
	if (tallest.length === 2) return `The tallest bars, ${binName(tallest[0])} and ${binName(tallest[1])}, hold ${share} of the sand each. Height = ${division}.`;
	throw new Error(`DistributionBoard: ${sandOf(state).name} has ${tallest.length} tallest bars at ${cm(width)} cm; the sentence covers one, two or all.`);
}

const BARS_TOTAL = "The bars' areas add up to 1: all the sand.";
const CURVE_TOTAL = 'The area under the curve is 1: all the sand.';

// ---- Curve ----

/** "The curve is the pile's height at each point: …", built from the knots like the shape sentence. */
export function curveLine(state: DensityState): string {
	const { shape, name } = sandOf(state);
	const [start, end] = supportOf(shape);
	const lead = "The curve is the pile's height at each point:";
	if (shape.ends === 'closed-block') {
		const beyond = toNumber(end) < RULER_CM ? ', and 0 beyond' : '';
		return `${lead} ${fractionText(shape.knots[0].height)} per cm from ${cm(start)} to ${cm(end)} cm${beyond}.`;
	}
	if (shape.knots.length !== 3) throw new Error(`DistributionBoard: the curve sentence covers one peak; ${name} has ${shape.knots.length - 2}.`);
	const peak = shape.knots[1];
	return `${lead} it rises from 0 at ${cm(start)} cm to ${fractionText(peak.height)} per cm at ${cm(peak.x)} cm and falls back to 0 at ${cm(end)} cm.`;
}

// ---- Interval ----

const intervalEnds = (state: DensityState) => [quartersToCm(state.from), quartersToCm(state.to)] as const;
export const shadedShare = (state: DensityState): Fraction => areaBetween(shapeNow(state), ...intervalEnds(state));

/** "3/4 of the sand", "all the sand", "none of the sand". */
function shareWords(share: Fraction): string {
	if (share.numerator === 0) return 'none of the sand';
	return isOne(share) ? 'all the sand' : `${fractionText(share)} of the sand`;
}

/** The interval sentence; the spoken form says "≤" in words. */
export function intervalLine(state: DensityState): SpokenLine | null {
	if (!densitySetupOf(state).openingInterval) return null;
	const [a, b] = intervalEnds(state);
	if (state.from === state.to) {
		const height = heightAt(shapeNow(state), a);
		const tail = height.numerator === 0 ? 'and the curve is 0 there too' : `although the curve is ${fractionText(height)} per cm tall there`;
		const text = `From ${cm(a)} to ${cm(b)} cm: no width, so no area. P(X = ${cm(a)}) = 0, ${tail}.`;
		return { visible: text, spoken: text };
	}
	const share = shadedShare(state);
	const lead = `From ${cm(a)} to ${cm(b)} cm: the shaded area is ${shareWords(share)}, so`;
	const exact = fractionChance(share);
	const decimal = formatNumber(toNumber(share), SENTENCE_PLACES);
	const tiny = underThreshold(share.numerator, share.denominator, SENTENCE_PLACES);
	const decimalWords = tiny ? underText(SENTENCE_PLACES) : `${terminatesWithin(share, SENTENCE_PLACES) ? '' : 'about '}${decimal}`;
	const spokenValue = isOne(share) || share.numerator === 0 ? fractionText(share) : `${fractionText(share)}, or ${decimalWords}`;
	return {
		visible: `${lead} P(${cm(a)} ≤ X ≤ ${cm(b)}) = ${exact}.`,
		spoken: `${lead} the chance that X is from ${cm(a)} to ${cm(b)} cm is ${spokenValue}.`,
	};
}

// ---- Mean and spread ----

export function spreadLines(state: DensityState): string[] {
	if (!state.spreadShown) return [];
	const shape = shapeNow(state);
	const variance = varianceOf(shape);
	return [`The mean is μ = ${amountText(meanOf(shape))} cm: the pile balances there.`, `Variance: ${amountText(variance)} cm². Standard deviation: σ = ${rootText(variance)} ${sigmaValue(variance)} cm.`];
}

// ---- Readouts ----

export function readoutLines(state: DensityState): SpokenLine[] {
	const plain = (text: string) => ({ visible: text, spoken: text });
	const interval = intervalLine(state);
	if (interval) return [interval, ...spreadLines(state).map(plain)];
	if (state.stage === 'bars') return [plain(tallestLine(state)), plain(BARS_TOTAL)];
	return [plain(curveLine(state)), plain(CURVE_TOTAL)];
}

// ---- Chart labels ----

export interface DensityChartLabels {
	axis: string;
	heightAxis: string;
	gridlines: readonly { value: number; label: string; solid: boolean }[];
	mu: string | null;
	sigma: string | null;
}

export function chartLabels(state: DensityState): DensityChartLabels {
	const setup = densitySetupOf(state);
	const shape = shapeNow(state);
	const variance = varianceOf(shape);
	const mean = meanOf(shape);
	const muValue = terminatesWithin(mean, AMOUNT_DECIMAL_PLACES) ? `= ${amountText(mean)}` : `≈ ${formatNumber(toNumber(mean), SENTENCE_PLACES)}`;
	return {
		axis: DENSITY_LABELS.axis,
		heightAxis: DENSITY_LABELS.heightAxis,
		gridlines: setup.gridlines.map((line) => ({ value: toNumber(line.value), label: line.label, solid: line.solid })),
		mu: state.spreadShown ? `μ ${muValue}` : null,
		sigma: state.spreadShown ? `σ ${sigmaValue(variance)}` : null,
	};
}

// ---- Table ----

export interface DensityTable {
	caption: string;
	headers: readonly string[];
	rows: readonly (readonly string[])[];
	footer: { label: string; value: string } | null;
}

const HEADERS = ['From (cm)', 'To (cm)', 'Share of the sand', 'Height (per cm)'] as const;
const CURVE_CAPTION = 'The curve, measured in bars 0.25 cm wide.';

/** The bars the table lists: the bars on screen, or the curve measured in 0.25 cm bars. */
const tableBinsPerCm = (state: DensityState): BinsPerCm => (state.stage === 'bars' ? state.binsPerCm : CURVE_BINS_PER_CM);

export function tableOf(state: DensityState): DensityTable {
	const interval = densitySetupOf(state).openingInterval !== null;
	const [a, b] = intervalEnds(state);
	const shaded = (bin: Bin) => interval && state.from < state.to && compareFractions(bin.from, a) >= 0 && compareFractions(bin.to, b) <= 0;
	const rows = bins(shapeNow(state), binWidthOf(tableBinsPerCm(state))).map((bin) => [
		shaded(bin) ? `${cm(bin.from)} (shaded)` : cm(bin.from),
		cm(bin.to),
		fractionText(bin.share),
		fractionText(bin.height),
	]);
	const footer = interval ? { label: `Shaded, from ${cm(a)} to ${cm(b)} cm`, value: shareWords(shadedShare(state)) } : null;
	return { caption: state.stage === 'bars' ? 'The bars as a table.' : CURVE_CAPTION, headers: HEADERS, rows, footer };
}

/** The Table view body. */
export function tableFoldSentence(state: DensityState): string {
	const count = RULER_CM * tableBinsPerCm(state);
	const width = binWidthLabel(tableBinsPerCm(state));
	if (densitySetupOf(state).openingInterval) return `It lists the curve measured in ${count} bars ${width} wide, then the shaded share.`;
	const listed = state.stage === 'bars' ? `the ${count} bars ${width} wide` : `the curve measured in ${count} bars ${width} wide`;
	return `It lists ${listed}, each with its share of the sand and its height.`;
}

// ---- Announcements ----

/** The first readout a view shows, as spoken. */
const firstReadout = (state: DensityState) => readoutLines(state)[0].spoken;

/** "To moved along to 3 cm. " when a From move carried To, and the reverse. */
function pushSentence(previous: DensityState, state: DensityState, moved: 'from' | 'to'): string {
	if (moved === 'from' && state.to !== previous.to) return `To moved along to ${formatQuarters(state.to)}. `;
	if (moved === 'to' && state.from !== previous.from) return `From moved back to ${formatQuarters(state.from)}. `;
	return '';
}

/** What the live region says after `action` took `previous` to `state`. */
export function densityAnnouncement(previous: DensityState, state: DensityState, action: DensityAction): string {
	switch (action.type) {
		case 'preset': {
			if (previous.shape === state.shape) return `${sandOf(state).name} is already showing.`;
			return [shapeSentence(state), firstReadout(state), ...(densitySetupOf(state).openingInterval ? spreadLines(state) : [])].join(' ');
		}
		case 'stage':
			return state.stage === 'curve' ? `Showing the curve. ${curveLine(state)}` : `Showing bars ${binWidthLabel(state.binsPerCm)} wide. ${tallestLine(state)}`;
		case 'bin-width':
			return tallestLine(state);
		case 'from':
		case 'to':
			return `${pushSentence(previous, state, action.type)}${firstReadout(state)}`;
		case 'spread':
			return action.on ? spreadLines(state).join(' ') : 'Mean and spread hidden.';
		case 'table':
			return tableFoldAnnouncement(action.open, tableFoldSentence(state));
		case 'reset':
			return 'Board reset.';
	}
}

/** Bar width as bars per cm, for the choice's values. */
export const binWidthOptions = (state: DensityState) => densitySetupOf(state).binWidths.map((perCm) => ({ value: String(perCm), label: binWidthLabel(perCm) }));
