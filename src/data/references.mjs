// Every source MathSignal cites (decision 0009). Add a source only after opening it; `checked` is that date.
// Pages list ids in frontmatter `references`; <Cite id> links to the entry; <References /> renders the list.
// Years are the first public version (arXiv v1 for preprints). Venues are recorded only when the source states them.

/** @typedef {{ id: string, authors: string[], year: number, title: string, venue?: string, url: string, note?: string, checked: string }} Reference */

/** @type {Reference[]} */
export const REFERENCES = [
	{
		id: 'he2015',
		authors: ['Kaiming He', 'Xiangyu Zhang', 'Shaoqing Ren', 'Jian Sun'],
		year: 2015,
		title: 'Delving deep into rectifiers: surpassing human-level performance on ImageNet classification',
		url: 'https://arxiv.org/abs/1502.01852',
		note: 'The source of He initialization.',
		checked: '2026-11-23',
	},
	{
		id: 'glorot2010',
		authors: ['Xavier Glorot', 'Yoshua Bengio'],
		year: 2010,
		title: 'Understanding the difficulty of training deep feedforward neural networks',
		venue: 'AISTATS, PMLR 9:249–256',
		url: 'https://proceedings.mlr.press/v9/glorot10a.html',
		note: 'The source of Xavier (Glorot) initialization.',
		checked: '2026-11-23',
	},
	{
		id: 'ioffe2015',
		authors: ['Sergey Ioffe', 'Christian Szegedy'],
		year: 2015,
		title: 'Batch normalization: accelerating deep network training by reducing internal covariate shift',
		url: 'https://arxiv.org/abs/1502.03167',
		checked: '2026-11-23',
	},
	{
		id: 'kingma2013',
		authors: ['Diederik P. Kingma', 'Max Welling'],
		year: 2013,
		title: 'Auto-encoding variational Bayes',
		url: 'https://arxiv.org/abs/1312.6114',
		note: 'Introduces the reparameterization trick.',
		checked: '2026-11-23',
	},
	{
		id: 'ho2020',
		authors: ['Jonathan Ho', 'Ajay Jain', 'Pieter Abbeel'],
		year: 2020,
		title: 'Denoising diffusion probabilistic models',
		url: 'https://arxiv.org/abs/2006.11239',
		checked: '2026-11-23',
	},
	{
		id: 'song2020',
		authors: ['Yang Song', 'Jascha Sohl-Dickstein', 'Diederik P. Kingma', 'Abhishek Kumar', 'Stefano Ermon', 'Ben Poole'],
		year: 2020,
		title: 'Score-based generative modeling through stochastic differential equations',
		venue: 'ICLR 2021',
		url: 'https://arxiv.org/abs/2011.13456',
		checked: '2026-11-23',
	},
	{
		id: 'lee2017',
		authors: ['Jaehoon Lee', 'Yasaman Bahri', 'Roman Novak', 'Samuel S. Schoenholz', 'Jeffrey Pennington', 'Jascha Sohl-Dickstein'],
		year: 2017,
		title: 'Deep neural networks as Gaussian processes',
		venue: 'ICLR 2018',
		url: 'https://arxiv.org/abs/1711.00165',
		checked: '2026-11-23',
	},
	{
		id: 'jacot2018',
		authors: ['Arthur Jacot', 'Franck Gabriel', 'Clément Hongler'],
		year: 2018,
		title: 'Neural tangent kernel: convergence and generalization in neural networks',
		venue: 'NeurIPS 2018',
		url: 'https://arxiv.org/abs/1806.07572',
		checked: '2026-11-23',
	},
	{
		id: 'simsekli2019',
		authors: ['Umut Şimşekli', 'Levent Sagun', 'Mert Gürbüzbalaban'],
		year: 2019,
		title: 'A tail-index analysis of stochastic gradient noise in deep neural networks',
		url: 'https://arxiv.org/abs/1901.06053',
		checked: '2026-11-23',
	},
	{
		id: 'rasmussen2006',
		authors: ['Carl Edward Rasmussen', 'Christopher K. I. Williams'],
		year: 2006,
		title: 'Gaussian processes for machine learning',
		venue: 'MIT Press',
		url: 'https://gaussianprocess.org/gpml/',
		note: 'Chapter 2.',
		checked: '2026-11-23',
	},
	{
		id: 'deisenroth2020',
		authors: ['Marc Peter Deisenroth', 'A. Aldo Faisal', 'Cheng Soon Ong'],
		year: 2020,
		title: 'Mathematics for machine learning',
		venue: 'Cambridge University Press',
		url: 'https://mml-book.github.io/',
		note: 'Section 6.5, the Gaussian distribution.',
		checked: '2026-11-23',
	},
	{
		id: 'kolmogorov1950',
		authors: ['A. N. Kolmogorov'],
		year: 1950,
		title: 'Foundations of the theory of probability',
		venue: 'Chelsea Publishing Company',
		url: 'https://archive.org/details/foundationsofthe00kolm',
		note: 'English translation edited by Nathan Morrison. Chapter I, §1: Axioms I–V; Chapter I, §4: conditional probability, the multiplication theorem, the theorem on total probability and the theorem of Bayes; Chapter II, §1: Axiom VI (continuity) and its equivalence, given Axioms I–V, to countable (complete) additivity; Chapter V, §§1–3: conditional probability with respect to a partition or a random variable, unique only to within equivalence, the Borel paradox, and conditioning on a random variable.',
		checked: '2026-11-24',
	},
	{
		id: 'grinstead2003',
		authors: ['Charles M. Grinstead', 'J. Laurie Snell'],
		year: 2003,
		title: 'Introduction to probability',
		venue: 'American Mathematical Society, 2nd edition',
		url: 'https://math.dartmouth.edu/~prob/prob/prob.pdf',
		note: 'Section 1.2: sample spaces, outcomes, events, set operations and the basic rules of probability. Section 4.1, pp. 134–146: conditional probability, the reverse tree (p. 136) and Bayes\' formula with the total-probability sum, equation (4.3). Free version from the Dartmouth Chance Project.',
		checked: '2026-11-24',
	},
	{
		id: 'tao2011',
		authors: ['Terence Tao'],
		year: 2011,
		title: 'An introduction to measure theory',
		venue: 'American Mathematical Society',
		url: 'https://terrytao.wordpress.com/books/an-introduction-to-measure-theory/',
		note: 'Section 1.2.3: a subset of [0, 1] that is not Lebesgue measurable, built with the axiom of choice.',
		checked: '2026-11-24',
	},
	{
		id: 'goodfellow2016',
		authors: ['Ian Goodfellow', 'Yoshua Bengio', 'Aaron Courville'],
		year: 2016,
		title: 'Deep learning',
		venue: 'MIT Press',
		url: 'https://www.deeplearningbook.org/contents/mlp.html',
		note: 'Section 6.2.1.1: learning conditional distributions with maximum likelihood. Sections 6.2.2.2 and 6.2.2.3: sigmoid output units for a binary variable and softmax output units for a distribution over n classes.',
		checked: '2026-11-24',
	},
	{
		id: 'szegedy2015',
		authors: ['Christian Szegedy', 'Vincent Vanhoucke', 'Sergey Ioffe', 'Jonathon Shlens', 'Zbigniew Wojna'],
		year: 2015,
		title: 'Rethinking the Inception architecture for computer vision',
		venue: 'IEEE Conference on Computer Vision and Pattern Recognition (CVPR 2016)',
		url: 'https://arxiv.org/abs/1512.00567',
		note: 'Section 7: label smoothing.',
		checked: '2026-11-24',
	},
	{
		id: 'cao2021',
		authors: ['Kris Cao', 'Laura Rimell'],
		year: 2021,
		title: 'You should evaluate your language model on marginal likelihood over tokenisations',
		venue: 'EMNLP 2021',
		url: 'https://arxiv.org/abs/2109.02550',
		note: 'Section 2: a string has many tokenizations, and its probability is the sum over all of them; models are usually scored on one canonical tokenization.',
		checked: '2026-11-24',
	},
	{
		id: 'du2022',
		authors: ['Li Du', 'Lucas Torroba Hennigen', 'Tiago Pimentel', 'Clara Meister', 'Jason Eisner', 'Ryan Cotterell'],
		year: 2022,
		title: 'A measure-theoretic characterization of tight language models',
		venue: 'ACL 2023',
		url: 'https://arxiv.org/abs/2212.10502',
		note: 'Sections 2–5: probability mass can leak onto the uncountable set of infinite sequences; a σ-algebra and countable additivity make tightness precise. Transformer language models are always tight; some n-gram and RNN models are not.',
		checked: '2026-11-24',
	},
	{
		id: 'blundell2015',
		authors: ['Charles Blundell', 'Julien Cornebise', 'Koray Kavukcuoglu', 'Daan Wierstra'],
		year: 2015,
		title: 'Weight uncertainty in neural networks',
		venue: 'ICML 2015',
		url: 'https://arxiv.org/abs/1505.05424',
		note: 'Section 1: plain networks often make overly confident decisions, and exact Bayesian inference on their weights is intractable, so the paper uses a variational approximation (Bayes by Backprop). Section 3 and equation (1): the variational free energy and the intractable predictive average. Section 3.3: choosing the prior by empirical Bayes.',
		checked: '2026-11-24',
	},
	{
		id: 'saerens2002',
		authors: ['Marco Saerens', 'Patrice Latinne', 'Christine Decaestecker'],
		year: 2002,
		title: 'Adjusting the outputs of a classifier to new a priori probabilities: a simple procedure',
		venue: 'Neural Computation 14(1):21–41',
		url: 'https://doi.org/10.1162/089976602753284446',
		note: 'Section 2.2: reweighting a classifier\'s outputs by the ratio of new to training class priors when the new priors are known. Section 2.3: estimating unknown new priors with the EM algorithm.',
		checked: '2026-11-24',
	},
];

const BY_ID = new Map(REFERENCES.map((reference) => [reference.id, reference]));

/** @param {string} id */
export function getReference(id) {
	const reference = BY_ID.get(id);
	if (!reference) throw new Error(`Unknown reference id "${id}". Add it to src/data/references.mjs after opening the source.`);
	return reference;
}

/** "He et al. 2015", "Glorot and Bengio 2010" */
export function shortCitation(reference) {
	const surname = (name) => name.split(' ').at(-1);
	const [first, second] = reference.authors;
	const names = reference.authors.length === 1 ? surname(first) : reference.authors.length === 2 ? `${surname(first)} and ${surname(second)}` : `${surname(first)} et al.`;
	return `${names} ${reference.year}`;
}
