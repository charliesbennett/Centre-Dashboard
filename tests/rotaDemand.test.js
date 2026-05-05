import { describe, it, expect } from "vitest";
import { buildDemand, STUDENTS_PER_TEACHER, STUDENTS_PER_STAFF, MIN_EVE_STAFF, PREFER_LESSONS, PREFER_EXCURSION, PREFER_EVE, PREFER_PICKUP } from "../lib/rotaDemand";

// Monday 2026-07-06 → Sunday 2026-07-19 (2 weeks)
const PROG_START = "2026-07-06";
const PROG_END = "2026-07-19";

function mkGroup(overrides = {}) {
  return { id: "g1", group: "Group A", arr: "2026-07-06", dep: "2026-07-19", stu: 16, gl: 1, lessonSlot: "AM", ...overrides };
}

describe("buildDemand — guards", () => {
  it("returns empty when progStart missing", () => {
    const r = buildDemand({ groups: [mkGroup()], progEnd: PROG_END });
    expect(r.demand).toEqual({});
    expect(r.profiles).toEqual({});
  });

  it("returns empty when progEnd missing", () => {
    const r = buildDemand({ groups: [mkGroup()], progStart: PROG_START });
    expect(r.demand).toEqual({});
  });

  it("returns empty demand before first group arrival", () => {
    const groups = [mkGroup({ arr: "2026-07-08" })];
    const r = buildDemand({ groups, progStart: PROG_START, progEnd: PROG_END });
    expect(r.demand["2026-07-06"]).toEqual({ AM: [], PM: [], Eve: [] });
    expect(r.demand["2026-07-07"]).toEqual({ AM: [], PM: [], Eve: [] });
  });
});

describe("buildDemand — lesson demand", () => {
  it("emits one Lessons cell per group in their slot on a weekday", () => {
    const r = buildDemand({ groups: [mkGroup({ stu: 32 })], progStart: PROG_START, progEnd: PROG_END });
    const tue = r.demand["2026-07-07"];
    const lessons = tue.AM.filter((c) => c.kind === "Lessons");
    expect(lessons).toHaveLength(1);
    expect(lessons[0].groupId).toBe("g1");
    expect(lessons[0].need).toBe(Math.ceil(33 / STUDENTS_PER_TEACHER));
  });

  it("Lessons preference puts boundTAL first", () => {
    const r = buildDemand({ groups: [mkGroup()], progStart: PROG_START, progEnd: PROG_END });
    const lesson = r.demand["2026-07-07"].AM.find((c) => c.kind === "Lessons");
    expect(lesson.prefer).toEqual(PREFER_LESSONS);
    expect(lesson.prefer[0]).toBe("boundTAL");
  });

  it("no Lessons on the group's arrival day", () => {
    const r = buildDemand({ groups: [mkGroup()], progStart: PROG_START, progEnd: PROG_END });
    expect(r.demand["2026-07-06"].AM.filter((c) => c.kind === "Lessons")).toHaveLength(0);
  });

  it("no Lessons on the group's departure day", () => {
    const r = buildDemand({ groups: [mkGroup()], progStart: PROG_START, progEnd: PROG_END });
    expect(r.demand["2026-07-19"].AM.filter((c) => c.kind === "Lessons")).toHaveLength(0);
  });

  it("lesson slot flips in week 2 (AM→PM)", () => {
    const r = buildDemand({ groups: [mkGroup({ lessonSlot: "AM" })], progStart: PROG_START, progEnd: PROG_END });
    const wk1Tue = r.demand["2026-07-07"];
    const wk2Tue = r.demand["2026-07-14"];
    expect(wk1Tue.AM.some((c) => c.kind === "Lessons")).toBe(true);
    expect(wk1Tue.PM.some((c) => c.kind === "Lessons")).toBe(false);
    expect(wk2Tue.AM.some((c) => c.kind === "Lessons")).toBe(false);
    expect(wk2Tue.PM.some((c) => c.kind === "Lessons")).toBe(true);
  });

  it("two groups in opposite slots emit two Lessons cells", () => {
    const groups = [mkGroup({ id: "g1", lessonSlot: "AM" }), mkGroup({ id: "g2", lessonSlot: "PM" })];
    const r = buildDemand({ groups, progStart: PROG_START, progEnd: PROG_END });
    const tue = r.demand["2026-07-07"];
    expect(tue.AM.filter((c) => c.kind === "Lessons")).toHaveLength(1);
    expect(tue.PM.filter((c) => c.kind === "Lessons")).toHaveLength(1);
  });

  it("ZZ mode: lesson demand in both AM and PM for every group", () => {
    const r = buildDemand({ groups: [mkGroup({ lessonSlot: "AM" })], progStart: PROG_START, progEnd: PROG_END, isZZ: true });
    const tue = r.demand["2026-07-07"];
    expect(tue.AM.some((c) => c.kind === "Lessons")).toBe(true);
    expect(tue.PM.some((c) => c.kind === "Lessons")).toBe(true);
  });

  it("ZZ mode: lesson demand in both slots in week 2 (no flip)", () => {
    const r = buildDemand({ groups: [mkGroup({ lessonSlot: "AM" })], progStart: PROG_START, progEnd: PROG_END, isZZ: true });
    const wk2Tue = r.demand["2026-07-14"];
    expect(wk2Tue.AM.some((c) => c.kind === "Lessons")).toBe(true);
    expect(wk2Tue.PM.some((c) => c.kind === "Lessons")).toBe(true);
  });
});

