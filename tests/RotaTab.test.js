import { describe, it, expect } from "vitest";

// Replicate SESSION_TYPES from lib/constants.js (avoids "use client" import issues)
const SESSION_TYPES = {
  Lessons: "#3b82f6",
  Activities: "#8b5cf6",
  Excursion: "#ea580c",
  "Half Exc": "#f97316",
  "Eve Ents": "#7c3aed",
  Setup: "#64748b",
  "Day Off": "#f59e0b",
};

// Replicate cellColor from RotaTab.js
const cellColor = (v, slot = "AM") => {
  if (!v) return null;
  if (v === "Day Off") return "#f59e0b";
  if (SESSION_TYPES[v]) return SESSION_TYPES[v];
  const vl = v.toLowerCase();
  if (vl.includes("lesson") || vl.includes("english test") || vl.includes("testing") || vl.includes("int english") || vl.includes("int eng")) return SESSION_TYPES["Lessons"];
  if (vl.includes("eve activity") || vl.includes("evening activity") || vl.includes("eve ent") || vl.includes("disco") || vl.includes("bbq") || vl.includes("quiz") || vl.includes("karaoke") || vl.includes("film") || vl.includes("talent") || vl.includes("scav")) return SESSION_TYPES["Eve Ents"];
  if (vl.includes("excursion")) return SESSION_TYPES["Excursion"];
  if (vl.includes("act") || vl.includes("multi")) return SESSION_TYPES["Activities"];
  if (vl.includes("half exc")) return SESSION_TYPES["Half Exc"];
  if (vl === "office") return "#94a3b8";
  if (vl === "pickup" || vl === "welcome" || vl === "setup" || vl === "departure duty") return SESSION_TYPES["Setup"];
  if (vl === "football") return "#16a34a";
  if (vl === "performing arts" || vl === "pa" || vl === "drama" || vl === "dance") return "#9333ea";
  return slot === "Eve" ? SESSION_TYPES["Eve Ents"] : SESSION_TYPES["Excursion"];
};

describe("cellColor — lessons and teaching", () => {
  it("Lessons returns blue", () => {
    expect(cellColor("Lessons")).toBe("#3b82f6");
  });

  it("english test (lowercase) returns blue", () => {
    expect(cellColor("english test")).toBe("#3b82f6");
  });

  it("Testing returns blue", () => {
    expect(cellColor("Testing")).toBe("#3b82f6");
  });

  it("int english returns blue", () => {
    expect(cellColor("Int English")).toBe("#3b82f6");
  });
});

describe("cellColor — Eve Activity label", () => {
  it("'Eve Activity' returns purple on Eve slot", () => {
    expect(cellColor("Eve Activity", "Eve")).toBe("#7c3aed");
  });

  it("'Eve Activity' returns purple on AM slot (keyword match wins)", () => {
    expect(cellColor("Eve Activity", "AM")).toBe("#7c3aed");
  });

  it("'Evening Activity' (legacy) also returns purple", () => {
    expect(cellColor("Evening Activity", "Eve")).toBe("#7c3aed");
  });

  it("custom Eve name falls through to purple on Eve slot", () => {
    expect(cellColor("Beach Party", "Eve")).toBe("#7c3aed");
  });

  it("custom AM name falls through to orange (excursion) on AM slot", () => {
    expect(cellColor("Beach Party", "AM")).toBe("#ea580c");
  });

  it("disco night matches keyword and returns purple", () => {
    expect(cellColor("disco night", "Eve")).toBe("#7c3aed");
  });

  it("BBQ Evening matches keyword and returns purple", () => {
    expect(cellColor("BBQ Evening", "Eve")).toBe("#7c3aed");
  });
});

describe("cellColor — Performing Arts (PA) role", () => {
  it("'Performing Arts' returns purple", () => {
    expect(cellColor("Performing Arts")).toBe("#9333ea");
  });

  it("'pa' (lowercase) returns purple", () => {
    expect(cellColor("pa")).toBe("#9333ea");
  });

  it("legacy 'drama' still returns purple", () => {
    expect(cellColor("drama")).toBe("#9333ea");
  });

  it("legacy 'dance' still returns purple", () => {
    expect(cellColor("dance")).toBe("#9333ea");
  });
});

describe("cellColor — other values", () => {
  it("Day Off returns amber", () => {
    expect(cellColor("Day Off", "Eve")).toBe("#f59e0b");
  });

  it("Excursion returns orange", () => {
    expect(cellColor("Excursion", "Eve")).toBe("#ea580c");
  });

  it("Lessons on Eve returns blue (keyword wins over fallthrough)", () => {
    expect(cellColor("Lessons", "Eve")).toBe("#3b82f6");
  });

  it("Activities returns purple", () => {
    expect(cellColor("Activities")).toBe("#8b5cf6");
  });

  it("Football returns green", () => {
    expect(cellColor("football")).toBe("#16a34a");
  });

  it("Office returns slate", () => {
    expect(cellColor("office")).toBe("#94a3b8");
  });

  it("Setup returns grey", () => {
    expect(cellColor("setup")).toBe("#64748b");
  });

  it("Pickup returns grey", () => {
    expect(cellColor("pickup")).toBe("#64748b");
  });

  it("Departure Duty returns grey", () => {
    expect(cellColor("departure duty")).toBe("#64748b");
  });

  it("empty string returns null", () => {
    expect(cellColor("", "Eve")).toBeNull();
  });

  it("null returns null", () => {
    expect(cellColor(null, "Eve")).toBeNull();
  });

  it("unknown value defaults to AM→orange", () => {
    expect(cellColor("Mystery Event")).toBe("#ea580c");
  });
});
