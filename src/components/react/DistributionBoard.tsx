import OutcomeBoard from "./distributionBoard/OutcomeBoard.tsx";
import type { SetupId } from "./distributionBoard/setups.ts";

interface DistributionBoardProps {
  /** Which configuration to show; see src/components/react/distributionBoard/setups.ts. */
  setup: SetupId;
}

/** A random variable as a bar chart. Each mode is its own board; design and reasoning: decisions 0012 and 0018. */
export default function DistributionBoard({ setup }: DistributionBoardProps) {
  return <OutcomeBoard setup={setup} />;
}
