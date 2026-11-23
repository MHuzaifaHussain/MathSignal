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
