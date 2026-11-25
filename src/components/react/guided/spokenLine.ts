// A sentence a board shows one way and speaks another. Types only, so the pure describe modules never import a
// React component; guided/SpokenText.tsx renders it.

/** A line whose spoken form can differ from what the screen shows ("2¹⁰", "HHT", "≤", "z = 6 / 8"). */
export interface SpokenLine {
	visible: string;
	spoken: string;
}
