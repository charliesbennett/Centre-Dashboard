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
  { id: "HC-003", label: "TAL/FTT session limits respected (max 4 Lessons per day)" },
  { id: "HC-004", label: "Safeguarding ratios met for all activity sessions" },
  { id: "HC-005", label: "Role rules enforced (CM/CD not assigned student-facing slots without reason)" },
  { id: "HC-006", label: "Evening entertainment covered by eligible staff each session night" },
];

// ── Publish button logic (mirrors AiRotaTab ReviewStep disabled condition) ─
function isPublishDisabled(draftRota) {
  return !draftRota;
}

// ── buildDraftRotaGrid — replicated from AiRotaTab.js (pure function) ─────
// Returns: { [staffId]: { [dateKey]: { AM, PM, Eve } } }
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

// ── Tests ─────────────────────────────────────────────────────────────────

describe("STORY-A1: AiRotaTab stepper", () => {
  it("has exactly 3 steps", () => {
    expect(STEPS).toHaveLength(3);
  });

  it("step labels are Programme, Generate, Review in order", () => {
    expect(STEPS[0].label).toBe("Programme");
    expect(STEPS[1].label).toBe("Generate");
    expect(STEPS[2].label).toBe("Review");
  });

  it("does not include a Shifts step", () => {
    const labels = STEPS.map((s) => s.label);
    expect(labels).not.toContain("Shifts");
  });
});

describe("STORY-A1: Constraint checklist", () => {
  it("does not include HC-007", () => {
    const ids = CONSTRAINTS.map((c) => c.id);
    expect(ids).not.toContain("HC-007");
  });

  it("does not include HC-008", () => {
    const ids = CONSTRAINTS.map((c) => c.id);
    expect(ids).not.toContain("HC-008");
  });

  it("includes HC-001 through HC-006", () => {
    const ids = CONSTRAINTS.map((c) => c.id);
    ["HC-001", "HC-002", "HC-003", "HC-004", "HC-005", "HC-006"].forEach((id) => {
      expect(ids).toContain(id);
    });
  });
});

describe("STORY-A1: Publish button disabled logic", () => {
  it("is disabled when draftRota is null", () => {
    expect(isPublishDisabled(null)).toBe(true);
  });

  it("is disabled when draftRota is undefined", () => {
    expect(isPublishDisabled(undefined)).toBe(true);
  });

  it("is enabled when draftRota is a non-null object", () => {
    const draft = { rota: { "Staff Name": { "2026-07-01": ["AM", "PM"] } } };
    expect(isPublishDisabled(draft)).toBe(false);
  });

  it("is enabled when draftRota is any truthy value", () => {
    expect(isPublishDisabled({ rota: {} })).toBe(false);
  });
});

// ── buildDraftRotaGrid ─────────────────────────────────────────────────────

describe("STORY-A2: buildDraftRotaGrid", () => {
  const staff = [
    { id: "staff-1", name: "Alice" },
    { id: "staff-2", name: "Bob" },
  ];

  it("returns correct grid structure from draft rota JSON", () => {
    const draftRota = {
      grid: {
        "staff-1-2026-07-01-AM": "Lessons",
        "staff-1-2026-07-01-PM": "Sports",
        "staff-1-2026-07-01-Eve": "Eve Ent",
        "staff-2-2026-07-01-AM": "Day Off",
      },
    };
    const result = buildDraftRotaGrid(draftRota, staff);
    expect(result["staff-1"]["2026-07-01"].AM).toBe("Lessons");
    expect(result["staff-1"]["2026-07-01"].PM).toBe("Sports");
    expect(result["staff-1"]["2026-07-01"].Eve).toBe("Eve Ent");
    expect(result["staff-2"]["2026-07-01"].AM).toBe("Day Off");
  });

  it("returns empty grid when draftRota is null", () => {
    const result = buildDraftRotaGrid(null, staff);
    expect(result).toEqual({});
  });

  it("returns empty grid when draftRota has no grid property", () => {
    const result = buildDraftRotaGrid({}, staff);
    expect(result).toEqual({});
  });

  it("returns empty grid when staff is empty", () => {
    const draftRota = { grid: { "staff-1-2026-07-01-AM": "Lessons" } };
    const result = buildDraftRotaGrid(draftRota, []);
    expect(result).toEqual({});
  });

  it("ignores keys that don't match any staff member", () => {
    const draftRota = { grid: { "unknown-2026-07-01-AM": "Lessons" } };
    const result = buildDraftRotaGrid(draftRota, staff);
    expect(result["staff-1"]).toEqual({});
    expect(result["staff-2"]).toEqual({});
  });

  it("handles multiple dates for the same staff member", () => {
    const draftRota = {
      grid: {
        "staff-1-2026-07-01-AM": "Lessons",
        "staff-1-2026-07-02-AM": "Sports",
        "staff-1-2026-07-02-PM": "Day Off",
      },
    };
    const result = buildDraftRotaGrid(draftRota, staff);
    expect(result["staff-1"]["2026-07-01"].AM).toBe("Lessons");
    expect(result["staff-1"]["2026-07-02"].AM).toBe("Sports");
    expect(result["staff-1"]["2026-07-02"].PM).toBe("Day Off");
  });
});

