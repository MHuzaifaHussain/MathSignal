// Content tables and display formulas scroll inside their own box when they are wider than the column (Starlight's
// table rule, `.katex-display` in global.css). This makes each one focusable and named while, and only while, it
// overflows, so a keyboard reader can scroll it with the arrow keys and a screen reader hears what it is (decision
// 0024). Expressive Code does the same for code blocks. Boxes that fit get no extra tab stop.
import { FORMULA_SCROLL_LABEL, tableScrollLabel } from './labels.ts';

const TABLE_SELECTOR = '.sl-markdown-content table:not(:where(.not-content *))';
const FORMULA_SELECTOR = '.sl-markdown-content .katex-display';
/** Marks a box this script changed, holding what it added, so it can undo exactly that when the box fits again. */
const ADDED_ATTRIBUTE = 'data-ms-scroll-box';
/** Sub-pixel rounding can leave scrollWidth one pixel over clientWidth on a box that fits. */
const OVERFLOW_TOLERANCE_PX = 1;

/** A header cell's visible text, without KaTeX's hidden MathML copy of any formula in it. */
function headerText(cell: Element): string {
	const copy = cell.cloneNode(true) as Element;
	for (const mathml of copy.querySelectorAll('.katex-mathml')) mathml.remove();
	return copy.textContent ?? '';
}

function labelFor(box: HTMLElement): string {
	if (box.matches('table')) return tableScrollLabel([...box.querySelectorAll('thead th')].map(headerText));
	return FORMULA_SCROLL_LABEL;
}

function markScrollable(box: HTMLElement) {
	const added = ['tabindex'];
	box.tabIndex = 0;
	if (!box.hasAttribute('aria-label') && !box.hasAttribute('aria-labelledby')) {
		box.setAttribute('aria-label', labelFor(box));
		added.push('aria-label');
	}
	// A span with a name needs a role for the name to be read; a table keeps its own.
	if (!box.matches('table')) {
		box.setAttribute('role', 'group');
		added.push('role');
	}
	box.setAttribute(ADDED_ATTRIBUTE, added.join(' '));
}

function unmarkScrollable(box: HTMLElement) {
	for (const attribute of (box.getAttribute(ADDED_ATTRIBUTE) ?? '').split(' ')) box.removeAttribute(attribute);
	box.removeAttribute(ADDED_ATTRIBUTE);
}

function update(box: HTMLElement) {
	const overflows = box.scrollWidth - box.clientWidth > OVERFLOW_TOLERANCE_PX;
	const marked = box.hasAttribute(ADDED_ATTRIBUTE);
	if (overflows && !marked) markScrollable(box);
	if (!overflows && marked) unmarkScrollable(box);
}

function watchScrollBoxes() {
	const boxes = [...document.querySelectorAll<HTMLElement>(`${TABLE_SELECTOR}, ${FORMULA_SELECTOR}`)];
	if (boxes.length === 0) return;
	// Fires once per box on observe, again when a fold opens or the column resizes.
	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) update(entry.target as HTMLElement);
	});
	for (const box of boxes) observer.observe(box);
	// A web font can widen a box without resizing it.
	document.fonts.ready.then(() => boxes.forEach(update), (error: unknown) => console.error('focusableScrollBoxes: waiting for fonts failed', error));
}

watchScrollBoxes();
