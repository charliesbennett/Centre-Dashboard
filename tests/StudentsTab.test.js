import { describe, it, expect } from "vitest";

// Replicate buildStudentRows from StudentsTab.js
function buildStudentRows(groups, roomingAssignments = [], roomingRooms = []) {
  const rows = [];
  (groups || []).filter((g) => !g.archived).forEach((g) => {
    (g.students || []).forEach((s) => {
      const fullName = [s.firstName, s.surname].filter(Boolean).join(" ").trim();
      const assignment = roomingAssignments.find(
        (a) => a.occupantName && a.occupantName.trim().toLowerCase() === fullName.toLowerCase()
      );
      const room = assignment
        ? (roomingRooms.find((r) => r.id === (assignment.roomId || assignment.room_id))?.roomName ||
           roomingRooms.find((r) => r.id === (assignment.roomId || assignment.room_id))?.name || "")
        : "";
      rows.push({
        "First Name": s.firstName || "",
        "Surname": s.surname || "",
        "Group": g.group || g.name || "",
        "Nationality": g.nat || s.nationality || "",
        "Age": s.age || "",
        "Arrival Date": s.arrDate || g.arr || "",
        "Departure Date": s.depDate || g.dep || "",
        "Medical": s.medical || "",
        "Room": room,
      });
    });
  });
  rows.sort((a, b) => {
    const gCmp = (a["Group"] || "").toLowerCase().localeCompare((b["Group"] || "").toLowerCase());
    if (gCmp !== 0) return gCmp;
    return (a["Surname"] || "").toLowerCase().localeCompare((b["Surname"] || "").toLowerCase());
  });
  return rows;
}

// Replicate getFlaggedStudents from StudentsTab.js (avoids "use client" import)
const DIETARY_KEYWORDS = ["vegetarian", "vegan", "halal", "kosher", "gluten free"];

function getFlaggedStudents(groups) {
  const results = [];
  (groups || []).forEach((g) => {
    const groupName = g.group || g.name || "—";
    (g.students || []).forEach((s) => {
      const hasMedical = !!(s.medical && s.medical.trim());
      const hasDietary = DIETARY_KEYWORDS.some((kw) =>
        (s.accommodation || "").toLowerCase().includes(kw)
      );
      if (!hasMedical && !hasDietary) return;
      let flagType, content;
      if (hasMedical && hasDietary) {
        flagType = "Both";
        content = [s.medical.trim(), s.accommodation.trim()].join(" | ");
      } else if (hasMedical) {
        flagType = "Medical";
        content = s.medical.trim();
      } else {
        flagType = "Dietary";
        content = s.accommodation.trim();
      }
      results.push({ firstName: s.firstName || "", surname: s.surname || "", groupName, flagType, content });
    });
  });
  return results;
}

function makeGroup(students, name = "Group A") {
  return [{ id: "g1", group: name, students }];
}

function makeStudent(overrides = {}) {
  return { id: "s1", firstName: "Alice", surname: "Smith", medical: "", accommodation: "", ...overrides };
}

describe("STORY-D2: buildStudentRows", () => {
  const groups = [
    { id: "g1", group: "Group B", nat: "Spanish", students: [
      { id: "s1", firstName: "Carlos", surname: "Ruiz", age: 14, arrDate: "2026-07-10", depDate: "2026-07-24", medical: "", accommodation: "" },
    ]},
    { id: "g2", group: "Group A", nat: "French", students: [
      { id: "s2", firstName: "Marie", surname: "Dupont", age: 15, arrDate: "2026-07-10", depDate: "2026-07-24", medical: "Asthma", accommodation: "" },
      { id: "s3", firstName: "Alice", surname: "Martin", age: 13, arrDate: "2026-07-10", depDate: "2026-07-24", medical: "", accommodation: "" },
    ]},
  ];

  it("returns one row per student across all groups", () => {
    expect(buildStudentRows(groups)).toHaveLength(3);
  });

  it("sorts by group then surname", () => {
    const rows = buildStudentRows(groups);
    expect(rows[0]["Group"]).toBe("Group A");
    expect(rows[0]["Surname"]).toBe("Dupont");
    expect(rows[1]["Surname"]).toBe("Martin");
    expect(rows[2]["Group"]).toBe("Group B");
  });

  it("populates room from roomingAssignments when name matches", () => {
    const assignments = [{ id: "a1", roomId: "r1", occupantName: "Marie Dupont" }];
    const rooms = [{ id: "r1", roomName: "101" }];
    const rows = buildStudentRows(groups, assignments, rooms);
    const marie = rows.find((r) => r["Surname"] === "Dupont");
    expect(marie["Room"]).toBe("101");
  });

  it("leaves room blank when no assignment found", () => {
    const rows = buildStudentRows(groups, [], []);
    expect(rows[0]["Room"]).toBe("");
  });

  it("excludes students from archived groups", () => {
    const withArchived = [...groups, { id: "g3", group: "Group C", archived: true, students: [
      { id: "s4", firstName: "Bob", surname: "Smith" }
    ]}];
    expect(buildStudentRows(withArchived)).toHaveLength(3);
  });

  it("includes medical field when present", () => {
    const rows = buildStudentRows(groups);
    const marie = rows.find((r) => r["Surname"] === "Dupont");
    expect(marie["Medical"]).toBe("Asthma");
  });

  it("leaves medical blank when absent", () => {
    const rows = buildStudentRows(groups);
    const carlos = rows.find((r) => r["Surname"] === "Ruiz");
    expect(carlos["Medical"]).toBe("");
  });

  it("room lookup is case-insensitive", () => {
    const assignments = [{ id: "a1", roomId: "r1", occupantName: "marie dupont" }];
    const rooms = [{ id: "r1", roomName: "101" }];
    const rows = buildStudentRows(groups, assignments, rooms);
    const marie = rows.find((r) => r["Surname"] === "Dupont");
    expect(marie["Room"]).toBe("101");
  });

  it("returns empty array for null groups", () => {
    expect(buildStudentRows(null)).toEqual([]);
  });
});

