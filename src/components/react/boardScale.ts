// The label layouts of FunctionCurve and VectorBoard2D measure text, dots and clearances in px calibrated at the base
// font sizes. On a scaled board (useBoardScale, decision 0025) every one of those px grows by the same factor, so the
// layouts run at the plane's base size and the text is drawn at its base size × scale: the labels land on the same
// grid positions at every scale. Pure, so scripts/check-boards.mjs checks the boards' own call.

/** The size, in base px, at which a plane's label layout runs: the drawn size divided by the board scale. */
export function layoutPlaneSize(planeSize: number, scale: number): number {
	if (!(planeSize > 0)) throw new Error(`layoutPlaneSize: the plane must be wider than 0px, got ${planeSize}.`);
	if (!(scale > 0)) throw new Error(`layoutPlaneSize: the board scale must be positive, got ${scale}.`);
	return planeSize / scale;
}
