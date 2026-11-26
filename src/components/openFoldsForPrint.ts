// Opens every fold in the page content before printing and closes again only the ones it opened, so a proof or a
// PropertiesTable inside a closed fold reaches paper and the reader's own open/closed choices survive (decision 0023).
// The print CSS in global.css does the same for browsers with ::details-content; this covers the rest. Shared by Fold
// and FormalDefinition next to openFoldForHash; Astro bundles it once per page.
const CONTENT_FOLD_SELECTOR = '.sl-markdown-content details';

/** The folds this script opened for the current print, closed again after it. */
let openedForPrint: HTMLDetailsElement[] = [];

function openFoldsForPrint() {
	// A print preview can send beforeprint twice before afterprint; the second call must not forget the first list.
	const closedFolds = [...document.querySelectorAll<HTMLDetailsElement>(CONTENT_FOLD_SELECTOR)].filter((fold) => !fold.open);
	for (const fold of closedFolds) fold.open = true;
	openedForPrint = [...openedForPrint, ...closedFolds];
}

function restoreFoldsAfterPrint() {
	for (const fold of openedForPrint) fold.open = false;
	openedForPrint = [];
}

window.addEventListener('beforeprint', openFoldsForPrint);
window.addEventListener('afterprint', restoreFoldsAfterPrint);