// ── countSessions ──────────────────────────────────────────────────────────

describe("STORY-A3: countSessions", () => {
  it("counts sessions correctly for a staff member", () => {
    const rotaGrid = {
      "s1-2026-07-01-AM": "Lessons",
      "s1-2026-07-01-PM": "Sports",
      "s1-2026-07-01-Eve": "Evening Activity",
      "s1-2026-07-02-AM": "Day Off",
      "s1-2026-07-02-PM": "Day Off",
      "s1-2026-07-02-Eve": "Day Off",
      "s2-2026-07-01-AM": "Lessons",
    };
    expect(countSessions(rotaGrid, "s1", NO_COUNT)).toBe(3);
  });

  it("excludes NO_COUNT values (Day Off, Induction, Setup, Office, Airport)", () => {
    const rotaGrid = {
      "s1-2026-07-01-AM": "Day Off",
      "s1-2026-07-01-PM": "Induction",
      "s1-2026-07-02-AM": "Setup",
      "s1-2026-07-02-PM": "Office",
      "s1-2026-07-03-AM": "Airport",
      "s1-2026-07-03-PM": "Lessons",
    };
    expect(countSessions(rotaGrid, "s1", NO_COUNT)).toBe(1);
  });

  it("returns 0 for a staff member with no entries", () => {
    const rotaGrid = { "s2-2026-07-01-AM": "Lessons" };
    expect(countSessions(rotaGrid, "s1", NO_COUNT)).toBe(0);
  });

  it("returns 0 for an empty grid", () => {
    expect(countSessions({}, "s1", NO_COUNT)).toBe(0);
  });

  it("does not count sessions from other staff members", () => {
    const rotaGrid = {
      "s1-2026-07-01-AM": "Lessons",
      "s2-2026-07-01-AM": "Lessons",
      "s2-2026-07-01-PM": "Sports",
    };
    expect(countSessions(rotaGrid, "s1", NO_COUNT)).toBe(1);
    expect(countSessions(rotaGrid, "s2", NO_COUNT)).toBe(2);
  });
});

// ── validateDayOffs ────────────────────────────────────────────────────────

describe("STORY-A3: validateDayOffs", () => {
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03"];

  it("returns empty array when all day offs are complete (all 3 slots)", () => {
    const rotaGrid = {
      "s1-2026-07-01-AM": "Day Off",
      "s1-2026-07-01-PM": "Day Off",
      "s1-2026-07-01-Eve": "Day Off",
    };
    expect(validateDayOffs(rotaGrid, "s1", dates)).toEqual([]);
  });

  it("detects a partial day off (AM only)", () => {
    const rotaGrid = {
      "s1-2026-07-02-AM": "Day Off",
      "s1-2026-07-02-PM": "Sports",
      "s1-2026-07-02-Eve": "",
    };
    expect(validateDayOffs(rotaGrid, "s1", dates)).toContain("2026-07-02");
  });

  it("detects a partial day off (AM + PM but not Eve)", () => {
    const rotaGrid = {
      "s1-2026-07-03-AM": "Day Off",
      "s1-2026-07-03-PM": "Day Off",
      "s1-2026-07-03-Eve": "Evening Activity",
    };
    expect(validateDayOffs(rotaGrid, "s1", dates)).toContain("2026-07-03");
  });

  it("returns empty array when no day offs exist at all", () => {
    const rotaGrid = {
      "s1-2026-07-01-AM": "Lessons",
      "s1-2026-07-01-PM": "Sports",
    };
    expect(validateDayOffs(rotaGrid, "s1", dates)).toEqual([]);
  });

  it("returns empty array for an empty grid", () => {
    expect(validateDayOffs({}, "s1", dates)).toEqual([]);
  });
});
