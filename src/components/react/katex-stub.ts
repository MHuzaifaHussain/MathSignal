// Stand-in for KaTeX inside React islands (decision 0007). Mafs imports KaTeX at module level for its
// <LaTeX> component, which no board uses; replacing it here keeps about 66 KB (gzip) of maths
// typesetting out of every board's JavaScript. Formulas on the page are still rendered at build time.
// If a board ever needs <LaTeX>, this throws loudly instead of rendering nothing.
const DISABLED_MESSAGE =
	"KaTeX is not bundled into islands (docs/decisions/0007-no-katex-in-islands.md). Use Mafs <Text> or put the formula in the page's MDX.";

function disabled(): never {
	throw new Error(DISABLED_MESSAGE);
}

const katexStub = {
	render: disabled,
	renderToString: disabled,
};

export default katexStub;
export const render = disabled;
export const renderToString = disabled;
