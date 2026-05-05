import { describe, it, expect } from "vitest";
import { applyFixedForStaff, parseTimeOff, isFullDayOff, buildFixedGrid } from "../lib/rotaFixed";

const NO_TO = [];
const noOff = () => false;

function mkStaff(id, over = {}) {
  return { id, arr: "2026-06-24", dep: "2026-08-05", role: "TAL", ...over };
}

function range(start, end) {
  const dates = [];
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ── applyFixedForStaff: induction placement ────────────────────────────────

describe("applyFixedForStaff — induction on centre dates", () => {
  it("places Induction on all eligible dates within the range", () => {
    const s = mkStaff("t1", { arr: "2026-06-24" });
    const dates = range("2026-06-24", "2026-07-07");
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, ["2026-06-30", "2026-07-01"]);
    expect(fixed["t1-2026-06-30-AM"]).toBe("Induction");
    expect(fixed["t1-2026-06-30-PM"]).toBe("Induction");
    expect(fixed["t1-2026-07-01-AM"]).toBe("Induction");
    expect(fixed["t1-2026-07-01-PM"]).toBe("Induction");
  });

  it("only places induction date on or after staff arrival", () => {
    const s = mkStaff("t1", { arr: "2026-07-01" });
    const dates = range("2026-06-30", "2026-07-07");
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, ["2026-06-30", "2026-07-01"]);
    expect(fixed["t1-2026-06-30-AM"]).toBeUndefined();
    expect(fixed["t1-2026-07-01-AM"]).toBe("Induction");
  });

  it("does NOT fall back to onSite[0] when induction dates exist but are outside the range", () => {
    const s = mkStaff("t1", { arr: "2026-06-24" });
    // Second fortnight: 8 July onwards — induction (30 Jun, 1 Jul) already passed
    const dates = range("2026-07-08", "2026-07-21");
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, ["2026-06-30", "2026-07-01"]);
    // Should NOT place Induction on first on-site date (8 Jul)
    expect(fixed["t1-2026-07-08-AM"]).toBeUndefined();
    expect(fixed["t1-2026-07-08-PM"]).toBeUndefined();
  });

  it("falls back to first on-site day for unknown centre (no induction dates)", () => {
    const s = mkStaff("t1", { arr: "2026-07-06" });
    const dates = range("2026-07-06", "2026-07-19");
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, []);
    expect(fixed["t1-2026-07-06-AM"]).toBe("Induction");
  });

  it("falls back to first on-site day for late joiner (arrives after all induction dates)", () => {
    const s = mkStaff("t1", { arr: "2026-07-10" });
    const dates = range("2026-07-10", "2026-07-23");
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, ["2026-06-30", "2026-07-01"]);
    expect(fixed["t1-2026-07-10-AM"]).toBe("Induction");
  });
});

// ── applyFixedForStaff: Setup placement ───────────────────────────────────

describe("applyFixedForStaff — Setup placement", () => {
  it("places Induction on first contracted day, then Setup before group arrival", () => {
    // Induction on 30 Jun, but staff arrives 1 Jul (after induction). Since all configured
    // induction dates are before arrival, staff gets Induction on their first on-site day
    // (1 Jul) and Setup Jul 2–5 before group arrival on 6 Jul.
    const s = mkStaff("t1", { arr: "2026-07-01" });
    const dates = range("2026-06-30", "2026-07-07");
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, ["2026-06-30"]);
    expect(fixed["t1-2026-07-01-AM"]).toBe("Induction");
    expect(fixed["t1-2026-07-02-AM"]).toBe("Setup");
    expect(fixed["t1-2026-07-05-AM"]).toBe("Setup");
    expect(fixed["t1-2026-07-06-AM"]).toBeUndefined(); // group arrival — no setup
  });

  it("places Induction on first contracted day + pre-contract Setup between last induction and arrival", () => {
    // Staff arrives 5 Jul; induction was 30 Jun + 1 Jul (all before arrival).
    // Since all configured dates are before arrival, staff gets Induction on 5 Jul (first day).
    // Pre-contract Setup fills days 2–4 Jul (between last induction 1 Jul and contracted start 5 Jul).
    const s = mkStaff("t1", { arr: "2026-07-05" });
    const dates = range("2026-06-30", "2026-07-09");
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, ["2026-06-30", "2026-07-01"]);
    expect(fixed["t1-2026-06-30-AM"]).toBeUndefined(); // before arrival — no entry
    expect(fixed["t1-2026-07-01-AM"]).toBeUndefined(); // before arrival — no entry
    expect(fixed["t1-2026-07-02-AM"]).toBe("Setup");   // pre-contract Setup
    expect(fixed["t1-2026-07-03-AM"]).toBe("Setup");
    expect(fixed["t1-2026-07-04-AM"]).toBe("Setup");
    expect(fixed["t1-2026-07-05-AM"]).toBe("Induction"); // first contracted day
  });

  it("does not place Setup on or after group arrival", () => {
    const s = mkStaff("t1", { arr: "2026-06-30" });
    const dates = range("2026-06-30", "2026-07-08");
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, ["2026-06-30"]);
    expect(fixed["t1-2026-07-06-AM"]).toBeUndefined();
    expect(fixed["t1-2026-07-07-AM"]).toBeUndefined();
  });
});

