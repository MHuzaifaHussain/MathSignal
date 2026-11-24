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
	{ key: 'sample-space', tex: '\\Omega', say: '"Omega"', meaning: 'The sample space: the set of all possible outcomes' },
	{ key: 'outcome', tex: '\\omega', say: '"omega"', meaning: 'An outcome: one result of the experiment' },
	{ key: 'event', tex: 'A \\subseteq \\Omega', say: '"A is a subset of Omega"', meaning: 'An event: a group of outcomes we care about', note: 'On infinite spaces, only the subsets in 𝓕.' },
	{ key: 'complement', tex: 'A^\\complement', say: '"A complement" or "not A"', meaning: 'The event that A does not happen' },
	{ key: 'intersection', tex: 'A \\cap B', say: '"A and B" or "A intersect B"', meaning: 'The event that both A and B happen' },
	{ key: 'union', tex: 'A \\cup B', say: '"A or B" or "A union B"', meaning: 'The event that A happens, B happens, or both' },
	{ key: 'empty-set', tex: '\\emptyset', say: '"the empty set"', meaning: 'The event with no outcomes, which can never happen' },
	{ key: 'probability', tex: 'P(A)', say: '"the probability of A"', meaning: 'How likely the event A is, from 0 to 1' },
	{
		key: 'conditional',
		tex: 'P(A \\mid B)',
		say: '"the probability of A given B"',
		meaning: 'How likely A is once you know B happened',
		note: 'Undefined when P(B) = 0.',
	},
	{ key: 'cardinality', tex: '|A|', say: '"the size of A"', meaning: 'The number of outcomes in A' },
	{
		key: 'event-collection',
		tex: '\\mathcal{F}',
		say: '"script F"',
		meaning: 'The collection of events we are allowed to ask about',
		note: 'Written 𝓕 here, not σ, because σ is the standard deviation on this site.',
	},
	{ key: 'density', tex: 'p(x)', say: '"p of x"', meaning: 'A probability density: probability per unit, for continuous quantities' },
];

const BY_KEY = new Map(NOTATION.map((entry) => [entry.key, entry]));

/** @param {string} key */
export function getNotation(key) {
	const entry = BY_KEY.get(key);
	if (!entry) throw new Error(`Unknown notation key "${key}". Add it to src/data/notation.mjs.`);
	return entry;
}
