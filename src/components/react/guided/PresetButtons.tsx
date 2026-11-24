import { refusedBy } from "./refusal.tsx";

interface PresetButtonsProps {
  /** Accessible name of the group, e.g. "Presets for event A". */
  label: string;
  /** Short visible caption before the buttons, e.g. "A"; screen readers get `label` instead. */
  caption: string;
  presets: readonly { id: string; label: string }[];
  /**
   * The preset the board shows now (null when the reader has stepped away from every preset), drawn pressed.
   * Omit it for presets that only load values and never stay selected; the buttons then carry no aria-pressed.
   */
  activeId?: string | null;
  /** The RefusalNote id while the presets are refused; presses still reach `onPick`, which decides what to say. */
  refusalId?: string | null;
  onPick: (id: string) => void;
}

/** A row of preset buttons in one labeled group. Styles: .ms-board-presets. */
export default function PresetButtons({ label, caption, presets, activeId, refusalId, onPick }: PresetButtonsProps) {
  return (
    <div className="ms-board-presets" role="group" aria-label={label}>
      <span className="ms-board-presets-label" aria-hidden="true">
        {caption}:
      </span>
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="ms-board-button"
          aria-pressed={activeId === undefined ? undefined : activeId === preset.id}
          {...refusedBy(refusalId)}
          onClick={() => onPick(preset.id)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
