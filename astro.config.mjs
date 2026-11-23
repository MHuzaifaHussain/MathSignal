// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { katexOptions } from './src/design/katex.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://mathsignal.dev',
	markdown: {
		// Astro 7 defaults to the Sätteri processor, which renders $$ display maths as a code block.
		// The unified pipeline keeps remark-math + rehype-katex working.
		processor: unified({
			remarkPlugins: [remarkMath],
			rehypePlugins: [[rehypeKatex, katexOptions]],
		}),
	},
	integrations: [
		starlight({
			title: 'MathSignal',
			logo: {
				src: './src/assets/logo.svg',
				alt: 'MathSignal',
			},
			description:
				'Interactive statistics, probability, and mathematics for AI/ML practitioners',
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
					href: 'https://github.com/mhuzaifahussain/mathsignal',
				},
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [{ label: 'Introduction', slug: '' }],
				},
				{
					label: 'Statistics',
					items: [{ autogenerate: { directory: 'statistics' } }],
				},
				{
					label: 'Probability',
					items: [{ autogenerate: { directory: 'probability' } }],
				},
				{
					label: 'Linear Algebra',
					items: [{ autogenerate: { directory: 'linear-algebra' } }],
				},
				{
					label: 'Machine Learning',
					items: [{ autogenerate: { directory: 'ml' } }],
				},
			],
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
		plugins: [tailwindcss()],
		ssr: {
			noExternal: ['katex'],
		},
	},
});
