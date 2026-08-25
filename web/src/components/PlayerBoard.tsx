import { useMemo, useState } from "react";
import type { Player } from "@shared/engine";
import { assignTiers } from "@shared/engine";
import type { Position } from "@shared/league-config";
import type { PickRow } from "@/lib/types";
import { PosBadge, InjuryChip, Panel } from "./ui";

interface Props {
  players: Player[];
  picks: PickRow[];
  onLog: (playerId: string) => void;   // logs at current pick for on-clock team
  onClockLabel: string;
}

const POSITIONS: (Position | "ALL")[] = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

export default function PlayerBoard({ players, picks, onLog, onClockLabel }: Props) {
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [sort, setSort] = useState<"vorp" | "adp" | "proj">("proj");
  const [q, setQ] = useState("");

  const draftedIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);

  const rows = useMemo(() => {
    let list = players.filter((p) => !draftedIds.has(p.playerId));
    if (pos !== "ALL") list = list.filter((p) => p.position === pos);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(needle));
    }
    const tiered = assignTiers(list);
    const tierMap = new Map(tiered.map((p) => [p.playerId, p.tier]));
    list = list.map((p) => ({ ...p, tier: tierMap.get(p.playerId) }));
    list.sort((a, b) => {
      if (sort === "adp") return a.adp - b.adp;
      return b.projPoints - a.projPoints; // proj + vorp both track proj here
    });
    return list.slice(0, 200);
  }, [players, draftedIds, pos, sort, q]);

  return (
    <Panel
      title="Available Players"
      right={
        <span className="text-xs text-silver/60">on clock: {onClockLabel}</span>
      }
    >
      <div className="p-3 flex flex-wrap gap-2 items-center border-b border-edge">
        <div className="flex gap-1">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={[
                "text-xs px-2 py-1 rounded border",
                pos === p ? "bg-kelly/20 border-kelly text-kelly"
                  : "border-edge text-silver/70 hover:text-white",
              ].join(" ")}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search player…"
            className="text-xs bg-coal2 border border-edge rounded px-2 py-1 w-36 focus:outline-none focus:border-kelly"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="text-xs bg-coal2 border border-edge rounded px-2 py-1"
          >
            <option value="proj">Sort: Proj</option>
            <option value="adp">Sort: ADP</option>
          </select>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-coal text-silver/60 text-xs">
            <tr>
              <th className="text-left font-medium px-3 py-2">Player</th>
              <th className="text-center font-medium px-2">Tier</th>
              <th className="text-right font-medium px-2">Proj</th>
              <th className="text-right font-medium px-2">ADP</th>
              <th className="px-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.playerId} className="border-t border-edge/50 hover:bg-coal2/50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <PosBadge pos={p.position} />
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-silver/60">{p.team}</span>
                    <InjuryChip status={p.injuryStatus} />
                  </div>
                </td>
                <td className="text-center text-xs text-silver/70">{p.tier ?? "-"}</td>
                <td className="text-right tabular-nums px-2">{p.projPoints.toFixed(0)}</td>
                <td className="text-right tabular-nums px-2 text-silver/70">
                  {p.adp >= 999 ? "—" : p.adp.toFixed(0)}
                </td>
                <td className="px-2 text-right">
                  <button
                    onClick={() => onLog(p.playerId)}
                    className="text-[10px] px-2 py-0.5 rounded bg-coal2 border border-edge hover:border-kelly hover:text-kelly"
                  >
                    draft
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="text-center text-silver/60 py-6 text-sm">
                No matching players.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
