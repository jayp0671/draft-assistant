import type { Position } from "@shared/engine";

const POS_COLORS: Record<Position, string> = {
  QB: "bg-rose-500/15 text-rose-300 border-rose-400/40",
  RB: "bg-kelly/15 text-kelly border-kelly/40",
  WR: "bg-sky-400/15 text-sky-300 border-sky-400/40",
  TE: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  K: "bg-slate-400/15 text-slate-300 border-slate-400/40",
  DEF: "bg-violet-400/15 text-violet-300 border-violet-400/40",
};

export function PosBadge({ pos }: { pos: Position }) {
  return (
    <span className={`pos-patch inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${POS_COLORS[pos]}`}>
      {pos}
    </span>
  );
}

export function InjuryChip({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const color = s.includes("out") || s.includes("ir")
    ? "text-bad" : s.includes("doubt") ? "text-warn" : "text-silver";
  return <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{status}</span>;
}

export function Panel({ title, right, children, className = "", accent = false }: {
  title?: string; right?: React.ReactNode; children: React.ReactNode;
  className?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border ${accent ? "border-kelly/30 shadow-glow" : "border-edge"} bg-coal/80 backdrop-blur ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          {title && (
            <h2 className="font-display font-bold text-sm uppercase tracking-widest text-silver flex items-center gap-2">
              {accent && <span className="h-4 w-1 rounded-sm bg-kelly" />}
              {title}
            </h2>
          )}
          {right}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

/** Scoreboard-style stat tile — the signature visual element. */
export function Stat({ label, value, accent = false }: {
  label: string; value: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`stat-tile ${accent ? "stat-tile-accent" : ""} flex flex-col items-center justify-center px-2.5 py-1.5 min-w-[44px]`}>
      <span className={`font-mono text-sm font-bold tabular-nums leading-none ${accent ? "text-kellybright" : "text-white"}`}>
        {value}
      </span>
      <span className="text-[8px] font-display uppercase tracking-[0.12em] text-silver/50 mt-1">
        {label}
      </span>
    </div>
  );
}
