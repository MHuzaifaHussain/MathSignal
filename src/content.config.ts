import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

/**
 * Concept-page frontmatter (decisions 0008 and 0009). Optional here because the home and About pages
 * don't use it; `npm run check:content` requires every field on pages inside a subject folder.
 */
const conceptPageFields = z.object({
	/** Id in src/data/topics.mjs, e.g. "statistics/normal-distribution". */
	topic: z.string().optional(),
	/** Article type from the 12-week plan: A new board, B reused board, C worked example, D comparison, E ML deep dive, F hub. */
	type: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).optional(),
	objectives: z.array(z.string()).min(3).max(5).optional(),
	takeaways: z.array(z.string()).min(3).max(5).optional(),
	/** Ids in src/data/references.mjs. */
	references: z.array(z.string()).optional(),
	author: z.string().optional(),
	/** The date the page was last checked end to end; drives "Last reviewed" in the footer. */
	reviewedAt: z.coerce.date().optional(),
	aiAssisted: z.boolean().optional(),
	/** The one search query this page answers (docs/seo/README.md). */
	primaryQuery: z.string().optional(),
	// Follows the page type (content plan): A and B learn, C solve, D compare, E apply, F reference.
	searchIntent: z.enum(['learn', 'solve', 'compare', 'apply', 'reference']).optional(),
	/** "spine" pages are publishable; "complete" pages have every layer, including the research frontier and checks. */
	depthStatus: z.enum(['spine', 'complete']).optional(),
});

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: conceptPageFields }) }),
};
