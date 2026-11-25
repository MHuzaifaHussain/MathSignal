import { lazy, Suspense } from "react";
import OutcomeBoard from "./distributionBoard/OutcomeBoard.tsx";
import { boardModeOf, type BoardSetupId } from "./distributionBoard/boardSetups.ts";
import type { DensitySetupId } from "./distributionBoard/densitySetups.ts";
import type { FamilySetupId } from "./distributionBoard/familySetups.ts";
import type { SetupId } from "./distributionBoard/setups.ts";

// The family and density boards load as their own chunks, so a page with only outcome setups never ships them
// (decision 0018). The server renders them in full; while the chunk loads, hydration keeps that markup on screen,
// so the empty fallback is never drawn over a server-rendered board.
const FamilyBoard = lazy(() => import("./distributionBoard/FamilyBoard.tsx"));
const DensityBoard = lazy(() => import("./distributionBoard/DensityBoard.tsx"));

interface DistributionBoardProps {
  /** Which configuration to show; each mode lists its own in distributionBoard/ (setups.ts, familySetups.ts, densitySetups.ts). */
  setup: BoardSetupId;
}

/**
 * A random variable as a bar chart. The setup picks the mode, and each mode is its own board with its own state, so
 * the mode never changes under a mounted board. Design and reasoning: decisions 0012 and 0018.
 */
export default function DistributionBoard({ setup }: DistributionBoardProps) {
  switch (boardModeOf(setup)) {
    case "outcomes":
      // Outside any Suspense boundary, so the shipped outcome boards render exactly as before the split.
      return <OutcomeBoard setup={setup as SetupId} />;
    case "family":
      return (
        <Suspense fallback={null}>
          <FamilyBoard setup={setup as FamilySetupId} />
        </Suspense>
      );
    case "density":
      return (
        <Suspense fallback={null}>
          <DensityBoard setup={setup as DensitySetupId} />
        </Suspense>
      );
  }
}
