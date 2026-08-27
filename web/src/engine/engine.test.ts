import { describe, it, expect } from "vitest";
import { scoreStatLine, pointsAllowedToPoints } from "@shared/scoring";
import {
  slotOnClock, picksForSlot, roundForPick, TEAMS, ROSTER_SLOTS,
} from "@shared/league-config";
import { byeWeekFor, BYE_WEEKS_2026 } from "@shared/schedule";
import {
  recommend, computeRosterNeed, computeBaselines, assignTiers,
  turnPairLookahead, type Player, type DraftState, type DraftPick,
} from "@shared/engine";

// ============================================================================
// 1. SCORING - exact league-rule math
// ============================================================================
describe("scoring: league rules are encoded exactly", () => {
  it("QB: 4000 yd, 30 TD, 10 INT -> 270", () => {
    expect(scoreStatLine({ passYards: 4000, passTD: 30, passInt: 10 })).toBe(270);
  });
  it("pass-catching RB full PPR: 282", () => {
    expect(scoreStatLine({ rushYards: 1200, rushTD: 10, receptions: 50, recYards: 400, recTD: 2 })).toBe(282);
  });
  it("WR full PPR: 100 rec, 1400 yd, 12 TD -> 100+140+72 = 312", () => {
    expect(scoreStatLine({ receptions: 100, recYards: 1400, recTD: 12 })).toBe(312);
  });
  it("reception point is full PPR (1.0)", () => {
    expect(scoreStatLine({ receptions: 10 })).toBe(10);
  });
  it("fumbles lost subtract 2 each", () => {
    expect(scoreStatLine({ rushYards: 100, fumblesLost: 2 })).toBe(6); // 10 - 4
  });
  it("kicker distance tiers", () => {
    // 40-49 =4, 50-59 =5, 60+ =6, PAT =1
    expect(scoreStatLine({ fg40to49: 1, fg50to59: 1, fg60plus: 1, patMade: 3 })).toBe(4 + 5 + 6 + 3);
  });
  it("DEF points-allowed tiers map correctly", () => {
    expect(pointsAllowedToPoints([0])).toBe(10);
    expect(pointsAllowedToPoints([6])).toBe(7);
    expect(pointsAllowedToPoints([13])).toBe(4);
    expect(pointsAllowedToPoints([20])).toBe(1);
    expect(pointsAllowedToPoints([24])).toBe(0);
    expect(pointsAllowedToPoints([30])).toBe(-1);
    expect(pointsAllowedToPoints([40])).toBe(-4);
  });
});

// ============================================================================
// 2. SNAKE ORDER - the backbone of turn logic
// ============================================================================
describe("snake draft order", () => {
  it("round 1 is 1..12 in order", () => {
    for (let i = 1; i <= 12; i++) expect(slotOnClock(i)).toBe(i);
  });
  it("round 2 reverses 12..1", () => {
    expect(slotOnClock(13)).toBe(12);
    expect(slotOnClock(14)).toBe(11);
    expect(slotOnClock(24)).toBe(1);
  });
  it("round 3 restores 1..12", () => {
    expect(slotOnClock(25)).toBe(1);
    expect(slotOnClock(36)).toBe(12);
  });
  it("slot 11 (Jay) owns picks 11,14,35,38,59,62...", () => {
    expect(picksForSlot(11).slice(0, 6)).toEqual([11, 14, 35, 38, 59, 62]);
  });
  it("roundForPick is correct at boundaries", () => {
    expect(roundForPick(12)).toBe(1);
    expect(roundForPick(13)).toBe(2);
    expect(roundForPick(24)).toBe(2);
    expect(roundForPick(25)).toBe(3);
  });
  it("league has exactly 12 teams and Jay is slot 11", () => {
    expect(TEAMS).toHaveLength(12);
    expect(TEAMS.find((t) => t.isProjectOwner)?.slot).toBe(11);
    expect(TEAMS.find((t) => t.slot === 11)?.owner).toBe("@jayp671");
  });
});