describe("buildDemand — excursion demand", () => {
  it("emits Excursion cell per progGrid destination on a half-day", () => {
    const groups = [mkGroup({ stu: 40 })];
    const progGrid = { "g1-2026-07-07-PM": "National Gallery" };
    const r = buildDemand({ groups, progGrid, progStart: PROG_START, progEnd: PROG_END });
    const tue = r.demand["2026-07-07"];
    const exc = tue.PM.find((c) => c.kind === "Excursion");
    expect(exc.dest).toBe("National Gallery");
    expect(exc.need).toBe(Math.ceil(41 / STUDENTS_PER_STAFF));
    expect(exc.prefer).toEqual(PREFER_EXCURSION);
  });

  it("ignores 'Arrival' and 'Departure' text in progGrid", () => {
    const progGrid = { "g1-2026-07-07-PM": "Arrival Day" };
    const r = buildDemand({ groups: [mkGroup()], progGrid, progStart: PROG_START, progEnd: PROG_END });
    expect(r.demand["2026-07-07"].PM.some((c) => c.kind === "Excursion")).toBe(false);
  });
});

describe("buildDemand — FDE", () => {
  it("FDE emits one Excursion cell with spanSlots AM+PM under AM", () => {
    const groups = [mkGroup({ stu: 40 })];
    const progGrid = {
      "g1-2026-07-11-AM": "Stonehenge",
      "g1-2026-07-11-PM": "Stonehenge",
    };
    const r = buildDemand({ groups, progGrid, progStart: PROG_START, progEnd: PROG_END });
    const sat = r.demand["2026-07-11"];
    expect(r.profiles["2026-07-11"].isFDE).toBe(true);
    const fde = sat.AM.find((c) => c.kind === "Excursion");
    expect(fde.dest).toBe("Stonehenge");
    expect(fde.spanSlots).toEqual(["AM", "PM"]);
    expect(sat.PM).toHaveLength(0);
  });

  it("FDE need = ceil(totalStudents/20)", () => {
    const groups = [mkGroup({ stu: 45, gl: 0 })];
    const progGrid = { "g1-2026-07-11-AM": "Stonehenge", "g1-2026-07-11-PM": "Stonehenge" };
    const r = buildDemand({ groups, progGrid, progStart: PROG_START, progEnd: PROG_END });
    const fde = r.demand["2026-07-11"].AM.find((c) => c.kind === "Excursion");
    expect(fde.need).toBe(Math.ceil(45 / STUDENTS_PER_STAFF));
  });
});

describe("buildDemand — testing day", () => {
  it("testing day emits Testing cells, not Lessons", () => {
    const groups = [mkGroup()];
    const progGrid = { "g1-2026-07-07-AM": "English Test", "g1-2026-07-07-PM": "Placement Test" };
    const r = buildDemand({ groups, progGrid, progStart: PROG_START, progEnd: PROG_END });
    const tue = r.demand["2026-07-07"];
    expect(tue.AM.some((c) => c.kind === "Lessons")).toBe(false);
    expect(tue.AM.some((c) => c.kind === "Testing")).toBe(true);
    expect(tue.PM.some((c) => c.kind === "Testing")).toBe(true);
  });
});

