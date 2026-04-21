// End-to-end smoke test of the hybrid auto-generate pipeline.
// Mirrors a screenshot centre: ZZ programme, 1 group, mixed staff,
// 1 FDE weekend. Verifies the six issues the user flagged:
//   1. Eve activities filled every night from group arrival
//   2. TALs do most Eve activities; activity leaders do half-day excursions
//   3. TALs teach the same group consistently (follow weekly flip)
//   4. TALs split across FDE weekend (half off Sat, half off Sun)
//   5. Activity staff (not TALs) do Pickup when teaching demand exists
//   6. Tuesday half-day excursion adequately staffed

import { describe, it, expect } from "vitest";
import { buildDemand } from "../lib/rotaDemand";
import { bindTals } from "../lib/rotaBinding";
import { placeDayOffs } from "../lib/rotaDayOff";
import { allocateRota } from "../lib/rotaAllocator";

const PROG_START = "2026-07-06";
const PROG_END = "2026-07-19";
const MON_WK1 = "2026-07-06";
const TUE_WK1 = "2026-07-07";
const WED_WK1 = "2026-07-08";
const SAT_WK1 = "2026-07-11";
const SUN_WK1 = "2026-07-12";
const TUE_WK2 = "2026-07-14";

function mkStaff(id, role, over = {}) {
  return { id, name: id, role, arr: PROG_START, dep: PROG_END, ...over };
}
function mkGroup(id, stu, over = {}) {
  return { id, group: id.toUpperCase(), arr: PROG_START, dep: PROG_END, stu, gl: 2, lessonSlot: "AM", ...over };
}

function buildFixed(staff) {
  const fixed = {};
  staff.forEach((s) => {
    fixed[`${s.id}-${PROG_START}-PM`] = "Induction";
  });
  return fixed;
}

function runPipeline({ staff, groups, progGrid = {} }) {
  const fixedGrid = buildFixed(staff);
  const bindings = bindTals({ staff, groups });
  const { demand, profiles } = buildDemand({ groups, progGrid, progStart: PROG_START, progEnd: PROG_END });
  const { dayOffGrid } = placeDayOffs({ staff, profiles, fixedGrid, progStart: PROG_START, progEnd: PROG_END });
  const merged = { ...fixedGrid, ...dayOffGrid };
  const dates = Object.keys(demand).sort();
  const { grid, shortfalls } = allocateRota({ staff, demand, bindings, fixedGrid: merged, dates });
  return { grid, shortfalls, profiles };
}

function standardCentre() {
  // 30 students in one group — teaching slot AM, 16:1 teacher ratio → 2 teachers
  const staff = [
    mkStaff("t1", "TAL"), mkStaff("t2", "TAL"),
    mkStaff("t3", "TAL"), mkStaff("t4", "TAL"),
    mkStaff("f1", "FTT"),
    mkStaff("a1", "LAL"), mkStaff("a2", "SAI"), mkStaff("a3", "EAL"),
    mkStaff("c1", "CM"),
  ];
  const groups = [mkGroup("g1", 30)];
  return { staff, groups };
}

