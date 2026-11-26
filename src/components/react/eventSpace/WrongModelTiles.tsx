import SpokenText from "../guided/SpokenText.tsx";
import { spokenLine } from "./describe.ts";
import { poolTiles } from "./model.ts";
import type { Scenario } from "./scenarios.ts";
import type { EventSpaceState } from "./state.ts";

interface WrongModelTilesProps {
  state: EventSpaceState;
  scenario: Scenario;
}

/**
 * The tempting wrong model (HH, "one of each", TT as three equally likely outcomes), drawn in dashed ink and
 * filled with the reader's own tosses, so "one of each" visibly holds about half of them, not a third.
 */
export default function WrongModelTiles({ state, scenario }: WrongModelTilesProps) {
  if (!scenario.wrongModel) return null;
  const tiles = poolTiles(state.tallies, scenario.wrongModel.tiles);
  return (
    <figure className="ms-wrong-model">
      <ul className="ms-wrong-model-tiles">
        {tiles.map((tile) => (
          <li key={tile.label} className="ms-wrong-model-tile">
            <span className="ms-wrong-model-label">{tile.label}</span>
            {state.tossCount > 0 && <span className="ms-wrong-model-count">{tile.count} tosses</span>}
          </li>
        ))}
      </ul>
      <figcaption className="ms-event-status">
        <SpokenText line={spokenLine(scenario.wrongModel.caption)} />
      </figcaption>
    </figure>
  );
}
