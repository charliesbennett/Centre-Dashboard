"use client";
import { useState, useMemo } from "react";
import { B, ACTIVITY_TYPES, LONDON_CENTRES, genDates, dayKey, dayName, isWeekend, inRange } from "@/lib/constants";
import { Fld, TableWrap, IcWand, thStyle, tdStyle, btnPrimary, inputStyle } from "@/components/ui";
import { getProgrammesForCentre } from "@/lib/programmeData";

export default function ProgrammesTab({ groups, progStart, progEnd, centre, excDays, setExcDays }) {
  const dates = useMemo(() => genDates(progStart, progEnd), [progStart, progEnd]);
  const [grid, setGrid] = useState({});
  const isLondon = LONDON_CENTRES.includes(centre);
  const [viewMode, setViewMode] = useState("schedule");
  const centreProgs = useMemo(() => getProgrammesForCentre(centre), [centre]);
  const [selectedProg, setSelectedProg] = useState(null);
  const activeProg = selectedProg !== null ? centreProgs[selectedProg] : null;

  const autoPop = () => {
    const ng = {};
    groups.forEach((g) => {
      dates.forEach((d) => {
        const s = dayKey(d); if (!inRange(s, g.arr, g.dep)) return;
        const day = d.getDay(); const we = isWeekend(d);
        if (g.arr && s === dayKey(new Date(g.arr))) { ng[`${g.id}-${s}-PM`] = "Arrival"; return; }
        if (g.dep && s === dayKey(new Date(g.dep))) { ng[`${g.id}-${s}-AM`] = "Departure"; return; }
        if (excDays[s] === "Full") { ng[`${g.id}-${s}-AM`] = "Full Exc"; ng[`${g.id}-${s}-PM`] = "Full Exc"; return; }
        if (excDays[s] === "Half") { ng[`${g.id}-${s}-AM`] = "Lessons"; ng[`${g.id}-${s}-PM`] = "Half Exc"; return; }
        if (we) { ng[`${g.id}-${s}-AM`] = "Full Exc"; ng[`${g.id}-${s}-PM`] = "Full Exc"; return; }
        const spec = g.prog === "Multi-Activity" ? "Multi-Act" : g.prog === "Intensive English" ? "English+" : g.prog === "Performing Arts" ? "Perf Arts" : g.prog || "Multi-Act";
        if (isLondon && (day === 1 || day === 3 || day === 5)) { ng[`${g.id}-${s}-AM`] = "Lessons"; ng[`${g.id}-${s}-PM`] = "Half Exc"; }
        else { ng[`${g.id}-${s}-AM`] = "Lessons"; ng[`${g.id}-${s}-PM`] = spec; }
      });
    }); setGrid(ng);
  };

  const toggleCell = (gid, dStr, slot) => {
    const key = `${gid}-${dStr}-${slot}`; const types = Object.keys(ACTIVITY_TYPES);
    setGrid((prev) => { const cur = prev[key]; const idx = cur ? types.indexOf(cur) : -1; const next = idx < types.length - 1 ? types[idx + 1] : undefined; return { ...prev, [key]: next }; });
  };

  const toggleExc = (dStr) => {
    setExcDays((prev) => { const cur = prev[dStr]; if (!cur) return { ...prev, [dStr]: "Full" }; if (cur === "Full") return { ...prev, [dStr]: "Half" }; const n = { ...prev }; delete n[dStr]; return n; });
  };

  const classifyActivity = (text) => {
    if (!text) return { label: "\u2014", color: B.textLight, bg: "transparent" };
    const t = text.toLowerCase();
    if (t.includes("english test")) return { label: text, color: "#0891b2", bg: "#0891b220" };
    if (t.includes("english lesson")) return { label: text, color: "#3b82f6", bg: "#3b82f620" };
    if (t.includes("multi-activity") || t.includes("chosen programme")) return { label: text, color: "#8b5cf6", bg: "#8b5cf620" };
    if (t.includes("vlogging") || t.includes("workshop")) return { label: text, color: "#7c3aed", bg: "#7c3aed20" };
    if (t.includes("depart")) return { label: text, color: B.danger, bg: B.dangerBg };
    if (t.includes("free time") || t.includes("optional")) return { label: text, color: B.textMuted, bg: "#f1f5f9" };
    if (t.includes("orientation") || t.includes("welcome")) return { label: text, color: "#16a34a", bg: "#dcfce7" };
    if (t.includes("football") || t.includes("sport") || t.includes("training")) return { label: text, color: "#15803d", bg: "#15803d20" };
    return { label: text, color: "#ea580c", bg: "#ea580c15" };
  };

  return (
    <div>
      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: B.navy }}>{dates.length} days · {groups.length} groups</span>
          {isLondon && <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>London</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setViewMode(viewMode === "schedule" ? "grid" : "schedule")} style={{ ...btnPrimary, background: B.textMuted }}>
            {viewMode === "schedule" ? "\ud83d\udccb Grid View" : "\ud83d\udcc5 Schedule View"}
          </button>
          {viewMode === "grid" && <button onClick={autoPop} style={{ ...btnPrimary, background: B.navy }}><IcWand /> Auto-Populate</button>}
        </div>
      </div>

      {viewMode === "schedule" && (
        <div>
          <div style={{ padding: "10px 20px", background: B.white, borderBottom: `1px solid ${B.border}` }}>
            {centre ? (centreProgs.length > 0 ? (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: B.textMuted, marginBottom: 6, textTransform: "uppercase" }}>Programmes for {centre}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {centreProgs.map((p, i) => (
                    <button key={i} onClick={() => setSelectedProg(selectedProg === i ? null : i)} style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                      border: selectedProg === i ? `2px solid ${B.navy}` : `1px solid ${B.border}`,
                      background: selectedProg === i ? B.navy : B.white, color: selectedProg === i ? B.white : B.navy,
                    }}>{p.nights} {p.period ? `· ${p.period.split("-")[0].trim()}` : ""}</button>
                  ))}
                </div>
              </div>
            ) : <div style={{ fontSize: 11, color: B.textMuted }}>No programme templates found for this centre</div>
            ) : <div style={{ fontSize: 11, color: B.warning, fontWeight: 600 }}>Select a centre in the header to see available programmes</div>}
          </div>

          {activeProg && (
            <div style={{ padding: "0 12px 16px" }}>
              <div style={{ padding: "8px 8px 4px", fontSize: 10, color: B.textMuted }}>{activeProg.centre} · {activeProg.nights} · {activeProg.period}</div>
              {activeProg.weeks.map((week) => (
                <div key={week.week} style={{ marginBottom: 12 }}>
                  <div style={{ padding: "6px 8px", fontWeight: 800, fontSize: 11, color: B.navy }}>Week {week.week}</div>
                  <TableWrap>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <thead><tr><th style={{ ...thStyle, width: 30 }}></th>
                        {week.days.map((d, i) => (<th key={i} style={{ ...thStyle, textAlign: "center", minWidth: 100 }}>
                          <div style={{ fontWeight: 800, fontSize: 10, color: (d.day === "Saturday" || d.day === "Sunday") ? B.red : B.navy }}>{d.day}</div>
                        </th>))}
                      </tr></thead>
                      <tbody>
                        {["am", "pm"].map((slot) => (
                          <tr key={slot} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                            <td style={{ ...tdStyle, fontWeight: 800, fontSize: 8, color: B.textMuted, textAlign: "center" }}>{slot.toUpperCase()}</td>
                            {week.days.map((d, i) => {
                              const cls = classifyActivity(d[slot]);
                              return (<td key={i} style={{ padding: "4px 6px", borderLeft: `1px solid ${B.borderLight}`, verticalAlign: "top" }}>
                                <div style={{ background: cls.bg, color: cls.color, padding: "4px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, minHeight: 32, display: "flex", alignItems: "center" }}>{cls.label}</div>
                              </td>);
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === "grid" && (
        <div>
          <div style={{ padding: "4px 20px", display: "flex", gap: 3, flexWrap: "wrap" }}>
            {Object.entries(ACTIVITY_TYPES).map(([name, color]) => (<span key={name} style={{ background: color + "20", color, padding: "2px 5px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{name}</span>))}
            <span style={{ fontSize: 9, color: B.textMuted, marginLeft: 4 }}>Click date headers for exc days · Click cells to assign</span>
          </div>
          <div style={{ padding: "0 8px 16px", overflowX: "auto" }}>
            <TableWrap>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead><tr>
                  <th style={{ ...thStyle, width: 80 }}>Group</th><th style={{ ...thStyle, width: 28 }}>Pax</th>
                  {dates.map((d) => { const s = dayKey(d); const exc = excDays[s]; const we = isWeekend(d);
                    return (<th key={s} colSpan={2} onClick={() => toggleExc(s)} style={{ ...thStyle, textAlign: "center", borderLeft: `2px solid ${B.border}`, padding: "3px 0", minWidth: 44, cursor: "pointer", background: exc ? "#fff7ed" : we ? "#fef2f2" : "#f8fafc" }}>
                      <div style={{ fontWeight: 800, fontSize: 8, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                      <div style={{ fontSize: 7, color: B.textMuted }}>{d.getDate()}</div>
                      {exc && <div style={{ fontSize: 6, color: "#ea580c", fontWeight: 800 }}>{exc === "Full" ? "FD" : "HD"}</div>}
                    </th>); })}
                </tr></thead>
                <tbody>
                  {groups.length === 0 ? <tr><td colSpan={100} style={{ textAlign: "center", padding: 36, color: B.textLight }}>Add groups in Students tab</td></tr> :
                    groups.map((g) => (<tr key={g.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: B.navy, fontSize: 10 }} title={g.agent}>{g.group}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, textAlign: "center" }}>{(g.stu || 0) + (g.gl || 0)}</td>
                      {dates.map((d) => ["AM", "PM"].map((slot) => {
                        const key = `${g.id}-${dayKey(d)}-${slot}`; const v = grid[key]; const color = v ? ACTIVITY_TYPES[v] : null; const onSite = inRange(dayKey(d), g.arr, g.dep);
                        return (<td key={key} onClick={() => onSite && toggleCell(g.id, dayKey(d), slot)} style={{ padding: "1px", borderLeft: slot === "AM" ? `2px solid ${B.border}` : `1px solid ${B.borderLight}`, cursor: onSite ? "pointer" : "default", minWidth: 22, background: !onSite ? "#f5f5f5" : "transparent" }}>
                          {color ? <div style={{ background: color + "30", color, borderRadius: 2, fontSize: 7, fontWeight: 800, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{v.slice(0, 4)}</div> : onSite ? <div style={{ height: 20 }} /> : <div style={{ height: 20, background: "#eee", borderRadius: 2 }} />}
                        </td>);
                      }))}
                      <td></td>
                    </tr>))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </div>
      )}
    </div>
  );
}
