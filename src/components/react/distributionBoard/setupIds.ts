// The family and density setup ids, kept apart from their registries so DistributionBoard can pick a mode without
// loading that mode's code (decision 0018). Each registry is typed Record<Id, Setup>, so an id listed here with no
// setup, or a setup missing from this list, fails the type check.
export const FAMILY_SETUP_IDS = ['coins-binomial', 'binomial-spread'] as const;
export const DENSITY_SETUP_IDS = ['sand-pour', 'sand-interval'] as const;

export type FamilySetupId = (typeof FAMILY_SETUP_IDS)[number];
export type DensitySetupId = (typeof DENSITY_SETUP_IDS)[number];

export function isFamilySetupId(id: string): id is FamilySetupId {
	return (FAMILY_SETUP_IDS as readonly string[]).includes(id);
}

export function isDensitySetupId(id: string): id is DensitySetupId {
	return (DENSITY_SETUP_IDS as readonly string[]).includes(id);
}