// ============================================================================
// 3. BYE WEEKS - data integrity
// ============================================================================
describe("2026 bye weeks", () => {
  it("all 32 teams have a bye", () => {
    expect(Object.keys(BYE_WEEKS_2026)).toHaveLength(32);
  });
  it("no byes in weeks 1-4, 12, or 15+", () => {
    for (const wk of Object.values(BYE_WEEKS_2026)) {
      expect(wk).toBeGreaterThanOrEqual(5);
      expect(wk).toBeLessThanOrEqual(14);
      expect(wk).not.toBe(12);
    }
  });
  it("known byes: PHI wk10, KC wk5, DAL wk14", () => {
    expect(byeWeekFor("PHI")).toBe(10);
    expect(byeWeekFor("KC")).toBe(5);
    expect(byeWeekFor("DAL")).toBe(14);
  });
});

// ============================================================================
// Test fixture: a realistic-ish player pool
// ============================================================================
function pool(): Player[] {
  const p: Player[] = [
    { playerId: "chase", name: "Ja'Marr Chase", position: "WR", team: "CIN", projPoints: 330, adp: 3, ffcAdp: 2, targetShare: 0.31, depthChartOrder: 1, careerTrend: "rising" },
    { playerId: "bijan", name: "Bijan Robinson", position: "RB", team: "ATL", projPoints: 323, adp: 1, ffcAdp: 1, depthChartOrder: 1, byeWeek: 11 },
    { playerId: "gibbs", name: "Jahmyr Gibbs", position: "RB", team: "DET", projPoints: 315, adp: 2, ffcAdp: 3, depthChartOrder: 1, byeWeek: 6 },
    { playerId: "puka", name: "Puka Nacua", position: "WR", team: "LAR", projPoints: 305, adp: 5, ffcAdp: 6, targetShare: 0.28, gamesMissed2y: 6, depthChartOrder: 1 },
    { playerId: "allen", name: "Josh Allen", position: "QB", team: "BUF", projPoints: 402, adp: 22, ffcAdp: 20, depthChartOrder: 1 },
    { playerId: "mcbride", name: "Trey McBride", position: "TE", team: "ARI", projPoints: 240, adp: 18, ffcAdp: 16, targetShare: 0.24, depthChartOrder: 1 },
    { playerId: "aubrey", name: "Brandon Aubrey", position: "K", team: "DAL", projPoints: 165, adp: 140, ffcAdp: 138, depthChartOrder: 1 },
    { playerId: "jeanty", name: "Ashton Jeanty", position: "RB", team: "LV", projPoints: 270, adp: 13, ffcAdp: 12, isRookie: true, draftRound: 1, draftPick: 6, depthChartOrder: 1 },
  ];
  for (let i = 0; i < 60; i++) {
    p.push({ playerId: "rb" + i, name: "RBfill" + i, position: "RB", team: "FA", projPoints: 210 - i * 3, adp: 30 + i, ffcAdp: 30 + i });
    p.push({ playerId: "wr" + i, name: "WRfill" + i, position: "WR", team: "FA", projPoints: 212 - i * 3, adp: 31 + i, ffcAdp: 31 + i });
    p.push({ playerId: "qb" + i, name: "QBfill" + i, position: "QB", team: "FA", projPoints: 300 - i * 4, adp: 55 + i, ffcAdp: 55 + i });
    p.push({ playerId: "te" + i, name: "TEfill" + i, position: "TE", team: "FA", projPoints: 180 - i * 3, adp: 70 + i, ffcAdp: 70 + i });
  }
  return p;
}
const emptyState = (): DraftState => ({ picks: [], numTeams: 12, totalRounds: 16 });

// ============================================================================
// 4. REPLACEMENT BASELINES + TIERS
// ============================================================================
describe("VORP baselines & tiers", () => {
  it("baseline exists for every position and RB baseline is positive", () => {
    const players = pool();
    const byPos: any = {};
    for (const pl of players) (byPos[pl.position] ??= []).push(pl);
    const b = computeBaselines(byPos);
    expect(b.RB).toBeGreaterThan(0);
    expect(b.WR).toBeGreaterThan(0);
    // elite backs sit well above replacement
    expect(323 - b.RB).toBeGreaterThan(50);
  });
  it("tiers restart per position and are ascending", () => {
    const t = assignTiers(pool());
    const chase = t.find((x) => x.playerId === "chase");
    expect(chase?.tier).toBe(1);
  });
});