// ── applyFixedForStaff: Airport placement ────────────────────────────────

describe("applyFixedForStaff — Airport placement", () => {
  it("places Airport on departure day AM", () => {
    const s = mkStaff("t1", { arr: "2026-07-06", dep: "2026-07-19" });
    const dates = range("2026-07-06", "2026-07-19");
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, []);
    expect(fixed["t1-2026-07-19-AM"]).toBe("Airport");
  });

  it("does not overwrite an existing departure cell", () => {
    const s = mkStaff("t1", { arr: "2026-07-06", dep: "2026-07-19" });
    const dates = range("2026-07-06", "2026-07-19");
    const fixed = { "t1-2026-07-19-AM": "Lessons" };
    applyFixedForStaff(fixed, s, dates, "2026-07-06", NO_TO, noOff, []);
    expect(fixed["t1-2026-07-19-AM"]).toBe("Lessons");
  });
});

// ── applyFixedForStaff: time-off ──────────────────────────────────────────

describe("applyFixedForStaff — time-off overrides", () => {
  it("places Day Off on all slots for a full-day time-off entry", () => {
    const s = mkStaff("t1", { arr: "2026-07-06", dep: "2026-07-19" });
    const dates = range("2026-07-06", "2026-07-19");
    const tos = [{ date: "2026-07-10", slot: null }];
    const fixed = {};
    applyFixedForStaff(fixed, s, dates, "2026-07-06", tos, isFullDayOff, []);
    expect(fixed["t1-2026-07-10-AM"]).toBe("Day Off");
    expect(fixed["t1-2026-07-10-PM"]).toBe("Day Off");
    expect(fixed["t1-2026-07-10-Eve"]).toBe("Day Off");
  });
});

// ── buildFixedGrid: Reaseheath scenario ───────────────────────────────────

