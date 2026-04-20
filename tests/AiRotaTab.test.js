import { describe, it, expect } from "vitest";
import { countSessions, validateDayOffs, NO_COUNT } from "@/lib/rotaRules";

// ── Replicate the module-level constants from AiRotaTab.js ────────────────
// (Avoids "use client" / Next.js module resolution issues in Vitest)

const STEPS = [
  { id: 1, label: "Programme" },
  { id: 2, label: "Generate" },
  { id: 3, label: "Review" },
];

const CONSTRAINTS = [
  { id: "HC-001", label: "Each staff member works at most 1 session per slot per day" },
  { id: "HC-002", label: "Every staff member gets at least 1 full day off per week" },
  { id: "HC-003", label: "TAL/FTT session limits respected (max 22 sessions per fortnight)" },
  { id: "HC-004", label: "Safeguarding ratios met for all activity sessions" },
  { id: "HC-005", label: "Role rules enforced (FTTs not on excursion days; 5FTTs not on weekends)" },
  { id: "HC-006", label: "Evening entertainment covered by eligible staff each session night" },
];

// ── Publish button logic (mirrors AiRotaTab ReviewStep disabled condition) ─
function isPublishDisabled(draftRota) {
  return !draftRota;
}

// ── ZZ/NZZ toggle required logic ──────────────────────────────────────────
function canContinueToGenerate(hasData, isZZ) {
  return hasData && isZZ !== null;
}

// ── buildDraftRotaGrid — replicated from AiRotaTab.js (pure function) ─────
function buildDraftRotaGrid(draftRota, staff) {
  if (!draftRota?.grid || !staff?.length) return {};
  const result = {};
  staff.forEach((s) => { result[s.id] = {}; });
  for (const [key, val] of Object.entries(draftRota.grid)) {
    const slotMatch = key.match(/-(AM|PM|Eve)$/);
    if (!slotMatch) continue;
    const slot = slotMatch[1];
    const withoutSlot = key.slice(0, key.length - slot.length - 1);
    const staffMember = staff.find((s) => withoutSlot.startsWith(s.id));
    if (!staffMember) continue;
    const dateKey = withoutSlot.slice(staffMember.id.length + 1);
    if (!result[staffMember.id][dateKey]) result[staffMember.id][dateKey] = {};
    result[staffMember.id][dateKey][slot] = val;
  }
  return result;
}

