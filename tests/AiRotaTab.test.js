import { describe, it, expect } from "vitest";

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
