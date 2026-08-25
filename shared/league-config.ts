/**
 * League Configuration — Source of Truth
 * Encoded verbatim from Project Charter Section 3 (Fiserv Goons, 2026-27).
 *
 * This file is the single source of truth for scoring + roster shape.
 * It is imported by BOTH the data pipeline (to score players) and the
 * web engine (to reason about roster need). Do not fork it.
 */

// ----------------------------------------------------------------------------
// 3.1 League Structure
// ----------------------------------------------------------------------------
export const LEAGUE = {
  name: "Fiserv Goons",
  season: 2026,
  numTeams: 12,
  draftType: "snake" as const,
  playoffStartWeek: 15,
  playoffWeeks: [15, 16, 17] as number[],
  totalRounds: 16, // 9 starters + 5 bench... actually 8 starters (1QB2RB2WR1TE2FLEX1K1DEF=10) + 5 BN = 15 roster spots
} as const;

// Roster composition: 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX (W/R/T), 1 K, 1 DEF, 5 BN
export const ROSTER_SLOTS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 2, // W/R/T
  K: 1,
  DEF: 1,
  BN: 5,
} as const;

export const FLEX_ELIGIBLE: Position[] = ["RB", "WR", "TE"];

// Total starting spots across the whole league (used for replacement-level math)
export const TOTAL_STARTERS = LEAGUE.numTeams * (
  ROSTER_SLOTS.QB + ROSTER_SLOTS.RB + ROSTER_SLOTS.WR + ROSTER_SLOTS.TE +
  ROSTER_SLOTS.FLEX + ROSTER_SLOTS.K + ROSTER_SLOTS.DEF
);

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

// ----------------------------------------------------------------------------
// 3.2 Scoring Settings (Full PPR) — every material line item from the charter
// ----------------------------------------------------------------------------
export const SCORING = {
  // Passing
  passYardsPerPoint: 25, // 0.04/yd
  passYardPoints: 0.04,
  passTD: 4,
  passTwoPt: 2,
  interceptionThrown: -1,

  // Rushing
  rushYardPoints: 0.1, // 10 yds = 1 pt
  rushTD: 6,
  rushTwoPt: 2,

  // Receiving (Full PPR)
  reception: 1,
  recYardPoints: 0.1, // 10 yds = 1 pt
  recTD: 6,
  recTwoPt: 2,

  // Misc offense
  fumbleLost: -2,
  fumbleRecoveryTD: 6,

  // Kicking (distance tiers)
  fg0to19: 3,
  fg20to29: 3,
  fg30to39: 3,
  fg40to49: 4,
  fg50to59: 5,
  fg60plus: 6,
  patMade: 1,
  fgMissed: -1,
  patMissed: -1,

  // Team Defense / Special Teams
  defTD: 6,
  defSack: 1,
  defInt: 2,
  defFumbleRecovery: 2,
  defSafety: 2,
  defForcedFumble: 1,
  defBlockedKick: 2,
  defPA0: 10,
  defPA1to6: 7,
  defPA7to13: 4,
  defPA14to20: 1,
  defPA21to27: 0, // implied neutral band
  defPA28to34: -1,
  defPA35plus: -4,

  // Special teams (player + unit)
  stTD: 6,
  stForcedFumble: 1,
  stFumbleRecovery: 1,
  stPlayerTD: 6,
  stPlayerForcedFumble: 1,
  stPlayerFumbleRecovery: 1,
} as const;

// ----------------------------------------------------------------------------
// 3.3 Confirmed Draft (Snake) Order — Round 1; even rounds reverse
// ----------------------------------------------------------------------------
export interface LeagueTeam {
  slot: number;      // draft position 1-12
  teamName: string;  // display name
  owner: string;     // @handle
  isProjectOwner?: boolean;
  isCommissioner?: boolean;
}

export const TEAMS: LeagueTeam[] = [
  { slot: 1, teamName: "Team Ben16001", owner: "@Ben16001" },
  { slot: 2, teamName: "seeyaaaaa", owner: "@siyav" },
  { slot: 3, teamName: "Team loum67", owner: "@loum67" },
  { slot: 4, teamName: "Team unspoken38", owner: "@unspoken38" },
  { slot: 5, teamName: "Team mambaujj", owner: "@mambaujj" },
  { slot: 6, teamName: "Team Neer12", owner: "@Neer12" },
  { slot: 7, teamName: "Team bennykimchi", owner: "@bennykimchi" },
  { slot: 8, teamName: "Team Greenninjaturtle44", owner: "@Greenninjaturtle44" },
  { slot: 9, teamName: "Team Atharva25", owner: "@Atharva25", isCommissioner: true },
  { slot: 10, teamName: "Team shreya04", owner: "@shreya04" },
  { slot: 11, teamName: "Team jayp671", owner: "@jayp671", isProjectOwner: true },
  { slot: 12, teamName: "Team IsaiahP32", owner: "@IsaiahP32" },
];

// ----------------------------------------------------------------------------
// Snake draft order helper
// ----------------------------------------------------------------------------
/**
 * Returns the team slot (1-12) that is on the clock for a given overall pick #.
 * Overall pick is 1-indexed. Round 1 = slots 1..12, Round 2 = 12..1, etc.
 */
export function slotOnClock(overallPick: number, numTeams: number = LEAGUE.numTeams): number {
  const round = Math.ceil(overallPick / numTeams);        // 1-indexed round
  const idxInRound = (overallPick - 1) % numTeams;        // 0-indexed within round
  // odd rounds go 1..N (left to right); even rounds reverse
  if (round % 2 === 1) {
    return idxInRound + 1;
  } else {
    return numTeams - idxInRound;
  }
}

/**
 * Returns the round number (1-indexed) for a given overall pick.
 */
export function roundForPick(overallPick: number, numTeams: number = LEAGUE.numTeams): number {
  return Math.ceil(overallPick / numTeams);
}

/**
 * Returns the list of overall pick numbers a given draft slot owns,
 * across all rounds. Useful for turn-pair lookahead (e.g. slot 11 -> 11, 14, 35, 38...).
 */
export function picksForSlot(slot: number, totalRounds: number = LEAGUE.totalRounds, numTeams: number = LEAGUE.numTeams): number[] {
  const picks: number[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const base = (round - 1) * numTeams;
    if (round % 2 === 1) {
      picks.push(base + slot);
    } else {
      picks.push(base + (numTeams - slot + 1));
    }
  }
  return picks;
}
