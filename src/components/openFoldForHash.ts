// Opens the fold a URL hash points into, and every fold around it, on load and on in-page navigation. Shared by Fold
// and FormalDefinition, so a link such as #properties opens the closed formal definition even on a page with no other
// fold (decision 0023). Astro bundles this module once per page however many components import it.
/** The element id a hash names, or null when the hash is empty or not valid percent-encoding (such as #%E0). */
function hashTargetId(hash: string): string | null {
	try {
		return decodeURIComponent(hash.slice(1)) || null;
	} catch (error) {
		if (error instanceof URIError) return null;
		throw error;
	}
}

function openFoldForHash() {
	const id = hashTargetId(location.hash);
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
