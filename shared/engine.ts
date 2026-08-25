/**
 * Recommendation Engine — Value-Based Drafting (VORP)
 * Implements Charter Section 6.3 + strategic guardrails from Section 4.2.
 *
 * This is a PURE function of (players, draftState, teamSlot). No I/O, no
 * globals, no time dependence — so it is deterministic and unit-testable,
 * and can run identically on the server or client.
 */
import {
  LEAGUE,
  ROSTER_SLOTS,
  FLEX_ELIGIBLE,
  Position,
  picksForSlot,
  slotOnClock,
  roundForPick,
} from "./league-config";

export type { Position } from "./league-config";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface Player {
  playerId: string;       // universal join id (sleeper id)
  name: string;
  position: Position;
  team: string;           // NFL team abbr, or "FA"
  projPoints: number;     // league-scored projected season points
  adp: number;            // average draft position (overall pick number)
  injuryStatus?: string;  // e.g. "Questionable", "IR", "Out", null
  usageTrend?: number;    // -1..+1 (declining..rising), optional
  isRookie?: boolean;
  byeWeek?: number;
  playoffSos?: number;    // 0..1, higher = easier playoff schedule (wks 15-17)
  tier?: number;          // positional tier, filled by engine if absent
  // enrichment fields (optional; surfaced in UI, not required by math)
  targetShare?: number;   // 0..1 season target share (WR/TE/RB)
  depthChartOrder?: number; // 1 = starter, 2 = backup, ...
  gamesMissed2y?: number; // games missed over last 2 seasons (durability)
  draftRound?: number;    // NFL draft round (rookies)
  draftPick?: number;     // NFL draft overall pick (rookies)
  fpEcr?: number;         // FantasyPros expert consensus rank (backup ADP)
}

export interface DraftPick {
  overallPick: number;    // 1-indexed
  teamSlot: number;       // which of the 12 slots made it
  playerId: string;
}

export interface DraftState {
  picks: DraftPick[];     // all picks made so far, in order
  numTeams: number;
  totalRounds: number;
}

export interface RosterNeed {
  QB: number; RB: number; WR: number; TE: number; K: number; DEF: number;
  FLEX: number;           // remaining flex slots not yet notionally filled
  BN: number;             // remaining bench
}

export interface Recommendation {
  player: Player;
  vorp: number;           // value over replacement (raw)
  score: number;          // final ranking score after need + scarcity weighting
  reasons: string[];      // plain-language explanation (Charter 6.3)
  fillsNeed: boolean;
  adpValue: number;       // (adp - currentPick): positive = falling/value
}

// ----------------------------------------------------------------------------
// Replacement-level baselines
// ----------------------------------------------------------------------------
/**
 * Compute the replacement-level baseline projected-points for each position,
 * given the pool of still-available players AND the league's starting demand.
 *
 * Baseline = projected points of the "last starter-quality" player at that
 * position. FLEX demand (RB/WR/TE) is distributed across those positions in
 * proportion to how often each is rostered in flex — a standard VBD approach.
 */
export function computeBaselines(availableByPos: Record<Position, Player[]>): Record<Position, number> {
  const t = LEAGUE.numTeams;

  // Dedicated starter demand per position across the league
  const dedicated: Record<Position, number> = {
    QB: t * ROSTER_SLOTS.QB,
    RB: t * ROSTER_SLOTS.RB,
    WR: t * ROSTER_SLOTS.WR,
    TE: t * ROSTER_SLOTS.TE,
    K: t * ROSTER_SLOTS.K,
    DEF: t * ROSTER_SLOTS.DEF,
  };

  // FLEX demand split across eligible positions.
  // Empirically flex skews heavily RB/WR; use 45/45/10 RB/WR/TE.
  const flexTotal = t * ROSTER_SLOTS.FLEX;
  const flexSplit: Partial<Record<Position, number>> = {
    RB: flexTotal * 0.45,
    WR: flexTotal * 0.45,
    TE: flexTotal * 0.10,
  };

  const baselines = {} as Record<Position, number>;
  (Object.keys(dedicated) as Position[]).forEach((pos) => {
    const demand = Math.round(dedicated[pos] + (flexSplit[pos] ?? 0));
    const pool = availableByPos[pos] ?? [];
    // sort desc by projected points
    const sorted = [...pool].sort((a, b) => b.projPoints - a.projPoints);
    // baseline is the player right at the replacement line (demand-th best).
    // if fewer players than demand remain, use the worst available (scarcity spike).
    const idx = Math.min(demand, sorted.length) - 1;
    baselines[pos] = idx >= 0 && sorted[idx] ? sorted[idx].projPoints : 0;
  });

  return baselines;
}

// ----------------------------------------------------------------------------
// Roster need
// ----------------------------------------------------------------------------
/**
 * Given the picks a team has already made, compute remaining roster needs.
 * FLEX is consumed only after dedicated RB/WR/TE slots are satisfied.
 */
