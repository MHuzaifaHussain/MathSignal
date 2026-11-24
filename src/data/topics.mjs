// Every topic, published or planned, and how they connect (decision 0009).
// `id` is the page path without slashes (subject/slug). Planned topics show as "coming soon" until published.
// `recap` is the two-line reminder shown wherever the topic is a prerequisite, so it is written once.

/** @typedef {{ id: string, title: string, description: string, recap: string, status: 'published' | 'planned', prerequisites: string[], leadsTo: string[] }} Topic */

/** @type {Topic[]} */
export const TOPICS = [
	{
		id: 'probability/sample-spaces-and-events',
		title: 'Sample spaces and events',
		description: 'Listing everything that could happen, and naming the groups of outcomes we care about.',
		recap: 'A sample space is the set of all possible outcomes of a random experiment. An event is any group of those outcomes, such as "the die shows an even number".',
		status: 'published',
		prerequisites: [],
		leadsTo: ['probability/probability-axioms'],
	},
	{
		id: 'probability/probability-axioms',
		title: 'Probability axioms',
		description: 'The three rules every probability must obey, and what follows from them.',
		recap: 'Probabilities are never negative, the whole sample space has probability 1, and the probabilities of events that cannot happen together add up.',
		status: 'published',
		prerequisites: ['probability/sample-spaces-and-events'],
		leadsTo: ['probability/random-variables-and-distributions', 'probability/conditional-probability'],
	},
	{
		id: 'probability/conditional-probability',
		title: 'Conditional probability',
		description: 'How the probability of an event changes once you learn that another event happened.',
		recap: 'The conditional probability P(A | B) is the probability of A once you know B happened. It equals P(A ∩ B) / P(B), so it only exists when P(B) is above 0.',
		status: 'published',
		prerequisites: ['probability/probability-axioms'],
		leadsTo: ['probability/bayes-theorem'],
	},
	{
		id: 'probability/bayes-theorem',
		title: 'Bayes\' theorem',
		description: 'Turning "how likely is the evidence if the hypothesis is true" into "how likely is the hypothesis given the evidence".',
		recap: 'Bayes\' theorem reverses a conditional probability: P(A | B) = P(B | A) P(A) / P(B). The two directions are different numbers, and P(B) is found by adding over every way B can happen.',
		status: 'published',
		prerequisites: ['probability/conditional-probability'],
		leadsTo: [],
	},
	{
		id: 'probability/random-variables-and-distributions',
		title: 'Random variables and distributions',
		description: 'Numbers that come out of chance, and the rules that say how likely each value is.',
		recap: 'A random variable is a number decided by chance, such as a height or a dice roll. Its distribution says how likely each value, or range of values, is.',
		status: 'planned',
		prerequisites: ['probability/probability-axioms'],
		leadsTo: ['statistics/normal-distribution'],
	},
	{
		id: 'probability/expectation-and-variance',
		title: 'Expected value and variance',
		description: 'The long-run average of a random variable, and how far its values spread around it.',
		recap: 'The expected value is the long-run average of a random variable: multiply each value by its probability and add. For a list of numbers, it is the familiar mean.',
		status: 'planned',
		prerequisites: [],
		leadsTo: ['statistics/normal-distribution', 'statistics/variance-and-standard-deviation'],
	},
	{
		id: 'statistics/variance-and-standard-deviation',
		title: 'Variance and standard deviation',
		description: 'Measuring spread, and why there are two versions.',
		recap: 'Variance is the average squared distance from the mean. The standard deviation is its square root, so it is in the data\'s own units.',
		status: 'planned',
		prerequisites: ['probability/expectation-and-variance'],
		leadsTo: ['statistics/normal-distribution'],
	},
	{
		id: 'statistics/normal-distribution',
		title: 'Normal distribution',
		description: 'The bell curve, its two parameters, and why it shows up throughout machine learning.',
		recap: 'The normal (Gaussian) distribution is the symmetric bell curve set by its mean μ and standard deviation σ. About 68% of values lie within one σ of the mean.',
		status: 'published',
		prerequisites: ['probability/random-variables-and-distributions', 'probability/expectation-and-variance', 'statistics/variance-and-standard-deviation'],
		leadsTo: ['probability/central-limit-theorem', 'statistics/hypothesis-testing', 'probability/multivariate-normal-distribution'],
	},
	{
		id: 'probability/central-limit-theorem',
		title: 'Central limit theorem',
		description: 'Why averages of almost anything end up bell-shaped.',
		recap: 'Averages of many independent draws with finite variance are approximately normal, whatever the original distribution looks like.',
		status: 'planned',
		prerequisites: ['statistics/normal-distribution'],
		leadsTo: [],
	},
	{
		id: 'statistics/hypothesis-testing',
		title: 'Hypothesis testing',
		description: 'Using the normal distribution to decide what is surprising.',
		recap: 'A hypothesis test asks how likely data this extreme would be if nothing interesting were going on.',
		status: 'planned',
		prerequisites: ['statistics/normal-distribution'],
		leadsTo: [],
	},
	{
		id: 'probability/multivariate-normal-distribution',
		title: 'Multivariate normal distribution',
		description: 'The bell curve in several dimensions, and the covariance matrix that shapes it.',
		recap: 'The multivariate normal extends the bell curve to vectors; a covariance matrix replaces σ² and sets the shape and tilt of the bell.',
		status: 'planned',
		prerequisites: ['statistics/normal-distribution'],
		leadsTo: [],
	},
];

const BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));

/** @param {string} id */
export function getTopic(id) {
	const topic = BY_ID.get(id);
	if (!topic) throw new Error(`Unknown topic id "${id}". Add it to src/data/topics.mjs.`);
	return topic;
}

/** Root-relative URL for a published topic, or null while it is planned. */
export function topicHref(topic) {
	return topic.status === 'published' ? `/${topic.id}/` : null;
}
