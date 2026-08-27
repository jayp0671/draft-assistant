import { useEffect, useState } from "react";
import type { Player } from "@shared/engine";
import { slotOnClock, TEAMS } from "@shared/league-config";
import { loadPlayers } from "@/engine/adapter";
import { useDraft } from "@/hooks/useDraft";
import TeamClaim from "@/components/TeamClaim";
import DraftBoard from "@/components/DraftBoard";
import Recommendations from "@/components/Recommendations";
import PlayerBoard from "@/components/PlayerBoard";
import MyRoster from "@/components/MyRoster";
import LogPick from "@/components/LogPick";
import ResetModal from "@/components/ResetModal";

export default function App() {
  const draft = useDraft();
  const [players, setPlayers] = useState<Player[]>([]);
  const [entered, setEntered] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!entered) {
    return (
      <TeamClaim
        claims={draft.claims}
        mySlot={draft.mySlot}
        onClaim={draft.claimTeam}
        onEnter={() => setEntered(true)}
      />
    );
  }

  const overall = draft.picks.length + 1;
  const onClockSlot = slotOnClock(overall);
  const onClockLabel = TEAMS.find((t) => t.slot === onClockSlot)?.teamName ?? `Slot ${onClockSlot}`;

  const quickLog = async (teamSlot: number, playerId: string) => {
    const err = await draft.logPick(teamSlot, playerId);
    if (err) setToast(err);
  };
  const doUndo = async () => {
    const err = await draft.undoLastPick();
    if (err) setToast(err);
  };

  return (
    <div className="min-h-screen">
      {/* top bar */}
      <header className="border-b border-edge bg-coal/85 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🦅</span>
            <span className="font-display font-bold text-lg uppercase tracking-wider">Fiserv Goons</span>
            <span className="text-[11px] font-display text-silver/50 uppercase tracking-[0.15em]">Draft Assistant</span>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
            draft.online ? "border-good/40 text-good bg-good/5" : "border-warn/40 text-warn bg-warn/5"
          }`}>
            {draft.online ? "live · synced" : "offline · local"}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-silver/60">{players.length} players</span>
            <button
              onClick={() => setShowLog(true)}
              className="text-sm px-3 py-1.5 rounded-lg bg-kelly text-charcoal font-bold hover:brightness-110"
            >
              + Log pick
            </button>
            <button
              onClick={doUndo}
              disabled={draft.picks.length === 0}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-edge text-silver/80 hover:text-white hover:border-silver/40 disabled:opacity-40"
            >
              Undo
            </button>
            <button
              onClick={() => setShowReset(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-bad/40 text-bad/90 hover:bg-bad/10"
            >
              Reset
            </button>
            <button
              onClick={() => setEntered(false)}
              className="text-[11px] text-silver/50 hover:text-white"
            >
              change team
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Recommendations
            players={players}
            picks={draft.picks}
            mySlot={draft.mySlot}
            onQuickLog={quickLog}
          />
          <PlayerBoard
            players={players}
            picks={draft.picks}
            onClockLabel={onClockLabel}
            onLog={(playerId) => quickLog(onClockSlot, playerId)}
          />
        </div>
        <div className="space-y-4">
          <DraftBoard players={players} picks={draft.picks} onUndoLast={doUndo} />
          <MyRoster players={players} picks={draft.picks} mySlot={draft.mySlot} />
        </div>
      </main>

      {showLog && (
        <LogPick
          players={players}
          picks={draft.picks}
          onLog={draft.logPick}
          onClose={() => setShowLog(false)}
        />
      )}
      {showReset && (
        <ResetModal onReset={draft.resetDraft} onClose={() => setShowReset(false)} />
      )}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-coal2 border border-bad/40 text-sm text-white px-4 py-2 rounded-lg shadow-glow">
          {toast}
        </div>
      )}
    </div>
  );
}
