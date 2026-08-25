import type { Position } from "@shared/engine";

const POS_COLORS: Record<Position, string> = {
  QB: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  RB: "bg-kelly/15 text-kelly border-kelly/40",
  WR: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  TE: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  K: "bg-slate-400/15 text-slate-300 border-slate-400/30",
  DEF: "bg-violet-400/15 text-violet-300 border-violet-400/30",
};

export function PosBadge({ pos }: { pos: Position }) {
  return (
    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${POS_COLORS[pos]}`}>
      {pos}
    </span>
  );
}

export function InjuryChip({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const color = s.includes("out") || s.includes("ir")
    ? "text-bad" : s.includes("doubt") ? "text-warn" : "text-silver";
  return <span className={`text-[10px] font-semibold uppercase ${color}`}>{status}</span>;
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
            <h2 className="font-bold text-sm tracking-wide text-silver uppercase flex items-center gap-2">
              {accent && <span className="h-3 w-1 rounded bg-kelly" />}
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

/** A single labeled stat cell for the clean stat strip. */
export function Stat({ label, value, tone = "default" }: {
  label: string; value: React.ReactNode; tone?: "default" | "good" | "warn" | "bad" | "accent";
}) {
  const toneClass = {
    default: "text-white",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
    accent: "text-kelly",
  }[tone];
  return (
    <div className="flex flex-col items-center px-2">
      <span className={`text-sm font-bold tabular-nums leading-none ${toneClass}`}>{value}</span>
      <span className="text-[9px] uppercase tracking-wider text-silver/60 mt-1">{label}</span>
    </div>
  );
}
