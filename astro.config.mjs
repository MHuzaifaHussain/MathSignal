// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
	site: 'https://mathsignal.dev',
	markdown: {
		remarkPlugins: [remarkMath],
		rehypePlugins: [rehypeKatex],
	},
	integrations: [
		starlight({
			title: 'MathSignal',
			description:
				'Interactive statistics, probability, and mathematics for AI/ML practitioners',
			expressiveCode: {
				themes: ['dracula', 'github-light'],
				useStarlightDarkModeSwitch: true,
				useStarlightUiThemeColors: true,
				styleOverrides: {
					borderRadius: '0.5rem',
					codeFontSize: '0.875rem',
				},
			},
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
					autogenerate: { directory: 'statistics' },
				},
				{
					label: 'Probability',
					autogenerate: { directory: 'probability' },
				},
				{
					label: 'Linear Algebra',
					autogenerate: { directory: 'linear-algebra' },
				},
				{
					label: 'Machine Learning',
					autogenerate: { directory: 'ml' },
				},
			],
			customCss: ['katex/dist/katex.min.css', './src/styles/global.css'],
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