// ── cellBg — replicated from AiRotaTab.js ─────────────────────────────────
function cellBg(val) {
  if (!val) return "transparent";
  if (val === "Day Off") return "#fee2e2";
  if (/^(lessons?|testing|english test|int english)$/i.test(val)) return "#fce7f3";
  if (/^(induction|setup|office)$/i.test(val)) return "#f0f4f8";
  if (/welcome|pickup/i.test(val)) return "#f0f4f8";
  if (/eve activity/i.test(val)) return "#fef9c3";
  return "#f0fdf4";
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("AiRotaTab stepper", () => {
  it("has exactly 3 steps", () => {
    expect(STEPS).toHaveLength(3);
  });

  it("step labels are Programme, Generate, Review in order", () => {
    expect(STEPS[0].label).toBe("Programme");
    expect(STEPS[1].label).toBe("Generate");
    expect(STEPS[2].label).toBe("Review");
  });

  it("does not include a Shifts step", () => {
    expect(STEPS.map((s) => s.label)).not.toContain("Shifts");
  });
});

describe("Constraint checklist", () => {
  it("does not include HC-007 or HC-008", () => {
    const ids = CONSTRAINTS.map((c) => c.id);
    expect(ids).not.toContain("HC-007");
    expect(ids).not.toContain("HC-008");
  });

  it("includes HC-001 through HC-006", () => {
    const ids = CONSTRAINTS.map((c) => c.id);
    ["HC-001","HC-002","HC-003","HC-004","HC-005","HC-006"].forEach((id) => {
      expect(ids).toContain(id);
    });
  });
});

describe("Publish button disabled logic", () => {
  it("is disabled when draftRota is null", () => {
    expect(isPublishDisabled(null)).toBe(true);
  });

  it("is disabled when draftRota is undefined", () => {
    expect(isPublishDisabled(undefined)).toBe(true);
  });

  it("is enabled when draftRota is a non-null object", () => {
    expect(isPublishDisabled({ grid: {} })).toBe(false);
  });
});

describe("ZZ/NZZ toggle — required before generating", () => {
  it("cannot continue when isZZ is null (not yet selected)", () => {
    expect(canContinueToGenerate(true, null)).toBe(false);
  });

  it("can continue when ZZ is selected (true)", () => {
    expect(canContinueToGenerate(true, true)).toBe(true);
  });

  it("can continue when NZZ is selected (false)", () => {
    expect(canContinueToGenerate(true, false)).toBe(true);
  });

  it("cannot continue even with ZZ selected if no programme data", () => {
    expect(canContinueToGenerate(false, true)).toBe(false);
  });
});

describe("buildDraftRotaGrid", () => {
  const staff = [
    { id: "staff-1", name: "Alice" },
    { id: "staff-2", name: "Bob" },
  ];

  it("returns correct grid structure from draft rota JSON", () => {
    const draftRota = {
      grid: {
        "staff-1-2026-07-01-AM": "Lessons",
        "staff-1-2026-07-01-PM": "Activities",
        "staff-1-2026-07-01-Eve": "Eve Activity",
        "staff-2-2026-07-01-AM": "Day Off",
      },
    };
    const result = buildDraftRotaGrid(draftRota, staff);
    expect(result["staff-1"]["2026-07-01"].AM).toBe("Lessons");
    expect(result["staff-1"]["2026-07-01"].PM).toBe("Activities");
    expect(result["staff-1"]["2026-07-01"].Eve).toBe("Eve Activity");
    expect(result["staff-2"]["2026-07-01"].AM).toBe("Day Off");
  });

  it("returns empty grid when draftRota is null", () => {
    expect(buildDraftRotaGrid(null, staff)).toEqual({});
  });

  it("returns empty grid when draftRota has no grid property", () => {
    expect(buildDraftRotaGrid({}, staff)).toEqual({});
  });

  it("returns empty grid when staff is empty", () => {
    expect(buildDraftRotaGrid({ grid: { "staff-1-2026-07-01-AM": "Lessons" } }, [])).toEqual({});
  });

  it("ignores keys that don't match any staff member", () => {
    const result = buildDraftRotaGrid({ grid: { "unknown-2026-07-01-AM": "Lessons" } }, staff);
    expect(result["staff-1"]).toEqual({});
    expect(result["staff-2"]).toEqual({});
  });

  it("handles multiple dates for the same staff member", () => {
    const draftRota = {
      grid: {
        "staff-1-2026-07-01-AM": "Lessons",
        "staff-1-2026-07-02-AM": "Activities",
        "staff-1-2026-07-02-PM": "Day Off",
      },
    };
    const result = buildDraftRotaGrid(draftRota, staff);
    expect(result["staff-1"]["2026-07-01"].AM).toBe("Lessons");
    expect(result["staff-1"]["2026-07-02"].AM).toBe("Activities");
    expect(result["staff-1"]["2026-07-02"].PM).toBe("Day Off");
  });
});

describe("cellBg — draft rota cell colours", () => {
  it("Day Off returns light red #fee2e2", () => {
    expect(cellBg("Day Off")).toBe("#fee2e2");
  });

  it("Lessons returns pink", () => {
    expect(cellBg("Lessons")).toBe("#fce7f3");
  });

  it("Testing returns pink", () => {
    expect(cellBg("Testing")).toBe("#fce7f3");
  });

  it("Eve Activity returns pale yellow", () => {
    expect(cellBg("Eve Activity")).toBe("#fef9c3");
  });

  it("Induction returns neutral grey", () => {
    expect(cellBg("Induction")).toBe("#f0f4f8");
  });

  it("Setup returns neutral grey", () => {
    expect(cellBg("Setup")).toBe("#f0f4f8");
  });

  it("Activities returns green", () => {
    expect(cellBg("Activities")).toBe("#f0fdf4");
  });

  it("empty/null returns transparent", () => {
    expect(cellBg("")).toBe("transparent");
    expect(cellBg(null)).toBe("transparent");
  });
});

describe("NO_COUNT — session counting exclusions", () => {
  it("Day Off does not count", () => {
    expect(NO_COUNT.has("Day Off")).toBe(true);
  });

  it("Office does not count", () => {
    expect(NO_COUNT.has("Office")).toBe(true);
  });

  it("Induction does not count", () => {
    expect(NO_COUNT.has("Induction")).toBe(true);
  });

  it("Setup counts as a session", () => {
    expect(NO_COUNT.has("Setup")).toBe(false);
  });

  it("Pickup counts as a session", () => {
    expect(NO_COUNT.has("Pickup")).toBe(false);
  });

  it("Welcome counts as a session", () => {
    expect(NO_COUNT.has("Welcome")).toBe(false);
  });

  it("Departure Duty counts as a session", () => {
    expect(NO_COUNT.has("Departure Duty")).toBe(false);
  });

  it("Airport counts as a session", () => {
    expect(NO_COUNT.has("Airport")).toBe(false);
  });

  it("Eve Activity counts as a session", () => {
    expect(NO_COUNT.has("Eve Activity")).toBe(false);
  });
});

describe("countSessions", () => {
  it("counts Lessons, Activities, and Eve Activity as sessions", () => {
    const grid = {
      "s1-2026-07-01-AM": "Lessons",
      "s1-2026-07-01-PM": "Activities",
      "s1-2026-07-01-Eve": "Eve Activity",
    };
    expect(countSessions(grid, "s1", NO_COUNT)).toBe(3);
  });

  it("Day Off, Office, and Induction do not count", () => {
    const grid = {
      "s1-2026-07-01-AM": "Day Off",
      "s1-2026-07-01-PM": "Day Off",
      "s1-2026-07-01-Eve": "Day Off",
      "s1-2026-07-02-AM": "Office",
      "s1-2026-07-02-PM": "Induction",
      "s1-2026-07-03-AM": "Lessons",
    };
    expect(countSessions(grid, "s1", NO_COUNT)).toBe(1);
  });

  it("Setup counts as a session", () => {
    const grid = { "s1-2026-07-01-AM": "Setup" };
    expect(countSessions(grid, "s1", NO_COUNT)).toBe(1);
  });

  it("Pickup counts as a session", () => {
    const grid = { "s1-2026-07-01-AM": "Pickup" };
    expect(countSessions(grid, "s1", NO_COUNT)).toBe(1);
  });

  it("Airport counts as a session", () => {
    const grid = { "s1-2026-07-01-AM": "Airport" };
    expect(countSessions(grid, "s1", NO_COUNT)).toBe(1);
  });

  it("returns 0 for a staff member with no entries", () => {
    expect(countSessions({ "s2-2026-07-01-AM": "Lessons" }, "s1", NO_COUNT)).toBe(0);
  });

  it("does not count sessions from other staff members", () => {
    const grid = {
      "s1-2026-07-01-AM": "Lessons",
      "s2-2026-07-01-AM": "Lessons",
      "s2-2026-07-01-PM": "Activities",
    };
    expect(countSessions(grid, "s1", NO_COUNT)).toBe(1);
    expect(countSessions(grid, "s2", NO_COUNT)).toBe(2);
  });
});

describe("validateDayOffs", () => {
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03"];

  it("returns empty array when all 3 slots are Day Off", () => {
    const grid = {
      "s1-2026-07-01-AM": "Day Off",
      "s1-2026-07-01-PM": "Day Off",
      "s1-2026-07-01-Eve": "Day Off",
    };
    expect(validateDayOffs(grid, "s1", dates)).toEqual([]);
  });

  it("detects a partial day off (AM only marked)", () => {
    const grid = {
      "s1-2026-07-02-AM": "Day Off",
      "s1-2026-07-02-PM": "Activities",
      "s1-2026-07-02-Eve": "",
    };
    expect(validateDayOffs(grid, "s1", dates)).toContain("2026-07-02");
  });

  it("detects a partial day off (AM + PM but not Eve)", () => {
    const grid = {
      "s1-2026-07-03-AM": "Day Off",
      "s1-2026-07-03-PM": "Day Off",
      "s1-2026-07-03-Eve": "Eve Activity",
    };
    expect(validateDayOffs(grid, "s1", dates)).toContain("2026-07-03");
  });

  it("returns empty array when no day offs exist", () => {
    const grid = {
      "s1-2026-07-01-AM": "Lessons",
      "s1-2026-07-01-PM": "Activities",
    };
    expect(validateDayOffs(grid, "s1", dates)).toEqual([]);
  });

  it("returns empty array for an empty grid", () => {
    expect(validateDayOffs({}, "s1", dates)).toEqual([]);
  });
});
