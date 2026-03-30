import { describe, it, expect } from "vitest";
import { getFortnights, getTodayFortnight } from "../lib/fortnights.js";

describe("STORY-F2: getFortnights", () => {
  it("returns 2 fortnights for a 28-day programme", () => {
    const result = getFortnights("2026-07-04", "2026-07-31");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ label: "Week 1–2", start: "2026-07-04", end: "2026-07-17" });
    expect(result[1]).toEqual({ label: "Week 3–4", start: "2026-07-18", end: "2026-07-31" });
  });

  it("returns 3 fortnights for a 42-day programme", () => {
    const result = getFortnights("2026-07-04", "2026-08-14");
    expect(result).toHaveLength(3);
    expect(result[0].label).toBe("Week 1–2");
    expect(result[1].label).toBe("Week 3–4");
    expect(result[2].label).toBe("Week 5–6");
    expect(result[0].start).toBe("2026-07-04");
    expect(result[0].end).toBe("2026-07-17");
    expect(result[1].start).toBe("2026-07-18");
    expect(result[1].end).toBe("2026-07-31");
    expect(result[2].start).toBe("2026-08-01");
    expect(result[2].end).toBe("2026-08-14");
  });

  it("returns 1 fortnight for a programme exactly 14 days long", () => {
    const result = getFortnights("2026-07-04", "2026-07-17");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ label: "Week 1–2", start: "2026-07-04", end: "2026-07-17" });
  });

  it("clamps final fortnight to progEnd when programme is not a multiple of 14", () => {
    // 20 days: fortnight 1 = days 1-14, fortnight 2 = days 15-20 (clamped)
    const result = getFortnights("2026-07-04", "2026-07-23");
    expect(result).toHaveLength(2);
    expect(result[1].start).toBe("2026-07-18");
    expect(result[1].end).toBe("2026-07-23");
  });

  it("returns empty array for null inputs", () => {
    expect(getFortnights(null, null)).toEqual([]);
    expect(getFortnights(null, "2026-08-01")).toEqual([]);
    expect(getFortnights("2026-07-04", null)).toEqual([]);
  });

  it("labels increment correctly: Week 1–2, Week 3–4, Week 5–6", () => {
    const result = getFortnights("2026-07-04", "2026-08-14");
    expect(result.map((f) => f.label)).toEqual(["Week 1–2", "Week 3–4", "Week 5–6"]);
  });
});

describe("STORY-F2: getTodayFortnight", () => {
  const fortnights = [
    { label: "Week 1–2", start: "2026-07-04", end: "2026-07-17" },
    { label: "Week 3–4", start: "2026-07-18", end: "2026-08-01" },
  ];

  it("returns index 0 for a date in the first fortnight", () => {
    expect(getTodayFortnight(fortnights, "2026-07-10")).toBe(0);
  });

  it("returns index 1 for a date in the second fortnight", () => {
    expect(getTodayFortnight(fortnights, "2026-07-20")).toBe(1);
  });

  it("returns 0 for a date before the programme", () => {
    expect(getTodayFortnight(fortnights, "2026-01-01")).toBe(0);
  });

  it("returns 0 for a date after the programme", () => {
    expect(getTodayFortnight(fortnights, "2026-09-01")).toBe(0);
  });

  it("returns correct index for boundary dates (first day of fortnight)", () => {
    expect(getTodayFortnight(fortnights, "2026-07-18")).toBe(1);
  });

  it("returns correct index for boundary dates (last day of fortnight)", () => {
    expect(getTodayFortnight(fortnights, "2026-07-17")).toBe(0);
  });

  it("returns 0 for empty fortnights array", () => {
    expect(getTodayFortnight([], "2026-07-10")).toBe(0);
  });
});