describe("buildFixedGrid — Reaseheath induction (30 Jun + 1 Jul)", () => {
  const STAFF = [
    { id: "t1", role: "TAL", arr: "2026-06-24", dep: "2026-08-05" },
    { id: "t2", role: "TAL", arr: "2026-07-01", dep: "2026-08-05" },
    { id: "t3", role: "TAL", arr: "2026-07-10", dep: "2026-08-05" }, // late joiner
    { id: "t4", role: "SAI", arr: "2026-07-06", dep: "2026-08-05" }, // arrives same day as groups
  ];
  const GROUP_ARRIVAL = "2026-07-06";
  const PROG_YEAR = 2026;

  it("t1 (early arrival) gets Induction on 30 Jun AND 1 Jul", () => {
    const dates = range("2026-06-30", "2026-07-13");
    const fixed = buildFixedGrid(STAFF, dates, GROUP_ARRIVAL, PROG_YEAR, "Nantwich — Reaseheath College");
    expect(fixed["t1-2026-06-30-AM"]).toBe("Induction");
    expect(fixed["t1-2026-06-30-PM"]).toBe("Induction");
    expect(fixed["t1-2026-07-01-AM"]).toBe("Induction");
    expect(fixed["t1-2026-07-01-PM"]).toBe("Induction");
  });

  it("t2 (arrives 1 Jul) gets Induction only on 1 Jul", () => {
    const dates = range("2026-06-30", "2026-07-13");
    const fixed = buildFixedGrid(STAFF, dates, GROUP_ARRIVAL, PROG_YEAR, "Nantwich — Reaseheath College");
    expect(fixed["t2-2026-06-30-AM"]).toBeUndefined();
    expect(fixed["t2-2026-07-01-AM"]).toBe("Induction");
  });

  it("t3 (late joiner, arrives 10 Jul) gets Induction on 10 Jul and NO pre-contract Setup", () => {
    const dates = range("2026-07-06", "2026-07-19");
    const fixed = buildFixedGrid(STAFF, dates, GROUP_ARRIVAL, PROG_YEAR, "Nantwich — Reaseheath College");
    expect(fixed["t3-2026-07-10-AM"]).toBe("Induction");
    // No Setup before arrival — late joiners were not on site during setup period
    expect(fixed["t3-2026-07-06-AM"]).toBeUndefined();
    expect(fixed["t3-2026-07-07-AM"]).toBeUndefined();
    expect(fixed["t3-2026-07-08-AM"]).toBeUndefined();
    expect(fixed["t3-2026-07-09-AM"]).toBeUndefined();
  });

  it("t4 (arrives same day as groups, 6 Jul) gets Induction on first on-site day (6 Jul)", () => {
    // All configured induction dates (30 Jun, 1 Jul) are before t4's arrival (6 Jul),
    // so t4 gets Induction on their first on-site day instead.
    const dates = range("2026-06-30", "2026-07-13");
    const fixed = buildFixedGrid(STAFF, dates, GROUP_ARRIVAL, PROG_YEAR, "Nantwich — Reaseheath College");
    expect(fixed["t4-2026-06-30-AM"]).toBeUndefined();
    expect(fixed["t4-2026-07-01-AM"]).toBeUndefined();
    expect(fixed["t4-2026-07-06-AM"]).toBe("Induction");
    expect(fixed["t4-2026-07-06-PM"]).toBe("Induction");
  });

  it("in second fortnight, t1 gets NO Induction (already had it)", () => {
    const dates = range("2026-07-14", "2026-07-27");
    const fixed = buildFixedGrid(STAFF, dates, GROUP_ARRIVAL, PROG_YEAR, "Nantwich — Reaseheath College");
    expect(fixed["t1-2026-07-14-AM"]).toBeUndefined();
    expect(fixed["t1-2026-07-14-PM"]).toBeUndefined();
  });
});

// ── buildFixedGrid: Dean Close / late joiner scenario (Tom's case) ────────
describe("buildFixedGrid — Dean Close, late joiner arrives after group arrival", () => {
  // Groups arrive 8 Jul; Tom contracted from 13 Jul (week 2 Monday).
  // Induction dates 5-6 Jul are before Tom's arrival — Tom is a true late joiner.
  const STAFF = [{ id: "tom", role: "FTT", arr: "2026-07-13", dep: "2026-08-05" }];
  const GROUP_ARRIVAL = "2026-07-08";
  const PROG_YEAR = 2026;

  it("Tom gets Induction on 13 Jul (first on-site day), no Setup before that", () => {
    const dates = range("2026-07-06", "2026-07-19");
    const fixed = buildFixedGrid(STAFF, dates, GROUP_ARRIVAL, PROG_YEAR, "Cheltenham — Dean Close School");
    expect(fixed["tom-2026-07-13-AM"]).toBe("Induction");
    expect(fixed["tom-2026-07-13-PM"]).toBe("Induction");
    // No pre-contract Setup: Tom was not on site during setup period
    expect(fixed["tom-2026-07-07-AM"]).toBeUndefined();
    expect(fixed["tom-2026-07-08-AM"]).toBeUndefined();
    expect(fixed["tom-2026-07-09-AM"]).toBeUndefined();
    expect(fixed["tom-2026-07-12-AM"]).toBeUndefined();
  });
});

// ── parseTimeOff ──────────────────────────────────────────────────────────

describe("parseTimeOff", () => {
  it("parses a date range", () => {
    const result = parseTimeOff("10/07 - 12/07", 2026);
    expect(result).toEqual([{ start: "2026-07-10", end: "2026-07-12" }]);
  });

  it("parses a single date", () => {
    const result = parseTimeOff("15/07", 2026);
    expect(result).toEqual([{ date: "2026-07-15", slot: null }]);
  });

  it("parses a slot-specific entry", () => {
    const result = parseTimeOff("15/07 am", 2026);
    expect(result).toEqual([{ date: "2026-07-15", slot: "am" }]);
  });

  it("returns empty array for empty string", () => {
    expect(parseTimeOff("", 2026)).toEqual([]);
    expect(parseTimeOff(null, 2026)).toEqual([]);
  });
});
