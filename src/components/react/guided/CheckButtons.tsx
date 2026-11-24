import { canShowAnswer, type CheckProgress } from "./guided.ts";

interface CheckButtonsProps {
  progress: CheckProgress;
  /** Button text from the board's describe.ts. */
  checkLabel: string;
  showAnswerLabel: string;
  onCheck: () => void;
  onShowAnswer: () => void;
}

/**
 * Check until it passes, plus "Show the answer" once the reader has missed enough times (guided.ts). Both
 * disappear once the answer is in, so the board moves focus to its verdict sentence.
 */
export default function CheckButtons({ progress, checkLabel, showAnswerLabel, onCheck, onShowAnswer }: CheckButtonsProps) {
  return (
    <>
      {!progress.checked && (
        <button type="button" className="ms-board-button ms-board-button-primary" onClick={onCheck}>
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
