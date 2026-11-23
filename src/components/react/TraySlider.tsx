import { useId } from "react";
import { Slider } from "@base-ui/react/slider";

interface TraySliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  /** Called once when the user finishes a change; use it to update the board's announcement. */
  onValueCommitted?: (value: number) => void;
  /** Readout text, e.g. "1.50". Also used for aria-valuetext unless `describe` is given. */
  format: (value: number) => string;
  /** Spoken value, e.g. "mean 1.50". */
  describe?: (value: number) => string;
  /** Colours the label and thumb with a meaning colour. */
  meaning?: "mu" | "sigma";
}

/** A labelled slider for a board's tray: the keyboard and screen-reader alternative to dragging. */
export default function TraySlider({
  label,
  value,
  min,
  max,
  step,
  onValueChange,
  onValueCommitted,
  format,
  describe,
  meaning,
}: TraySliderProps) {
  const labelId = useId();
  const meaningClass = meaning ? `ms-${meaning}` : "";

  return (
    <div className={`ms-slider ${meaningClass}`}>
      <span id={labelId} className="ms-slider-label">
        {label}
      </span>
      <Slider.Root
        className="ms-slider-root"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-labelledby={labelId}
        onValueChange={(next) => onValueChange(next)}
        onValueCommitted={(next) => onValueCommitted?.(next)}
      >
        <Slider.Control className="ms-slider-control">
          <Slider.Track className="ms-slider-track">
            <Slider.Indicator className="ms-slider-indicator" />
            <Slider.Thumb
              className="ms-slider-thumb"
              getAriaValueText={(_formatted, current) => (describe ? describe(current) : format(current))}
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <output className="ms-slider-readout" aria-hidden="true">
        {format(value)}
      </output>
    </div>
  );
}