export function computeRosterNeed(myPlayers: Player[]): RosterNeed {
  const need: RosterNeed = {
    QB: ROSTER_SLOTS.QB, RB: ROSTER_SLOTS.RB, WR: ROSTER_SLOTS.WR,
    TE: ROSTER_SLOTS.TE, K: ROSTER_SLOTS.K, DEF: ROSTER_SLOTS.DEF,
    FLEX: ROSTER_SLOTS.FLEX, BN: ROSTER_SLOTS.BN,
  };

  for (const p of myPlayers) {
    const pos = p.position;
    if (pos === "QB" && need.QB > 0) need.QB--;
    else if (pos === "K" && need.K > 0) need.K--;
    else if (pos === "DEF" && need.DEF > 0) need.DEF--;
    else if (pos === "RB" && need.RB > 0) need.RB--;
    else if (pos === "WR" && need.WR > 0) need.WR--;
    else if (pos === "TE" && need.TE > 0) need.TE--;
    else if (FLEX_ELIGIBLE.includes(pos) && need.FLEX > 0) need.FLEX--;
    else if (need.BN > 0) need.BN--;
  }
  return need;
}

/** Does drafting this position fill a current STARTING need (dedicated or flex)? */
function fillsStartingNeed(pos: Position, need: RosterNeed): boolean {
  if (pos === "QB") return need.QB > 0;
  if (pos === "RB") return need.RB > 0 || need.FLEX > 0;
  if (pos === "WR") return need.WR > 0 || need.FLEX > 0;
  if (pos === "TE") return need.TE > 0 || need.FLEX > 0;
  if (pos === "K") return need.K > 0;
  if (pos === "DEF") return need.DEF > 0;
  return false;
}

// ----------------------------------------------------------------------------
// Tiering — group players within a position by projected-points gaps
// ----------------------------------------------------------------------------
/**
 * Assign tier numbers within each position. A new tier starts when the gap
 * to the next player exceeds `gapThreshold` (points). Charter 4.2: "draft by
 * tier, not rank — take the last player in a tier before it breaks."
 */
export function assignTiers(players: Player[], gapThreshold = 15): Player[] {
  const byPos: Record<string, Player[]> = {};
  for (const p of players) {
    (byPos[p.position] ??= []).push(p);
  }
  const out: Player[] = [];
  for (const pos of Object.keys(byPos)) {
    const sorted = byPos[pos].sort((a, b) => b.projPoints - a.projPoints);
    let tier = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i - 1].projPoints - sorted[i].projPoints > gapThreshold) {
        tier++;
      }
      out.push({ ...sorted[i], tier });
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Strategic guardrails (Charter 4.2)
// ----------------------------------------------------------------------------
/**
 * Positional draft-round guardrails. Returns a multiplier applied to score.
 * - QB deferred until ~round 6 unless elite (top of position).
 * - K/DEF strongly deferred until the final ~2 rounds.
 */
function positionalRoundMultiplier(
  pos: Position,
  round: number,
  totalRounds: number,
  posRankAvailable: number, // 1 = best remaining at position
): number {
  if (pos === "K" || pos === "DEF") {
    // near-zero value until the last two rounds
    if (round < totalRounds - 1) return 0.05;
    return 1;
  }
  if (pos === "QB") {
    // elite QB (best remaining) allowed from round 3; otherwise defer to ~6
    if (posRankAvailable === 1 && round >= 3) return 0.85;
    if (round < 6) return 0.4;
    return 1;
  }
  return 1;
}

/** Injury discount: down-weight players with concerning designations. */
function injuryMultiplier(status?: string): number {
  if (!status) return 1;
  const s = status.toLowerCase();
  if (s.includes("ir") || s.includes("out") || s.includes("pup") || s.includes("suspend")) return 0.5;
  if (s.includes("doubtful")) return 0.7;
  if (s.includes("question")) return 0.9;
  return 1;
}

// ----------------------------------------------------------------------------
// Main entry point
// ----------------------------------------------------------------------------
export interface RecommendOptions {
  topN?: number;
  gapThreshold?: number;
}

/**
 * Produce ranked recommendations for whichever team is on the clock at the
 * next unmade pick, OR for an explicitly supplied teamSlot.
 */
