// Expressive Code configuration. Kept in its own file (not astro.config.mjs) because themes and
// plugins aren't serialisable, and Starlight's <Code> component needs them too.
// Rules: docs/design-system/math-plots-code.md
import { defineEcConfig } from '@astrojs/starlight/expressive-code';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { codeThemes } from './src/design/code-themes.mjs';
import { palette } from './src/design/palette.mjs';
import { pluginMeaningMarkers } from './src/design/ec-meaning-markers.mjs';

export default defineEcConfig({
	themes: [codeThemes.dark, codeThemes.light],
	useStarlightDarkModeSwitch: true,
	// Use each theme's own background, which is what every contrast figure was measured against.
	useStarlightUiThemeColors: false,
	// Every token colour is at least 5.5:1, so this never alters a colour; `npm run check:design` keeps it that way.
	minSyntaxHighlightingColorContrast: 5.5,
	plugins: [pluginLineNumbers(), pluginCollapsibleSections(), pluginMeaningMarkers()],
	// Code wraps instead of scrolling sideways; wrapped lines keep their indentation.
	defaultProps: { wrap: true, preserveIndent: true },
	styleOverrides: {
		borderRadius: '4px',
		borderColor: 'var(--ms-rule)',
		codeFontFamily: 'var(--ms-font-mono)',
		codeFontSize: '0.9375rem',
		codeLineHeight: '1.6',
		uiFontFamily: 'var(--ms-font-ui)',
		// No vertical rule between line numbers and code (decision 0006)
		gutterBorderWidth: '0px',
		frames: {
			shadowColor: 'transparent',
			frameBoxShadowCssValue: 'none',
			terminalTitlebarDotsOpacity: '0',
		},
		// Highlighted lines use "look here", never the default blue (blue belongs to sigma).
		// Light mode marks them with a band only. Dark mode keeps a yellow edge because any
		// visible band pushes dark token colours under 5.5:1: the one functional vertical mark (decision 0006).
		textMarkers: {
			markBackground: ({ theme }) => palette[theme.type].codeMarkBg,
			markBorderColor: ({ theme }) => (theme.type === 'light' ? 'transparent' : palette.dark.codeMarkEdge),
		},
	},
});
