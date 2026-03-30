import { describe, it, expect } from "vitest";

// Replicate addNotice / deleteNotice from HomeTab.js
let _counter = 0;
function uid() { return "id-" + (++_counter); }

function addNotice(notices, { title, body, urgency, createdBy }) {
  const notice = {
    id: uid(),
    title,
    body,
    urgency: urgency || "Normal",
    createdAt: new Date().toISOString(),
    createdBy: createdBy || "",
  };
  return [notice, ...(notices || [])];
}

function deleteNotice(notices, id) {
  return (notices || []).filter((n) => n.id !== id);
}

// Replicate assembleBriefingData from HomeTab.js
function assembleBriefingData({ centreName, today, groups, staff, excursions, rotaGrid }) {
  const dateStr = new Date(today).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const activeGroups = (groups || []).filter((g) => !g.archived);

  const onSiteCount = activeGroups
    .filter((g) => g.arr && g.dep && new Date(today) >= new Date(g.arr) && new Date(today) < new Date(g.dep))
    .reduce((s, g) => s + (g.stu || 0), 0);

  const arriving = activeGroups
    .filter((g) => g.arr === today)
    .map((g) => ({ groupName: g.group || g.name || "", stu: g.stu || 0 }));

  const departing = activeGroups
    .filter((g) => g.dep === today)
    .map((g) => ({ groupName: g.group || g.name || "", stu: g.stu || 0 }));

  const excursionsToday = (excursions || [])
    .filter((e) => e.exc_date === today)
    .map((e) => ({ destination: e.destination || "", coaches: e.coaches || [] }));

  const slots = ["AM", "PM", "Eve"];
  const rotaBySlot = { AM: [], PM: [], Eve: [] };
  Object.entries(rotaGrid || {}).forEach(([key, val]) => {
    if (!val) return;
    for (const slot of slots) {
      const suffix = `-${today}-${slot}`;
      if (key.endsWith(suffix)) {
        const staffId = key.slice(0, key.length - suffix.length);
        const member = (staff || []).find((s) => s.id === staffId);
        const staffName = member
          ? [member.firstName, member.surname].filter(Boolean).join(" ").trim()
          : staffId;
        rotaBySlot[slot].push({ staffName, assignment: val });
        break;
      }
    }
  });

  return { centreName: centreName || "", dateStr, onSiteCount, arriving, departing, excursionsToday, rotaBySlot };
}

const TODAY = "2026-07-15";

describe("STORY-D4: assembleBriefingData", () => {
  it("returns correct onSiteCount for groups spanning today", () => {
    const groups = [
      { id: "g1", group: "Group A", arr: "2026-07-10", dep: "2026-07-24", stu: 20 },
      { id: "g2", group: "Group B", arr: "2026-07-15", dep: "2026-07-29", stu: 15 }, // arriving today — inBed = arr <= today < dep
    ];
    const result = assembleBriefingData({ centreName: "Oxford", today: TODAY, groups, staff: [], excursions: [], rotaGrid: {} });
    // Group A: arr 10 <= 15 < dep 24 → on site. Group B: arr 15 <= 15 < dep 29 → on site
    expect(result.onSiteCount).toBe(35);
  });

  it("does not count groups whose dep date is today (departure day excluded)", () => {
    const groups = [
      { id: "g1", group: "Group A", arr: "2026-07-10", dep: "2026-07-15", stu: 20 }, // dep = today → NOT on site
    ];
    const result = assembleBriefingData({ centreName: "Oxford", today: TODAY, groups, staff: [], excursions: [], rotaGrid: {} });
    expect(result.onSiteCount).toBe(0);
  });

  it("returns arriving array for groups arriving today", () => {
    const groups = [
      { id: "g1", group: "Group A", arr: TODAY, dep: "2026-07-29", stu: 18 },
      { id: "g2", group: "Group B", arr: "2026-07-10", dep: "2026-07-24", stu: 20 },
    ];
    const result = assembleBriefingData({ centreName: "Test", today: TODAY, groups, staff: [], excursions: [], rotaGrid: {} });
    expect(result.arriving).toHaveLength(1);
    expect(result.arriving[0].groupName).toBe("Group A");
    expect(result.arriving[0].stu).toBe(18);
  });

  it("returns departing array for groups departing today", () => {
    const groups = [
      { id: "g1", group: "Group A", arr: "2026-07-01", dep: TODAY, stu: 22 },
    ];
    const result = assembleBriefingData({ centreName: "Test", today: TODAY, groups, staff: [], excursions: [], rotaGrid: {} });
    expect(result.departing).toHaveLength(1);
    expect(result.departing[0].groupName).toBe("Group A");
  });

  it("returns excursionsToday for excursions matching today", () => {
    const excursions = [
      { id: "e1", exc_date: TODAY, destination: "London", coaches: ["Coach A"] },
      { id: "e2", exc_date: "2026-07-20", destination: "Bath", coaches: [] },
    ];
    const result = assembleBriefingData({ centreName: "Test", today: TODAY, groups: [], staff: [], excursions, rotaGrid: {} });
    expect(result.excursionsToday).toHaveLength(1);
    expect(result.excursionsToday[0].destination).toBe("London");
    expect(result.excursionsToday[0].coaches).toEqual(["Coach A"]);
  });

  it("returns rotaBySlot.AM with correct staff name and assignment", () => {
    const staff = [{ id: "s1", firstName: "Alice", surname: "Jones" }];
    const rotaGrid = { [`s1-${TODAY}-AM`]: "English" };
    const result = assembleBriefingData({ centreName: "Test", today: TODAY, groups: [], staff, excursions: [], rotaGrid });
    expect(result.rotaBySlot.AM).toHaveLength(1);
    expect(result.rotaBySlot.AM[0].staffName).toBe("Alice Jones");
    expect(result.rotaBySlot.AM[0].assignment).toBe("English");
  });

  it("returns correct rotaBySlot for PM and Eve slots", () => {
    const staff = [
      { id: "s1", firstName: "Bob", surname: "Smith" },
      { id: "s2", firstName: "Carol", surname: "Lee" },
    ];
    const rotaGrid = {
      [`s1-${TODAY}-PM`]: "Sports",
      [`s2-${TODAY}-Eve`]: "Eve Ents",
    };
    const result = assembleBriefingData({ centreName: "Test", today: TODAY, groups: [], staff, excursions: [], rotaGrid });
    expect(result.rotaBySlot.PM[0].staffName).toBe("Bob Smith");
    expect(result.rotaBySlot.Eve[0].staffName).toBe("Carol Lee");
    expect(result.rotaBySlot.Eve[0].assignment).toBe("Eve Ents");
  });

  it("returns empty arrays and 0 count when no data", () => {
    const result = assembleBriefingData({ centreName: "Test", today: TODAY, groups: [], staff: [], excursions: [], rotaGrid: {} });
    expect(result.onSiteCount).toBe(0);
    expect(result.arriving).toEqual([]);
    expect(result.departing).toEqual([]);
    expect(result.excursionsToday).toEqual([]);
    expect(result.rotaBySlot.AM).toEqual([]);
    expect(result.rotaBySlot.PM).toEqual([]);
    expect(result.rotaBySlot.Eve).toEqual([]);
  });

  it("excludes archived groups from all counts", () => {
    const groups = [
      { id: "g1", group: "Group A", arr: TODAY, dep: "2026-07-29", stu: 20, archived: true },
    ];
    const result = assembleBriefingData({ centreName: "Test", today: TODAY, groups, staff: [], excursions: [], rotaGrid: {} });
    expect(result.arriving).toHaveLength(0);
    expect(result.onSiteCount).toBe(0);
  });

  it("returns centreName in result", () => {
    const result = assembleBriefingData({ centreName: "Cambridge", today: TODAY, groups: [], staff: [], excursions: [], rotaGrid: {} });
    expect(result.centreName).toBe("Cambridge");
  });

  it("formats dateStr as long English date", () => {
    const result = assembleBriefingData({ centreName: "Test", today: "2026-07-15", groups: [], staff: [], excursions: [], rotaGrid: {} });
    expect(result.dateStr).toContain("2026");
    expect(result.dateStr).toContain("July");
    expect(result.dateStr).toContain("15");
  });

  it("skips rota entries not matching today", () => {
    const staff = [{ id: "s1", firstName: "Alice", surname: "Jones" }];
    const rotaGrid = { "s1-2026-07-20-AM": "English" }; // different date
    const result = assembleBriefingData({ centreName: "Test", today: TODAY, groups: [], staff, excursions: [], rotaGrid });
    expect(result.rotaBySlot.AM).toHaveLength(0);
  });
});

