// JSON-LD builders. Structured data is for entity clarity, not tricks: only fields that are true
// and present on the page, and no FAQ markup (docs/seo/README.md).
import { LOGO_URL, REPOSITORY_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site.mjs';

type JsonLd = Record<string, unknown>;

const WEBSITE_ID = `${SITE_URL}/#website`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function homeGraph(): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebSite',
				'@id': WEBSITE_ID,
				name: SITE_NAME,
				url: `${SITE_URL}/`,
				description: SITE_DESCRIPTION,
				inLanguage: 'en',
				publisher: { '@id': ORGANIZATION_ID },
			},
			{
				'@type': 'Organization',
				'@id': ORGANIZATION_ID,
				name: SITE_NAME,
				url: `${SITE_URL}/`,
				logo: LOGO_URL,
				sameAs: [REPOSITORY_URL],
			},
		],
	};
}

interface ArticleInput {
	title: string;
	description: string;
	/** Path with leading and trailing slash, e.g. /statistics/normal-distribution/ */
	path: string;
	subjectLabel: string;
}

export function conceptPageGraph({ title, description, path, subjectLabel }: ArticleInput): JsonLd {
	const url = `${SITE_URL}${path}`;
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
					{ '@type': 'ListItem', position: 2, name: title, item: url },
				],
			},
			{
				'@type': ['TechArticle', 'LearningResource'],
				headline: title,
				description,
				url,
				inLanguage: 'en',
				about: { '@type': 'Thing', name: title },
				educationalUse: 'self-study',
				keywords: [subjectLabel, 'machine learning'],
				isPartOf: { '@id': WEBSITE_ID },
				publisher: { '@id': ORGANIZATION_ID },
			},
		],
	};
}

/** Serialise for a <script type="application/ld+json">, escaping "<" so content can't close the tag. */
export function serialiseJsonLd(data: JsonLd): string {
	return JSON.stringify(data).replace(/</g, '\\u003c');
}
