"use client";
import { useState, useRef } from "react";
import { B, MEALS, PROGRAMMES, uid, fmtDate } from "@/lib/constants";
import { Fld, StatCard, TableWrap, IconBtn, IcPlus, IcTrash, IcSearch, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";
import * as XLSX from "xlsx";

export default function StudentsTab({ groups, setGroups, onDatesImported }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [importMsg, setImportMsg] = useState(null);
  const fileRef = useRef(null);
  const [n, setN] = useState({
    agent: "", group: "", nat: "", stu: 0, gl: 0, arr: "", dep: "",
    firstMeal: "Dinner", lastMeal: "Packed Lunch", prog: "Multi-Activity",
  });

  const add = () => {
    if (!n.group.trim()) return;
    setGroups((p) => [...p, { ...n, id: uid(), stu: +n.stu || 0, gl: +n.gl || 0 }]);
    setN({ agent: "", group: "", nat: "", stu: 0, gl: 0, arr: "", dep: "", firstMeal: "Dinner", lastMeal: "Packed Lunch", prog: "Multi-Activity" });
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
        // Read WITHOUT cellDates to get raw serial numbers
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: false });

        const groupSheet = wb.SheetNames.find(
          (n) => n.toLowerCase().includes("group") || n === "Sheet1"
        ) || wb.SheetNames[0];
        const ws = wb.Sheets[groupSheet];

        // Header info - B2-C2 = label, D2 = value
        const agentName = cellVal(ws, "D2", "B2", "C2");
        const agentEmerg = cellVal(ws, "D3", "B3", "C3");
        const groupName = cellVal(ws, "L2", "M2", "K2");
        const centre = cellVal(ws, "L4", "M4", "K4");

        // Flight details
        const arrDate = excelDate(ws["G3"]?.v);
        const arrTime = ws["H3"]?.w || ws["H3"]?.v || "";
        const arrAirport = ws["I3"]?.v || "";
        const arrFlight = ws["J3"]?.v || "";
        const depDate = excelDate(ws["G4"]?.v);
        const depTime = ws["H4"]?.w || ws["H4"]?.v || "";
        const depAirport = ws["I4"]?.v || "";
        const depFlight = ws["J4"]?.v || "";

        // Students (rows 9-58)
        const students = [];
        for (let r = 9; r <= 58; r++) {
          const firstName = ws["C" + r]?.v;
          const surname = ws["D" + r]?.v;
          if (!firstName && !surname) continue;

          students.push({
            id: uid(), type: "student",
            firstName: String(firstName || "").trim(),
            surname: String(surname || "").trim(),
            dob: excelDate(ws["E" + r]?.v),
            age: ws["F" + r]?.v || "",
            sex: ws["G" + r]?.v || "",
            passport: ws["H" + r]?.v || "",
            passportExpiry: ws["I" + r]?.v || "",
            nationality: ws["J" + r]?.v || "",
            accommodation: ws["K" + r]?.v || "",
            arrDate: excelDate(ws["L" + r]?.v),
            depDate: excelDate(ws["M" + r]?.v),
            specialism1: ws["N" + r]?.v || "",
            specialism2: ws["O" + r]?.v || "",
            medical: ws["P" + r]?.v || "",
            parentName1: ws["Q" + r]?.v || "",
            parentPhone1: ws["R" + r]?.v || "",
            parentName2: ws["S" + r]?.v || "",
            englishLevel: ws["T" + r]?.v || "",
            photoConsent: ws["U" + r]?.v || "",
            swimming: ws["V" + r]?.v || "",
            hobbies: ws["W" + r]?.v || "",
          });
        }

        // Group leaders (rows 61-66)
        const leaders = [];
        for (let r = 61; r <= 66; r++) {
          const firstName = ws["B" + r]?.v;
          const surname = ws["C" + r]?.v;
          if (!firstName && !surname) continue;

          leaders.push({
            id: uid(), type: "gl",
            firstName: String(firstName || "").trim(),
            surname: String(surname || "").trim(),
            dob: excelDate(ws["D" + r]?.v),
            age: ws["E" + r]?.v || "",
            sex: ws["F" + r]?.v || "",
            passport: ws["G" + r]?.v || "",
            passportExpiry: ws["H" + r]?.v || "",
            nationality: ws["I" + r]?.v || "",
            arrDate: excelDate(ws["J" + r]?.v),
            depDate: excelDate(ws["K" + r]?.v),
            medical: ws["L" + r]?.v || "",
            mobile: ws["M" + r]?.v || "",
          });
        }

        // Derive group-level data
        const nats = students.map((s) => s.nationality).filter(Boolean);
        const topNat = nats.length > 0 ? mode(nats) : "";

        const allArr = students.map((s) => s.arrDate).filter(Boolean).sort();
        const allDep = students.map((s) => s.depDate).filter(Boolean).sort();
        const earliestArr = allArr[0] || arrDate;
        const latestDep = allDep[allDep.length - 1] || depDate;

        const specs = students.map((s) => s.specialism1).filter(Boolean);
        const topSpec = specs.length > 0 ? mode(specs) : "Multi-Activity";
        const prog = topSpec.toLowerCase().includes("multi") ? "Multi-Activity"
          : topSpec.toLowerCase().includes("intensive") ? "Intensive English"
          : topSpec.toLowerCase().includes("perform") ? "Performing Arts"
          : topSpec.toLowerCase().includes("football") ? "Football"
          : topSpec.toLowerCase().includes("dance") ? "Dance"
          : topSpec.toLowerCase().includes("drama") ? "Drama"
          : topSpec.toLowerCase().includes("leader") ? "Leadership"
          : "Multi-Activity";

        const newGroup = {
          id: uid(), agent: agentName, agentEmergency: agentEmerg,
          group: groupName || agentName + " Group", nat: topNat,
          stu: students.length, gl: leaders.length,
          arr: earliestArr, dep: latestDep,
          firstMeal: "Dinner", lastMeal: "Packed Lunch", prog, centre,
          arrAirport: String(arrAirport || "").trim(),
          arrFlight: String(arrFlight || "").trim(),
          arrTime: String(arrTime || "").trim(),
          depAirport: String(depAirport || "").trim(),
          depFlight: String(depFlight || "").trim(),
          depTime: String(depTime || "").trim(),
          students, leaders,
        };

        setGroups((prev) => [...prev, newGroup]);
        if (onDatesImported && earliestArr && latestDep) onDatesImported(earliestArr, latestDep);

        setImportMsg({ type: "success", text: "Imported \"" + newGroup.group + "\" \u2014 " + students.length + " students, " + leaders.length + " GLs from " + agentName });
        setTimeout(() => setImportMsg(null), 6000);
      } catch (err) {
        console.error("Import error:", err);
        setImportMsg({ type: "error", text: "Import failed: " + err.message });
        setTimeout(() => setImportMsg(null), 6000);
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const filtered = groups.filter((x) =>
    !search || (x.agent + " " + x.group + " " + x.nat).toLowerCase().includes(search.toLowerCase())
  );
  const totalStu = groups.reduce((s, x) => s + (x.stu || 0), 0);
  const totalGL = groups.reduce((s, x) => s + (x.gl || 0), 0);
  const fi = inputStyle;
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatCard label="Groups" value={groups.length} accent={B.navy} />
        <StatCard label="Students" value={totalStu} accent={B.red} />
        <StatCard label="GLs" value={totalGL} accent="#7c3aed" />
        <StatCard label="Total Pax" value={totalStu + totalGL} accent={B.success} />
      </div>

      {importMsg && (
        <div style={{ margin: "0 20px 8px", padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: importMsg.type === "success" ? B.successBg : B.dangerBg, color: importMsg.type === "success" ? B.success : B.danger }}>
          {importMsg.type === "success" ? "\u2713 " : "\u2717 "}{importMsg.text}
        </div>
      )}

      <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid " + B.border, borderRadius: 6, padding: "4px 10px" }}>
          <IcSearch />
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ background: "none", border: "none", fontSize: 12, width: 130, fontFamily: "inherit", color: B.text }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>
            \ud83d\udce5 Import Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} />
          </label>
          <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}><IcPlus /> Add Manual</button>
        </div>
      </div>

      {showAdd && (
        <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "10px 20px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Fld label="Agent"><input value={n.agent} onChange={(e) => setN((p) => ({ ...p, agent: e.target.value }))} style={fi} /></Fld>
          <Fld label="Group"><input value={n.group} onChange={(e) => setN((p) => ({ ...p, group: e.target.value }))} style={fi} /></Fld>
          <Fld label="Nat"><input value={n.nat} onChange={(e) => setN((p) => ({ ...p, nat: e.target.value }))} style={{ ...fi, width: 60 }} /></Fld>
          <Fld label="Students"><input type="number" value={n.stu} onChange={(e) => setN((p) => ({ ...p, stu: e.target.value }))} style={{ ...fi, width: 60 }} /></Fld>
          <Fld label="GLs"><input type="number" value={n.gl} onChange={(e) => setN((p) => ({ ...p, gl: e.target.value }))} style={{ ...fi, width: 55 }} /></Fld>
          <Fld label="Arrival"><input type="date" value={n.arr} onChange={(e) => setN((p) => ({ ...p, arr: e.target.value }))} style={fi} /></Fld>
          <Fld label="Departure"><input type="date" value={n.dep} onChange={(e) => setN((p) => ({ ...p, dep: e.target.value }))} style={fi} /></Fld>
          <Fld label="1st Meal"><select value={n.firstMeal} onChange={(e) => setN((p) => ({ ...p, firstMeal: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></Fld>
          <Fld label="Last Meal"><select value={n.lastMeal} onChange={(e) => setN((p) => ({ ...p, lastMeal: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></Fld>
          <Fld label="Programme"><select value={n.prog} onChange={(e) => setN((p) => ({ ...p, prog: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>{PROGRAMMES.map((s) => <option key={s}>{s}</option>)}</select></Fld>
          <button onClick={add} style={{ padding: "6px 16px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32 }}>Add</button>
          <button onClick={() => setShowAdd(false)} style={{ color: B.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}

      <div style={{ padding: "0 12px 16px", overflowX: "auto" }}>
        <TableWrap>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr>{["", "Agent", "Group", "Nat", "Stu", "GLs", "Total", "Prog", "1st Meal", "Last", "Arr", "Dep", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} style={{ textAlign: "center", padding: 36, color: B.textLight }}>No groups — use <strong>Import Excel</strong> to upload an agent spreadsheet</td></tr>
              ) : filtered.map((x) => (
                <>
                  <tr key={x.id} style={{ borderBottom: expanded === x.id ? "none" : "1px solid " + B.borderLight, cursor: "pointer" }} onClick={() => setExpanded(expanded === x.id ? null : x.id)}>
                    <td style={{ ...tdStyle, fontSize: 9, color: B.textMuted }}>{expanded === x.id ? "\u25bc" : "\u25b6"}</td>
                    <td style={tdStyle}>{x.agent}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{x.group}</td>
                    <td style={tdStyle}><span style={{ background: B.pink, padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, color: B.red }}>{x.nat}</span></td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{x.stu}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{x.gl}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: B.navy }}>{(x.stu || 0) + (x.gl || 0)}</td>
                    <td style={tdStyle}><span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{x.prog}</span></td>
                    <td style={{ ...tdStyle, fontSize: 9 }}>{x.firstMeal}</td>
                    <td style={{ ...tdStyle, fontSize: 9 }}>{x.lastMeal}</td>
                    <td style={tdStyle}>{fmtDate(x.arr)}</td>
                    <td style={tdStyle}>{fmtDate(x.dep)}</td>
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}><IconBtn danger onClick={() => setGroups((p) => p.filter((z) => z.id !== x.id))}><IcTrash /></IconBtn></td>
                  </tr>
                  {expanded === x.id && x.students && (
                    <tr key={x.id + "-d"} style={{ borderBottom: "1px solid " + B.borderLight }}>
                      <td colSpan={13} style={{ padding: "0 8px 12px", background: "#f8fafc" }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "8px 12px" }}>
                          {x.arrFlight && <div style={{ fontSize: 10 }}><span style={{ fontWeight: 700, color: B.textMuted }}>Arrival:</span> {x.arrAirport} · {x.arrFlight} {x.arrTime ? "at " + x.arrTime : ""}</div>}
                          {x.depFlight && <div style={{ fontSize: 10 }}><span style={{ fontWeight: 700, color: B.textMuted }}>Departure:</span> {x.depAirport} · {x.depFlight} {x.depTime ? "at " + x.depTime : ""}</div>}
                          {x.centre && <div style={{ fontSize: 10 }}><span style={{ fontWeight: 700, color: B.textMuted }}>Centre:</span> {x.centre}</div>}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, background: B.white, borderRadius: 6, overflow: "hidden" }}>
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
                                <td style={{ ...tdStyle, fontSize: 9 }}>\u2014</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{fmtDate(gl.arrDate)}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{fmtDate(gl.depDate)}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>Group Leader</td>
                                <td style={{ ...tdStyle, fontSize: 9, color: gl.medical ? B.danger : B.textLight }}>{gl.medical || "\u2014"}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.mobile || "\u2014"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
      <div style={{ padding: "0 20px 8px", fontSize: 10, color: B.success, fontWeight: 600 }}>{"\u2713"} Groups auto-flow to Programmes, Catering &amp; Transfers</div>
    </div>
  );
}

// Convert Excel serial date to YYYY-MM-DD using UTC to avoid timezone shifts
function excelDate(val) {
  if (!val) return "";
  if (typeof val === "number") {
    // Excel serial: days since 1899-12-30
    // Use UTC to avoid timezone issues
    const utcDays = Math.round(val - 25569);
    const ms = utcDays * 86400000;
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const day = String(val.getUTCDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  // Try parsing string dates like "31/03/2026" or "31 Mar 2026"
  const s = String(val).trim();
  const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    return slashMatch[3] + "-" + slashMatch[2].padStart(2, "0") + "-" + slashMatch[1].padStart(2, "0");
  }
  return s;
}

function mode(arr) {
  const freq = {};
  arr.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}
