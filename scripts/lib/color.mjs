// Colour maths for the design checks: WCAG 2 contrast, CIEDE2000 and colour-blindness simulation.
// Colour-blindness uses Machado, Oliveira & Fernandes (2009) matrices at severity 1.0, applied in linear RGB.

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

/** @param {string} hex */
export function parseHex(hex) {
	if (!HEX_PATTERN.test(hex)) {
		throw new Error(`Expected a 6-digit hex colour like #1e2725, got "${hex}"`);
	}
	return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** @param {number[]} rgb sRGB channels 0..1 */
function relativeLuminance(rgb) {
	const [r, g, b] = rgb.map(toLinear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two hex colours. */
export function contrastRatio(foregroundHex, backgroundHex) {
	const a = relativeLuminance(parseHex(foregroundHex));
	const b = relativeLuminance(parseHex(backgroundHex));
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const MACHADO = {
	deuteranopia: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881],
	],
	protanopia: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	tritanopia: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039],
	],
};

export const COLOUR_VISION_TYPES = /** @type {const} */ (['deuteranopia', 'protanopia', 'tritanopia']);

/** @param {number[]} rgb @param {keyof typeof MACHADO} type */
function simulate(rgb, type) {
	const linear = rgb.map(toLinear);
	return MACHADO[type].map((row) => toSrgb(clamp01(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2])));
}

/** @param {number[]} rgb */
function toLab(rgb) {
	const [r, g, b] = rgb.map(toLinear);
	const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
	const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
	const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
	const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
	return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const DEG = Math.PI / 180;

/** CIEDE2000 colour difference between two Lab colours. */
function ciede2000([l1, a1, b1], [l2, a2, b2]) {
	const c1 = Math.hypot(a1, b1);
	const c2 = Math.hypot(a2, b2);
	const cMean = (c1 + c2) / 2;
	const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)));
	const a1p = a1 * (1 + g);
	const a2p = a2 * (1 + g);
	const c1p = Math.hypot(a1p, b1);
	const c2p = Math.hypot(a2p, b2);
	const hue = (a, b) => {
		const h = Math.atan2(b, a) / DEG;
		return h < 0 ? h + 360 : h;
	};
	const h1p = hue(a1p, b1);
	const h2p = hue(a2p, b2);
	const dL = l2 - l1;
	const dC = c2p - c1p;
	let dh = h2p - h1p;
	if (c1p * c2p === 0) dh = 0;
	else if (dh > 180) dh -= 360;
	else if (dh < -180) dh += 360;
	const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dh * DEG) / 2);
	const lMean = (l1 + l2) / 2;
	const cMeanP = (c1p + c2p) / 2;
	let hMean = h1p + h2p;
	if (c1p * c2p !== 0) {
		hMean = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2;
	}
	const t =
		1 -
		0.17 * Math.cos((hMean - 30) * DEG) +
		0.24 * Math.cos(2 * hMean * DEG) +
		0.32 * Math.cos((3 * hMean + 6) * DEG) -
		0.2 * Math.cos((4 * hMean - 63) * DEG);
	const sL = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
	const sC = 1 + 0.045 * cMeanP;
	const sH = 1 + 0.015 * cMeanP * t;
	const rT = -2 * Math.sqrt(cMeanP ** 7 / (cMeanP ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hMean - 275) / 25) ** 2)) * DEG);
	return Math.sqrt((dL / sL) ** 2 + (dC / sC) ** 2 + (dH / sH) ** 2 + rT * (dC / sC) * (dH / sH));
}

/**
 * Perceptual distance between two hex colours, optionally as seen with a colour-vision deficiency.
 * @param {string} hexA @param {string} hexB @param {(typeof COLOUR_VISION_TYPES)[number]} [visionType]
 */
export function perceptualDistance(hexA, hexB, visionType) {
	const see = (hex) => (visionType ? simulate(parseHex(hex), visionType) : parseHex(hex));
	return ciede2000(toLab(see(hexA)), toLab(see(hexB)));
}
