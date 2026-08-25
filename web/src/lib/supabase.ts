import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when Supabase is configured; when false the app runs in offline/local
 *  mode using the bundled players.json and in-memory draft state. */
export const SUPABASE_ENABLED = Boolean(url && anon);

export const supabase = SUPABASE_ENABLED
  ? createClient(url!, anon!, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

/** The single shared draft session id (see supabase/migrations/0002_seed.sql). */
export const DRAFT_ID = "00000000-0000-0000-0000-000000000001";

/** Stable per-browser session id used for team claims + pick attribution. */
export function getSessionId(): string {
  const KEY = "fg_session_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}
