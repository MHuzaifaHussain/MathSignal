import { useEffect, useId, useRef } from "react";
import { Slider } from "@base-ui/react/slider";
import { KEYBOARD_COMMIT_DELAY_MS } from "./boardTiming";

const KEYBOARD_REASONS = new Set(["keyboard", "input-change"]);
/** PageUp/PageDown and Shift+Arrow move about a tenth of the range. */
const LARGE_STEP_FRACTION = 10;

interface TraySliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Step for PageUp/PageDown and Shift+Arrow. Defaults to about a tenth of the range. */
  largeStep?: number;
  onValueChange: (value: number) => void;
  /** Called once when the user finishes a change; use it to update the board's announcement. */
  onValueCommitted?: (value: number) => void;
  /** Readout text, e.g. "1.50". Also used for aria-valuetext unless `describe` is given. */
  format: (value: number) => string;
  /** Spoken value, e.g. "mean 1.50". */
  describe?: (value: number) => string;
  /** Colors the label and thumb with a meaning color. */
  meaning?: "mu" | "sigma";
}

const defaultLargeStep = (min: number, max: number, step: number) =>
  step * Math.max(1, Math.round((max - min) / step / LARGE_STEP_FRACTION));

/** A labeled slider for a board's tray: the keyboard and screen-reader alternative to dragging. */
export default function TraySlider({
  label,
  value,
  min,
  max,
  step,
  largeStep,
  onValueChange,
  onValueCommitted,
  format,
  describe,
  meaning,
}: TraySliderProps) {
  const labelId = useId();
  const meaningClass = meaning ? `ms-${meaning}` : "";
  const commitTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(commitTimerRef.current), []);

  const handleCommit = (next: number, reason: string) => {
    window.clearTimeout(commitTimerRef.current);
    if (!KEYBOARD_REASONS.has(reason)) {
      onValueCommitted?.(next);
      return;
    }
    commitTimerRef.current = window.setTimeout(() => onValueCommitted?.(next), KEYBOARD_COMMIT_DELAY_MS);
  };

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
        largeStep={largeStep ?? defaultLargeStep(min, max, step)}
        onValueChange={(next) => onValueChange(next)}
        onValueCommitted={(next, details) => handleCommit(next, details.reason)}
      >
        <Slider.Control className="ms-slider-control">
          <Slider.Track className="ms-slider-track">
            <Slider.Indicator className="ms-slider-indicator" />
            {/* The label names the slider input only. On Root it would also name Root's group, so a screen reader
                heard the label twice ("Height grouping, Height slider"). */}
            <Slider.Thumb
              className="ms-slider-thumb"
              aria-labelledby={labelId}
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
