import type { Position, Player } from "@shared/engine";

/** Row shape of public.players in Supabase. */
export interface PlayerRow {
  player_id: string;
  name: string;
  position: Position;
  team: string | null;
  proj_points: number;
  adp: number;
  injury_status: string | null;
  usage_trend: number | null;
  is_rookie: boolean | null;
  bye_week: number | null;
  playoff_sos: number | null;
  target_share: number | null;
  depth_chart_order: number | null;
  games_missed_2y: number | null;
  draft_round: number | null;
  draft_pick: number | null;
  fp_ecr: number | null;
  ffc_adp: number | null;
  adp_confidence: "high" | "low" | null;
  adp_spread: number | null;
  career_trend: "rising" | "stable" | "declining" | null;
  career_trend_pct: number | null;
  recency_ppg: number | null;
}

export interface PickRow {
  id: number;
  draft_id: string;
  overall_pick: number;
  round: number;
  team_slot: number;
  player_id: string;
  logged_by: string | null;
  created_at: string;
}

export interface ClaimRow {
  draft_id: string;
  team_slot: number;
  team_name: string;
  owner: string | null;
  session_id: string | null;
  claimed_at: string | null;
}

/** Convert a DB player row (or local players.json shape) into engine Player.
 *  Accepts both snake_case (DB) and camelCase (json fallback). */
export function toEnginePlayer(r: any): Player {
  return {
    playerId: r.player_id ?? r.playerId,
    name: r.name,
    position: r.position,
    team: r.team ?? "FA",
    projPoints: Number(r.proj_points ?? r.projPoints ?? 0),
    adp: Number(r.adp ?? 999),
    injuryStatus: r.injury_status ?? r.injuryStatus ?? undefined,
    usageTrend: r.usage_trend ?? r.usageTrend ?? undefined,
    isRookie: r.is_rookie ?? r.isRookie ?? undefined,
    byeWeek: r.bye_week ?? r.byeWeek ?? undefined,
    playoffSos: r.playoff_sos ?? r.playoffSos ?? undefined,
    targetShare: r.target_share ?? r.targetShare ?? undefined,
    depthChartOrder: r.depth_chart_order ?? r.depthChartOrder ?? undefined,
    gamesMissed2y: r.games_missed_2y ?? r.gamesMissed2y ?? undefined,
    draftRound: r.draft_round ?? r.draftRound ?? undefined,
    draftPick: r.draft_pick ?? r.draftPick ?? undefined,
    fpEcr: r.fp_ecr ?? r.fpEcr ?? undefined,
    ffcAdp: r.ffc_adp ?? r.ffcAdp ?? undefined,
    adpConfidence: r.adp_confidence ?? r.adpConfidence ?? undefined,
    adpSpread: r.adp_spread ?? r.adpSpread ?? undefined,
    careerTrend: r.career_trend ?? r.careerTrend ?? undefined,
    careerTrendPct: r.career_trend_pct ?? r.careerTrendPct ?? undefined,
    recencyPpg: r.recency_ppg ?? r.recencyPpg ?? undefined,
  };
}
