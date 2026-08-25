import { supabase, SUPABASE_ENABLED } from "@/lib/supabase";
import { toEnginePlayer } from "@/lib/types";
import type { Player } from "@shared/engine";

/**
 * Load the frozen player dataset.
 * Priority: Supabase `players` table -> bundled local players.json fallback.
 * The fallback guarantees the app still functions on draft day even if the
 * network / Supabase is unavailable (Charter risk mitigation).
 */
export async function loadPlayers(): Promise<Player[]> {
  if (SUPABASE_ENABLED && supabase) {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("proj_points", { ascending: false })
        .limit(2000);
      if (error) throw error;
      if (data && data.length) return data.map(toEnginePlayer);
    } catch (e) {
      console.warn("[adapter] Supabase player load failed, using local fallback", e);
    }
  }
  // local fallback (may be empty until pipeline has been run)
  try {
    const local = (await import("@/data/players.json")).default as any[];
    return local.map(toEnginePlayer);
  } catch {
    return [];
  }
}
