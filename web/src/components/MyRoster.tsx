import { useMemo } from "react";
import type { Player, DraftState } from "@shared/engine";
import { computeRosterNeed, turnPairLookahead } from "@shared/engine";
import { ROSTER_SLOTS, TEAMS, FLEX_ELIGIBLE } from "@shared/league-config";
import type { PickRow } from "@/lib/types";
import { PosBadge, Panel } from "./ui";

interface Props {
  players: Player[];
  picks: PickRow[];
  mySlot: number | null;
}

export default function MyRoster({ players, picks, mySlot }: Props) {
  const playerById = useMemo(() => new Map(players.map((p) => [p.playerId, p])), [players]);

  if (mySlot == null) {
    return (
      <Panel title="My Roster">
        <div className="p-4 text-sm text-silver/60">No team selected.</div>
      </Panel>
    );
  }

  const myPicks = picks.filter((p) => p.team_slot === mySlot);
  const myPlayers = myPicks.map((p) => playerById.get(p.player_id)).filter(Boolean) as Player[];
  const need = computeRosterNeed(myPlayers);
  const team = TEAMS.find((t) => t.slot === mySlot);

  // build slot display
  const slots: { label: string; player?: Player }[] = [];
  const pool = [...myPlayers];
  const take = (pred: (p: Player) => boolean, label: string) => {
    const idx = pool.findIndex(pred);
    slots.push({ label, player: idx >= 0 ? pool.splice(idx, 1)[0] : undefined });
  };
  take((p) => p.position === "QB", "QB");
  take((p) => p.position === "RB", "RB1");
  take((p) => p.position === "RB", "RB2");
  take((p) => p.position === "WR", "WR1");
  take((p) => p.position === "WR", "WR2");
  take((p) => p.position === "TE", "TE");
  take((p) => FLEX_ELIGIBLE.includes(p.position), "FLEX1");
  take((p) => FLEX_ELIGIBLE.includes(p.position), "FLEX2");
  take((p) => p.position === "K", "K");
  take((p) => p.position === "DEF", "DEF");
  for (let i = 0; i < ROSTER_SLOTS.BN; i++) {
    slots.push({ label: "BN", player: pool.shift() });
  }

  // turn-pair lookahead
  const state: DraftState = {
    picks: picks.map((p) => ({ overallPick: p.overall_pick, teamSlot: p.team_slot, playerId: p.player_id })),
    numTeams: 12, totalRounds: 16,
  };
  const pair = players.length ? turnPairLookahead(players, state, mySlot) : null;

  return (
    <div className="space-y-4">
      <Panel title={`My Roster — ${team?.teamName ?? ""}`}>
        <ul className="p-2">
          {slots.map((s, i) => (
            <li key={i} className="flex items-center gap-2 px-2 py-1 text-sm">
              <span className="text-xs text-silver/60 w-12">{s.label}</span>
              {s.player ? (
                <>
                  <PosBadge pos={s.player.position} />
                  <span className="truncate">{s.player.name}</span>
                  <span className="text-xs text-silver/60 ml-auto">
                    {s.player.projPoints.toFixed(0)}
                  </span>
                </>
              ) : (
                <span className="text-silver/40 italic text-xs">empty</span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {pair && pair.thisPick !== pair.nextPick && (
        <Panel accent title="Turn-Pair Strategy">
          <div className="p-3 space-y-3">
            <p className="text-[12px] leading-relaxed text-silver/85 border-l-2 border-kelly/40 pl-2.5">
              {pair.strategy}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-bad/80 font-bold mb-1">
                  Grab now — won't last
                </div>
                <ul className="space-y-1">
                  {pair.grabNow.slice(0, 6).map((p) => (
                    <li key={p.playerId} className="flex items-center gap-1 text-xs">
                      <PosBadge pos={p.position} />
                      <span className="truncate">{p.name}</span>
                      <span className="text-silver/50 ml-auto">{p.projPoints.toFixed(0)}</span>
                    </li>
                  ))}
                  {pair.grabNow.length === 0 && (
                    <li className="text-[11px] text-silver/50 italic">nothing scarce right now</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-good/80 font-bold mb-1">
                  Can wait — likely at #{pair.nextPick}
                </div>
                <ul className="space-y-1">
                  {pair.likelyAtNext.slice(0, 6).map((p) => (
                    <li key={p.playerId} className="flex items-center gap-1 text-xs">
                      <PosBadge pos={p.position} />
                      <span className="truncate">{p.name}</span>
                      <span className="text-silver/50 ml-auto">{p.projPoints.toFixed(0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
