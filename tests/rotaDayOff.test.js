import { describe, it, expect } from "vitest";
import { placeDayOffs } from "../lib/rotaDayOff";

const PROG_START = "2026-07-06";
const PROG_END = "2026-07-19";
const MON = "2026-07-06";
const SAT = "2026-07-11";
const SUN = "2026-07-12";

function mkStaff(id, role, over = {}) {
  return { id, name: id, role, arr: PROG_START, dep: PROG_END, ...over };
}

function profilesWhere(override = {}) {
  const dates = [];
  for (let d = new Date(PROG_START); d <= new Date(PROG_END); d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  const profiles = {};
  dates.forEach((ds) => {
    profiles[ds] = { students: 60, isFDE: false, isHDE: false, isTestingDay: false, isArrival: ds === MON, isFirstArrival: ds === MON, ...(override[ds] || {}) };
  });
  return profiles;
}

describe("placeDayOffs — guards", () => {
  it("no progStart/progEnd → empty grid", () => {
    const { dayOffGrid } = placeDayOffs({ staff: [mkStaff("t1", "TAL")], profiles: {}, progStart: null, progEnd: null });
    expect(dayOffGrid).toEqual({});
  });

  it("skips CM / CD / EAM / SWC (no day-offs placed)", () => {
    const staff = [mkStaff("b", "CM"), mkStaff("c", "CD"), mkStaff("d", "EAM"), mkStaff("e", "SWC")];
    const profiles = profilesWhere();
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    expect(Object.keys(dayOffGrid)).toHaveLength(0);
  });

  it("5FTT gets Day Off on all weekends", () => {
    const staff = [mkStaff("a", "5FTT")];
    const profiles = profilesWhere();
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    expect(dayOffGrid[`a-${SAT}-AM`]).toBe("Day Off");
    expect(dayOffGrid[`a-${SAT}-PM`]).toBe("Day Off");
    expect(dayOffGrid[`a-${SUN}-AM`]).toBe("Day Off");
    expect(dayOffGrid[`a-${SUN}-PM`]).toBe("Day Off");
  });
});

describe("placeDayOffs — FTT on FDE", () => {
  it("FTTs get Day Off on every FDE day", () => {
    const staff = [mkStaff("f1", "FTT")];
    const profiles = profilesWhere({ [SAT]: { isFDE: true, students: 60 }, [SUN]: { isFDE: true, students: 60 } });
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    expect(dayOffGrid[`f1-${SAT}-AM`]).toBe("Day Off");
    expect(dayOffGrid[`f1-${SAT}-PM`]).toBe("Day Off");
    expect(dayOffGrid[`f1-${SAT}-Eve`]).toBe("Day Off");
    expect(dayOffGrid[`f1-${SUN}-AM`]).toBe("Day Off");
  });

  it("FTT gets Day Off on ALL weekends (not just FDE days)", () => {
    const staff = [mkStaff("f1", "FTT")];
    const profiles = profilesWhere(); // no FDE days
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    expect(dayOffGrid[`f1-${SAT}-AM`]).toBe("Day Off");
    expect(dayOffGrid[`f1-${SUN}-AM`]).toBe("Day Off");
    // No weekday Day Offs
    expect(dayOffGrid[`f1-2026-07-07-AM`]).toBeUndefined();
    expect(dayOffGrid[`f1-2026-07-08-AM`]).toBeUndefined();
  });
});

describe("placeDayOffs — TAL cohort split", () => {
  it("splits TALs across FDE weekend: even idx → Sat, odd idx → Sun", () => {
    const staff = [mkStaff("t1", "TAL"), mkStaff("t2", "TAL"), mkStaff("t3", "TAL"), mkStaff("t4", "TAL")];
    const profiles = profilesWhere({ [SAT]: { isFDE: true, students: 60 }, [SUN]: { isFDE: true, students: 60 } });
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    expect(dayOffGrid[`t1-${SAT}-AM`]).toBe("Day Off");
    expect(dayOffGrid[`t3-${SAT}-AM`]).toBe("Day Off");
    expect(dayOffGrid[`t2-${SUN}-AM`]).toBe("Day Off");
    expect(dayOffGrid[`t4-${SUN}-AM`]).toBe("Day Off");
    expect(dayOffGrid[`t1-${SUN}-AM`]).toBeUndefined();
    expect(dayOffGrid[`t2-${SAT}-AM`]).toBeUndefined();
  });

  it("TAL gets one weekend Day Off per week even when no FDE — never a weekday", () => {
    const staff = [mkStaff("t1", "TAL"), mkStaff("t2", "TAL")];
    const profiles = profilesWhere(); // no FDE days
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    // Must have at least one day off somewhere (on a weekend)
    const t1Offs = Object.keys(dayOffGrid).filter((k) => k.startsWith("t1-") && k.endsWith("-AM"));
    expect(t1Offs.length).toBeGreaterThanOrEqual(1);
    // None of those day-offs are on a weekday
    t1Offs.forEach((k) => {
      const ds = k.split("-").slice(1, 4).join("-"); // extract YYYY-MM-DD
      const dow = new Date(ds).getDay();
      expect(dow === 0 || dow === 6).toBe(true);
    });
  });
});

describe("placeDayOffs — weekly Day Off", () => {
  it("gives exactly one Day Off per week on lowest-demand day", () => {
    const staff = [mkStaff("a1", "SAI")];
    // Make one weekday clearly lowest demand
    const profiles = profilesWhere({
      "2026-07-07": { students: 100 },
      "2026-07-08": { students: 100 },
      "2026-07-09": { students: 20 }, // lowest
      "2026-07-10": { students: 100 },
      [SAT]: { students: 100 },
      [SUN]: { students: 100 },
    });
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    expect(dayOffGrid[`a1-2026-07-09-AM`]).toBe("Day Off");
    const wk1Offs = ["2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", SAT, SUN]
      .filter((ds) => dayOffGrid[`a1-${ds}-AM`] === "Day Off");
    expect(wk1Offs).toHaveLength(1);
  });

  it("prefers non-FDE, non-test days for Day Off", () => {
    const staff = [mkStaff("a1", "LAL")];
    const profiles = profilesWhere({
      "2026-07-07": { isFDE: true, students: 60 },
      "2026-07-08": { students: 60 },
      "2026-07-09": { students: 60 },
    });
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    expect(dayOffGrid[`a1-2026-07-07-AM`]).toBeUndefined();
  });

  it("does NOT place Day Off on arrival day", () => {
    const staff = [mkStaff("a1", "SAI")];
    const profiles = profilesWhere();
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    expect(dayOffGrid[`a1-${MON}-AM`]).toBeUndefined();
  });
});

describe("placeDayOffs — fixedGrid precedence", () => {
  it("does not place Day Off on a day with a fixed Airport assignment", () => {
    const staff = [mkStaff("t1", "TAL")];
    const profiles = profilesWhere();
    const fixedGrid = { [`t1-2026-07-09-AM`]: "Airport" };
    const { dayOffGrid } = placeDayOffs({ staff, profiles, fixedGrid, progStart: PROG_START, progEnd: PROG_END });
    expect(dayOffGrid[`t1-2026-07-09-AM`]).toBeUndefined();
  });

  it("respects pre-existing fixed Day Off (no duplicate in same week)", () => {
    const staff = [mkStaff("a1", "SAI")];
    const profiles = profilesWhere();
    const fixedGrid = {
      [`a1-2026-07-08-AM`]: "Day Off",
      [`a1-2026-07-08-PM`]: "Day Off",
      [`a1-2026-07-08-Eve`]: "Day Off",
    };
    const { dayOffGrid } = placeDayOffs({ staff, profiles, fixedGrid, progStart: PROG_START, progEnd: PROG_END });
    const wk1 = ["2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", SAT, SUN];
    const offs = wk1.filter((ds) => dayOffGrid[`a1-${ds}-AM`] === "Day Off");
    expect(offs).toEqual(["2026-07-08"]);
  });
});

describe("placeDayOffs — output shape", () => {
  it("Day Off covers all 3 slots on that date", () => {
    const staff = [mkStaff("a1", "LAL")];
    const profiles = profilesWhere();
    const { dayOffGrid } = placeDayOffs({ staff, profiles, progStart: PROG_START, progEnd: PROG_END });
    const offKeys = Object.keys(dayOffGrid).filter((k) => k.startsWith("a1-") && k.endsWith("-AM") && dayOffGrid[k] === "Day Off");
    offKeys.forEach((k) => {
      const ds = k.split("-").slice(1, 4).join("-");
      expect(dayOffGrid[`a1-${ds}-AM`]).toBe("Day Off");
      expect(dayOffGrid[`a1-${ds}-PM`]).toBe("Day Off");
      expect(dayOffGrid[`a1-${ds}-Eve`]).toBe("Day Off");
    });
  });
});
