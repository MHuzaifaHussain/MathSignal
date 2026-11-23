// Every symbol MathSignal uses, with one meaning and one convention each (decision 0009).
// <NotationKey symbols={['mu', 'sigma']} /> renders rows from here; an unknown key fails the build.
// `tex` may use the page macros (\vmu, \vsigma) so meaning colors match the formulas.

/** @typedef {{ key: string, tex: string, say: string, meaning: string, note?: string }} NotationEntry */

/** @type {NotationEntry[]} */
export const NOTATION = [
	{ key: 'mu', tex: '\\vmu', say: '"mu"', meaning: 'Mean: the center of a distribution' },
	{ key: 'sigma', tex: '\\vsigma', say: '"sigma"', meaning: 'Standard deviation: the spread, in the data\'s own units' },
	{ key: 'sigma2', tex: '\\vsigma^2', say: '"sigma squared"', meaning: 'Variance: the spread in squared units' },
	{
		key: 'normal',
		tex: '\\mathcal{N}(\\vmu, \\vsigma^2)',
		say: '"normal with mean mu and variance sigma squared"',
		meaning: 'A normal distribution',
		note: 'The second argument is the variance, not the standard deviation. NumPy and PyTorch take the standard deviation instead.',
	},
	{ key: 'sim', tex: 'X \\sim \\mathcal{N}(\\vmu, \\vsigma^2)', say: '"X is distributed normally with…"', meaning: 'The random variable X follows that distribution' },
	{ key: 'z', tex: 'z', say: '"z"', meaning: 'A z-score: how many standard deviations a value sits from the mean' },
	{ key: 'expectation', tex: '\\mathbb{E}[X]', say: '"the expected value of X"', meaning: 'The long-run average of X' },
	{ key: 'variance', tex: '\\operatorname{Var}[X]', say: '"the variance of X"', meaning: 'The expected squared distance of X from its mean' },
];

const BY_KEY = new Map(NOTATION.map((entry) => [entry.key, entry]));

/** @param {string} key */
export function getNotation(key) {
	const entry = BY_KEY.get(key);
	if (!entry) throw new Error(`Unknown notation key "${key}". Add it to src/data/notation.mjs.`);
	return entry;
}
