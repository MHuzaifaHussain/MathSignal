import { useId } from "react";

interface TrayChoiceOption<T extends string> {
  value: T;
  label: string;
}

interface TrayChoiceProps<T extends string> {
  /** Visible name of the group, e.g. "Editing". */
  legend: string;
  options: readonly TrayChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A segmented choice for a board's tray: a fieldset of native radios, so arrow keys, screen readers and forms
 * all work without custom code. The selected option is shown by fill and weight, never by color alone.
 * Styles: .ms-choice in src/styles/components.css.
 */
export default function TrayChoice<T extends string>({ legend, options, value, onChange }: TrayChoiceProps<T>) {
  const name = useId();
  return (
    <fieldset className="ms-choice">
      <legend className="ms-choice-legend">{legend}</legend>
      <div className="ms-choice-options">
        {options.map((option) => (
          <label key={option.value} className="ms-choice-option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