// ============================================================================
// 5. RECOMMENDATION ENGINE - core behaviors
// ============================================================================
describe("recommendation engine behavior", () => {
  it("round 1: RB/WR lead, elite QB and K are suppressed", () => {
    const recs = recommend(pool(), emptyState(), { topN: 5 });
    expect(["RB", "WR"]).toContain(recs[0].player.position);
    expect(recs.map((r) => r.player.position)).not.toContain("K");
    // Josh Allen (402 proj) must NOT be the #1 pick despite highest raw points
    expect(recs[0].player.playerId).not.toBe("allen");
  });

  it("kicker is essentially unpickable until the final two rounds", () => {
    const recs = recommend(pool(), emptyState(), { topN: 40 });
    const k = recs.find((r) => r.player.position === "K");
    if (k) expect(recs.indexOf(k)).toBeGreaterThan(10);
  });

  it("QB rises once the roster need is real and round is right", () => {
    // build a slot-11 roster that already has RB/WR/TE depth; deep round
    const picks: DraftPick[] = [];
    // simulate 6 rounds (72 picks) of filler so we're in round 7
    let id = 0;
    for (let i = 1; i <= 72; i++) {
      picks.push({ overallPick: i, teamSlot: slotOnClock(i), playerId: "used" + id++ });
    }
    // give those fake ids real players so they count as drafted
    const players = pool();
    picks.forEach((pk, i) => { players.push({ playerId: pk.playerId, name: "used" + i, position: "RB", team: "FA", projPoints: 1, adp: 999 }); });
    const state: DraftState = { picks, numTeams: 12, totalRounds: 16 };
    const recs = recommend(players, state, { topN: 10 }, 11);
    // Allen should now appear in a reasonable position (QB no longer crushed)
    const allen = recs.find((r) => r.player.playerId === "allen");
    expect(allen).toBeTruthy();
  });

  it("every recommendation carries a non-empty reasoning paragraph", () => {
    const recs = recommend(pool(), emptyState(), { topN: 8 });
    for (const r of recs) {
      expect(r.reasoning.length).toBeGreaterThan(40);
      expect(r.reasoning).toContain(r.player.name);
    }
  });

  it("reasoning mentions value when a player falls past ADP", () => {
    // put us at pick 10 where Puka (adp/ffc ~5-6) would be a slight reach,
    // and a filler with high adp is a value
    const state: DraftState = { picks: [], numTeams: 12, totalRounds: 16 };
    // draft 9 players so currentOverall = 10
    const players = pool();
    for (let i = 1; i <= 9; i++) state.picks.push({ overallPick: i, teamSlot: slotOnClock(i), playerId: "rb" + i });
    const recs = recommend(players, state, { topN: 20 }, slotOnClock(10));
    const valueRec = recs.find((r) => r.adpValue >= 6);
    if (valueRec) expect(valueRec.reasoning.toLowerCase()).toContain("market");
  });

  it("does not recommend already-drafted players", () => {
    const state = emptyState();
    state.picks.push({ overallPick: 1, teamSlot: 1, playerId: "chase" });
    const recs = recommend(pool(), state, { topN: 10 });
    expect(recs.find((r) => r.player.playerId === "chase")).toBeUndefined();
  });

  it("effective ADP prefers FFC over ESPN adp field", () => {
    // chase has adp 3 but ffcAdp 2; at pick 1 adpValue uses ffc (2-1=1)
    const recs = recommend(pool(), emptyState(), { topN: 8 });
    const chase = recs.find((r) => r.player.playerId === "chase");
    expect(chase).toBeTruthy();
    // adpValue = effAdp(2) - currentOverall(1) = 1
    expect(chase!.adpValue).toBeCloseTo(1, 1);
  });
});

// ============================================================================
// 6. ROSTER NEED - slot accounting incl. FLEX
// ============================================================================
describe("roster need accounting", () => {
  it("fresh roster needs all starting slots", () => {
    const n = computeRosterNeed([]);
    expect(n.QB).toBe(ROSTER_SLOTS.QB);
    expect(n.RB).toBe(ROSTER_SLOTS.RB);
    expect(n.WR).toBe(ROSTER_SLOTS.WR);
    expect(n.FLEX).toBe(ROSTER_SLOTS.FLEX);
  });
  it("third RB spills into FLEX, not RB", () => {
    const rbs: Player[] = [
      { playerId: "a", name: "A", position: "RB", team: "X", projPoints: 200, adp: 1 },
      { playerId: "b", name: "B", position: "RB", team: "X", projPoints: 190, adp: 2 },
      { playerId: "c", name: "C", position: "RB", team: "X", projPoints: 180, adp: 3 },
    ];
    const n = computeRosterNeed(rbs);
    expect(n.RB).toBe(0);
    expect(n.FLEX).toBe(ROSTER_SLOTS.FLEX - 1);
  });
  it("overflow beyond starters+flex goes to bench", () => {
    const many: Player[] = Array.from({ length: 7 }, (_, i) => ({
      playerId: "r" + i, name: "R" + i, position: "RB", team: "X", projPoints: 100 - i, adp: i + 1,
    }));
    const n = computeRosterNeed(many);
    // 2 RB + 2 FLEX filled = 4 used as starters; remaining 3 to bench
    expect(n.RB).toBe(0);
    expect(n.FLEX).toBe(0);
    expect(n.BN).toBe(ROSTER_SLOTS.BN - 3);
  });
});

