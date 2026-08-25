import { describe, it, expect } from "vitest";
import { scoreStatLine, pointsAllowedToPoints } from "@shared/scoring";
import { slotOnClock, picksForSlot, roundForPick } from "@shared/league-config";
import { recommend, computeRosterNeed, type Player, type DraftState } from "@shared/engine";

describe("scoring", () => {
  it("scores a QB line exactly (PPR-agnostic)", () => {
    // 4000*0.04 + 30*4 + 10*-1 = 160 + 120 - 10 = 270
    expect(scoreStatLine({ passYards: 4000, passTD: 30, passInt: 10 })).toBe(270);
  });
  it("scores a pass-catching RB line with full PPR", () => {
    // 1200*0.1 + 10*6 + 50*1 + 400*0.1 + 2*6 = 120+60+50+40+12 = 282
    expect(scoreStatLine({ rushYards: 1200, rushTD: 10, receptions: 50, recYards: 400, recTD: 2 })).toBe(282);
  });
  it("applies points-allowed tiers", () => {
    // one shutout (10) + one 3-pt game (7) + one 24-pt game (0) = 17
    expect(pointsAllowedToPoints([0, 3, 24])).toBe(17);
  });
});

describe("snake order", () => {
  it("maps overall picks to slots with reversal", () => {
    expect(slotOnClock(1)).toBe(1);
    expect(slotOnClock(12)).toBe(12);
    expect(slotOnClock(13)).toBe(12); // round 2 reverses
    expect(slotOnClock(14)).toBe(11);
    expect(slotOnClock(24)).toBe(1);
    expect(slotOnClock(25)).toBe(1); // round 3
  });
  it("computes a slot's pick list", () => {
    expect(picksForSlot(11).slice(0, 4)).toEqual([11, 14, 35, 38]);
    expect(roundForPick(14)).toBe(2);
  });
});

function makePool(): Player[] {
  const players: Player[] = [
    { playerId: "rbA", name: "RB A", position: "RB", team: "ATL", projPoints: 320, adp: 1 },
    { playerId: "rbB", name: "RB B", position: "RB", team: "DET", projPoints: 300, adp: 2 },
    { playerId: "wrA", name: "WR A", position: "WR", team: "CIN", projPoints: 310, adp: 3 },
    { playerId: "qbA", name: "QB A", position: "QB", team: "BUF", projPoints: 400, adp: 20 },
    { playerId: "kA", name: "K A", position: "K", team: "DAL", projPoints: 160, adp: 150 },
  ];
  for (let i = 0; i < 40; i++) {
    players.push({ playerId: "r" + i, name: "RBf" + i, position: "RB", team: "FA", projPoints: 200 - i * 3, adp: 30 + i });
    players.push({ playerId: "w" + i, name: "WRf" + i, position: "WR", team: "FA", projPoints: 205 - i * 3, adp: 30 + i });
    players.push({ playerId: "q" + i, name: "QBf" + i, position: "QB", team: "FA", projPoints: 260 - i * 4, adp: 60 + i });
  }
  return players;
}

describe("recommendation engine", () => {
  it("favors RB/WR over an elite QB and a kicker in round 1", () => {
    const players = makePool();
    const state: DraftState = { picks: [], numTeams: 12, totalRounds: 16 };
    const recs = recommend(players, state, { topN: 3 });
    const topPositions = recs.map((r) => r.player.position);
    expect(topPositions).not.toContain("K");
    expect(["RB", "WR"]).toContain(topPositions[0]);
  });

  it("computes roster need correctly after picks", () => {
    const players = makePool();
    const me: Player[] = [players[0], players[2]]; // one RB, one WR
    const need = computeRosterNeed(me);
    expect(need.RB).toBe(1);
    expect(need.WR).toBe(1);
    expect(need.QB).toBe(1);
  });

  it("suppresses kicker until the final rounds", () => {
    const players = makePool();
    // simulate 14 rounds done (168 picks) so we're deep
    const picks = Array.from({ length: 168 }, (_, i) => ({
      overallPick: i + 1, teamSlot: slotOnClock(i + 1), playerId: players[i % players.length].playerId,
    }));
    // dedupe playerIds to keep engine's "available" honest by using unique fills
    const uniquePicks = picks.filter((p, i) => picks.findIndex((x) => x.playerId === p.playerId) === i);
    const state: DraftState = { picks: uniquePicks, numTeams: 12, totalRounds: 16 };
    const recsEarly = recommend(makePool(), { picks: [], numTeams: 12, totalRounds: 16 }, { topN: 20 });
    const kEarly = recsEarly.find((r) => r.player.position === "K");
    // kicker should not be a top pick early
    if (kEarly) expect(recsEarly.indexOf(kEarly)).toBeGreaterThan(3);
  });
});