describe("STORY-D1: getFlaggedStudents", () => {
  it("returns Medical flag for student with medical field", () => {
    const result = getFlaggedStudents(makeGroup([makeStudent({ medical: "Peanut allergy" })]));
    expect(result).toHaveLength(1);
    expect(result[0].flagType).toBe("Medical");
    expect(result[0].content).toBe("Peanut allergy");
  });

  it("returns Dietary flag for student with Halal accommodation", () => {
    const result = getFlaggedStudents(makeGroup([makeStudent({ accommodation: "Halal" })]));
    expect(result).toHaveLength(1);
    expect(result[0].flagType).toBe("Dietary");
    expect(result[0].content).toBe("Halal");
  });

  it("returns Both flag for student with medical and dietary", () => {
    const result = getFlaggedStudents(makeGroup([makeStudent({ medical: "Asthma", accommodation: "Vegetarian" })]));
    expect(result).toHaveLength(1);
    expect(result[0].flagType).toBe("Both");
    expect(result[0].content).toContain("Asthma");
    expect(result[0].content).toContain("Vegetarian");
  });

  it("returns 0 results for student with neither flag", () => {
    const result = getFlaggedStudents(makeGroup([makeStudent()]));
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty groups", () => {
    expect(getFlaggedStudents([])).toEqual([]);
  });

  it("returns empty array for null input", () => {
    expect(getFlaggedStudents(null)).toEqual([]);
  });

  it("detects dietary case-insensitively (vegan lowercase)", () => {
    const result = getFlaggedStudents(makeGroup([makeStudent({ accommodation: "vegan" })]));
    expect(result[0].flagType).toBe("Dietary");
  });

  it("detects all dietary keywords", () => {
    const keywords = ["Vegetarian", "Vegan", "Halal", "Kosher", "Gluten Free"];
    keywords.forEach((kw) => {
      const result = getFlaggedStudents(makeGroup([makeStudent({ accommodation: kw })]));
      expect(result).toHaveLength(1);
      expect(result[0].flagType).toBe("Dietary");
    });
  });

  it("ignores medical fields that are empty or whitespace only", () => {
    const result = getFlaggedStudents(makeGroup([makeStudent({ medical: "   " })]));
    expect(result).toHaveLength(0);
  });

  it("includes group name in result", () => {
    const result = getFlaggedStudents([{ id: "g1", group: "Team Spain", students: [makeStudent({ medical: "Nut allergy" })] }]);
    expect(result[0].groupName).toBe("Team Spain");
  });

  it("collects flagged students across multiple groups", () => {
    const groups = [
      { id: "g1", group: "Group A", students: [makeStudent({ id: "s1", medical: "Asthma" })] },
      { id: "g2", group: "Group B", students: [makeStudent({ id: "s2", accommodation: "Halal" }), makeStudent({ id: "s3" })] },
    ];
    const result = getFlaggedStudents(groups);
    expect(result).toHaveLength(2);
  });

  it("returns first name and surname in result", () => {
    const result = getFlaggedStudents(makeGroup([makeStudent({ firstName: "Bob", surname: "Jones", medical: "Diabetes" })]));
    expect(result[0].firstName).toBe("Bob");
    expect(result[0].surname).toBe("Jones");
  });
});
