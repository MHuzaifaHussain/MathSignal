// The density mode's state and every transition, as a pure reducer (decision 0018). The push rule lives here: From
// and To keep a fixed 0 to 4 cm range, and moving one past the other carries the other along. Whether a move pushed
// the other end is read by comparing states, so a slider burst that pushes and then backs off still says so.
import { fraction, type Fraction } from '../boardMath.ts';
import { QUARTERS_PER_CM, RULER_CM, type PiecewiseLinear } from './density.ts';
import { getDensitySetup, shapeOf, type BinsPerCm, type DensitySetup, type DensitySetupId, type DensityStage, type ShapeId } from './densitySetups.ts';

export interface DensityState {
	setupId: DensitySetupId;
	shape: ShapeId;
	stage: DensityStage;
	binsPerCm: BinsPerCm;
	/** The shaded stretch, in whole quarters of a centimeter (0..16); From ≤ To always holds. */
	from: number;
	to: number;
	spreadShown: boolean;
	/** "Table view" (decision 0017): off at the start and after Reset. */
	tableOpen: boolean;
}

export type DensityAction =
	| { type: 'preset'; name: string }
	| { type: 'stage'; stage: DensityStage }
	| { type: 'bin-width'; binsPerCm: BinsPerCm }
	| { type: 'from'; quarters: number }
	| { type: 'to'; quarters: number }
	| { type: 'spread'; on: boolean }
	| { type: 'table'; open: boolean }
	| { type: 'reset' };

export const LAST_QUARTER = RULER_CM * QUARTERS_PER_CM;

export const densitySetupOf = (state: DensityState): DensitySetup => getDensitySetup(state.setupId);
export const sandOf = (state: DensityState) => shapeOf(state.shape);
export const shapeNow = (state: DensityState): PiecewiseLinear => sandOf(state).shape;
/** A whole number of quarters as centimeters. */
export const quartersToCm = (quarters: number): Fraction => fraction(quarters, QUARTERS_PER_CM);
/** The bar width in cm: 1, 1/2 or 1/4. */
export const binWidthOf = (binsPerCm: BinsPerCm): Fraction => fraction(1, binsPerCm);

export function initialDensityState(setupId: DensitySetupId): DensityState {
	const setup = getDensitySetup(setupId);
	const [from, to] = setup.openingInterval ?? [0, 0];
	return {
		setupId,
		shape: setup.openingShape,
		stage: setup.stages[0],
		binsPerCm: setup.binWidths[0],
		from,
		to,
		spreadShown: false,
		tableOpen: false,
	};
}

const clampQuarter = (quarters: number) => Math.min(Math.max(Math.round(quarters), 0), LAST_QUARTER);

function assertInterval(state: DensityState, action: DensityAction['type']): void {
	if (!densitySetupOf(state).openingInterval) throw new Error(`DistributionBoard: "${action}" needs a setup with an interval, not "${state.setupId}".`);
}

export function densityReducer(state: DensityState, action: DensityAction): DensityState {
	const setup = densitySetupOf(state);
	switch (action.type) {
		case 'preset': {
			// A preset keeps the view, the bar width, the stretch and the table, so shapes are compared like for like.
			const id = setup.shapes.find((candidate) => shapeOf(candidate).name === action.name);
			return id ? { ...state, shape: id } : state;
		}
		case 'stage':
			return setup.stages.includes(action.stage) ? { ...state, stage: action.stage } : state;
		case 'bin-width':
			return setup.binWidths.includes(action.binsPerCm) ? { ...state, binsPerCm: action.binsPerCm } : state;
		case 'from': {
			assertInterval(state, 'from');
			const from = clampQuarter(action.quarters);
			return { ...state, from, to: Math.max(state.to, from) };
		}
		case 'to': {
			assertInterval(state, 'to');
			const to = clampQuarter(action.quarters);
			return { ...state, to, from: Math.min(state.from, to) };
		}
		case 'spread':
			if (!setup.spreadSwitch) throw new Error(`DistributionBoard: "spread" needs a setup with the switch, not "${state.setupId}".`);
			return { ...state, spreadShown: action.on };
		case 'table':
			return { ...state, tableOpen: action.open };
		case 'reset':
			return initialDensityState(state.setupId);
	}
}