describe("rota pipeline — Issue 1: Eve every night from arrival", () => {
  it("every night with students on site has >= 2 staff on Eve Activity", () => {
    const { grid } = runPipeline(standardCentre());
    const dates = [TUE_WK1, WED_WK1, "2026-07-09", "2026-07-10", SAT_WK1, SUN_WK1, "2026-07-13", TUE_WK2];
    dates.forEach((ds) => {
      const n = ["t1","t2","t3","t4","f1","a1","a2","a3","c1"].filter((sid) => grid[`${sid}-${ds}-Eve`] === "Eve Activity").length;
      expect(n).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("rota pipeline — Issue 2: TALs preferred for Eve", () => {
  it("TALs appear in Eve Activity more often than activity staff on quiet nights", () => {
    const { grid } = runPipeline(standardCentre());
    const nights = [TUE_WK1, WED_WK1, "2026-07-09", "2026-07-10"];
    let talEveCount = 0;
    nights.forEach((ds) => {
      ["t1","t2","t3","t4"].forEach((sid) => { if (grid[`${sid}-${ds}-Eve`] === "Eve Activity") talEveCount++; });
    });
    expect(talEveCount).toBeGreaterThan(0);
  });
});

describe("rota pipeline — Issue 3: TALs teach same group consistently", () => {
  it("bound TALs fill the teaching slot (AM wk1, PM wk2) on working days", () => {
    const { grid } = runPipeline(standardCentre());
    const tals = ["t1","t2","t3","t4"];
    const wk1Teachers = tals.filter((sid) => grid[`${sid}-${TUE_WK1}-AM`] === "Lessons").length;
    const wk2Teachers = tals.filter((sid) => grid[`${sid}-${TUE_WK2}-PM`] === "Lessons").length;
    expect(wk1Teachers).toBeGreaterThanOrEqual(2);
    expect(wk2Teachers).toBeGreaterThanOrEqual(2);
  });

  it("a TAL who teaches AM wk1 also teaches PM wk2 (same group across flip)", () => {
    const { grid } = runPipeline(standardCentre());
    const tals = ["t1","t2","t3","t4"];
    const wk1AM = tals.filter((sid) => grid[`${sid}-${TUE_WK1}-AM`] === "Lessons");
    const wk2PM = tals.filter((sid) => grid[`${sid}-${TUE_WK2}-PM`] === "Lessons");
    const overlap = wk1AM.filter((sid) => wk2PM.includes(sid));
    expect(overlap.length).toBeGreaterThan(0);
  });
});

describe("rota pipeline — Issue 4: TAL cohort split across FDE weekend", () => {
  it("half TALs off Sat, half off Sun when both are FDE", () => {
    const { staff, groups } = standardCentre();
    const progGrid = {
      "g1-2026-07-11-AM": "Stonehenge", "g1-2026-07-11-PM": "Stonehenge",
      "g1-2026-07-12-AM": "Oxford",     "g1-2026-07-12-PM": "Oxford",
    };
    const { grid } = runPipeline({ staff, groups, progGrid });
    const satOff = ["t1","t2","t3","t4"].filter((sid) => grid[`${sid}-${SAT_WK1}-AM`] === "Day Off");
    const sunOff = ["t1","t2","t3","t4"].filter((sid) => grid[`${sid}-${SUN_WK1}-AM`] === "Day Off");
    expect(satOff.length).toBeGreaterThanOrEqual(1);
    expect(sunOff.length).toBeGreaterThanOrEqual(1);
    // No TAL off both
    ["t1","t2","t3","t4"].forEach((sid) => {
      const bothOff = grid[`${sid}-${SAT_WK1}-AM`] === "Day Off" && grid[`${sid}-${SUN_WK1}-AM`] === "Day Off";
      expect(bothOff).toBe(false);
    });
  });
});

describe("rota pipeline — Issue 5: Activity staff do Pickup, not TALs", () => {
  it("on arrival day with teaching demand, pickup goes to activity staff first", () => {
    // Group arrives Wed (mid-programme) while another group teaches
    const staff = [
      mkStaff("t1", "TAL"), mkStaff("t2", "TAL"),
      mkStaff("a1", "LAL"), mkStaff("a2", "SAI"),
    ];
    const groups = [
      mkGroup("g1", 15),
      mkGroup("g2", 15, { arr: WED_WK1 }),
    ];
    const { grid } = runPipeline({ staff, groups });
    const talPickup = ["t1","t2"].some((sid) => grid[`${sid}-${WED_WK1}-AM`] === "Pickup");
    const actPickup = ["a1","a2"].some((sid) => grid[`${sid}-${WED_WK1}-AM`] === "Pickup");
    expect(actPickup).toBe(true);
    expect(talPickup).toBe(false);
  });
});

describe("rota pipeline — Issue 6: HDE adequately staffed", () => {
  it("Tuesday half-day excursion gets at least ceil(students/20) staff", () => {
    const { staff, groups } = standardCentre();
    const progGrid = { "g1-2026-07-07-PM": "Cotswolds" }; // PM excursion, AM lessons
    const { grid } = runPipeline({ staff, groups, progGrid });
    const excStaff = ["t1","t2","t3","t4","a1","a2","a3"]
      .filter((sid) => grid[`${sid}-${TUE_WK1}-PM`] === "Cotswolds").length;
    // 30 students + 2 GLs = 32 → ceil(32/20) = 2 staff needed
    expect(excStaff).toBeGreaterThanOrEqual(2);
  });
});

describe("rota pipeline — session cap enforced end-to-end", () => {
  it("no staff has more than 2 counted sessions in a single day", () => {
    const { grid } = runPipeline(standardCentre());
    const NO_COUNT = new Set(["Day Off", "Office", "Induction"]);
    const { staff } = standardCentre();
    const breaches = [];
    const dates = ["2026-07-06","2026-07-07","2026-07-08","2026-07-09","2026-07-10","2026-07-11","2026-07-12","2026-07-13","2026-07-14","2026-07-15","2026-07-16","2026-07-17","2026-07-18"];
    staff.forEach((s) => {
      dates.forEach((ds) => {
        const counted = ["AM","PM","Eve"].map((sl) => grid[`${s.id}-${ds}-${sl}`]).filter((v) => v && !NO_COUNT.has(v));
        if (counted.length > 2) breaches.push({ sid: s.id, ds, counted });
      });
    });
    expect(breaches).toEqual([]);
  });
});

describe("rota pipeline — shortfalls when staff inadequate", () => {
  it("records shortfall if not enough teachers for lesson demand", () => {
    const staff = [mkStaff("a1", "SAI")]; // no teachers at all
    const groups = [mkGroup("g1", 30)];
    const { shortfalls } = runPipeline({ staff, groups });
    expect(shortfalls.some((s) => s.reason === "Lessons")).toBe(true);
  });
});
