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
		leadsTo: ['probability/bayes-theorem', 'probability/independence', 'probability/law-of-total-probability'],
	},
	{
		id: 'probability/bayes-theorem',
		title: 'Bayes\' theorem',
		description: 'Turning "how likely is the evidence if the hypothesis is true" into "how likely is the hypothesis given the evidence".',
		recap: 'Bayes\' theorem reverses a conditional probability: P(A | B) = P(B | A) P(A) / P(B). The two directions are different numbers, and P(B) is found by adding over every way B can happen.',
		status: 'published',
		prerequisites: ['probability/conditional-probability'],
		leadsTo: [
			'probability/law-of-total-probability',
			'probability/base-rate-fallacy-medical-test',
			'probability/conditional-independence',
			'probability/naive-bayes-classifier',
			'probability/monty-hall-problem',
			'probability/probability-rules-cheat-sheet',
		],
	},
	{
		id: 'probability/independence',
		title: 'Independent events',
		description: 'When knowing that one event happened leaves the chance of another unchanged, and how to check it.',
		recap: 'Events A and B are independent when knowing that one happened leaves the other\'s probability unchanged, which is the same as P(A ∩ B) = P(A) P(B). Disjoint events with positive probabilities are never independent.',
		status: 'planned',
		prerequisites: ['probability/conditional-probability'],
		leadsTo: ['probability/independence-vs-mutual-exclusivity', 'probability/conditional-independence', 'probability/probability-rules-cheat-sheet'],
	},
	{
		id: 'probability/independence-vs-mutual-exclusivity',
		title: 'Independent vs mutually exclusive events',
		description: 'Why events that cannot happen together are far from independent, and how to tell the two ideas apart.',
		recap: 'Mutually exclusive events share no outcomes, so if one happens the other can\'t, which is a strong form of dependence. Independent events can overlap, and knowing one happened leaves the other\'s probability unchanged. Both can hold only when one event has probability 0.',
		status: 'planned',
		prerequisites: ['probability/independence'],
		leadsTo: ['probability/probability-rules-cheat-sheet'],
	},
	{
		id: 'probability/law-of-total-probability',
		title: 'Law of total probability',
		description: 'Finding the chance of an event by splitting the world into cases and adding up what each case contributes.',
		recap: 'The law of total probability finds P(B) by splitting the world into cases that share no outcome and cover everything, then adding P(B | case) × P(case) over the cases. So P(B) is a weighted average of the chances within each case.',
		status: 'planned',
		prerequisites: ['probability/conditional-probability', 'probability/bayes-theorem'],
		leadsTo: [],
	},
	{
		id: 'probability/base-rate-fallacy-medical-test',
		title: 'The base rate fallacy in medical tests',
		description: 'Why a positive result from an accurate test can still mean the condition is unlikely, counted out step by step.',
		recap: 'The base rate fallacy is reading a positive test by the test\'s accuracy alone. What a positive means also depends on how common the condition is, so a good test for a rare condition can still give mostly false positives.',
		status: 'planned',
		prerequisites: ['probability/bayes-theorem'],
		leadsTo: [],
	},
	{
		id: 'probability/conditional-independence',
		title: 'Conditional independence',
		description: 'Events that move together until you learn a third fact, and how to test independence within each case.',
		recap: 'A and B are conditionally independent given C when, once you know C happened, learning B doesn\'t change the probability of A: P(A ∩ B | C) = P(A | C) P(B | C). This can hold even when A and B are dependent overall, and the reverse can happen too.',
		status: 'planned',
		prerequisites: ['probability/independence', 'probability/bayes-theorem'],
		leadsTo: ['probability/naive-bayes-classifier'],
	},
	{
		id: 'probability/naive-bayes-classifier',
		title: 'Naive Bayes classifier',
		description: 'A classifier built from Bayes\' theorem and one simplifying assumption, trained by counting.',
		recap: 'A naive Bayes classifier picks the class y that makes P(y) times the product of P(x_k | y) largest: Bayes\' theorem plus the assumption that the features are independent once the class is known.',
		status: 'planned',
		prerequisites: ['probability/bayes-theorem', 'probability/conditional-independence'],
		leadsTo: [],
	},
	{
		id: 'probability/monty-hall-problem',
		title: 'The Monty Hall problem',
		description: 'Why switching doors wins two games in three, and how the host\'s rule decides the answer.',
		recap: 'In the Monty Hall problem, a host who knows where the car is opens a door with a goat behind it. If he picks at random when he has a choice, switching wins 2 times in 3, because which door he opens depends on where the car is.',
		status: 'planned',
		prerequisites: ['probability/bayes-theorem'],
		leadsTo: [],
	},
	{
		id: 'probability/probability-rules-cheat-sheet',
		title: 'Probability rules cheat sheet',
		description: 'Every basic probability rule on one page, with the condition it needs and a worked example.',
		recap: 'The probability rules cheat sheet puts the complement, addition, conditional, product, chain, total-probability, Bayes and independence rules on one page, each with the condition it needs and one marble-bag example.',
		status: 'planned',
		prerequisites: ['probability/bayes-theorem', 'probability/independence', 'probability/independence-vs-mutual-exclusivity'],
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
	{
		id: 'linear-algebra/vectors',
		title: 'Vectors',
		description: 'Arrows, lists of numbers and data points: three views of one object, and how to add and scale it.',
		recap: 'A vector is an ordered list of numbers, such as (3, 2), drawn as an arrow from the origin. Vectors add entry by entry (tip to tail), and multiplying by a number stretches, shrinks or flips them.',
		status: 'planned',
		prerequisites: [],
		leadsTo: ['linear-algebra/dot-product'],
	},
	{
		id: 'linear-algebra/dot-product',
		title: 'Dot product',
		description: 'Multiplying two vectors into one number that says how much they point the same way.',
		recap: 'The dot product a · b multiplies matching entries and adds them, so (3, 2) · (1, 3) = 9. It is positive when the arrows point roughly the same way, zero when they are perpendicular and negative when they point apart.',
		status: 'planned',
		prerequisites: ['linear-algebra/vectors'],
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
