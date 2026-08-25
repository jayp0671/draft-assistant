import type { ClaimRow } from "@/lib/types";
import { TEAMS } from "@shared/league-config";

interface Props {
  claims: ClaimRow[];
  mySlot: number | null;
  onClaim: (slot: number) => void;
  onEnter: () => void;
}

export default function TeamClaim({ claims, mySlot, onClaim, onEnter }: Props) {
  const claimBySlot = new Map(claims.map((c) => [c.team_slot, c]));

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-kelly font-semibold tracking-wide text-sm mb-2">
            <span className="h-2 w-2 rounded-full bg-kelly animate-pulse" /> LIVE DRAFT ROOM
          </div>
          <h1 className="text-4xl font-extrabold">Fiserv Goons — Draft Assistant</h1>
          <p className="text-silver/70 mt-2">
            12-team full-PPR snake draft · pick your team to enter the shared room
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TEAMS.map((t) => {
            const claim = claimBySlot.get(t.slot);
            const takenByOther = claim?.session_id && mySlot !== t.slot;
            const isMine = mySlot === t.slot;
            return (
              <button
                key={t.slot}
                onClick={() => onClaim(t.slot)}
                className={[
                  "text-left rounded-xl border p-3 transition",
                  isMine
                    ? "border-kelly bg-midnight/20 ring-1 ring-kelly"
                    : takenByOther
                    ? "border-edge bg-coal/60 opacity-60"
                    : "border-edge bg-coal hover:border-kelly/60 hover:bg-coal2",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-silver/60">#{t.slot}</span>
                  {t.isProjectOwner && (
                    <span className="text-[10px] font-bold text-kelly">YOU</span>
                  )}
                  {t.isCommissioner && (
                    <span className="text-[10px] font-bold text-warn">COMM</span>
                  )}
                </div>
                <div className="font-semibold mt-1 truncate">{t.teamName}</div>
                <div className="text-xs text-silver/70 truncate">{t.owner}</div>
                {takenByOther && (
                  <div className="text-[10px] text-silver/60 mt-1">claimed</div>
                )}
                {isMine && (
                  <div className="text-[10px] text-kelly mt-1">✓ your team</div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            disabled={mySlot == null}
            onClick={onEnter}
            className={[
              "px-8 py-3 rounded-xl font-semibold transition",
              mySlot == null
                ? "bg-coal2 text-silver/60 cursor-not-allowed"
                : "bg-kelly text-charcoal hover:brightness-110",
            ].join(" ")}
          >
            {mySlot == null ? "Select your team" : "Enter draft room →"}
          </button>
          <p className="text-xs text-silver/60 text-center max-w-md">
            Anyone can log any team's pick during the draft. Selecting your team
            just tailors the on-clock recommendations to your roster.
          </p>
        </div>
      </div>
    </div>
  );
}