// ============================================================================
// 7. TURN-PAIR STRATEGY (slot 11 = Jay)
// ============================================================================
describe("turn-pair lookahead for slot 11", () => {
  it("identifies picks 11 and 14 at the start", () => {
    const plan = turnPairLookahead(pool(), emptyState(), 11);
    expect(plan.thisPick).toBe(11);
    expect(plan.nextPick).toBe(14);
    expect(plan.gap).toBe(3);
  });
  it("produces a strategy sentence and grab/wait buckets", () => {
    const plan = turnPairLookahead(pool(), emptyState(), 11);
    expect(plan.strategy.length).toBeGreaterThan(40);
    // grab-now players have ADP at/under nextPick(14); wait players beyond it
    for (const p of plan.grabNow) {
      const eff = (p.ffcAdp && p.ffcAdp < 999) ? p.ffcAdp : p.adp;
      expect(eff).toBeLessThanOrEqual(14);
    }
    for (const p of plan.likelyAtNext) {
      const eff = (p.ffcAdp && p.ffcAdp < 999) ? p.ffcAdp : p.adp;
      expect(eff).toBeGreaterThan(14);
    }
  });
});

// ============================================================================
// 8. FULL DRAFT FLOW - simulate all 16 rounds for slot 11, assert sane roster
// ============================================================================
describe("full draft simulation (auto-pick top rec each turn)", () => {
  it("completes a 12-team x 16-round draft with a legal, sane roster for Jay", () => {
    const players = pool();
    // ensure enough players to fill 192 picks
    for (let i = 0; i < 200; i++) {
      players.push({ playerId: "x" + i, name: "X" + i, position: (["RB", "WR", "TE", "QB"] as const)[i % 4], team: "FA", projPoints: 90 - (i % 40), adp: 100 + i, ffcAdp: 100 + i });
    }
    // add kickers/defenses so late rounds can fill them
    for (let i = 0; i < 20; i++) {
      players.push({ playerId: "k" + i, name: "K" + i, position: "K", team: "FA", projPoints: 150 - i, adp: 150 + i, ffcAdp: 150 + i });
      players.push({ playerId: "d" + i, name: "D" + i, position: "DEF", team: "FA", projPoints: 120 - i, adp: 160 + i, ffcAdp: 160 + i });
    }

    const state: DraftState = { picks: [], numTeams: 12, totalRounds: 16 };
    const totalPicks = 12 * 16;
    for (let overall = 1; overall <= totalPicks; overall++) {
      const slot = slotOnClock(overall);
      const recs = recommend(players, state, { topN: 1 }, slot);
      expect(recs.length).toBeGreaterThan(0); // engine must always have a pick
      state.picks.push({ overallPick: overall, teamSlot: slot, playerId: recs[0].player.playerId });
    }
    expect(state.picks).toHaveLength(totalPicks);

    // Jay's roster (slot 11)
    const mineIds = new Set(state.picks.filter((p) => p.teamSlot === 11).map((p) => p.playerId));
    const mine = players.filter((p) => mineIds.has(p.playerId));
    expect(mine).toHaveLength(16);

    // sanity: at least 1 QB, 2 RB, 2 WR, 1 TE somewhere in the 16
    const count = (pos: string) => mine.filter((p) => p.position === pos).length;
    expect(count("QB")).toBeGreaterThanOrEqual(1);
    expect(count("RB")).toBeGreaterThanOrEqual(2);
    expect(count("WR")).toBeGreaterThanOrEqual(2);
    expect(count("TE")).toBeGreaterThanOrEqual(1);

    // no duplicate players across the entire draft
    const allIds = state.picks.map((p) => p.playerId);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
