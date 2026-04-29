import { describe, it, expect } from "vitest";
import { buildDemand } from "../lib/rotaDemand";
import { bindTals } from "../lib/rotaBinding";
import { allocateRota } from "../lib/rotaAllocator";

const PROG_START = "2026-07-06";
const PROG_END = "2026-07-19";
const TUE_WK1 = "2026-07-07";
const TUE_WK2 = "2026-07-14";
const SAT = "2026-07-11";

function mkStaff(id, role) { return { id, name: id, role, arr: PROG_START, dep: PROG_END }; }
function mkGroup(over = {}) { return { id: "g1", group: "A", arr: PROG_START, dep: PROG_END, stu: 15, gl: 0, lessonSlot: "AM", ...over }; }

function setup({ staff, groups, progGrid = {}, fixedGrid = {} }) {
  const d = buildDemand({ groups, progGrid, progStart: PROG_START, progEnd: PROG_END });
  const bindings = bindTals({ staff, groups });
  const dates = Object.keys(d.demand).sort();
  const result = allocateRota({ staff, demand: d.demand, bindings, fixedGrid, dates });
  return { ...result, bindings, profiles: d.profiles };
}

describe("allocateRota — lessons", () => {
  it("bound TAL teaches their group AM in week 1", () => {
    const { grid } = setup({ staff: [mkStaff("t1", "TAL")], groups: [mkGroup()] });
    expect(grid[`t1-${TUE_WK1}-AM`]).toBe("Lessons");
  });

  it("bound TAL teaches PM in week 2 (lessonSlot flip)", () => {
    const { grid } = setup({ staff: [mkStaff("t1", "TAL")], groups: [mkGroup()] });
    expect(grid[`t1-${TUE_WK2}-PM`]).toBe("Lessons");
  });

  it("FTT tops up when lesson demand exceeds bound TALs", () => {
    const staff = [mkStaff("t1", "TAL"), mkStaff("f1", "FTT")];
    const { grid } = setup({ staff, groups: [mkGroup({ stu: 30 })] });
    expect(grid[`t1-${TUE_WK1}-AM`]).toBe("Lessons");
    expect(grid[`f1-${TUE_WK1}-AM`]).toBe("Lessons");
  });

  it("records shortfall when no teachers available", () => {
    const staff = [mkStaff("a1", "SAI")];
    const { shortfalls } = setup({ staff, groups: [mkGroup()] });
    expect(shortfalls.some((s) => s.reason === "Lessons" && s.date === TUE_WK1)).toBe(true);
  });
});

describe("allocateRota — FDE (spanSlots)", () => {
  it("assigns both AM and PM of FDE to same staff", () => {
    const staff = [mkStaff("a1", "LAL"), mkStaff("a2", "SAI")];
    const progGrid = { "g1-2026-07-11-AM": "Stonehenge", "g1-2026-07-11-PM": "Stonehenge" };
    const { grid } = setup({ staff, groups: [mkGroup()], progGrid });
    expect(grid[`a1-${SAT}-AM`]).toBe("Stonehenge");
    expect(grid[`a1-${SAT}-PM`]).toBe("Stonehenge");
  });
});

