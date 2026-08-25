/**
 * League-specific fantasy scoring.
 * Converts a player's raw projected stat line into projected fantasy points
 * under the Fiserv Goons scoring rules (Charter Section 3.2).
 *
 * Used by the data pipeline to compute `proj_points` per player. The web app
 * reads the stored value, but this function is exported so the app can also
 * re-score on the fly if a manual stat override is entered.
 */
import { SCORING } from "./league-config";

/** Raw projected stat line for a skill-position player (season totals). */
export interface RawStatLine {
  // Passing
  passYards?: number;
  passTD?: number;
  passInt?: number;
  passTwoPt?: number;
  // Rushing
  rushYards?: number;
  rushTD?: number;
  rushTwoPt?: number;
  // Receiving
  receptions?: number;
  recYards?: number;
  recTD?: number;
  recTwoPt?: number;
  // Misc
  fumblesLost?: number;
  // Kicking
  fg0to19?: number;
  fg20to29?: number;
  fg30to39?: number;
  fg40to49?: number;
  fg50to59?: number;
  fg60plus?: number;
  patMade?: number;
  fgMissed?: number;
  patMissed?: number;
  // Team DEF/ST (season totals)
  defTD?: number;
  defSacks?: number;
  defInt?: number;
  defFumbleRec?: number;
  defSafety?: number;
  defForcedFumble?: number;
  defBlockedKick?: number;
  // Points-allowed is game-by-game; pipeline pre-aggregates into an expected
  // per-season points value in `defPointsAllowedPoints` to keep this pure.
  defPointsAllowedPoints?: number;
}

const n = (v: number | undefined) => v ?? 0;

/**
 * Compute total projected fantasy points for a raw stat line.
 * Pure function — no I/O, fully unit-testable.
 */
export function scoreStatLine(s: RawStatLine): number {
  let pts = 0;

  // Passing
  pts += n(s.passYards) * SCORING.passYardPoints;
  pts += n(s.passTD) * SCORING.passTD;
  pts += n(s.passInt) * SCORING.interceptionThrown;
  pts += n(s.passTwoPt) * SCORING.passTwoPt;

  // Rushing
  pts += n(s.rushYards) * SCORING.rushYardPoints;
  pts += n(s.rushTD) * SCORING.rushTD;
  pts += n(s.rushTwoPt) * SCORING.rushTwoPt;

  // Receiving (Full PPR)
  pts += n(s.receptions) * SCORING.reception;
  pts += n(s.recYards) * SCORING.recYardPoints;
  pts += n(s.recTD) * SCORING.recTD;
  pts += n(s.recTwoPt) * SCORING.recTwoPt;

  // Misc offense
  pts += n(s.fumblesLost) * SCORING.fumbleLost;

  // Kicking
  pts += n(s.fg0to19) * SCORING.fg0to19;
  pts += n(s.fg20to29) * SCORING.fg20to29;
  pts += n(s.fg30to39) * SCORING.fg30to39;
  pts += n(s.fg40to49) * SCORING.fg40to49;
  pts += n(s.fg50to59) * SCORING.fg50to59;
  pts += n(s.fg60plus) * SCORING.fg60plus;
  pts += n(s.patMade) * SCORING.patMade;
  pts += n(s.fgMissed) * SCORING.fgMissed;
  pts += n(s.patMissed) * SCORING.patMissed;

  // Team DEF / ST
  pts += n(s.defTD) * SCORING.defTD;
  pts += n(s.defSacks) * SCORING.defSack;
  pts += n(s.defInt) * SCORING.defInt;
  pts += n(s.defFumbleRec) * SCORING.defFumbleRecovery;
  pts += n(s.defSafety) * SCORING.defSafety;
  pts += n(s.defForcedFumble) * SCORING.defForcedFumble;
  pts += n(s.defBlockedKick) * SCORING.defBlockedKick;
  pts += n(s.defPointsAllowedPoints);

  return Math.round(pts * 10) / 10; // one decimal
}

/**
 * Helper: convert a game-by-game points-allowed distribution into expected
 * season points using the charter's PA tiers. `paGames` is an array of
 * points-allowed values (one per projected game).
 */
export function pointsAllowedToPoints(paGames: number[]): number {
  let total = 0;
  for (const pa of paGames) {
    if (pa === 0) total += SCORING.defPA0;
    else if (pa <= 6) total += SCORING.defPA1to6;
    else if (pa <= 13) total += SCORING.defPA7to13;
    else if (pa <= 20) total += SCORING.defPA14to20;
    else if (pa <= 27) total += SCORING.defPA21to27;
    else if (pa <= 34) total += SCORING.defPA28to34;
    else total += SCORING.defPA35plus;
  }
  return total;
}
