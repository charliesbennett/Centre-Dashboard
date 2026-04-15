import { describe, it, expect } from "vitest";
import { normaliseCentreName, centreMatchScore, matchCentre } from "@/lib/parseGroupsExcel";
import {
  applyTemplateToGroup,
  selectWeeks,
  groupDurationNights,
  autoMatchTemplate,
} from "@/lib/applyProgrammeTemplate";

// ── parseGroupsExcel helpers ────────────────────────────────────────────────

describe("normaliseCentreName", () => {
  it("lowercases and strips apostrophes", () => {
    expect(normaliseCentreName("Chetham's School")).toBe("chethams school");
  });
  it("replaces punctuation with spaces", () => {
    expect(normaliseCentreName("Dean Close, Cheltenham")).toBe("dean close cheltenham");
  });
  it("handles empty string", () => {
    expect(normaliseCentreName("")).toBe("");
  });
});

describe("centreMatchScore", () => {
  it("returns 1.0 for identical names", () => {
    expect(centreMatchScore("Queenswood School", "Queenswood School")).toBe(1);
  });
  it("returns high score for apostrophe variant", () => {
    const score = centreMatchScore("Chetham's School, Manchester", "Chetham's School, Manchester");
    expect(score).toBeGreaterThanOrEqual(0.8);
  });
  it("returns 0 for completely different names", () => {
    expect(centreMatchScore("Oxford University", "Manchester School")).toBe(0);
  });
});

describe("matchCentre", () => {
  const centres = [
    { id: "c1", name: "Queenswood School" },
    { id: "c2", name: "Dean Close, Cheltenham" },
    { id: "c3", name: "Chetham's School, Manchester" },
  ];

  it("matches Queenswood School correctly", () => {
    const match = matchCentre("Queenswood School", centres);
    expect(match?.centreId).toBe("c1");
  });
  it("matches Cheltenham correctly", () => {
    const match = matchCentre("Dean Close, Cheltenham", centres);
    expect(match?.centreId).toBe("c2");
  });
  it("returns null for unknown centre below threshold", () => {
    const match = matchCentre("Unknown Place", centres);
    expect(match).toBeNull();
  });
});

// ── applyProgrammeTemplate ──────────────────────────────────────────────────

const mondayTemplate = {
  Monday:    { am: "English Test",    pm: "Multi-Activity" },
  Tuesday:   { am: "English Lessons", pm: "London" },
  Wednesday: { am: "English Lessons", pm: "Workshop" },
  Thursday:  { am: "English Lessons", pm: "Activities" },
  Friday:    { am: "English Lessons", pm: "Activities" },
  Saturday:  { am: "Cambridge",       pm: "Cambridge" },
  Sunday:    { am: "",                pm: "" },
};

const thursdayTemplate = {
  Thursday:  { am: "English Test",    pm: "Multi-Activity" },
  Friday:    { am: "English Lessons", pm: "Cheltenham Tour" },
  Saturday:  { am: "Vlogging",        pm: "Vlogging" },
  Sunday:    { am: "Oxford",          pm: "Oxford" },
  Monday:    { am: "English Lessons", pm: "Activities" },
  Tuesday:   { am: "English Lessons", pm: "Gloucester" },
  Wednesday: { am: "English Lessons", pm: "Activities" },
};

describe("selectWeeks", () => {
  it("returns [0] for a 7-night group with a 2-week template", () => {
    expect(selectWeeks(7, 2)).toEqual([0]);
  });
  it("returns [0, 1] for a 14-night group with a 2-week template", () => {
    expect(selectWeeks(14, 2)).toEqual([0, 1]);
  });
  it("returns [0, 1] for a 13-night group with a 2-week template", () => {
    expect(selectWeeks(13, 2)).toEqual([0, 1]);
  });
  it("returns [0] for a 7-night group with a 1-week template", () => {
    expect(selectWeeks(7, 1)).toEqual([0]);
  });
  it("does not exceed available template weeks", () => {
    expect(selectWeeks(21, 2)).toEqual([0, 1]);
  });
});

