// Which of DistributionBoard's modes a setup belongs to (decision 0018). Each mode keeps its own registry; this is
// the one place that looks across them, so an id can't be claimed twice or go unrecognized.
import { DENSITY_SETUPS, isDensitySetupId, type DensitySetupId } from './densitySetups.ts';
import { FAMILY_SETUPS, isFamilySetupId, type FamilySetupId } from './familySetups.ts';
import { isOutcomeSetupId, OUTCOME_SETUP_IDS, type SetupId } from './setups.ts';

export type BoardMode = 'outcomes' | 'family' | 'density';
export type BoardSetupId = SetupId | FamilySetupId | DensitySetupId;

const REGISTRIES: readonly { mode: BoardMode; has: (id: string) => boolean; ids: () => readonly string[] }[] = [
	{ mode: 'outcomes', has: isOutcomeSetupId, ids: () => OUTCOME_SETUP_IDS },
	{ mode: 'family', has: isFamilySetupId, ids: () => Object.keys(FAMILY_SETUPS) },
	{ mode: 'density', has: isDensitySetupId, ids: () => Object.keys(DENSITY_SETUPS) },
];

/** The mode whose registry holds `id`. Throws, listing every known id, on an unknown id or one held twice. */
export function boardModeOf(id: string): BoardMode {
	const holders = REGISTRIES.filter((registry) => registry.has(id));
	if (holders.length === 1) return holders[0].mode;
	if (holders.length > 1) throw new Error(`DistributionBoard: setup "${id}" is defined in two modes (${holders.map((holder) => holder.mode).join(', ')}).`);
	const known = REGISTRIES.flatMap((registry) => registry.ids());
	throw new Error(`DistributionBoard: unknown setup "${id}". Known setups: ${known.join(', ')}.`);
}

/** Every setup id of every mode, for the lab page and the checks. */
export const allBoardSetupIds = (): readonly string[] => REGISTRIES.flatMap((registry) => registry.ids());
