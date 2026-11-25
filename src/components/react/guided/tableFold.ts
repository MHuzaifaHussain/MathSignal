// The words of the shared "Table view" fold (TableFold.tsx). One switch behaves and speaks the same on every board,
// so its name and its two fixed sentences live here; each board writes only the body that says what its table holds.
// Pure, so scripts/check-boards.mjs pins every string. Design and reasoning: decision 0017.

/** The switch's name. Not "Show as …": that is the stage choice's legend, and the two must not read as one choice. */
export const TABLE_FOLD_LABEL = 'Table view';
/** Opens every announcement of the switch turning on. */
export const TABLE_FOLD_SHOWN = 'Table shown under the switch.';
/** The whole announcement of the switch turning off. */
export const TABLE_FOLD_HIDDEN = 'Table hidden.';

/** Body starts that would double the fixed sentences ("Table shown under the switch. Table shown …"). */
const RESERVED_STARTS = ['Table shown', 'Table hidden'] as const;

/** A board's body: one or more sentences, ending with a period, that never repeat the fixed sentences. */
function checkBody(body: string): void {
	const reserved = RESERVED_STARTS.find((start) => body.startsWith(start));
	if (body.trim() === '' || !body.endsWith('.') || reserved) {
		const why = reserved ? `starts with "${reserved}", which the fold already says` : body.trim() === '' ? 'is empty' : 'does not end with a period';
		throw new Error(`tableFoldAnnouncement: the body "${body}" ${why}.`);
	}
}

/**
 * What the live region says when the switch turns: on, the shared opening plus the board's `body`; off, "Table hidden.".
 * The body is checked either way, so a board that forgets or garbles it fails on its first press, in check-boards too.
 */
export function tableFoldAnnouncement(open: boolean, body: string): string {
	checkBody(body);
	return open ? `${TABLE_FOLD_SHOWN} ${body}` : TABLE_FOLD_HIDDEN;
}
