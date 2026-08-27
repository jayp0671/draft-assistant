import { useMemo, useState } from "react";
import type { Player } from "@shared/engine";
import { slotOnClock, TEAMS } from "@shared/league-config";
import type { PickRow } from "@/lib/types";
import { PosBadge } from "./ui";

interface Props {
  players: Player[];
  picks: PickRow[];
  onLog: (teamSlot: number, playerId: string) => Promise<string | null>;
  onClose: () => void;
}

export default function LogPick({ players, picks, onLog, onClose }: Props) {
  const overall = picks.length + 1;
  const defaultSlot = slotOnClock(overall);
  const [slot, setSlot] = useState(defaultSlot);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const draftedIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);
  const results = useMemo(() => {
    const needle = q.toLowerCase().trim();
    if (!needle) return [];
    return players
      .filter((p) => !draftedIds.has(p.playerId) && p.name.toLowerCase().includes(needle))
      .sort((a, b) => b.projPoints - a.projPoints)
      .slice(0, 12);
  }, [q, players, draftedIds]);

  async function pick(playerId: string) {
    const e = await onLog(slot, playerId);
    if (e) setErr(e);
    else onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-edge bg-coal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h3 className="font-display font-bold uppercase tracking-wider">Log pick #{overall}</h3>
          <button onClick={onClose} className="text-silver/60 hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-silver/70">Team making this pick</label>
            <select
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
              className="w-full mt-1 bg-coal2 border border-edge rounded px-3 py-2 text-sm"
            >
              {TEAMS.map((t) => (
                <option key={t.slot} value={t.slot}>
                  #{t.slot} — {t.teamName}{t.slot === defaultSlot ? " (on clock)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-silver/70">Player selected</label>
            <input
              autoFocus
              value={q}
              onChange={(e) => { setQ(e.target.value); setErr(null); }}
              placeholder="type a player name…"
              className="w-full mt-1 bg-coal2 border border-edge rounded px-3 py-2 text-sm focus:outline-none focus:border-kelly"
            />
          </div>
          {err && <div className="text-xs text-bad">{err}</div>}
          <ul className="max-h-64 overflow-y-auto divide-y divide-edge/50">
            {results.map((p) => (
              <li key={p.playerId}>
                <button
                  onClick={() => pick(p.playerId)}
                  className="w-full text-left flex items-center gap-2 px-2 py-2 hover:bg-coal2 rounded"
                >
                  <PosBadge pos={p.position} />
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs text-silver/60">{p.team}</span>
                  <span className="text-xs text-silver/70 ml-auto">
                    {p.projPoints.toFixed(0)} pts · ADP {p.adp >= 999 ? "—" : p.adp.toFixed(0)}
                  </span>
                </button>
              </li>
            ))}
            {q && results.length === 0 && (
              <li className="text-center text-silver/60 text-sm py-4">No available players match.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
