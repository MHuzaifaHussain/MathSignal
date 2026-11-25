// Opens the fold a URL hash points into, and every fold around it, on load and on in-page navigation. Shared by Fold
// and FormalDefinition, so a link such as #properties opens the closed formal definition even on a page with no other
// fold (decision 0023). Astro bundles this module once per page however many components import it.
function openFoldForHash() {
	const id = decodeURIComponent(location.hash.slice(1));
	if (!id) return;
	const target = document.getElementById(id);
	let fold = target?.closest('details') ?? null;
	while (fold) {
		fold.open = true;
		fold = fold.parentElement?.closest('details') ?? null;
	}
}

openFoldForHash();
window.addEventListener('hashchange', openFoldForHash);
