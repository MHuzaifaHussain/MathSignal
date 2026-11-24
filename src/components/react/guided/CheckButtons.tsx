import { canShowAnswer, type CheckProgress } from "./guided.ts";
import { refusedBy } from "./refusal.tsx";

interface CheckButtonsProps {
  progress: CheckProgress;
  /** Button text from the board's own copy. */
  checkLabel: string;
  showAnswerLabel: string;
  /**
   * The RefusalNote id while Check is refused (the reader hasn't committed to an answer yet). Check stays
   * pressable; `onCheck` still runs, so the reducer refuses and the board says why.
   */
  checkRefusalId?: string | null;
  onCheck: () => void;
  onShowAnswer: () => void;
}

/**
 * Check until it passes, plus "Show the answer" once the reader has missed enough times (guided.ts). Both
 * disappear once the answer is in, so the board moves focus to its verdict sentence.
 */
export default function CheckButtons({ progress, checkLabel, showAnswerLabel, checkRefusalId, onCheck, onShowAnswer }: CheckButtonsProps) {
  return (
    <>
      {!progress.checked && (
        <button type="button" className="ms-board-button ms-board-button-primary" {...refusedBy(checkRefusalId)} onClick={onCheck}>
          {checkLabel}
        </button>
      )}
      {canShowAnswer(progress) && (
        <button type="button" className="ms-board-button" onClick={onShowAnswer}>
          {showAnswerLabel}
        </button>
      )}
    </>
  );
}