describe("STORY-D5: addNotice", () => {
  it("returns array of length 1 with correct shape", () => {
    const result = addNotice([], { title: "Test", body: "Body", urgency: "Normal", createdBy: "centre_manager" });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test");
    expect(result[0].body).toBe("Body");
    expect(result[0].urgency).toBe("Normal");
    expect(result[0].createdBy).toBe("centre_manager");
    expect(result[0].id).toBeTruthy();
    expect(result[0].createdAt).toBeTruthy();
  });

  it("prepends new notice so newest is first", () => {
    const first = addNotice([], { title: "First", body: "A", urgency: "Normal", createdBy: "cm" });
    const both = addNotice(first, { title: "Second", body: "B", urgency: "Urgent", createdBy: "cm" });
    expect(both).toHaveLength(2);
    expect(both[0].title).toBe("Second");
    expect(both[1].title).toBe("First");
  });

  it("sets urgency to Normal when not provided", () => {
    const result = addNotice([], { title: "T", body: "B", createdBy: "cm" });
    expect(result[0].urgency).toBe("Normal");
  });

  it("handles Urgent urgency correctly", () => {
    const result = addNotice([], { title: "Fire drill", body: "Today at 10am", urgency: "Urgent", createdBy: "head_office" });
    expect(result[0].urgency).toBe("Urgent");
  });

  it("works when passed null notices (treats as empty)", () => {
    const result = addNotice(null, { title: "T", body: "B", urgency: "Normal", createdBy: "cm" });
    expect(result).toHaveLength(1);
  });
});

describe("STORY-D5: deleteNotice", () => {
  it("removes the notice with the matching id", () => {
    const notices = addNotice([], { title: "T", body: "B", urgency: "Normal", createdBy: "cm" });
    const id = notices[0].id;
    const result = deleteNotice(notices, id);
    expect(result).toHaveLength(0);
  });

  it("returns unchanged array when id does not exist", () => {
    const notices = addNotice([], { title: "T", body: "B", urgency: "Normal", createdBy: "cm" });
    const result = deleteNotice(notices, "nonexistent-id");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("T");
  });

  it("returns empty array when called on empty array", () => {
    expect(deleteNotice([], "any-id")).toEqual([]);
  });

  it("removes only the targeted notice when multiple exist", () => {
    let notices = addNotice([], { title: "A", body: "x", urgency: "Normal", createdBy: "cm" });
    notices = addNotice(notices, { title: "B", body: "y", urgency: "Normal", createdBy: "cm" });
    const idToDelete = notices[1].id; // "A" is index 1 (older, prepended first)
    const result = deleteNotice(notices, idToDelete);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("B");
  });
});
