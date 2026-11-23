// Generates every raster brand image from src/design/palette.mjs, so they always match the SVG favicon
// and logos written by scripts/build-tokens.mjs:
//   public/og/default.png          1200x630 social card (Open Graph / Twitter), used by every page
//   public/logo-512.png            square logo for structured data (Google needs a raster logo of at least 112px)
//   public/apple-touch-icon.png    180x180 home-screen icon for iOS
//   public/icon-192.png            192x192 web app icon (site.webmanifest)
//   public/icon-512.png            512x512 web app icon (site.webmanifest)
// Usage: npm run brand-images   (rerun after changing the palette or the bell mark)
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { palette } from '../src/design/palette.mjs';

const fromRoot = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

const CARD = { width: 1200, height: 630 };
const LOGO_SIZE = 512;
const APP_ICONS = [
	{ path: 'public/apple-touch-icon.png', size: 180 },
	{ path: 'public/icon-192.png', size: 192 },
	{ path: 'public/icon-512.png', size: 512 },
];
/** App icons get padding so the mark survives the rounded masks phones apply. */
const APP_ICON_PADDING = 0.18;
// Same smooth bell as the favicon (scripts/build-tokens.mjs), drawn in a 32x32 box.
const BELL_PATH = 'M2 24 C6 24, 8 23, 10 20 C12 17, 13.5 4, 16 4 C18.5 4, 20 17, 22 20 C24 23, 26 24, 30 24';
// Raster rendering uses system fonts, so the card names a common serif rather than Literata.
const SERIF = "Georgia, 'Times New Roman', serif";

function socialCardSvg() {
	const { page, ink, inkMuted, mu, board, boardEdge } = palette.light;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}" viewBox="0 0 ${CARD.width} ${CARD.height}">
<rect width="100%" height="100%" fill="${page}"/>
<rect x="720" y="90" width="400" height="450" rx="8" fill="${board}" stroke="${boardEdge}" stroke-width="3"/>
<g transform="translate(744 170) scale(11)">
	<path d="${BELL_PATH}" fill="none" stroke="${mu}" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"/>
	<line x1="1" y1="24" x2="31" y2="24" stroke="${boardEdge}" stroke-width="0.2"/>
	<circle cx="16" cy="24" r="0.9" fill="${mu}"/>
</g>
<text x="80" y="270" font-family="${SERIF}" font-size="84" font-weight="600" fill="${ink}">MathSignal</text>
<text x="80" y="345" font-family="${SERIF}" font-size="36" fill="${inkMuted}">The math behind machine learning,</text>
<text x="80" y="395" font-family="${SERIF}" font-size="36" fill="${inkMuted}">from intuition to research.</text>
</svg>`;
}

/** The bell mark on a solid page-colored square. `padding` is a fraction of the size on each side. */
function squareMarkSvg(size, padding = 0) {
	const { page, ink, mu } = palette.light;
	const inner = 32 / (1 - 2 * padding);
	const offset = (inner - 32) / 2;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-offset} ${-offset} ${inner} ${inner}">
<rect x="${-offset}" y="${-offset}" width="${inner}" height="${inner}" fill="${page}"/>
<path d="${BELL_PATH}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="16" cy="28" r="2.25" fill="${mu}"/>
</svg>`;
}

async function writePng(relativePath, svg) {
	const outputPath = fromRoot(relativePath);
	await mkdir(dirname(outputPath), { recursive: true });
	await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outputPath);
	console.log(`Wrote ${relativePath}`);
}

async function main() {
	await writePng('public/og/default.png', socialCardSvg());
	await writePng('public/logo-512.png', squareMarkSvg(LOGO_SIZE));
	for (const icon of APP_ICONS) {
		await writePng(icon.path, squareMarkSvg(icon.size, APP_ICON_PADDING));
	}
}

main().catch((error) => {
	console.error('Failed to build brand images:', error);
	process.exit(1);
});
