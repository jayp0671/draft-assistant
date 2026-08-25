import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, SUPABASE_ENABLED, DRAFT_ID, getSessionId } from "@/lib/supabase";
import type { PickRow, ClaimRow } from "@/lib/types";
import { TEAMS, roundForPick } from "@shared/league-config";

const RESET_PASSWORD = "GO.BIRDS.DH";

export interface UseDraft {
  picks: PickRow[];
  claims: ClaimRow[];
  loading: boolean;
  online: boolean;
  mySlot: number | null;
  claimTeam: (slot: number) => Promise<void>;
  releaseTeam: (slot: number) => Promise<void>;
  logPick: (teamSlot: number, playerId: string) => Promise<string | null>;
  undoLastPick: () => Promise<string | null>;
  removePick: (overallPick: number) => Promise<void>;
  resetDraft: (password: string) => Promise<string | null>;
}

const seedClaims: ClaimRow[] = TEAMS.map((t) => ({
  draft_id: DRAFT_ID,
  team_slot: t.slot,
  team_name: t.teamName,
  owner: t.owner,
  session_id: null,
  claimed_at: null,
}));

export function useDraft(): UseDraft {
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>(seedClaims);
  const [loading, setLoading] = useState(true);
  const [mySlot, setMySlot] = useState<number | null>(null);
  const sessionId = useRef(getSessionId());

  // Keep a live ref to picks so callbacks never act on a stale closure.
  const picksRef = useRef<PickRow[]>([]);
  useEffect(() => { picksRef.current = picks; }, [picks]);

  async function refetchPicks() {
    if (!supabase) return;
    const { data } = await supabase.from("picks").select("*")
      .eq("draft_id", DRAFT_ID).order("overall_pick");
    if (data) setPicks(data as PickRow[]);
  }
  async function refetchClaims() {
    if (!supabase) return;
    const { data } = await supabase.from("team_claims").select("*")
      .eq("draft_id", DRAFT_ID).order("team_slot");
    if (data) setClaims(data as ClaimRow[]);
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!SUPABASE_ENABLED || !supabase) { setLoading(false); return; }
      const [{ data: pk }, { data: cl }] = await Promise.all([
        supabase.from("picks").select("*").eq("draft_id", DRAFT_ID).order("overall_pick"),
        supabase.from("team_claims").select("*").eq("draft_id", DRAFT_ID).order("team_slot"),
      ]);
      if (cancelled) return;
      if (pk) setPicks(pk as PickRow[]);
      if (cl && cl.length) setClaims(cl as ClaimRow[]);
      const mine = (cl as ClaimRow[] | null)?.find((c) => c.session_id === sessionId.current);
      if (mine) setMySlot(mine.team_slot);
      setLoading(false);

      const chan = supabase
        .channel("draft-" + DRAFT_ID)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "picks", filter: `draft_id=eq.${DRAFT_ID}` },
          () => refetchPicks())
        .on("postgres_changes",
          { event: "*", schema: "public", table: "team_claims", filter: `draft_id=eq.${DRAFT_ID}` },
          () => refetchClaims())
        .subscribe();
      return () => { supabase!.removeChannel(chan); };
    }
    const cleanup = init();
    return () => { cancelled = true; cleanup.then?.((fn) => fn && fn()); };
  }, []);

  const claimTeam = useCallback(async (slot: number) => {
    setMySlot(slot);
    if (!SUPABASE_ENABLED || !supabase) {
      setClaims((cs) => cs.map((c) => c.team_slot === slot ? { ...c, session_id: sessionId.current } : c));
      return;
    }
    await supabase.from("team_claims")
      .update({ session_id: sessionId.current, claimed_at: new Date().toISOString() })
      .eq("draft_id", DRAFT_ID).eq("team_slot", slot);
    await refetchClaims();
  }, []);

  const releaseTeam = useCallback(async (slot: number) => {
    setMySlot((s) => (s === slot ? null : s));
    if (!SUPABASE_ENABLED || !supabase) {
      setClaims((cs) => cs.map((c) => c.team_slot === slot ? { ...c, session_id: null } : c));
      return;
    }
    await supabase.from("team_claims")
      .update({ session_id: null, claimed_at: null })
      .eq("draft_id", DRAFT_ID).eq("team_slot", slot);
    await refetchClaims();
  }, []);

  const logPick = useCallback(async (teamSlot: number, playerId: string): Promise<string | null> => {
    const overall = picksRef.current.length + 1;
    const round = roundForPick(overall);
    const row: Omit<PickRow, "id" | "created_at"> = {
      draft_id: DRAFT_ID, overall_pick: overall, round, team_slot: teamSlot,
      player_id: playerId, logged_by: sessionId.current,
    };
    if (!SUPABASE_ENABLED || !supabase) {
      setPicks((ps) => [...ps, { ...row, id: Date.now(), created_at: new Date().toISOString() }]);
      return null;
    }
    const { error } = await supabase.from("picks").insert(row);
    if (error) {
      await refetchPicks();
      return (error.message.includes("duplicate") || (error as any).code === "23505")
        ? "That player is already drafted, or the pick number was just taken. Board refreshed - try again."
        : error.message;
    }
    await refetchPicks();
    return null;
  }, []);

  const removePick = useCallback(async (overallPick: number) => {
    if (!SUPABASE_ENABLED || !supabase) {
      setPicks((ps) => ps.filter((p) => p.overall_pick !== overallPick)
        .map((p, i) => ({ ...p, overall_pick: i + 1, round: roundForPick(i + 1) })));
      return;
    }
    await supabase.from("picks").delete().eq("draft_id", DRAFT_ID).eq("overall_pick", overallPick);
    await refetchPicks();
  }, []);

  const undoLastPick = useCallback(async (): Promise<string | null> => {
    const cur = picksRef.current;
    if (cur.length === 0) return "No picks to undo.";
    const last = cur.reduce((a, b) => (b.overall_pick > a.overall_pick ? b : a), cur[0]);
    if (!SUPABASE_ENABLED || !supabase) {
      setPicks((ps) => ps.filter((p) => p.overall_pick !== last.overall_pick));
      return null;
    }
    const { error } = await supabase.from("picks")
      .delete().eq("draft_id", DRAFT_ID).eq("overall_pick", last.overall_pick);
    if (error) { await refetchPicks(); return error.message; }
    await refetchPicks();
    return null;
  }, []);

  const resetDraft = useCallback(async (password: string): Promise<string | null> => {
    if (password !== RESET_PASSWORD) return "Incorrect password.";
    if (!SUPABASE_ENABLED || !supabase) {
      setPicks([]);
      setClaims((cs) => cs.map((c) => ({ ...c, session_id: null, claimed_at: null })));
      setMySlot(null);
      return null;
    }
    const { error: e1 } = await supabase.from("picks").delete().eq("draft_id", DRAFT_ID);
    if (e1) return e1.message;
    const { error: e2 } = await supabase.from("team_claims")
      .update({ session_id: null, claimed_at: null }).eq("draft_id", DRAFT_ID);
    if (e2) return e2.message;
    setMySlot(null);
    await Promise.all([refetchPicks(), refetchClaims()]);
    return null;
  }, []);

  return {
    picks, claims, loading, online: SUPABASE_ENABLED, mySlot,
    claimTeam, releaseTeam, logPick, undoLastPick, removePick, resetDraft,
  };
}
