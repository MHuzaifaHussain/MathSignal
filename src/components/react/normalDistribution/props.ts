// The prop guard that picks NormalDistribution's bell or z mode (decision 0019). It knows only the setup ids, so the
// published bell pages load none of the z mode's setups or math; setups.ts checks its registry matches this list.
// MDX props aren't type-checked, so this is the only guard. Pure, for check-boards.

export const Z_SETUP_IDS = ['taller-for-age'] as const;
export type ZSetupId = (typeof Z_SETUP_IDS)[number];

export type NormalBoardChoice = { mode: 'bell' } | { mode: 'z'; setup: ZSetupId };

const MODES = ['bell', 'z'] as const;

const isSetupId = (value: unknown): value is ZSetupId => Z_SETUP_IDS.includes(value as ZSetupId);

/**
 * The bell with no props (or mode="bell"), or the z mode with a known setup. Runs at build time and again at
 * hydration. Keys whose value is undefined are ignored, and `children` is always allowed and ignored, because Astro's
 * React client may pass one at hydration that the server render didn't have. Anything else throws, naming the prop.
 */
export function resolveNormalProps(props: Readonly<Record<string, unknown>>): NormalBoardChoice {
	const fail = (why: string) => {
		throw new Error(`NormalDistribution: ${why}`);
	};
	const setups = Z_SETUP_IDS.join(', ');
	for (const [key, value] of Object.entries(props)) {
		if (value !== undefined && key !== 'children' && key !== 'mode' && key !== 'setup') fail(`unknown prop "${key}"; the props are mode ("bell" or "z") and setup (${setups})`);
	}
	const { mode, setup } = props;
	if (mode !== undefined && !MODES.includes(mode as (typeof MODES)[number])) fail(`mode must be "bell" or "z", got ${JSON.stringify(mode)}`);
	if (mode === 'z') {
		if (setup === undefined) fail(`mode="z" needs a setup: ${setups}`);
		if (!isSetupId(setup)) fail(`unknown setup ${JSON.stringify(setup)}; the setups are ${setups}`);
		return { mode: 'z', setup: setup as ZSetupId };
	}
	if (setup !== undefined) fail('a setup needs mode="z"');
	return { mode: 'bell' };
}