describe("groupDurationNights", () => {
  it("calculates 7 nights correctly", () => {
    expect(groupDurationNights({ arr: "2026-07-07", dep: "2026-07-14" })).toBe(7);
  });
  it("calculates 14 nights correctly", () => {
    expect(groupDurationNights({ arr: "2026-07-07", dep: "2026-07-21" })).toBe(14);
  });
  it("returns 0 for missing dates", () => {
    expect(groupDurationNights({ arr: "", dep: "" })).toBe(0);
  });
});

describe("applyTemplateToGroup — Monday arrival", () => {
  const group = { id: "g1", arr: "2026-07-06", dep: "2026-07-13" }; // Monday to Monday (7N)

  it("maps Monday column to arrival date", () => {
    const cells = applyTemplateToGroup(group, [mondayTemplate], [0]);
    // Monday = arrival → ARRIVAL marker
    expect(cells["g1-2026-07-06-AM"]).toBe("ARRIVAL");
    expect(cells["g1-2026-07-06-PM"]).toBe("ARRIVAL");
  });

  it("maps Tuesday to arrival+1", () => {
    const cells = applyTemplateToGroup(group, [mondayTemplate], [0]);
    expect(cells["g1-2026-07-07-AM"]).toBe("English Lessons");
    expect(cells["g1-2026-07-07-PM"]).toBe("London");
  });

  it("sets departure day to DEPARTURE", () => {
    const cells = applyTemplateToGroup(group, [mondayTemplate], [0]);
    expect(cells["g1-2026-07-13-AM"]).toBe("DEPARTURE");
    expect(cells["g1-2026-07-13-PM"]).toBeUndefined();
  });

  it("does not write cells outside arr/dep range", () => {
    const cells = applyTemplateToGroup(group, [mondayTemplate], [0]);
    const outOfRange = Object.keys(cells).filter((k) => {
      const ds = k.split("-").slice(1, 4).join("-");
      return ds < group.arr || ds > group.dep;
    });
    expect(outOfRange).toHaveLength(0);
  });
});

describe("applyTemplateToGroup — Thursday arrival", () => {
  const group = { id: "g2", arr: "2026-07-09", dep: "2026-07-16" }; // Thursday to Thursday (7N)

  it("maps Thursday column to arrival date", () => {
    const cells = applyTemplateToGroup(group, [thursdayTemplate], [0]);
    expect(cells["g2-2026-07-09-AM"]).toBe("ARRIVAL");
  });

  it("maps Friday to arrival+1", () => {
    const cells = applyTemplateToGroup(group, [thursdayTemplate], [0]);
    expect(cells["g2-2026-07-10-AM"]).toBe("English Lessons");
    expect(cells["g2-2026-07-10-PM"]).toBe("Cheltenham Tour");
  });

  it("wraps correctly through Sunday → Monday → Tuesday", () => {
    const cells = applyTemplateToGroup(group, [thursdayTemplate], [0]);
    // Sunday = arrival+3 (2026-07-12)
    expect(cells["g2-2026-07-12-AM"]).toBe("Oxford");
    // Monday = arrival+4 (2026-07-13)
    expect(cells["g2-2026-07-13-AM"]).toBe("English Lessons");
    expect(cells["g2-2026-07-13-PM"]).toBe("Activities");
  });
});

describe("autoMatchTemplate", () => {
  const templates = [
    { id: "t7",  name: "Standard 7N",  durationNights: 7,  weeks: [{}] },
    { id: "t14", name: "Standard 14N", durationNights: 14, weeks: [{},{}] },
  ];

  it("matches 7-night group to 7N template", () => {
    const g = { arr: "2026-07-06", dep: "2026-07-13" };
    expect(autoMatchTemplate(g, templates)?.id).toBe("t7");
  });

  it("matches 14-night group to 14N template", () => {
    const g = { arr: "2026-07-06", dep: "2026-07-20" };
    expect(autoMatchTemplate(g, templates)?.id).toBe("t14");
  });

  it("matches 13-night group to 14N template (closest)", () => {
    const g = { arr: "2026-07-06", dep: "2026-07-19" };
    expect(autoMatchTemplate(g, templates)?.id).toBe("t14");
  });

  it("returns null for empty templates array", () => {
    expect(autoMatchTemplate({ arr: "2026-07-06", dep: "2026-07-13" }, [])).toBeNull();
  });
});
