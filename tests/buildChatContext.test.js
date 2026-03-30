import { describe, it, expect } from "vitest";
import { buildChatContext } from "../lib/buildChatContext.js";

const CENTRE_NAME = "Test Centre";

function makeData(overrides = {}) {
  return {
    groups: [],
    students: [],
    staff: [],
    rotaGrid: {},
    progGrid: {},
    excursions: [],
    transfers: [],
    settings: {},
    roomingHouses: [],
    roomingRooms: [],
    roomingAssignments: [],
    ...overrides,
  };
}

describe("buildChatContext", () => {
  it("includes centre name in output", () => {
    const result = buildChatContext(makeData(), CENTRE_NAME);
    expect(result).toContain("CENTRE: Test Centre");
  });

  it("includes current date", () => {
    const result = buildChatContext(makeData(), CENTRE_NAME);
    expect(result).toMatch(/CURRENT DATE:/);
  });

  it("lists group names and student counts", () => {
    const data = makeData({
      groups: [{ id: "g1", group: "Group A", stu: 12, arr: "2026-07-10", dep: "2026-07-24" }],
    });
    const result = buildChatContext(data, CENTRE_NAME);
    expect(result).toContain("Group A");
    expect(result).toContain("12 students");
  });

  it("lists students with name and group", () => {
    const data = makeData({
      groups: [{ id: "g1", group: "Group A", stu: 1 }],
      students: [{ id: "s1", name: "Alice Smith", groupId: "g1" }],
    });
    const result = buildChatContext(data, CENTRE_NAME);
    expect(result).toContain("Alice Smith");
    expect(result).toContain("Group: Group A");
  });

  it("shows student room assignment when available", () => {
    const data = makeData({
      groups: [{ id: "g1", group: "Group A", stu: 1 }],
      students: [{ id: "s1", name: "Alice Smith", groupId: "g1" }],
      roomingHouses: [{ id: "h1", name: "House A" }],
      roomingRooms: [{ id: "r1", houseId: "h1", roomName: "101" }],
      roomingAssignments: [{ roomId: "r1", occupantName: "Alice Smith" }],
    });
    const result = buildChatContext(data, CENTRE_NAME);
    expect(result).toContain("Room: 101");
  });

  it("shows unassigned when student has no room", () => {
    const data = makeData({
      groups: [{ id: "g1", group: "Group A", stu: 1 }],
      students: [{ id: "s1", name: "Bob Jones", groupId: "g1" }],
    });
    const result = buildChatContext(data, CENTRE_NAME);
    expect(result).toContain("Room: unassigned");
  });

  it("lists staff names and roles", () => {
    const data = makeData({
      staff: [{ id: "st1", name: "Jane Doe", role: "Activity Leader" }],
    });
    const result = buildChatContext(data, CENTRE_NAME);
    expect(result).toContain("Jane Doe");
    expect(result).toContain("Activity Leader");
  });

  it("includes rota section header", () => {
    const result = buildChatContext(makeData(), CENTRE_NAME);
    expect(result).toContain("ROTA (next 7 days from today):");
  });

  it("includes rota assignments for staff", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dk = today.toISOString().slice(0, 10);
    const data = makeData({
      staff: [{ id: "st1", name: "Jane Doe", role: "Activity Leader" }],
      rotaGrid: { [`st1-${dk}-AM`]: "English Class" },
    });
    const result = buildChatContext(data, CENTRE_NAME);
    expect(result).toContain("Jane Doe: English Class");
  });

  it("includes excursion details", () => {
    const data = makeData({
      excursions: [{ date: "2026-07-15", destination: "London Zoo", coaches: 2 }],
    });
    const result = buildChatContext(data, CENTRE_NAME);
    expect(result).toContain("London Zoo");
    expect(result).toContain("coaches: 2");
  });

  it("shows (none recorded) when no excursions", () => {
    const result = buildChatContext(makeData(), CENTRE_NAME);
    expect(result).toContain("(none recorded)");
  });

  it("lists rooming house and room names", () => {
    const data = makeData({
      roomingHouses: [{ id: "h1", name: "Tower Block" }],
      roomingRooms: [{ id: "r1", houseId: "h1", roomName: "201" }],
      roomingAssignments: [{ roomId: "r1", occupantName: "Tom Brown" }],
    });
    const result = buildChatContext(data, CENTRE_NAME);
    expect(result).toContain("Tower Block");
    expect(result).toContain("Room 201: Tom Brown");
  });

  it("handles null/undefined centreData gracefully", () => {
    expect(() => buildChatContext(null, CENTRE_NAME)).not.toThrow();
    expect(() => buildChatContext(undefined, CENTRE_NAME)).not.toThrow();
  });

  it("handles missing centreName gracefully", () => {
    const result = buildChatContext(makeData(), null);
    expect(result).toContain("CENTRE:");
  });
});
