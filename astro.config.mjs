// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { katexOptions, rehypeKatexFailOnError } from './src/design/katex.mjs';
import { DOMAINS } from './src/design/domains.mjs';
import { REPOSITORY_URL, SITE_DESCRIPTION, SITE_URL, SOCIAL_CARD } from './src/seo/site.mjs';
import { palette } from './src/design/palette.mjs';

// https://astro.build/config
export default defineConfig({
	site: SITE_URL,
	// One canonical form for every URL; content links already end in a slash.
	trailingSlash: 'always',
	markdown: {
		// Astro 7 defaults to the Sätteri processor, which renders $$ display maths as a code block.
		// The unified pipeline keeps remark-math + rehype-katex working.
		processor: unified({
			remarkPlugins: [remarkMath],
			rehypePlugins: [[rehypeKatex, katexOptions], rehypeKatexFailOnError],
		}),
	},
	integrations: [
		starlight({
			title: 'MathSignal',
			// Social card for every page (Open Graph and Twitter). Pages may override with frontmatter `head`.
			head: [
				{ tag: 'meta', attrs: { property: 'og:image', content: SOCIAL_CARD.url } },
				{ tag: 'meta', attrs: { property: 'og:image:width', content: String(SOCIAL_CARD.width) } },
				{ tag: 'meta', attrs: { property: 'og:image:height', content: String(SOCIAL_CARD.height) } },
				{ tag: 'meta', attrs: { property: 'og:image:alt', content: SOCIAL_CARD.alt } },
				{ tag: 'meta', attrs: { name: 'twitter:image', content: SOCIAL_CARD.url } },
				{ tag: 'meta', attrs: { name: 'twitter:image:alt', content: SOCIAL_CARD.alt } },
				// App icons and browser UI colour, generated from the palette (scripts/build-brand-images.mjs, build-tokens.mjs)
				{ tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
				{ tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' } },
				{ tag: 'meta', attrs: { name: 'theme-color', content: palette.light.ledge, media: '(prefers-color-scheme: light)' } },
				{ tag: 'meta', attrs: { name: 'theme-color', content: palette.dark.ledge, media: '(prefers-color-scheme: dark)' } },
			],
			// Generated from the palette by scripts/build-tokens.mjs. Starlight inserts the logo as an <img>,
			// so it can't inherit currentColor: one file per theme.
			logo: {
				light: './src/assets/logo-light.svg',
				dark: './src/assets/logo-dark.svg',
				alt: 'MathSignal',
			},
			description: SITE_DESCRIPTION,
			// Keep overrides few: each must be rechecked on every Starlight upgrade.
			components: {
				Header: './src/components/overrides/Header.astro',
				Sidebar: './src/components/overrides/Sidebar.astro',
			},
			// Expressive Code is configured in ec.config.mjs.
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: REPOSITORY_URL,
				},
			],
			// Subjects come from src/design/domains.mjs so the header strip and sidebar never drift apart.
			sidebar: [
				{ label: 'Getting started', items: [{ label: 'Introduction', slug: '' }] },
				...DOMAINS.map((domain) => ({ label: domain.label, items: [{ autogenerate: { directory: domain.directory } }] })),
			],
			// Narrows the sidebar to the active subject: src/routeData.ts
			routeMiddleware: './src/routeData.ts',
			customCss: [
				// Fonts: @font-face rules only download a file when text actually uses it,
				// so Kalam is fetched only on pages with a board note.
				'@fontsource-variable/literata/index.css',
				'@fontsource-variable/literata/wght-italic.css',
				'@fontsource-variable/atkinson-hyperlegible-next/index.css',
				'@fontsource-variable/atkinson-hyperlegible-mono/index.css',
				'@fontsource/kalam/latin-400.css',
				'@fontsource/kalam/latin-700.css',
				'katex/dist/katex.min.css',
				'mafs/core.css',
				'./src/styles/global.css',
			],
		}),
		react(),
	],
	vite: {
		ssr: {
			noExternal: ['katex'],
		},
	},
});