export function recommend(
  allPlayers: Player[],
  state: DraftState,
  opts: RecommendOptions = {},
  forTeamSlot?: number,
): Recommendation[] {
  const topN = opts.topN ?? 8;
  const gapThreshold = opts.gapThreshold ?? 15;

  const draftedIds = new Set(state.picks.map((p) => p.playerId));
  const available = allPlayers.filter((p) => !draftedIds.has(p.playerId));

  // whose turn?
  const currentOverall = state.picks.length + 1;
  const teamSlot = forTeamSlot ?? slotOnClock(currentOverall, state.numTeams);
  const round = roundForPick(currentOverall, state.numTeams);

  // my current roster
  const myPlayerIds = new Set(
    state.picks.filter((p) => p.teamSlot === teamSlot).map((p) => p.playerId),
  );
  const myPlayers = allPlayers.filter((p) => myPlayerIds.has(p.playerId));
  const need = computeRosterNeed(myPlayers);

  // group available by position for baselines + posRank
  const availableByPos = {} as Record<Position, Player[]>;
  for (const p of available) {
    (availableByPos[p.position] ??= []).push(p);
  }
  (Object.keys(availableByPos) as Position[]).forEach((pos) => {
    availableByPos[pos].sort((a, b) => b.projPoints - a.projPoints);
  });

  const baselines = computeBaselines(availableByPos);
  const tiered = assignTiers(available, gapThreshold);
  const tierById = new Map(tiered.map((p) => [p.playerId, p.tier]));

  const recs: Recommendation[] = available.map((p) => {
    const baseline = baselines[p.position] ?? 0;
    const vorp = p.projPoints - baseline;

    const posRank = (availableByPos[p.position] ?? []).findIndex((x) => x.playerId === p.playerId) + 1;
    const roundMult = positionalRoundMultiplier(p.position, round, state.totalRounds, posRank);
    const injMult = injuryMultiplier(p.injuryStatus);

    // roster-need weighting: once value threshold met, up-weight true needs
    const fills = fillsStartingNeed(p.position, need);
    const needMult = fills ? 1.15 : (need.BN > 0 ? 1.0 : 0.85);

    // ADP value: positive means player is falling past their ADP (a deal)
    const adpValue = p.adp - currentOverall;
    const adpBonus = adpValue > 0 ? Math.min(adpValue, 24) * 0.3 : Math.max(adpValue, -24) * 0.15;

    const score = vorp * roundMult * injMult * needMult + adpBonus;

    // ---- plain-language reasons (Charter 6.3) ----
    const reasons: string[] = [];
    const posBest = posRank === 1;
    if (posBest) reasons.push(`Best available ${p.position} by projection`);
    else reasons.push(`${ordinal(posRank)}-best ${p.position} available`);

    if (vorp > 0) reasons.push(`+${vorp.toFixed(0)} pts over replacement`);
    if (fills) {
      const slot = startingSlotLabel(p.position, need);
      if (slot) reasons.push(`fills your open ${slot}`);
    }
    if (adpValue >= 6) reasons.push(`value: ${adpValue} picks past its ADP`);
    else if (adpValue <= -8) reasons.push(`reach: ${-adpValue} picks ahead of ADP`);

    if (p.injuryStatus && injMult < 1) reasons.push(`injury: ${p.injuryStatus}`);
    if ((p.position === "K" || p.position === "DEF") && round < state.totalRounds - 1) {
      reasons.push(`too early for ${p.position} — wait`);
    }
    if (p.position === "QB" && round < 6 && !posBest) {
      reasons.push(`QB is deep — can wait`);
    }
    const tier = tierById.get(p.playerId);
    if (tier) reasons.push(`Tier ${tier} ${p.position}`);

    return {
      player: { ...p, tier },
      vorp: Math.round(vorp * 10) / 10,
      score: Math.round(score * 10) / 10,
      reasons,
      fillsNeed: fills,
      adpValue,
    };
  });

  recs.sort((a, b) => b.score - a.score);
  return recs.slice(0, topN);
}

// ----------------------------------------------------------------------------
// Turn-pair lookahead (Charter 6.4) — for slots near the snake turn
// ----------------------------------------------------------------------------
/**
 * For a team near the turn, estimate which players are likely to still be
 * available at their SECOND upcoming pick, so the two picks can be planned as
 * a pair. Uses ADP as the survival signal: a player with ADP beyond the gap
 * to the next-next pick is likely to survive.
 */
export function turnPairLookahead(
  allPlayers: Player[],
  state: DraftState,
  teamSlot: number,
): { thisPick: number; nextPick: number; likelyAtNext: Player[] } {
  const currentOverall = state.picks.length + 1;
  const myPicks = picksForSlot(teamSlot, state.totalRounds, state.numTeams)
    .filter((pk) => pk >= currentOverall);
  const thisPick = myPicks[0] ?? currentOverall;
  const nextPick = myPicks[1] ?? thisPick;

  const draftedIds = new Set(state.picks.map((p) => p.playerId));
  const available = allPlayers.filter((p) => !draftedIds.has(p.playerId));

  // players whose ADP suggests they'll survive until nextPick
  const likelyAtNext = available
    .filter((p) => p.adp >= nextPick - 2)
    .sort((a, b) => b.projPoints - a.projPoints)
    .slice(0, 12);

  return { thisPick, nextPick, likelyAtNext };
}

// ----------------------------------------------------------------------------
// small helpers
// ----------------------------------------------------------------------------
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function startingSlotLabel(pos: Position, need: RosterNeed): string | null {
  if (pos === "QB" && need.QB > 0) return "QB";
  if (pos === "RB" && need.RB > 0) return need.RB === ROSTER_SLOTS.RB ? "RB1" : "RB2";
  if (pos === "WR" && need.WR > 0) return need.WR === ROSTER_SLOTS.WR ? "WR1" : "WR2";
  if (pos === "TE" && need.TE > 0) return "TE";
  if (pos === "K" && need.K > 0) return "K";
  if (pos === "DEF" && need.DEF > 0) return "DEF";
  if (FLEX_ELIGIBLE.includes(pos) && need.FLEX > 0) return "FLEX";
  return null;
}
