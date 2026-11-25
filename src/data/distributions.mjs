// Distribution families and their properties, written once (decision 0023, extending 0009). PropertiesTable renders a
// family's rows; a page supplies only its own example column. The family's owner page must show the table, which
// `npm run check:content` enforces.
//
// Every label and statement is prose with $…$ math, like page text: KaTeX never wraps inside \text{}, so prose stays
// outside math, and a literal dollar sign is written \$. Row ids are stable: pages and later hubs name rows by id.

/** @typedef {{ id: string, label: string, statement: string }} PropertyRow */
/**
 * @typedef {object} Family
 * @property {string} id
 * @property {string} name As the caption says it: "Properties of the {name} distribution".
 * @property {string} ownerTopic The topic id of the page that must show the full table.
 * @property {string} statementHeading The second column's heading.
 * @property {PropertyRow[]} rows In display order.
 */

/** @type {readonly Family[]} */
export const DISTRIBUTIONS = [
	{
		id: 'binomial',
		name: 'binomial',
		ownerTopic: 'probability/binomial-distribution',
		statementHeading: 'Statement',
		rows: [
			{ id: 'bernoulli', label: 'Bernoulli', statement: 'With $n = 1$: values 0 and 1, mean $p$, variance $p(1 - p)$' },
			{ id: 'pmf', label: 'Formula', statement: '$P(X = k) = \\binom{n}{k} p^k (1 - p)^{n - k}$' },
			{ id: 'total', label: 'Adds up to 1', statement: 'By the binomial theorem, $\\sum_k P(X = k) = (p + 1 - p)^n = 1$' },
			{ id: 'mean', label: 'Mean', statement: '$np$' },
			{ id: 'variance', label: 'Variance', statement: '$np(1 - p)$, at most $n/4$' },
			{ id: 'tallest', label: 'Tallest bar', statement: 'At $\\lfloor (n + 1)p \\rfloor$ for $0 < p < 1$, tied with the bar below when $(n + 1)p$ is whole' },
			{ id: 'mirror', label: 'Mirror', statement: '$n - X \\sim \\operatorname{Bin}(n, 1 - p)$' },
			{ id: 'sums', label: 'Sums', statement: '$\\operatorname{Bin}(n, p) + \\operatorname{Bin}(m, p) = \\operatorname{Bin}(n + m, p)$ for independent counts' },
			{ id: 'needs', label: 'Needs', statement: 'A fixed $n$, independent trials, the same $p$' },
		],
	},
	{
		id: 'normal',
		name: 'normal',
		ownerTopic: 'statistics/normal-distribution',
		statementHeading: 'Value',
		rows: [
			{ id: 'center', label: 'Mean, median, mode', statement: '$\\vmu$' },
			{ id: 'variance', label: 'Variance', statement: '$\\vsigma^2$' },
			{ id: 'skewness', label: 'Skewness', statement: '0' },
			{ id: 'kurtosis', label: 'Excess kurtosis', statement: '0' },
			{ id: 'entropy', label: 'Entropy', statement: '$\\tfrac{1}{2}\\ln(2\\pi e \\vsigma^2)$' },
			{ id: 'mgf', label: 'Moment generating function', statement: '$\\exp(\\vmu t + \\vsigma^2 t^2 / 2)$' },
		],
	},
	{
		id: 'uniform',
		name: 'uniform',
		ownerTopic: 'probability/probability-density-functions',
		statementHeading: 'Uniform $\\mathcal{U}(a, b)$',
		rows: [
			{ id: 'height', label: 'Height', statement: '$1/(b - a)$' },
			{ id: 'mean', label: 'Mean', statement: '$(a + b)/2$' },
			{ id: 'variance', label: 'Variance', statement: '$(b - a)^2/12$' },
			{ id: 'point', label: '$P(X = x)$', statement: '0' },
		],
	},
];

/** A family by id, or an error naming it. */
export function getDistribution(id) {
	const family = DISTRIBUTIONS.find((entry) => entry.id === id);
	if (!family) throw new Error(`PropertiesTable: unknown distribution family "${id}"; add it to src/data/distributions.mjs`);
	return family;
}
