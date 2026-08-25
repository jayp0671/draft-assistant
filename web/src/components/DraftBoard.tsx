import { useMemo } from "react";
import type { Player } from "@shared/engine";
import { slotOnClock, TEAMS } from "@shared/league-config";
import type { PickRow } from "@/lib/types";
import { PosBadge, Panel } from "./ui";

interface Props {
  players: Player[];
  picks: PickRow[];
  onUndoLast: () => void;
}

export default function DraftBoard({ players, picks, onUndoLast }: Props) {
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.playerId, p])),
    [players],
  );
  const overall = picks.length + 1;
  const onClockSlot = slotOnClock(overall);

  const recent = [...picks].slice(-10).reverse();

  return (
    <Panel
      title="Draft Board"
      right={
        <button
          onClick={onUndoLast}
          disabled={picks.length === 0}
          className="text-xs px-2 py-1 rounded border border-edge text-silver/70 hover:text-bad hover:border-bad/50 disabled:opacity-40"
        >
          undo last
        </button>
      }
    >
      {/* on-the-clock strip */}
      <div className="px-4 py-2 border-b border-edge flex items-center gap-2 text-sm">
        <span className="text-silver/70">On the clock:</span>
        <span className="font-semibold text-kelly">
          {TEAMS.find((t) => t.slot === onClockSlot)?.teamName}
        </span>
        <span className="text-xs text-silver/60 ml-auto">{picks.length} picks made</span>
      </div>

      {/* recent picks */}
      <div className="p-3">
        <div className="text-xs text-silver/60 mb-2">Recent picks</div>
        {recent.length === 0 ? (
          <div className="text-silver/60 text-sm py-4 text-center">
            No picks yet — log the first selection to begin.
          </div>
        ) : (
          <ul className="space-y-1">
            {recent.map((pk) => {
              const pl = playerById.get(pk.player_id);
              const team = TEAMS.find((t) => t.slot === pk.team_slot);
              return (
                <li key={pk.overall_pick}
                  className="flex items-center gap-2 text-sm bg-coal2/40 rounded px-2 py-1">
                  <span className="text-xs text-silver/60 w-12">
                    {pk.round}.{String(((pk.overall_pick - 1) % 12) + 1).padStart(2, "0")}
                  </span>
                  {pl && <PosBadge pos={pl.position} />}
                  <span className="truncate">{pl?.name ?? pk.player_id}</span>
                  <span className="text-xs text-silver/60 ml-auto truncate max-w-[40%]">
                    {team?.teamName}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
