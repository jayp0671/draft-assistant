/**
 * 2026 NFL schedule facts used for draft-day decisions.
 * Bye weeks confirmed from the released 2026 schedule (all 32 teams).
 * Playoff weeks for this league: 15-17 (Charter 3.1).
 */

// Team abbreviations follow Sleeper/nflverse convention.
export const BYE_WEEKS_2026: Record<string, number> = {
  KC: 5, CAR: 5,
  MIA: 6, CIN: 6, DET: 6, MIN: 6,
  BUF: 7, LAC: 7, WAS: 7, JAX: 7,
  NYG: 8, NO: 8, SF: 8, HOU: 8,
  TEN: 9, PIT: 9,
  DEN: 10, PHI: 10, CHI: 10, TB: 10,
  NE: 11, CLE: 11, SEA: 11, GB: 11, ATL: 11, LAR: 11,
  IND: 13, NYJ: 13, LV: 13, BAL: 13,
  DAL: 14, ARI: 14,
};

export const PLAYOFF_WEEKS = [15, 16, 17];

export function byeWeekFor(team: string | null | undefined): number | undefined {
  if (!team) return undefined;
  return BYE_WEEKS_2026[team.toUpperCase()];
}

/**
 * Do two players share a bye week? Used to warn against stacking byes at a
 * single position (Charter 6.4 bye-week conflict flag).
 */
export function sharesBye(a?: number, b?: number): boolean {
  return !!a && !!b && a === b;
}
