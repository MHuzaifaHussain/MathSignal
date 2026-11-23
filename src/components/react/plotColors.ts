// Colours for Mafs plots, as CSS variables so they follow the theme.
// Meaning colours (mu, sigma, attention) are reserved: docs/design-system/math-plots-code.md
export const plotColors = {
	/** Anything that is the mean: the curve driven by it, its handle, its guide line. */
	mu: 'var(--ms-mu)',
	/** Anything that is the spread: its handle and span. */
	sigma: 'var(--ms-sigma)',
	/** Draggable handles that aren't μ or σ, and highlighted regions. */
	attention: 'var(--ms-attention)',
	/** Neutral strokes, fills and labels on the board. */
	ink: 'var(--ms-board-ink)',
	inkMuted: 'var(--ms-board-ink-muted)',
	/** Secondary guides. */
	axis: 'var(--ms-board-axis)',
} as const;

/** Real minus sign and fixed decimals, for readouts that don't jump while dragging. */
export function formatNumber(value: number, decimals = 2): string {
	const fixed = Math.abs(value).toFixed(decimals);
	return value < 0 && Number(fixed) !== 0 ? `−${fixed}` : fixed;
}
