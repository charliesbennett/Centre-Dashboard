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
  if (vl.includes("evening activity") || vl.includes("eve ent") || vl.includes("disco") || vl.includes("bbq") || vl.includes("quiz") || vl.includes("karaoke") || vl.includes("film") || vl.includes("talent") || vl.includes("scav")) return SESSION_TYPES["Eve Ents"];
  if (vl.includes("excursion")) return SESSION_TYPES["Excursion"];
  if (vl.includes("act") || vl.includes("multi")) return SESSION_TYPES["Activities"];
  if (vl.includes("half exc")) return SESSION_TYPES["Half Exc"];
  if (vl === "office") return "#94a3b8";
  if (vl === "pickup" || vl === "welcome" || vl === "setup" || vl === "departure duty") return SESSION_TYPES["Setup"];
  if (vl === "football") return "#16a34a";
  if (vl === "drama" || vl === "dance") return "#9333ea";
  return slot === "Eve" ? SESSION_TYPES["Eve Ents"] : SESSION_TYPES["Excursion"];
};

describe("STORY-F1: cellColor — Eve slot fallthrough", () => {
  it("custom Eve name returns purple", () => {
    expect(cellColor("Beach Party", "Eve")).toBe("#7c3aed");
  });

  it("custom AM name returns orange (excursion fallthrough unchanged)", () => {
    expect(cellColor("Beach Party", "AM")).toBe("#ea580c");
  });

  it("custom PM name returns orange", () => {
    expect(cellColor("Beach Party", "PM")).toBe("#ea580c");
  });

  it("Day Off on Eve returns amber (named type wins)", () => {
    expect(cellColor("Day Off", "Eve")).toBe("#f59e0b");
  });

  it("Excursion on Eve returns orange (SESSION_TYPES match wins before fallthrough)", () => {
    expect(cellColor("Excursion", "Eve")).toBe("#ea580c");
  });

  it("Lessons on Eve returns blue (keyword match wins before fallthrough)", () => {
    expect(cellColor("Lessons", "Eve")).toBe("#3b82f6");
  });

  it("empty string returns null", () => {
    expect(cellColor("", "Eve")).toBeNull();
  });

  it("null returns null", () => {
    expect(cellColor(null, "Eve")).toBeNull();
  });

  it("disco night matches keyword and returns purple (not fallthrough)", () => {
    expect(cellColor("disco night", "Eve")).toBe("#7c3aed");
  });

  it("BBQ Evening matches keyword and returns purple", () => {
    expect(cellColor("BBQ Evening", "Eve")).toBe("#7c3aed");
  });

  it("slot defaults to AM when omitted — unknown returns orange", () => {
    expect(cellColor("Mystery Event")).toBe("#ea580c");
  });

  it("english test on Eve returns lessons colour (keyword match)", () => {
    expect(cellColor("english test", "Eve")).toBe("#3b82f6");
  });
});
