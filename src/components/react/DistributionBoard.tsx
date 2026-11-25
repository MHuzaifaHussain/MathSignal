import FamilyBoard from "./distributionBoard/FamilyBoard.tsx";
import OutcomeBoard from "./distributionBoard/OutcomeBoard.tsx";
import { boardModeOf, type BoardSetupId } from "./distributionBoard/boardSetups.ts";
import type { FamilySetupId } from "./distributionBoard/familySetups.ts";
import type { SetupId } from "./distributionBoard/setups.ts";

interface DistributionBoardProps {
  /** Which configuration to show; each mode lists its own in distributionBoard/ (setups.ts, familySetups.ts). */
  setup: BoardSetupId;
}

/**
 * A random variable as a bar chart. The setup picks the mode, and each mode is its own board with its own state, so
 * the mode never changes under a mounted board. Design and reasoning: decisions 0012 and 0018.
 */
export default function DistributionBoard({ setup }: DistributionBoardProps) {
  switch (boardModeOf(setup)) {
    case "outcomes":
      return <OutcomeBoard setup={setup as SetupId} />;
    case "family":
      return <FamilyBoard setup={setup as FamilySetupId} />;
  }
}
