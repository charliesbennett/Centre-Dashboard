import { describe, it, expect } from "vitest";
import { bindTals } from "../lib/rotaBinding";

function mkTal(id, name = id) { return { id, name, role: "TAL", arr: "2026-07-06", dep: "2026-07-19" }; }
function mkGroup(id, stu, arr = "2026-07-06") { return { id, group: id.toUpperCase(), stu, gl: 1, arr, dep: "2026-07-19", lessonSlot: "AM" }; }

describe("bindTals — guards", () => {
  it("no TALs → empty binding", () => {
    const r = bindTals({ staff: [], groups: [mkGroup("g1", 16)] });
    expect(r.talGroup).toEqual({});
    expect(r.groupTals).toEqual({ g1: [] });
  });

  it("no groups → empty binding", () => {
    const r = bindTals({ staff: [mkTal("t1")], groups: [] });
    expect(r.talGroup).toEqual({});
    expect(r.groupTals).toEqual({});
  });

  it("groups with zero students excluded", () => {
    const r = bindTals({ staff: [mkTal("t1")], groups: [{ id: "g0", stu: 0, gl: 0 }, mkGroup("g1", 16)] });
    expect(r.talGroup.t1).toBe("g1");
    expect(r.groupTals.g0).toBeUndefined();
  });
});

describe("bindTals — single group", () => {
  it("1 TAL, 1 group → TAL bound to group", () => {
    const r = bindTals({ staff: [mkTal("t1")], groups: [mkGroup("g1", 16)] });
    expect(r.talGroup.t1).toBe("g1");
    expect(r.groupTals.g1).toEqual(["t1"]);
  });

  it("3 TALs, 1 group → all 3 bound to same group", () => {
    const tals = [mkTal("t1"), mkTal("t2"), mkTal("t3")];
    const r = bindTals({ staff: tals, groups: [mkGroup("g1", 48)] });
    expect(r.talGroup).toEqual({ t1: "g1", t2: "g1", t3: "g1" });
    expect(r.groupTals.g1).toEqual(["t1", "t2", "t3"]);
  });
});

describe("bindTals — multiple groups", () => {
  it("2 TALs, 2 equal groups → 1 TAL each", () => {
    const tals = [mkTal("t1"), mkTal("t2")];
    const groups = [mkGroup("g1", 16), mkGroup("g2", 16)];
    const r = bindTals({ staff: tals, groups });
    expect(r.groupTals.g1).toHaveLength(1);
    expect(r.groupTals.g2).toHaveLength(1);
  });

  it("weights binding by group size", () => {
    const tals = [mkTal("t1"), mkTal("t2"), mkTal("t3")];
    const groups = [mkGroup("g1", 32), mkGroup("g2", 16)];
    const r = bindTals({ staff: tals, groups });
    expect(r.groupTals.g1).toHaveLength(2);
    expect(r.groupTals.g2).toHaveLength(1);
  });

  it("extra TALs overflow into needier group first", () => {
    const tals = [mkTal("t1"), mkTal("t2"), mkTal("t3"), mkTal("t4"), mkTal("t5")];
    const groups = [mkGroup("g1", 32), mkGroup("g2", 16)];
    const r = bindTals({ staff: tals, groups });
    expect(r.groupTals.g1.length).toBeGreaterThanOrEqual(r.groupTals.g2.length);
    expect(r.groupTals.g1.length + r.groupTals.g2.length).toBe(5);
  });
});

describe("bindTals — stability", () => {
  it("deterministic: same input → same output", () => {
    const tals = [mkTal("t1"), mkTal("t2")];
    const groups = [mkGroup("g2", 16, "2026-07-06"), mkGroup("g1", 16, "2026-07-06")];
    const a = bindTals({ staff: tals, groups });
    const b = bindTals({ staff: tals, groups });
    expect(a).toEqual(b);
  });

  it("earlier-arriving group gets first TAL", () => {
    const tals = [mkTal("t1"), mkTal("t2")];
    const groups = [mkGroup("gLate", 16, "2026-07-13"), mkGroup("gEarly", 16, "2026-07-06")];
    const r = bindTals({ staff: tals, groups });
    expect(r.talGroup.t1).toBe("gEarly");
  });
});

describe("bindTals — ignores non-TAL staff", () => {
  it("FTT and activity staff not bound", () => {
    const staff = [{ id: "f1", role: "FTT" }, { id: "a1", role: "SAI" }, mkTal("t1")];
    const r = bindTals({ staff, groups: [mkGroup("g1", 16)] });
    expect(Object.keys(r.talGroup)).toEqual(["t1"]);
  });
});
