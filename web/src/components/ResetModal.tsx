import { useState } from "react";

interface Props {
  onReset: (password: string) => Promise<string | null>;
  onClose: () => void;
}

export default function ResetModal({ onReset, onClose }: Props) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setErr(null);
    const e = await onReset(pw);
    setBusy(false);
    if (e) { setErr(e); return; }
    setDone(true);
    setTimeout(onClose, 900);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-bad/40 bg-coal shadow-glow"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h3 className="font-display font-bold uppercase tracking-wider text-bad">Reset draft</h3>
          <button onClick={onClose} className="text-silver/60 hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-3">
          {done ? (
            <div className="text-good text-sm font-semibold text-center py-4">
              ✓ Draft reset. Board cleared.
            </div>
          ) : (
            <>
              <p className="text-xs text-silver/70">
                This clears <span className="text-white font-semibold">all picks</span> and releases
                every team claim. This cannot be undone. Enter the password to confirm.
              </p>
              <input
                type="password"
                autoFocus
                value={pw}
                onChange={(e) => { setPw(e.target.value); setErr(null); }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="password"
                className="w-full bg-coal2 border border-edge rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-bad"
              />
              {err && <div className="text-xs text-bad">{err}</div>}
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={onClose}
                  className="text-xs px-3 py-2 rounded-lg border border-edge text-silver/80 hover:text-white">
                  Cancel
                </button>
                <button onClick={submit} disabled={busy || !pw}
                  className="text-xs font-bold px-4 py-2 rounded-lg bg-bad text-white hover:brightness-110 disabled:opacity-50">
                  {busy ? "Resetting…" : "Reset draft"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
