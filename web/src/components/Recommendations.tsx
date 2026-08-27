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
        <div className="clock-bar flex items-center gap-3 px-3 py-1.5 rounded-r-lg">
          <span className="font-mono text-xs text-silver/70">
            PICK <span className="text-white font-bold">{overall}</span> · RD <span className="text-white font-bold">{round}</span>
          </span>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-display font-bold uppercase tracking-wider border ${
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
        <ul className="p-2 space-y-2">
          {recs.map((r, i) => {
            const p = r.player;
            const byeConflict = sharesBye(p.byeWeek, (myByesByPos[p.position] ?? [])[0]) ||
              (myByesByPos[p.position] ?? []).includes(p.byeWeek ?? -1);
            const adpGood = r.adpValue >= 6;
            const adpReach = r.adpValue <= -8;
            const isTop = i === 0;
            return (
              <li key={p.playerId}
                className={`rounded-xl border bg-coal2/70 hover:bg-coal2 transition-colors ${
                  isTop ? "border-kelly/40 ring-1 ring-kelly/10" : "border-edge"
                }`}>
                <div className="flex items-stretch">
                  {/* rank rail — big athletic number */}
                  <div className={`w-12 shrink-0 flex items-center justify-center rounded-l-xl ${
                    isTop ? "bg-kelly/15" : "bg-midnight/20"
                  }`}>
                    <span className={`font-display font-bold text-xl ${
                      isTop ? "text-kelly" : "text-silver/50"
                    }`}>
                      {i + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 p-3">
                    {/* name row — display font for player name */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <PosBadge pos={p.position} />
                      <span className="font-display font-semibold text-[15px] uppercase tracking-wide truncate">
                        {p.name}
                      </span>
                      <span className="text-xs text-silver/50 font-mono">{p.team}</span>
                      {p.isRookie && (
                        <span className="text-[9px] font-display font-bold tracking-wider text-kelly bg-kelly/10 border border-kelly/30 rounded px-1 py-px">ROOKIE</span>
                      )}
                      <InjuryChip status={p.injuryStatus} />
                      {r.fillsNeed && (
                        <span className="text-[9px] font-display font-bold tracking-wider text-charcoal bg-kelly rounded px-1.5 py-px">NEED</span>
                      )}
                    </div>

                    {/* scoreboard stat strip */}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <Stat label="VORP" value={r.vorp.toFixed(0)} accent />
                      <Stat label="Proj" value={p.projPoints.toFixed(0)} />
                      <Stat label="ADP" value={p.adp >= 999 ? "—" : p.adp.toFixed(0)} />
                      <Stat label="Bye" value={p.byeWeek ?? "—"} />
                      {p.targetShare != null && (
                        <Stat label="Tgt%" value={`${(p.targetShare * 100).toFixed(0)}`} />
                      )}
                      {p.tier != null && <Stat label="Tier" value={p.tier} />}
                    </div>

                    {/* reason chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {adpGood && <Chip tone="good">value +{r.adpValue.toFixed(0)}</Chip>}
                      {adpReach && <Chip tone="warn">reach {r.adpValue.toFixed(0)}</Chip>}
                      {byeConflict && <Chip tone="bad">bye stack wk{p.byeWeek}</Chip>}
                      {p.careerTrend === "rising" && <Chip tone="good">↑ rising</Chip>}
                      {p.careerTrend === "declining" && <Chip tone="warn">↓ declining</Chip>}
                      {p.recencyPpg != null && p.recencyPpg >= 14 && <Chip tone="good">hot: {p.recencyPpg} PPG</Chip>}
                      {p.adpConfidence === "low" && <Chip tone="warn">ADP uncertain</Chip>}
                      {p.depthChartOrder === 1 && <Chip>starter</Chip>}
                      {p.depthChartOrder && p.depthChartOrder > 1 && <Chip tone="warn">depth #{p.depthChartOrder}</Chip>}
                      {p.gamesMissed2y != null && p.gamesMissed2y >= 6 && (
                        <Chip tone="warn">{p.gamesMissed2y}G missed 2yr</Chip>
                      )}
                      {p.draftRound != null && p.isRookie && <Chip>Rd{p.draftRound} pick</Chip>}
                    </div>

                    {/* reasoning paragraph — gradient bar */}
                    <div className="reasoning-bar mt-2.5 pl-3 py-2 rounded-r">
                      <p className="text-[11.5px] leading-relaxed text-silver/75">
                        {r.reasoning}
                      </p>
                    </div>
                  </div>

                  {/* draft action */}
                  <div className="shrink-0 flex items-center pr-3">
                    <button
                      onClick={() => onQuickLog(onClockSlot, p.playerId)}
                      className="font-display font-bold uppercase tracking-wider text-[11px] px-4 py-2 rounded-lg bg-kelly text-charcoal hover:brightness-110 transition shadow-md"
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
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>;
}
