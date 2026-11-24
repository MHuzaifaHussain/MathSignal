import TrayChoice from "../TrayChoice";

interface StageChoiceProps<S extends string> {
  /** Visible name from the board's describe.ts, usually "Show as". */
  legend: string;
  /** Every stage the board has, in order. */
  options: readonly { value: S; label: string }[];
  /** The board's stageAllowed (guided.ts plus its own rules); stages that aren't allowed yet are left out. */
  isAllowed: (stage: S) => boolean;
  value: S;
  onChange: (stage: S) => void;
}

/** The "Show as" choice. It offers only the allowed stages, and draws nothing when fewer than two are left. */
export default function StageChoice<S extends string>({ legend, options, isAllowed, value, onChange }: StageChoiceProps<S>) {
  const allowed = options.filter((option) => isAllowed(option.value));
  if (allowed.length < 2) return null;
  return <TrayChoice legend={legend} options={allowed} value={value} onChange={onChange} />;
}
