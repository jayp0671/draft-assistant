import { useMemo } from "react";
import type { Player, DraftState } from "@shared/engine";
import { recommend, computeRosterNeed } from "@shared/engine";
import { slotOnClock, roundForPick, TEAMS } from "@shared/league-config";
import { sharesBye } from "@shared/schedule";
import type { PickRow } from "@/lib/types";
import { PosBadge, InjuryChip, Panel, Stat } from "./ui";

interface Props {
  players: Player[];
  picks: PickRow[];
  mySlot: number | null;
  onQuickLog: (teamSlot: number, playerId: string) => void;
}

export default function Recommendations({ players, picks, mySlot, onQuickLog }: Props) {
  const overall = picks.length + 1;
  const onClockSlot = slotOnClock(overall);
  const round = roundForPick(overall);
  const onClockTeam = TEAMS.find((t) => t.slot === onClockSlot);
  const isMyTurn = mySlot === onClockSlot;

  const playerById = useMemo(() => new Map(players.map((p) => [p.playerId, p])), [players]);

  const state: DraftState = useMemo(() => ({
    picks: picks.map((p) => ({ overallPick: p.overall_pick, teamSlot: p.team_slot, playerId: p.player_id })),
    numTeams: 12, totalRounds: 16,
  }), [picks]);

  const recs = useMemo(
    () => (players.length ? recommend(players, state, { topN: 8 }, onClockSlot) : []),
    [players, state, onClockSlot],
  );

  // for bye-conflict detection: the on-clock team's current roster byes per pos
  const myByesByPos = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const pk of picks.filter((p) => p.team_slot === onClockSlot)) {
      const pl = playerById.get(pk.player_id);
      if (pl?.byeWeek) (map[pl.position] ??= []).push(pl.byeWeek);
    }
    return map;
  }, [picks, onClockSlot, playerById]);

  return (
    <Panel
      accent
      title="On the Clock"
      right={
        <div className="text-xs flex items-center gap-2">
          <span className="text-silver/70">Pick {overall} · Rd {round}</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
            isMyTurn ? "bg-kelly/20 text-kelly border-kelly/40" : "bg-midnight/40 text-silver border-edge"
          }`}>
            {onClockTeam?.teamName ?? `Slot ${onClockSlot}`}{isMyTurn ? " — YOU" : ""}
          </span>
        </div>
      }
    >
      {recs.length === 0 ? (
        <div className="p-8 text-center text-silver/60 text-sm">
          No player data loaded yet. Run the data pipeline, or check Supabase config.
        </div>
      ) : (
        <ul className="p-2 space-y-1.5">
          {recs.map((r, i) => {
            const p = r.player;
            const byeConflict = sharesBye(p.byeWeek, (myByesByPos[p.position] ?? [])[0]) ||
              (myByesByPos[p.position] ?? []).includes(p.byeWeek ?? -1);
            const adpGood = r.adpValue >= 6;
            const adpReach = r.adpValue <= -8;
            return (
              <li key={p.playerId}
                className={`rounded-xl border bg-coal2/70 hover:bg-coal2 transition ${
                  i === 0 ? "border-kelly/40" : "border-edge"
                }`}>
                <div className="flex items-stretch">
                  {/* rank rail */}
                  <div className={`w-9 shrink-0 flex items-center justify-center rounded-l-xl font-black text-sm ${
                    i === 0 ? "bg-kelly/15 text-kelly" : "bg-midnight/25 text-silver/70"
                  }`}>
                    {i + 1}
                  </div>

                  <div className="flex-1 min-w-0 p-2.5">
                    {/* name row */}
                    <div className="flex items-center gap-2">
                      <PosBadge pos={p.position} />
                      <span className="font-bold truncate">{p.name}</span>
                      <span className="text-xs text-silver/60">{p.team}</span>
                      {p.isRookie && <span className="text-[9px] font-bold text-kelly">RK</span>}
                      <InjuryChip status={p.injuryStatus} />
                      {r.fillsNeed && (
                        <span className="text-[9px] font-bold text-kelly bg-kelly/10 border border-kelly/30 rounded px-1">NEED</span>
                      )}
                    </div>

                    {/* clean stat strip */}
                    <div className="flex items-center gap-1 mt-2 divide-x divide-edge">
                      <Stat label="VORP" value={r.vorp.toFixed(0)} tone="accent" />
                      <Stat label="Proj" value={p.projPoints.toFixed(0)} />
                      <Stat label="ADP" value={p.adp >= 999 ? "—" : p.adp.toFixed(0)} />
                      <Stat label="Bye" value={p.byeWeek ?? "—"} tone={byeConflict ? "bad" : "default"} />
                      {p.targetShare != null && (
                        <Stat label="Tgt%" value={`${(p.targetShare * 100).toFixed(0)}`} />
                      )}
                      {p.tier != null && <Stat label="Tier" value={p.tier} />}
                    </div>

                    {/* reason chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {adpGood && (
                        <Chip tone="good">value +{r.adpValue}</Chip>
                      )}
                      {adpReach && (
                        <Chip tone="warn">reach {r.adpValue}</Chip>
                      )}
                      {byeConflict && <Chip tone="bad">bye stack wk{p.byeWeek}</Chip>}
                      {p.depthChartOrder === 1 && <Chip>starter</Chip>}
                      {p.depthChartOrder && p.depthChartOrder > 1 && <Chip tone="warn">depth {p.depthChartOrder}</Chip>}
                      {p.gamesMissed2y != null && p.gamesMissed2y >= 6 && (
                        <Chip tone="warn">{p.gamesMissed2y} G missed 2y</Chip>
                      )}
                      {p.draftRound != null && p.isRookie && <Chip>Rd{p.draftRound} rookie</Chip>}
                      {r.reasons.slice(0, 2).map((rs, idx) => (
                        <Chip key={idx}>{rs}</Chip>
                      ))}
                    </div>
                  </div>

                  {/* action */}
                  <div className="shrink-0 flex items-center pr-2">
                    <button
                      onClick={() => onQuickLog(onClockSlot, p.playerId)}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-kelly text-charcoal hover:brightness-110"
                    >
                      Draft
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const cls = {
    default: "bg-midnight/30 text-silver/80 border-edge",
    good: "bg-good/10 text-good border-good/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    bad: "bg-bad/10 text-bad border-bad/30",
  }[tone];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>;
}
