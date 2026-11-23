// /llms.txt: a plain-text map of the site for AI assistants and answer engines (llmstxt.org format).
// Generated from the same content collection as the pages, so it never drifts from what is published.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { DOMAINS } from '../design/domains.mjs';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../seo/site.mjs';

export const GET: APIRoute = async () => {
	// Drafts are left out of production builds by Starlight, so listing them here would link to missing pages.
	const pages = await getCollection('docs', (page) => !page.data.draft);
	const sections = DOMAINS.map((domain) => {
		const entries = pages
			.filter((page) => page.id.startsWith(`${domain.directory}/`))
			.sort((a, b) => (a.data.sidebar?.order ?? 0) - (b.data.sidebar?.order ?? 0) || a.data.title.localeCompare(b.data.title))
			.map((page) => `- [${page.data.title}](${SITE_URL}/${page.id}/): ${page.data.description ?? ''}`.trimEnd());
		return entries.length > 0 ? `## ${domain.label}\n\n${entries.join('\n')}` : '';
	}).filter(Boolean);

	const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Each page builds from an everyday explanation to exact definitions, worked examples, machine learning applications, runnable Python and cited references.

${sections.join('\n\n')}
`;
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