describe("buildDemand — eve activity", () => {
  it("Eve need = max(2, ceil(students/20)) on days with students", () => {
    const r = buildDemand({ groups: [mkGroup({ stu: 50, gl: 0 })], progStart: PROG_START, progEnd: PROG_END });
    const eve = r.demand["2026-07-07"].Eve[0];
    expect(eve.kind).toBe("EveActivity");
    expect(eve.need).toBe(Math.max(MIN_EVE_STAFF, Math.ceil(50 / STUDENTS_PER_STAFF)));
    expect(eve.prefer).toEqual(PREFER_EVE);
    expect(eve.prefer[0]).toBe("TAL");
  });

  it("Eve floor is 2 even when students are few", () => {
    const r = buildDemand({ groups: [mkGroup({ stu: 5, gl: 0 })], progStart: PROG_START, progEnd: PROG_END });
    expect(r.demand["2026-07-07"].Eve[0].need).toBe(MIN_EVE_STAFF);
  });

  it("no Eve demand on days before first arrival", () => {
    const groups = [mkGroup({ arr: "2026-07-08" })];
    const r = buildDemand({ groups, progStart: PROG_START, progEnd: PROG_END });
    expect(r.demand["2026-07-07"].Eve).toHaveLength(0);
  });

  it("no Eve demand on departure day (no students on site)", () => {
    const groups = [mkGroup({ dep: "2026-07-15" })];
    const r = buildDemand({ groups, progStart: PROG_START, progEnd: PROG_END });
    expect(r.demand["2026-07-15"].Eve).toHaveLength(0);
  });
});

describe("buildDemand — pickup", () => {
  it("emits Pickup on arrival day, need = arriving groups", () => {
    const groups = [mkGroup({ id: "g1" }), mkGroup({ id: "g2", group: "Group B" })];
    const r = buildDemand({ groups, progStart: PROG_START, progEnd: PROG_END });
    const mon = r.demand["2026-07-06"];
    const pickup = mon.AM.find((c) => c.kind === "Pickup");
    expect(pickup).toBeDefined();
    expect(pickup.need).toBe(2);
    expect(pickup.prefer).toEqual(PREFER_PICKUP);
  });

  it("no Pickup on non-arrival days", () => {
    const r = buildDemand({ groups: [mkGroup()], progStart: PROG_START, progEnd: PROG_END });
    expect(r.demand["2026-07-07"].AM.some((c) => c.kind === "Pickup")).toBe(false);
  });
});

describe("buildDemand — min ratio", () => {
  it("minRatio = ceil(students/20) - gls", () => {
    const r = buildDemand({ groups: [mkGroup({ stu: 40, gl: 2 })], progStart: PROG_START, progEnd: PROG_END });
    expect(r.minRatio["2026-07-07"].AM).toBe(Math.ceil(42 / STUDENTS_PER_STAFF) - 2);
  });

  it("minRatio never goes negative", () => {
    const r = buildDemand({ groups: [mkGroup({ stu: 10, gl: 5 })], progStart: PROG_START, progEnd: PROG_END });
    expect(r.minRatio["2026-07-07"].AM).toBeGreaterThanOrEqual(0);
  });
});

describe("buildDemand — profiles and meta", () => {
  it("isFirstArrival true only on earliest arrival date", () => {
    const groups = [mkGroup({ id: "g1", arr: "2026-07-06" }), mkGroup({ id: "g2", arr: "2026-07-08" })];
    const r = buildDemand({ groups, progStart: PROG_START, progEnd: PROG_END });
    expect(r.profiles["2026-07-06"].isFirstArrival).toBe(true);
    expect(r.profiles["2026-07-08"].isFirstArrival).toBe(false);
  });

  it("isArrival true on any group's arr date", () => {
    const groups = [mkGroup({ id: "g1", arr: "2026-07-06" }), mkGroup({ id: "g2", arr: "2026-07-08" })];
    const r = buildDemand({ groups, progStart: PROG_START, progEnd: PROG_END });
    expect(r.profiles["2026-07-06"].isArrival).toBe(true);
    expect(r.profiles["2026-07-08"].isArrival).toBe(true);
    expect(r.profiles["2026-07-07"].isArrival).toBe(false);
  });

  it("arrGroups counts groups per arrival date", () => {
    const groups = [mkGroup({ id: "g1", arr: "2026-07-06" }), mkGroup({ id: "g2", arr: "2026-07-06" })];
    const r = buildDemand({ groups, progStart: PROG_START, progEnd: PROG_END });
    expect(r.arrGroups["2026-07-06"]).toBe(2);
  });
});
