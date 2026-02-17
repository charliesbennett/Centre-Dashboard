"use client";
import { useState, useRef } from "react";
import { B, MEALS, PROGRAMMES, uid, fmtDate } from "@/lib/constants";
import { Fld, StatCard, TableWrap, IconBtn, IcPlus, IcTrash, IcSearch, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";
import * as XLSX from "xlsx";

export default function StudentsTab({ groups, setGroups }) {
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

  // ── Excel Import ─────────────────────────────────────
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array", cellDates: true });

        // Find the group sheet (skip Guidance, Tables, Test)
        const groupSheet = wb.SheetNames.find(
          (n) => n.toLowerCase().includes("group") || n === "Sheet1"
        ) || wb.SheetNames[0];
        const ws = wb.Sheets[groupSheet];

        // Parse header info (rows 2-4)
        const agentName = ws["B2"]?.v || "";
        const agentEmerg = ws["B3"]?.v || "";
        const groupName = ws["K2"]?.v || "";
        const groupSize = ws["K3"]?.v || "";
        const centre = ws["L4"]?.v || "";

        // Flight details
        const arrDate = ws["G3"]?.v || ws["G3"]?.w || "";
        const arrTime = ws["H3"]?.v || ws["H3"]?.w || "";
        const arrAirport = ws["I3"]?.v || "";
        const arrFlight = ws["J3"]?.v || "";
        const depDate = ws["G4"]?.v || ws["G4"]?.w || "";
        const depTime = ws["H4"]?.v || ws["H4"]?.w || "";
        const depAirport = ws["I4"]?.v || "";
        const depFlight = ws["J4"]?.v || "";

        // Parse students (rows 9-58, columns A-W)
        const students = [];
        for (let r = 9; r <= 58; r++) {
          const firstName = ws[`C${r}`]?.v;
          const surname = ws[`D${r}`]?.v;
          if (!firstName && !surname) continue;

          const dobRaw = ws[`E${r}`]?.v;
          let dob = "";
          if (dobRaw instanceof Date) {
            dob = dobRaw.toISOString().split("T")[0];
          } else if (dobRaw) {
            dob = String(dobRaw);
          }

          students.push({
            id: uid(),
            type: "student",
            firstName: String(firstName || "").trim(),
            surname: String(surname || "").trim(),
            dob,
            age: ws[`F${r}`]?.v || "",
            sex: ws[`G${r}`]?.v || "",
            passport: ws[`H${r}`]?.v || "",
            passportExpiry: ws[`I${r}`]?.v || "",
            nationality: ws[`J${r}`]?.v || "",
            accommodation: ws[`K${r}`]?.v || "",
            arrDate: formatExcelDate(ws[`L${r}`]?.v),
            depDate: formatExcelDate(ws[`M${r}`]?.v),
            specialism1: ws[`N${r}`]?.v || "",
            specialism2: ws[`O${r}`]?.v || "",
            medical: ws[`P${r}`]?.v || "",
            parentName1: ws[`Q${r}`]?.v || "",
            parentPhone1: ws[`R${r}`]?.v || "",
            parentName2: ws[`S${r}`]?.v || "",
            englishLevel: ws[`T${r}`]?.v || "",
            photoConsent: ws[`U${r}`]?.v || "",
            swimming: ws[`V${r}`]?.v || "",
            hobbies: ws[`W${r}`]?.v || "",
          });
        }

        // Parse group leaders (rows 61-66)
        const leaders = [];
        for (let r = 61; r <= 66; r++) {
          const firstName = ws[`B${r}`]?.v;
          const surname = ws[`C${r}`]?.v;
          if (!firstName && !surname) continue;

          leaders.push({
            id: uid(),
            type: "gl",
            firstName: String(firstName || "").trim(),
            surname: String(surname || "").trim(),
            dob: formatExcelDate(ws[`D${r}`]?.v),
            age: ws[`E${r}`]?.v || "",
            sex: ws[`F${r}`]?.v || "",
            passport: ws[`G${r}`]?.v || "",
            passportExpiry: ws[`H${r}`]?.v || "",
            nationality: ws[`I${r}`]?.v || "",
            arrDate: formatExcelDate(ws[`J${r}`]?.v),
            depDate: formatExcelDate(ws[`K${r}`]?.v),
            medical: ws[`L${r}`]?.v || "",
            mobile: ws[`M${r}`]?.v || "",
          });
        }

        // Determine common nationality
        const nats = students.map((s) => s.nationality).filter(Boolean);
        const topNat = nats.length > 0
          ? nats.sort((a, b) => nats.filter((v) => v === a).length - nats.filter((v) => v === b).length).pop()
          : "";

        // Determine arrival/departure from students or flights
        const allArrivals = students.map((s) => s.arrDate).filter(Boolean);
        const allDepartures = students.map((s) => s.depDate).filter(Boolean);
        const earliestArr = allArrivals.sort()[0] || formatExcelDate(arrDate);
        const latestDep = allDepartures.sort().pop() || formatExcelDate(depDate);

        // Determine programme from specialism
        const specs = students.map((s) => s.specialism1).filter(Boolean);
        const topSpec = specs.length > 0
          ? specs.sort((a, b) => specs.filter((v) => v === a).length - specs.filter((v) => v === b).length).pop()
          : "Multi-Activity";
        const prog = topSpec.includes("Multi") ? "Multi-Activity"
          : topSpec.includes("Intensive") ? "Intensive English"
          : topSpec.includes("Perform") ? "Performing Arts"
          : topSpec.includes("Football") ? "Football"
          : topSpec.includes("Dance") ? "Dance"
          : topSpec.includes("Drama") ? "Drama"
          : topSpec.includes("Leader") ? "Leadership"
          : "Multi-Activity";

        // Create group entry
        const newGroup = {
          id: uid(),
          agent: String(agentName).trim(),
          agentEmergency: String(agentEmerg).trim(),
          group: String(groupName).trim() || `${agentName} Group`,
          nat: String(topNat).trim(),
          stu: students.length,
          gl: leaders.length,
          arr: earliestArr,
          dep: latestDep,
          firstMeal: "Dinner",
          lastMeal: "Packed Lunch",
          prog,
          centre: String(centre).trim(),
          // Flight info
          arrAirport: String(arrAirport).trim(),
          arrFlight: String(arrFlight).trim(),
          arrTime: String(arrTime).trim(),
          depAirport: String(depAirport).trim(),
          depFlight: String(depFlight).trim(),
          depTime: String(depTime).trim(),
          // Individual records
          students,
          leaders,
        };

        setGroups((prev) => [...prev, newGroup]);
        setImportMsg({
          type: "success",
          text: `Imported "${newGroup.group}" — ${students.length} students, ${leaders.length} GLs from ${agentName}`,
        });
        setTimeout(() => setImportMsg(null), 6000);
      } catch (err) {
        console.error("Import error:", err);
        setImportMsg({ type: "error", text: `Import failed: ${err.message}` });
        setTimeout(() => setImportMsg(null), 6000);
      }

      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const filtered = groups.filter((x) =>
    !search || `${x.agent} ${x.group} ${x.nat}`.toLowerCase().includes(search.toLowerCase())
  );
  const totalStu = groups.reduce((s, x) => s + (x.stu || 0), 0);
  const totalGL = groups.reduce((s, x) => s + (x.gl || 0), 0);
  const fi = inputStyle;

  // ── Expanded row state ───────────────────────────────
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
        <div style={{
          margin: "0 20px 8px", padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700,
          background: importMsg.type === "success" ? B.successBg : B.dangerBg,
          color: importMsg.type === "success" ? B.success : B.danger,
        }}>
          {importMsg.type === "success" ? "✓ " : "✗ "}{importMsg.text}
        </div>
      )}

      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 10px" }}>
          <IcSearch />
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ background: "none", border: "none", fontSize: 12, width: 130, fontFamily: "inherit", color: B.text }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <label style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
            background: B.navy, border: "none", color: B.white, borderRadius: 6,
            cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
          }}>
            📥 Import Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: "none" }} />
          </label>
          <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}><IcPlus /> Add Manual</button>
        </div>
      </div>

      {showAdd && (
        <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Fld label="Agent"><input value={n.agent} onChange={(e) => setN((p) => ({ ...p, agent: e.target.value }))} style={fi} /></Fld>
          <Fld label="Group"><input value={n.group} onChange={(e) => setN((p) => ({ ...p, group: e.target.value }))} style={fi} /></Fld>
          <Fld label="Nat"><input value={n.nat} onChange={(e) => setN((p) => ({ ...p, nat: e.target.value }))} style={{ ...fi, width: 60 }} /></Fld>
          <Fld label="Students"><input type="number" value={n.stu} onChange={(e) => setN((p) => ({ ...p, stu: e.target.value }))} style={{ ...fi, width: 60 }} /></Fld>
          <Fld label="GLs"><input type="number" value={n.gl} onChange={(e) => setN((p) => ({ ...p, gl: e.target.value }))} style={{ ...fi, width: 55 }} /></Fld>
          <Fld label="Arrival"><input type="date" value={n.arr} onChange={(e) => setN((p) => ({ ...p, arr: e.target.value }))} style={fi} /></Fld>
          <Fld label="Departure"><input type="date" value={n.dep} onChange={(e) => setN((p) => ({ ...p, dep: e.target.value }))} style={fi} /></Fld>
          <Fld label="1st Meal">
            <select value={n.firstMeal} onChange={(e) => setN((p) => ({ ...p, firstMeal: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>
              {MEALS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Fld>
          <Fld label="Last Meal">
            <select value={n.lastMeal} onChange={(e) => setN((p) => ({ ...p, lastMeal: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>
              {MEALS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Fld>
          <Fld label="Programme">
            <select value={n.prog} onChange={(e) => setN((p) => ({ ...p, prog: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>
              {PROGRAMMES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Fld>
          <button onClick={add} style={{ padding: "6px 16px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32 }}>Add</button>
          <button onClick={() => setShowAdd(false)} style={{ color: B.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}

      <div style={{ padding: "0 12px 16px", overflowX: "auto" }}>
        <TableWrap>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["", "Agent", "Group", "Nat", "Stu", "GLs", "Total", "Prog", "1st Meal", "Last", "Arr", "Dep", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} style={{ textAlign: "center", padding: 36, color: B.textLight }}>
                  No groups — use <strong>Import Excel</strong> to upload an agent spreadsheet
                </td></tr>
              ) : filtered.map((x) => (
                <>
                  <tr key={x.id} style={{ borderBottom: expanded === x.id ? "none" : `1px solid ${B.borderLight}`, cursor: "pointer" }}
                    onClick={() => setExpanded(expanded === x.id ? null : x.id)}>
                    <td style={{ ...tdStyle, fontSize: 9, color: B.textMuted }}>{expanded === x.id ? "▼" : "▶"}</td>
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
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <IconBtn danger onClick={() => setGroups((p) => p.filter((z) => z.id !== x.id))}><IcTrash /></IconBtn>
                    </td>
                  </tr>
                  {expanded === x.id && x.students && (
                    <tr key={`${x.id}-detail`} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                      <td colSpan={13} style={{ padding: "0 8px 12px", background: "#f8fafc" }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "8px 12px" }}>
                          {x.arrFlight && (
                            <div style={{ fontSize: 10 }}>
                              <span style={{ fontWeight: 700, color: B.textMuted }}>Arrival:</span> {x.arrAirport} · {x.arrFlight} {x.arrTime ? `at ${x.arrTime}` : ""}
                            </div>
                          )}
                          {x.depFlight && (
                            <div style={{ fontSize: 10 }}>
                              <span style={{ fontWeight: 700, color: B.textMuted }}>Departure:</span> {x.depAirport} · {x.depFlight} {x.depTime ? `at ${x.depTime}` : ""}
                            </div>
                          )}
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, background: B.white, borderRadius: 6, overflow: "hidden" }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9" }}>
                              {["#", "Name", "DOB", "Age", "Sex", "Nat", "Accomm", "Arr", "Dep", "Specialism", "Medical", "Swimming"].map((h) => (
                                <th key={h} style={{ ...thStyle, fontSize: 8, padding: "4px 5px" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(x.students || []).map((s, i) => (
                              <tr key={s.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
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
                                <td style={{ ...tdStyle, fontSize: 9, color: s.medical ? B.danger : B.textLight }}>{s.medical || "—"}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{s.swimming ? s.swimming.slice(0, 15) : "—"}</td>
                              </tr>
                            ))}
                            {(x.leaders || []).map((gl, i) => (
                              <tr key={gl.id} style={{ borderBottom: `1px solid ${B.borderLight}`, background: "#f0f4ff" }}>
                                <td style={{ ...tdStyle, fontSize: 9, color: "#7c3aed" }}>GL</td>
                                <td style={{ ...tdStyle, fontWeight: 700, color: "#7c3aed" }}>{gl.firstName} {gl.surname}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.dob}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.age}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.sex}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.nationality}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>—</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{fmtDate(gl.arrDate)}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{fmtDate(gl.depDate)}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>Group Leader</td>
                                <td style={{ ...tdStyle, fontSize: 9, color: gl.medical ? B.danger : B.textLight }}>{gl.medical || "—"}</td>
                                <td style={{ ...tdStyle, fontSize: 9 }}>{gl.mobile || "—"}</td>
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
      <div style={{ padding: "0 20px 8px", fontSize: 10, color: B.success, fontWeight: 600 }}>
        ✓ Groups auto-flow to Programmes, Catering &amp; Transfers · Import reads agent template format
      </div>
    </div>
  );
}

// Helper to handle Excel date values
function formatExcelDate(val) {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().split("T")[0];
  if (typeof val === "number") {
    // Excel serial date
    const d = new Date((val - 25569) * 86400000);
    return d.toISOString().split("T")[0];
  }
  return String(val);
}
