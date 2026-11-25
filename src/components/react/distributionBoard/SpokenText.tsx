/** A line whose spoken form can differ from what the screen shows ("2¹⁰", "HHT", "≤"). */
export interface SpokenLine {
  visible: string;
  spoken: string;
}

/** Shows `visible` and gives screen readers `spoken` instead, or plain text when the two agree. */
export default function SpokenText({ line }: { line: SpokenLine }) {
  if (line.visible === line.spoken) return <>{line.visible}</>;
  return (
    <>
      <span aria-hidden="true">{line.visible}</span>
      <span className="sr-only">{line.spoken}</span>
    </>
  );
}
