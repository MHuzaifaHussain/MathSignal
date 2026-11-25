import type { SpokenLine } from "./spokenLine.ts";

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