describe("allocateRota — Eve Activity", () => {
  it("prefers TAL over activity for Eve", () => {
    const staff = [mkStaff("t1", "TAL"), mkStaff("a1", "SAI"), mkStaff("a2", "LAL")];
    const { grid } = setup({ staff, groups: [mkGroup()] });
    expect(grid[`t1-${TUE_WK1}-Eve`]).toBe("Eve Activity");
  });

  it("assigns at least 2 staff per evening with students", () => {
    const staff = [mkStaff("t1", "TAL"), mkStaff("a1", "SAI"), mkStaff("a2", "LAL"), mkStaff("a3", "EAL")];
    const { grid } = setup({ staff, groups: [mkGroup()] });
    const eveCount = ["t1", "a1", "a2", "a3"].filter((sid) => grid[`${sid}-${TUE_WK1}-Eve`] === "Eve Activity").length;
    expect(eveCount).toBeGreaterThanOrEqual(2);
  });

  it("Eve-roster TAL keeps their non-teaching slot empty", () => {
    const staff = [mkStaff("t1", "TAL"), mkStaff("a1", "SAI")];
    const { grid } = setup({ staff, groups: [mkGroup()] });
    // t1 teaches AM + Eve. PM should be empty (no 3-session day).
    expect(grid[`t1-${TUE_WK1}-AM`]).toBe("Lessons");
    expect(grid[`t1-${TUE_WK1}-Eve`]).toBe("Eve Activity");
    expect(grid[`t1-${TUE_WK1}-PM`]).toBeFalsy();
  });

  it("records shortfall when not enough Eve-eligible staff", () => {
    const staff = [mkStaff("f1", "FTT"), mkStaff("c1", "CM")];
    const { shortfalls } = setup({ staff, groups: [mkGroup()] });
    expect(shortfalls.some((s) => s.slot === "Eve")).toBe(true);
  });
});

describe("allocateRota — session cap", () => {
  it("no staff has more than 2 counted sessions in a day", () => {
    const staff = [
      mkStaff("t1", "TAL"), mkStaff("t2", "TAL"),
      mkStaff("a1", "SAI"), mkStaff("a2", "LAL"),
      mkStaff("f1", "FTT"),
    ];
    const { grid } = setup({ staff, groups: [mkGroup({ stu: 30 })] });
    const over = [];
    staff.forEach((s) => {
      const days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(PROG_START); d.setDate(d.getDate() + i);
        return d.toISOString().split("T")[0];
      });
      days.forEach((ds) => {
        const slots = ["AM", "PM", "Eve"].map((sl) => grid[`${s.id}-${ds}-${sl}`]).filter(Boolean);
        const counted = slots.filter((v) => !["Day Off", "Induction"].includes(v));
        if (counted.length > 2) over.push({ sid: s.id, ds, counted });
      });
    });
    expect(over).toEqual([]);
  });
});

describe("allocateRota — fixedGrid precedence", () => {
  it("preserves pre-assigned Day Off cells", () => {
    const staff = [mkStaff("t1", "TAL"), mkStaff("t2", "TAL")];
    const fixedGrid = { [`t1-${TUE_WK1}-AM`]: "Day Off", [`t1-${TUE_WK1}-PM`]: "Day Off", [`t1-${TUE_WK1}-Eve`]: "Day Off" };
    const { grid } = setup({ staff, groups: [mkGroup()], fixedGrid });
    expect(grid[`t1-${TUE_WK1}-AM`]).toBe("Day Off");
  });

  it("preserves Airport on departure slot", () => {
    const staff = [mkStaff("t1", "TAL"), mkStaff("t2", "TAL")];
    const fixedGrid = { [`t1-${TUE_WK1}-AM`]: "Airport" };
    const { grid } = setup({ staff, groups: [mkGroup()], fixedGrid });
    expect(grid[`t1-${TUE_WK1}-AM`]).toBe("Airport");
  });
});

describe("allocateRota — Pickup", () => {
  it("activity staff pick up groups on arrival day, not TAL if teaching demand exists", () => {
    const staff = [mkStaff("t1", "TAL"), mkStaff("a1", "LAL"), mkStaff("a2", "SAI")];
    const { grid } = setup({ staff, groups: [mkGroup()] });
    const mon = "2026-07-06";
    const pickupAssigned = ["a1", "a2"].filter((sid) => grid[`${sid}-${mon}-AM`] === "Pickup");
    expect(pickupAssigned.length).toBeGreaterThan(0);
  });
});

describe("allocateRota — management", () => {
  it("CM/CD get Office AM and PM", () => {
    const staff = [mkStaff("c1", "CM"), mkStaff("t1", "TAL"), mkStaff("a1", "SAI")];
    const { grid } = setup({ staff, groups: [mkGroup()] });
    expect(grid[`c1-${TUE_WK1}-AM`]).toBe("Office");
    expect(grid[`c1-${TUE_WK1}-PM`]).toBe("Office");
  });
});
