"use client";
import { useState, useRef, useMemo } from "react";
import { B, MEALS, PROGRAMMES, uid, fmtDate, dayKey, dayName, isWeekend, genDates, calcLessonSplit } from "@/lib/constants";
import { Fld, StatCard, TableWrap, IconBtn, IcPlus, IcTrash, IcSearch, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";
import * as XLSX from "xlsx";

const DIETARY_KEYWORDS = ["vegetarian", "vegan", "halal", "kosher", "gluten free"];

export function getFlaggedStudents(groups) {
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

export function buildStudentRows(groups, roomingAssignments = [], roomingRooms = []) {
  const rows = [];
  (groups || []).filter((g) => !g.archived).forEach((g) => {
    (g.students || []).forEach((s) => {
      const fullName = [s.firstName, s.surname].filter(Boolean).join(" ").trim();
      const assignment = roomingAssignments.find(
        (a) => a.occupantName && a.occupantName.trim().toLowerCase() === fullName.toLowerCase()
      );
      const room = assignment
        ? (roomingRooms.find((r) => r.id === assignment.roomId || r.id === assignment.room_id)?.roomName ||
           roomingRooms.find((r) => r.id === assignment.roomId || r.id === assignment.room_id)?.name || "")
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

export function exportStudentsXlsx(groups, roomingAssignments, roomingRooms, centreName = "") {
  const rows = buildStudentRows(groups, roomingAssignments, roomingRooms);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  const safeName = (centreName || "export").replace(/[^a-z0-9]/gi, "-");
  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `students-${safeName}-${date}.xlsx`);
}

export default function StudentsTab({ groups = [], setGroups, progStart, progEnd, readOnly = false, userRole = "", roomingAssignments = [], roomingRooms = [], centreName = "" }) {
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState("groups");
  const [flagFilter, setFlagFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [importMsg, setImportMsg] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const fileRef = useRef(null);
  const [n, setN] = useState({
    agent: "", group: "", nat: "", stu: 0, gl: 0, arr: "", dep: "",
    firstMeal: "Dinner", lastMeal: "Packed Lunch", prog: "Multi-Activity", lessonSlot: "AM",
  });

  const add = () => {
    if (!n.group.trim()) return;
    setGroups((p) => [...p, { ...n, id: uid(), stu: +n.stu || 0, gl: +n.gl || 0 }]);
    setN({ agent: "", group: "", nat: "", stu: 0, gl: 0, arr: "", dep: "", firstMeal: "Dinner", lastMeal: "Packed Lunch", prog: "Multi-Activity", lessonSlot: "AM" });
    setShowAdd(false);
  };

  const isLabel = (v) => {
    const labels = ["agent name", "agent 24hr", "group name", "group size", "centre", "flight details", "date", "time", "airport", "flight number", "arrival", "departure"];
    return labels.some((l) => v.toLowerCase().trim().startsWith(l));
  };

  const cellVal = (ws, ...refs) => {
    for (const ref of refs) {
      const v = ws[ref]?.v;
      if (v && String(v).trim() && !isLabel(String(v))) return String(v).trim();
    }
    return "";
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: false });
        const groupSheet = wb.SheetNames.find((n) => n.toLowerCase().includes("group") || n === "Sheet1") || wb.SheetNames[0];
        const ws = wb.Sheets[groupSheet];

        // Convert 0-based col index to letter(s): 0→A, 25→Z, 26→AA
        const colLetter = (idx) => {
          let s = "";
          while (idx >= 0) { s = String.fromCharCode(65 + (idx % 26)) + s; idx = Math.floor(idx / 26) - 1; }
          return s;
        };

        // Build header-text → column-letter map for a given row
        const buildColMap = (row, maxCol = 30) => {
          const map = {};
          for (let c = 0; c < maxCol; c++) {
            const cl = colLetter(c);
            const v = ws[cl + row]?.v;
            if (v) map[String(v).toLowerCase().trim()] = cl;
          }
          return map;
        };

        const agentName = cellVal(ws, "D2", "B2", "C2");
        const groupName = cellVal(ws, "L2", "M2", "K2");
        const centre = cellVal(ws, "L4", "M4", "K4");
        const arrDate = excelDate(ws["G3"]);
        const arrTime = ws["H3"]?.w || ws["H3"]?.v || "";
        const arrAirport = ws["I3"]?.v || "";
        const arrFlight = ws["J3"]?.v || "";
        const depDate = excelDate(ws["G4"]);
        const depTime = ws["H4"]?.w || ws["H4"]?.v || "";
        const depAirport = ws["I4"]?.v || "";
        const depFlight = ws["J4"]?.v || "";

        // Find student header row (rows 5–15)
        let studentHeaderRow = 8;
        let stuColMap = {};
        for (let r = 5; r <= 15; r++) {
          const map = buildColMap(r);
          if (map["first name"] && (map["arrival date"] || map["arrival"])) {
            studentHeaderRow = r;
            stuColMap = map;
            break;
          }
        }

        const stuFnCol  = stuColMap["first name"] || "C";
        const stuSnCol  = stuColMap["surname"] || stuColMap["last name"] || stuColMap["family name"] || "D";
        const stuDobCol = stuColMap["date of birth"] || stuColMap["dob"] || "E";
        const stuAgeCol = stuColMap["age"] || "F";
        const stuSexCol = stuColMap["gender"] || stuColMap["sex"] || "G";
        const stuNatCol = stuColMap["nationality"] || "J";
        const stuAccCol = stuColMap["accommodation"] || "K";
        const stuArrCol = stuColMap["arrival date"] || stuColMap["arrival"] || "L";
        const stuDepCol = stuColMap["departure date"] || stuColMap["departure"] || "M";
        const stuSp1Col = stuColMap["specialism 1"] || stuColMap["specialism1"] || stuColMap["specialism"] || "N";
        const stuMedCol = stuColMap["medical"] || stuColMap["medical information"] || "P";
        const stuSwmCol = stuColMap["swimming"] || stuColMap["swimming ability"] || "V";

        // Scan student rows; stop when we hit a "Group Leader" label
        const stuStart = studentHeaderRow + 1;
        let stuEnd = stuStart;
        let glLabelRow = null;
        for (let r = stuStart; r <= stuStart + 100; r++) {
          let isGLLabel = false;
          for (let c = 0; c < 5; c++) {
            const v = ws[colLetter(c) + r]?.v;
            if (v && String(v).toLowerCase().includes("group leader")) { isGLLabel = true; glLabelRow = r; break; }
          }
          if (isGLLabel) break;
          stuEnd = r;
        }

        const students = [];
        for (let r = stuStart; r <= stuEnd; r++) {
          const firstName = ws[stuFnCol + r]?.v;
          const surname = ws[stuSnCol + r]?.v;
          if (!firstName && !surname) continue;
          students.push({
            id: uid(), type: "student",
            firstName: String(firstName || "").trim(), surname: String(surname || "").trim(),
            dob: excelDate(ws[stuDobCol + r]), age: ws[stuAgeCol + r]?.v || "", sex: ws[stuSexCol + r]?.v || "",
            nationality: ws[stuNatCol + r]?.v || "", accommodation: ws[stuAccCol + r]?.v || "",
            arrDate: excelDate(ws[stuArrCol + r]), depDate: excelDate(ws[stuDepCol + r]),
            specialism1: ws[stuSp1Col + r]?.v || "", medical: ws[stuMedCol + r]?.v || "",
            swimming: ws[stuSwmCol + r]?.v || "",
          });
        }

        // Find GL header row (1–3 rows after the "Group Leader" label)
        let glHeaderRow = null;
        let glColMap = {};
        if (glLabelRow) {
          for (let r = glLabelRow + 1; r <= glLabelRow + 3; r++) {
            const map = buildColMap(r);
            if (map["first name"] || map["arrival date"] || map["arrival"]) {
              glHeaderRow = r;
              glColMap = map;
              break;
            }
          }
        }

        const glFnCol  = glColMap["first name"] || "B";
        const glSnCol  = glColMap["surname"] || glColMap["last name"] || glColMap["family name"] || "C";
        const glDobCol = glColMap["date of birth"] || glColMap["dob"] || "D";
        const glAgeCol = glColMap["age"] || "E";
        const glSexCol = glColMap["gender"] || glColMap["sex"] || "F";
        const glNatCol = glColMap["nationality"] || "I";
        const glArrCol = glColMap["arrival date"] || glColMap["arrival"] || "J";
        const glDepCol = glColMap["departure date"] || glColMap["departure"] || "K";
        const glMedCol = glColMap["medical"] || glColMap["medical information"] || "L";
        const glMobCol = glColMap["mobile"] || glColMap["mobile number"] || glColMap["phone"] || "M";

        const glStart = glHeaderRow ? glHeaderRow + 1 : (glLabelRow ? glLabelRow + 2 : 61);
        const leaders = [];
        for (let r = glStart; r <= glStart + 20; r++) {
          const firstName = ws[glFnCol + r]?.v;
          const surname = ws[glSnCol + r]?.v;
          if (!firstName && !surname) continue;
          leaders.push({
            id: uid(), type: "gl",
            firstName: String(firstName || "").trim(), surname: String(surname || "").trim(),
            dob: excelDate(ws[glDobCol + r]), age: ws[glAgeCol + r]?.v || "", sex: ws[glSexCol + r]?.v || "",
            nationality: ws[glNatCol + r]?.v || "",
            arrDate: excelDate(ws[glArrCol + r]), depDate: excelDate(ws[glDepCol + r]),
            medical: ws[glMedCol + r]?.v || "", mobile: ws[glMobCol + r]?.v || "",
          });
        }

        const nats = students.map((s) => s.nationality).filter(Boolean);
        const topNat = nats.length > 0 ? mode(nats) : "";
        const allArr = students.map((s) => s.arrDate).filter(Boolean).sort();
        const allDep = students.map((s) => s.depDate).filter(Boolean).sort();
        const earliestArr = allArr[0] || arrDate;
        const latestDep = allDep[allDep.length - 1] || depDate;

        const newGroup = {
          id: uid(), agent: agentName,
          group: groupName || agentName + " Group", nat: topNat,
          stu: students.length, gl: leaders.length,
          arr: earliestArr, dep: latestDep,
          firstMeal: "Dinner", lastMeal: "Packed Lunch", prog: "Multi-Activity",
          lessonSlot: "AM",
          centre,
          arrAirport: String(arrAirport || "").trim(), arrFlight: String(arrFlight || "").trim(), arrTime: String(arrTime || "").trim(),
          depAirport: String(depAirport || "").trim(), depFlight: String(depFlight || "").trim(), depTime: String(depTime || "").trim(),
          students, leaders,
        };

        setImportPreview({ newGroup, students, leaders });
      } catch (err) {
        console.error("Import error:", err);
        setImportMsg({ type: "error", text: "Import failed: " + err.message });
        setTimeout(() => setImportMsg(null), 6000);
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleLessonSlot = (groupId) => {
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, lessonSlot: g.lessonSlot === "AM" ? "PM" : "AM" } : g));
  };

  const [expanded, setExpanded] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const openEdit = (g, e) => {
    e.stopPropagation();
    setEditDraft({ agent: g.agent||"", group: g.group||"", nat: g.nat||"", stu: g.stu||0, gl: g.gl||0, arr: g.arr||"", dep: g.dep||"", firstMeal: g.firstMeal||"Dinner", lastMeal: g.lastMeal||"Packed Lunch", prog: g.prog||"Multi-Activity", lessonSlot: g.lessonSlot||"AM" });
    setEditingGroup(g.id);
  };

  const saveEdit = () => {
    setGroups((prev) => prev.map((g) => g.id === editingGroup ? { ...g, ...editDraft, stu: +editDraft.stu||0, gl: +editDraft.gl||0 } : g));
    setEditingGroup(null);
  };
  const filtered = groups.filter((x) =>
    (showArchived ? x.archived : !x.archived) &&
    (!search || (x.agent + " " + x.group + " " + x.nat).toLowerCase().includes(search.toLowerCase()))
  );
  const totalStu = groups.filter((x) => !x.archived).reduce((s, x) => s + (x.stu || 0), 0);
  const totalGL = groups.filter((x) => !x.archived).reduce((s, x) => s + (x.gl || 0), 0);
  const activeGroups = groups.filter((x) => !x.archived);
  const archivedGroups = groups.filter((x) => x.archived);

  const lessonDates = useMemo(() => (progStart && progEnd ? genDates(progStart, progEnd) : []), [progStart, progEnd]);
  const lessonSplit = useMemo(() => calcLessonSplit(activeGroups, lessonDates), [activeGroups, lessonDates]);

  const toggleArchive = (groupId) => {
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, archived: !g.archived } : g));
  };

  return (
    <div>
      {/* ── Import preview modal ─────────────────────────── */}
      {importPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ background: B.navy, padding: "14px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Confirm Import</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Review before adding to dashboard</div>
            </div>
            <div style={{ padding: "18px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 12 }}>
                <span style={{ color: B.textMuted, fontWeight: 600 }}>Group</span>
                <span style={{ fontWeight: 800, color: B.navy }}>{importPreview.newGroup.group}</span>
                <span style={{ color: B.textMuted, fontWeight: 600 }}>Agent</span>
                <span>{importPreview.newGroup.agent || "—"}</span>
                <span style={{ color: B.textMuted, fontWeight: 600 }}>Students</span>
                <span style={{ fontWeight: 700 }}>{importPreview.students.length}</span>
                <span style={{ color: B.textMuted, fontWeight: 600 }}>Group Leaders</span>
                <span style={{ fontWeight: 700 }}>{importPreview.leaders.length}</span>
                <span style={{ color: B.textMuted, fontWeight: 600 }}>Arrival</span>
                <span>{fmtDate(importPreview.newGroup.arr) || "—"}</span>
                <span style={{ color: B.textMuted, fontWeight: 600 }}>Departure</span>
                <span>{fmtDate(importPreview.newGroup.dep) || "—"}</span>
                <span style={{ color: B.textMuted, fontWeight: 600 }}>Nationality</span>
                <span>{importPreview.newGroup.nat || "—"}</span>
              </div>
            </div>
            <div style={{ padding: "0 20px 18px", display: "flex", gap: 8 }}>
              <button onClick={() => {
                setGroups((prev) => [...prev, importPreview.newGroup]);
                setImportMsg({ type: "success", text: `Imported "${importPreview.newGroup.group}" — ${importPreview.students.length} students, ${importPreview.leaders.length} GLs` });
                setTimeout(() => setImportMsg(null), 6000);
                setImportPreview(null);
                if (fileRef.current) fileRef.current.value = "";
              }} style={{ flex: 1, padding: "10px", background: B.navy, border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                Import Group
              </button>
              <button onClick={() => { setImportPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                style={{ padding: "10px 16px", background: "#f1f5f9", border: "1px solid " + B.border, color: B.textMuted, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit group modal ─────────────────────────────── */}
      {editingGroup && (() => {
        const ed = editDraft;
        const set = (k, v) => setEditDraft((p) => ({ ...p, [k]: v }));
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ background: B.navy, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Edit Group</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Changes apply immediately to all tabs</div>
                </div>
                <button onClick={() => setEditingGroup(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>✕</button>
              </div>
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Fld label="Agent"><input value={ed.agent} onChange={(e) => set("agent", e.target.value)} style={inputStyle} /></Fld>
                  <Fld label="Group Name"><input value={ed.group} onChange={(e) => set("group", e.target.value)} style={inputStyle} /></Fld>
                  <Fld label="Nationality"><input value={ed.nat} onChange={(e) => set("nat", e.target.value)} style={inputStyle} /></Fld>
                  <Fld label="Programme"><select value={ed.prog} onChange={(e) => set("prog", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>{PROGRAMMES.map((s) => <option key={s}>{s}</option>)}</select></Fld>
                  <Fld label="Students"><input type="number" min={0} value={ed.stu} onChange={(e) => set("stu", e.target.value)} style={{ ...inputStyle, width: "100%" }} /></Fld>
                  <Fld label="Group Leaders"><input type="number" min={0} value={ed.gl} onChange={(e) => set("gl", e.target.value)} style={{ ...inputStyle, width: "100%" }} /></Fld>
                  <Fld label="Arrival Date"><input type="date" value={ed.arr} onChange={(e) => set("arr", e.target.value)} style={inputStyle} /></Fld>
                  <Fld label="Departure Date"><input type="date" value={ed.dep} onChange={(e) => set("dep", e.target.value)} style={inputStyle} /></Fld>
                  <Fld label="First Meal"><select value={ed.firstMeal} onChange={(e) => set("firstMeal", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></Fld>
                  <Fld label="Last Meal"><select value={ed.lastMeal} onChange={(e) => set("lastMeal", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></Fld>
                  <Fld label="Wk1 Lesson Slot"><select value={ed.lessonSlot} onChange={(e) => set("lessonSlot", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}><option value="AM">AM</option><option value="PM">PM</option></select></Fld>
                </div>
              </div>
              <div style={{ padding: "0 20px 18px", display: "flex", gap: 8 }}>
                <button onClick={saveEdit} style={{ flex: 1, padding: "10px", background: B.navy, border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>Save Changes</button>
                <button onClick={() => setEditingGroup(null)} style={{ padding: "10px 16px", background: "#f1f5f9", border: "1px solid " + B.border, color: B.textMuted, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatCard label="Groups" value={activeGroups.length} accent={B.navy} />
        <StatCard label="Students" value={totalStu} accent={B.red} />
        <StatCard label="GLs" value={totalGL} accent="#7c3aed" />
        <StatCard label="Total Pax" value={totalStu + totalGL} accent={B.success} />
        {archivedGroups.length > 0 && (
          <button onClick={() => setShowArchived(!showArchived)} style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginLeft: "auto",
            background: showArchived ? "#fef3c7" : "#f1f5f9", border: "1px solid " + (showArchived ? "#fbbf24" : B.border),
            color: showArchived ? "#92400e" : B.textMuted,
          }}>{showArchived ? "\ud83d\udcc2 Hide Archived" : "\ud83d\uddc3\ufe0f Show Archived"} ({archivedGroups.length})</button>
        )}
      </div>

      {/* ── Lesson split ────────────────────────────────── */}
      {lessonDates.length > 0 && activeGroups.length > 0 && (
        <div style={{ borderTop: "1px solid " + B.border, borderBottom: "1px solid " + B.border, background: B.white }}>
          <div style={{ padding: "6px 20px 4px", fontSize: 10, fontWeight: 800, color: B.navy }}>📚 AM / PM Lesson Split</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 10, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, position: "sticky", left: 0, background: "#f8fafc", zIndex: 2, minWidth: 60, textAlign: "left" }}>Session</th>
                  {lessonDates.map((d) => {
                    const ds = dayKey(d); const we = isWeekend(d); const split = lessonSplit[ds];
                    const hasLessons = split && (split.am > 0 || split.pm > 0);
                    return <th key={ds} style={{ ...thStyle, textAlign: "center", minWidth: 52, padding: "3px 4px", background: we ? "#fef2f2" : hasLessons ? "#f8fafc" : "#fafafa" }}>
                      <div style={{ fontSize: 7, color: B.textMuted }}>{d.getDate()}/{d.getMonth()+1}</div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                    </th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {["AM","PM"].map((slot) => (
                  <tr key={slot} style={{ borderBottom: slot === "AM" ? "1px solid " + B.borderLight : "none" }}>
                    <td style={{ ...thStyle, position: "sticky", left: 0, background: slot === "AM" ? "#dbeafe" : "#dcfce7", zIndex: 1, fontSize: 9, fontWeight: 800, color: slot === "AM" ? "#1e40af" : "#166534", padding: "4px 8px" }}>{slot} Lessons</td>
                    {lessonDates.map((d) => {
                      const ds = dayKey(d); const val = lessonSplit[ds]?.[slot.toLowerCase()] || 0; const we = isWeekend(d);
                      return <td key={ds} style={{ textAlign: "center", padding: "4px 2px", borderLeft: "1px solid " + B.borderLight, background: we ? "#fef2f2" : "transparent" }}>
                        {val > 0 ? <span style={{ fontWeight: 700, color: slot === "AM" ? "#1e40af" : "#166534", fontSize: 10 }}>{val}</span>
                          : <span style={{ color: B.textLight, fontSize: 9 }}>—</span>}
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ padding: "0 20px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      </div>

      {importMsg && (
        <div style={{ margin: "0 20px 8px", padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: importMsg.type === "success" ? B.successBg : B.dangerBg, color: importMsg.type === "success" ? B.success : B.danger }}>
          {importMsg.type === "success" ? "\u2713 " : "\u2717 "}{importMsg.text}
        </div>
      )}

      <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid " + B.border, borderRadius: 6, padding: "4px 10px" }}>
            <IcSearch />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ background: "none", border: "none", fontSize: 12, width: 130, fontFamily: "inherit", color: B.text }} />
          </div>
          {["groups", "flags"].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              fontFamily: "inherit", cursor: "pointer",
              border: `1px solid ${view === v ? B.navy : B.border}`,
              background: view === v ? B.navy : B.white,
              color: view === v ? B.white : B.textMuted,
            }}>
              {v === "groups" ? "Groups" : "⚑ Flags"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["centre_manager", "head_office", "course_director"].includes(userRole) && (
            <button onClick={() => exportStudentsXlsx(groups, roomingAssignments, roomingRooms, centreName)} style={{ padding: "6px 12px", background: B.success, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>
              ↓ Export Excel
            </button>
          )}
          {!readOnly && <>
            <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>
              {"\ud83d\udce5"} Import Excel
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} />
            </label>
            <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}><IcPlus /> Add Manual</button>
          </>}
        </div>
      </div>

      {showAdd && (
        <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "10px 20px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Fld label="Agent"><input value={n.agent} onChange={(e) => setN((p) => ({ ...p, agent: e.target.value }))} style={inputStyle} /></Fld>
          <Fld label="Group"><input value={n.group} onChange={(e) => setN((p) => ({ ...p, group: e.target.value }))} style={inputStyle} /></Fld>
          <Fld label="Nat"><input value={n.nat} onChange={(e) => setN((p) => ({ ...p, nat: e.target.value }))} style={{ ...inputStyle, width: 60 }} /></Fld>
          <Fld label="Students"><input type="number" value={n.stu} onChange={(e) => setN((p) => ({ ...p, stu: e.target.value }))} style={{ ...inputStyle, width: 60 }} /></Fld>
          <Fld label="GLs"><input type="number" value={n.gl} onChange={(e) => setN((p) => ({ ...p, gl: e.target.value }))} style={{ ...inputStyle, width: 55 }} /></Fld>
          <Fld label="Arrival"><input type="date" value={n.arr} onChange={(e) => setN((p) => ({ ...p, arr: e.target.value }))} style={inputStyle} /></Fld>
          <Fld label="Departure"><input type="date" value={n.dep} onChange={(e) => setN((p) => ({ ...p, dep: e.target.value }))} style={inputStyle} /></Fld>
          <Fld label="Wk1 Lessons"><select value={n.lessonSlot} onChange={(e) => setN((p) => ({ ...p, lessonSlot: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}><option value="AM">AM</option><option value="PM">PM</option></select></Fld>
          <Fld label="Programme"><select value={n.prog} onChange={(e) => setN((p) => ({ ...p, prog: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>{PROGRAMMES.map((s) => <option key={s}>{s}</option>)}</select></Fld>
          <button onClick={add} style={{ padding: "6px 16px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32 }}>Add</button>
          <button onClick={() => setShowAdd(false)} style={{ color: B.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}

      {/* ── Flags view ──────────────────────────────────── */}
      {view === "flags" && (() => {
        const allFlagged = getFlaggedStudents(groups);
        const filtered = flagFilter === "All" ? allFlagged : allFlagged.filter((f) => f.flagType === flagFilter);
        const BADGE = { Medical: { bg: "#fef2f2", color: B.danger }, Dietary: { bg: "#f0fdf4", color: B.success }, Both: { bg: "#faf5ff", color: B.purple } };
        return (
          <div style={{ padding: "12px 20px 20px" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {["All", "Medical", "Dietary", "Both"].map((f) => (
                <button key={f} onClick={() => setFlagFilter(f)} style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                  fontFamily: "inherit", cursor: "pointer",
                  border: `1px solid ${flagFilter === f ? B.navy : B.border}`,
                  background: flagFilter === f ? B.navy : B.white,
                  color: flagFilter === f ? B.white : B.textMuted,
                }}>{f}{f !== "All" && ` (${allFlagged.filter((x) => x.flagType === f).length})`}</button>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 11, color: B.textMuted, alignSelf: "center" }}>{allFlagged.length} flagged student{allFlagged.length !== 1 ? "s" : ""}</span>
            </div>
            <TableWrap>
              <table style={{ minWidth: 600, borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    {["First Name", "Surname", "Group", "Flag", "Details"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 36, color: B.textLight }}>No flagged students{flagFilter !== "All" ? ` with flag type "${flagFilter}"` : ""}</td></tr>
                  ) : filtered.map((f, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid " + B.borderLight }}>
                      <td style={tdStyle}>{f.firstName}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{f.surname}</td>
                      <td style={{ ...tdStyle, color: B.navy, fontWeight: 600 }}>{f.groupName}</td>
                      <td style={tdStyle}>
                        <span style={{ background: BADGE[f.flagType]?.bg, color: BADGE[f.flagType]?.color, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{f.flagType}</span>
                      </td>
                      <td style={{ ...tdStyle, color: B.text, maxWidth: 300 }}>{f.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        );
      })()}

      {/* ── Groups view ─────────────────────────────────── */}
      {view === "groups" && <div style={{ padding: "0 12px 16px", overflowX: "auto" }}>
        <TableWrap>
          <table style={{ minWidth: 800, borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr>{["", "Agent", "Group", "Nat", "Stu", "GLs", "Total", "Wk1", "Prog", "Arr", "Dep", "", ""].map((h, i) => <th key={h + i} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} style={{ textAlign: "center", padding: 36, color: B.textLight }}>No groups — use <strong>Import Excel</strong> to upload an agent spreadsheet</td></tr>
              ) : filtered.map((x) => (
                <>
                  <tr key={x.id} style={{ borderBottom: expanded === x.id ? "none" : "1px solid " + B.borderLight, cursor: "pointer", opacity: x.archived ? 0.5 : 1 }} onClick={() => setExpanded(expanded === x.id ? null : x.id)}>
                    <td style={{ ...tdStyle, fontSize: 9, color: B.textMuted }}>{expanded === x.id ? "\u25bc" : "\u25b6"}</td>
                    <td style={tdStyle}>{x.agent}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{x.group}</td>
                    <td style={tdStyle}><span style={{ background: B.pink, padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, color: B.red }}>{x.nat}</span></td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{x.stu}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{x.gl}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: B.navy }}>{(x.stu || 0) + (x.gl || 0)}</td>
                    <td style={tdStyle} onClick={(e) => { e.stopPropagation(); toggleLessonSlot(x.id); }}>
                      <span style={{
                        background: x.lessonSlot === "AM" ? "#dbeafe" : "#fae8ff",
                        color: x.lessonSlot === "AM" ? "#1e40af" : "#9333ea",
                        padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 800, cursor: "pointer",
                      }}>{x.lessonSlot || "AM"}</span>
                    </td>
                    <td style={tdStyle}><span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{x.prog}</span></td>
                    <td style={tdStyle}>{fmtDate(x.arr)}</td>
                    <td style={tdStyle}>{fmtDate(x.dep)}</td>
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {!readOnly && <button onClick={(e) => openEdit(x, e)} title="Edit group" style={{ background: "none", border: "none", cursor: "pointer", padding: 3, fontSize: 12, color: B.navy, borderRadius: 4 }}>✏️</button>}
                        {!readOnly && <button onClick={() => toggleArchive(x.id)} title={x.archived ? "Unarchive" : "Archive"} style={{
                          background: "none", border: "none", cursor: "pointer", padding: 3, fontSize: 12,
                          color: x.archived ? "#f59e0b" : B.textMuted, borderRadius: 4,
                        }}>{x.archived ? "\ud83d\udcc2" : "\ud83d\uddc3\ufe0f"}</button>}
                        {!readOnly && <IconBtn danger onClick={() => {
                          if (window.confirm(`Delete "${x.group}"? This will permanently remove the group, all students and programme data.`)) {
                            setGroups((p) => p.filter((z) => z.id !== x.id));
                          }
                        }}><IcTrash /></IconBtn>}
                      </div>
                    </td>
                  </tr>
                  {expanded === x.id && x.students && (
                    <tr key={x.id + "-d"} style={{ borderBottom: "1px solid " + B.borderLight }}>
                      <td colSpan={13} style={{ padding: "0 8px 12px", background: "#f8fafc" }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "8px 12px" }}>
                          {x.arrFlight && <div style={{ fontSize: 10 }}><span style={{ fontWeight: 700, color: B.textMuted }}>Arrival:</span> {x.arrAirport} · {x.arrFlight} {x.arrTime ? "at " + x.arrTime : ""}</div>}
                          {x.depFlight && <div style={{ fontSize: 10 }}><span style={{ fontWeight: 700, color: B.textMuted }}>Departure:</span> {x.depAirport} · {x.depFlight} {x.depTime ? "at " + x.depTime : ""}</div>}
                          {x.centre && <div style={{ fontSize: 10 }}><span style={{ fontWeight: 700, color: B.textMuted }}>Centre:</span> {x.centre}</div>}
                          <div style={{ fontSize: 10 }}><span style={{ fontWeight: 700, color: B.textMuted }}>Wk1 Lessons:</span> {x.lessonSlot || "AM"} <span style={{ color: B.textLight }}>(Wk2 auto-flips to {x.lessonSlot === "AM" ? "PM" : "AM"})</span></div>
                        </div>
                        <div style={{ overflowX: "auto", maxWidth: "calc(100vw - 60px)" }}>
                        <table style={{ minWidth: 900, borderCollapse: "collapse", fontSize: 10, background: B.white, borderRadius: 6 }}>
                          <thead><tr style={{ background: "#f1f5f9" }}>{["#", "Name", "DOB", "Age", "Sex", "Nat", "Accomm", "Arr", "Dep", "Specialism", "Medical", "Swimming"].map((h) => <th key={h} style={{ ...thStyle, fontSize: 8, padding: "4px 5px" }}>{h}</th>)}</tr></thead>
                          <tbody>
                            {(x.students || []).map((s, i) => (
                              <tr key={s.id} style={{ borderBottom: "1px solid " + B.borderLight }}>
                                <td style={{ ...tdStyle, fontSize: 9, color: B.textMuted }}>{i + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>{s.firstName} {s.surname}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{s.dob}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{s.age}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{s.sex}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{s.nationality}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{s.accommodation}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{fmtDate(s.arrDate)}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{fmtDate(s.depDate)}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{s.specialism1}</td>
                                <td style={{ ...tdStyle, fontSize: 9, color: s.medical ? B.danger : B.textLight }}>{s.medical || "\u2014"}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{s.swimming ? s.swimming.slice(0, 15) : "\u2014"}</td>
                              </tr>
                            ))}
                            {(x.leaders || []).map((gl) => (
                              <tr key={gl.id} style={{ borderBottom: "1px solid " + B.borderLight, background: "#f0f4ff" }}>
                                <td style={{ ...tdStyle, fontSize: 9, color: "#7c3aed" }}>GL</td>
                                <td style={{ ...tdStyle, fontWeight: 700, color: "#7c3aed" }}>{gl.firstName} {gl.surname}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.dob}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.age}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.sex}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.nationality}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{"\u2014"}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{fmtDate(gl.arrDate)}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{fmtDate(gl.depDate)}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>Group Leader</td>
                                <td style={{ ...tdStyle, fontSize: 9, color: gl.medical ? B.danger : B.textLight }}>{gl.medical || "\u2014"}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.mobile || "\u2014"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>}
      <div style={{ padding: "0 20px 8px", fontSize: 10, color: B.success, fontWeight: 600 }}>{"\u2713"} Click Wk1 column to toggle AM/PM lessons · Groups auto-flip after Week 1 · Data flows to Rota &amp; Programmes</div>
    </div>
  );
}

// Takes a full xlsx cell object (or a raw value for backwards compat).
// Priority: formatted .w value (DD/MM/YYYY already) → numeric serial → Date → string fallback.
function excelDate(cell) {
  if (!cell) return "";
  // If passed a raw primitive (legacy), wrap it
  const w = typeof cell === "object" && !(cell instanceof Date) ? cell.w : null;
  const val = typeof cell === "object" && !(cell instanceof Date) ? cell.v : cell;

  // Try the cell's formatted display value first — Excel shows it as DD/MM/YYYY
  if (w && typeof w === "string") {
    const s = w.trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  }

  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "number") {
    const utcDays = Math.round(val - 25569);
    const ms = utcDays * 86400000;
    const d = new Date(ms);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
  }
  if (val instanceof Date) {
    return val.getUTCFullYear() + "-" + String(val.getUTCMonth() + 1).padStart(2, "0") + "-" + String(val.getUTCDate()).padStart(2, "0");
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return s;
}

function mode(arr) {
  const freq = {};
  arr.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}
