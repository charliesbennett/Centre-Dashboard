"use client";
import { useState, useMemo } from "react";
import { B, ACTIVITY_TYPES, LONDON_CENTRES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { Fld, TableWrap, IcWand, thStyle, tdStyle, btnPrimary, inputStyle } from "@/components/ui";
import { getProgrammesForCentre } from "@/lib/programmeData";

export default function ProgrammesTab({ groups, progStart, progEnd, centre, excDays, setExcDays, progGrid, setProgGrid }) {
  const dates = useMemo(() => genDates(progStart, progEnd), [progStart, progEnd]);
  const isLondon = LONDON_CENTRES.includes(centre);
  const [viewMode, setViewMode] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const grid = progGrid || {};
  const setGrid = setProgGrid || (() => {});
  const centreProgs = useMemo(() => getProgrammesForCentre(centre), [centre]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const activeTemplate = selectedTemplate !== null ? centreProgs[selectedTemplate] : null;

  const autoPop = () => {
    const ng = {};
    groups.forEach((g) => {
      dates.forEach((d) => {
        const s = dayKey(d);
        if (!inRange(s, g.arr, g.dep)) return;
        const day = d.getDay();
        const we = isWeekend(d);
        const pre = g.id + "-" + s;
        if (g.arr && s === dayKey(new Date(g.arr))) { ng[pre + "-PM"] = "ARRIVAL"; return; }
        if (g.dep && s === dayKey(new Date(g.dep))) { ng[pre + "-AM"] = "DEPARTURE"; return; }
        if (excDays[s] === "Full") { ng[pre + "-AM"] = "Full Exc"; ng[pre + "-PM"] = "Full Exc"; return; }
        if (excDays[s] === "Half") { ng[pre + "-AM"] = "Lessons"; ng[pre + "-PM"] = "Half Exc"; return; }
        if (we) { ng[pre + "-AM"] = "Full Exc"; ng[pre + "-PM"] = "Full Exc"; return; }
        const spec = g.prog === "Multi-Activity" ? "Multi-Activity or Chosen Programme" : g.prog === "Intensive English" ? "English+" : g.prog === "Performing Arts" ? "Perf Arts" : g.prog || "Multi-Activity or Chosen Programme";
        if (isLondon && (day === 1 || day === 3 || day === 5)) { ng[pre + "-AM"] = "Lessons"; ng[pre + "-PM"] = "Half Exc"; }
        else { ng[pre + "-AM"] = "Lessons"; ng[pre + "-PM"] = spec; }
      });
    });
    setGrid(ng);
  };

  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const startEdit = (key, val) => { setEditingCell(key); setEditValue(val || ""); };
  const commitEdit = () => { if (editingCell) { setGrid((p) => ({ ...p, [editingCell]: editValue || undefined })); setEditingCell(null); } };

  const toggleExc = (dStr) => {
    setExcDays((p) => {
      const c = p[dStr];
      if (!c) return { ...p, [dStr]: "Full" };
      if (c === "Full") return { ...p, [dStr]: "Half" };
      const n = { ...p }; delete n[dStr]; return n;
    });
  };

  const classify = (text) => {
    if (!text) return { color: B.textLight, bg: "transparent" };
    const t = text.toLowerCase();
    if (t.includes("arrival")) return { color: "#16a34a", bg: "#dcfce7" };
    if (t.includes("depart")) return { color: B.danger, bg: B.dangerBg };
    if (t.includes("english test")) return { color: "#0891b2", bg: "#0891b220" };
    if (t.includes("lesson")) return { color: "#3b82f6", bg: "#3b82f620" };
    if (t.includes("multi-activity") || t.includes("chosen programme")) return { color: "#8b5cf6", bg: "#8b5cf620" };
    if (t.includes("vlogging") || t.includes("workshop")) return { color: "#7c3aed", bg: "#7c3aed20" };
    if (t.includes("free time") || t.includes("free-time") || t.includes("optional")) return { color: B.textMuted, bg: "#f1f5f9" };
    if (t.includes("orientation") || t.includes("welcome")) return { color: "#16a34a", bg: "#16a34a20" };
    if (t.includes("football") || t.includes("sport") || t.includes("training")) return { color: "#15803d", bg: "#15803d20" };
    if (t.includes("activity")) return { color: "#8b5cf6", bg: "#8b5cf620" };
    return { color: "#ea580c", bg: "#ea580c15" };
  };

  const selGroup = groups.find((g) => g.id === selectedGroupId);

  // Calculate table min-width based on dates
  const tableMinWidth = 220 + dates.length * 90;

  return (
    <div>
      {/* Header */}
      <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: B.navy }}>{dates.length} days · {groups.length} groups</span>
          {isLondon && <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>London</span>}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ id: "all", label: "\ud83d\udc65 All Groups" }, { id: "group", label: "\ud83d\udc64 By Group" }, { id: "template", label: "\ud83d\udcc4 Templates" }].map((m) => (
            <button key={m.id} onClick={() => setViewMode(m.id)} style={{
              padding: "5px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit",
              cursor: "pointer", border: "1px solid " + (viewMode === m.id ? B.navy : B.border),
              background: viewMode === m.id ? B.navy : B.white, color: viewMode === m.id ? B.white : B.textMuted,
            }}>{m.label}</button>
          ))}
          <button onClick={autoPop} style={{ ...btnPrimary, background: B.navy, marginLeft: 4 }}><IcWand /> Auto-Populate</button>
        </div>
      </div>

      {/* ── VIEW 1: ALL GROUPS ──────────────────────────── */}
      {viewMode === "all" && (
        <div>
          <div style={{ overflow: "auto", maxHeight: "calc(100vh - 160px)", padding: "0 4px 16px" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: tableMinWidth, background: B.white, borderRadius: 10, border: "1px solid " + B.border }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 100, position: "sticky", left: 0, zIndex: 3, background: "#f8fafc" }}>Agent</th>
                  <th style={{ ...thStyle, width: 90, position: "sticky", left: 100, zIndex: 3, background: "#f8fafc" }}>Group</th>
                  <th style={{ ...thStyle, width: 35, textAlign: "center", position: "sticky", left: 190, zIndex: 3, background: "#f8fafc" }}>Pax</th>
                  {dates.map((d) => {
                    const s = dayKey(d); const exc = excDays[s]; const we = isWeekend(d);
                    return (
                      <th key={s} colSpan={2} onClick={() => toggleExc(s)} style={{
                        ...thStyle, textAlign: "center", borderLeft: "2px solid " + B.border,
                        padding: "3px 2px", minWidth: 90, cursor: "pointer",
                        background: exc ? "#fff7ed" : we ? "#fef2f2" : "#f8fafc",
                      }}>
                        <div style={{ fontSize: 7, color: B.textMuted }}>{fmtDate(d)}</div>
                        <div style={{ fontWeight: 800, fontSize: 9, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                        {exc && <div style={{ fontSize: 6, color: "#ea580c", fontWeight: 800 }}>{exc === "Full" ? "FD EXC" : "HD EXC"}</div>}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th style={{ ...thStyle, position: "sticky", left: 0, zIndex: 3, background: "#f8fafc" }}></th>
                  <th style={{ ...thStyle, position: "sticky", left: 100, zIndex: 3, background: "#f8fafc" }}></th>
                  <th style={{ ...thStyle, position: "sticky", left: 190, zIndex: 3, background: "#f8fafc" }}></th>
                  {dates.map((d) => ["AM", "PM"].map((sl) => (
                    <th key={dayKey(d) + "-" + sl} style={{ ...thStyle, textAlign: "center", fontSize: 7, padding: "2px 1px", borderLeft: sl === "AM" ? "2px solid " + B.border : "1px solid " + B.borderLight, minWidth: 44 }}>{sl}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr><td colSpan={3 + dates.length * 2} style={{ textAlign: "center", padding: 36, color: B.textLight }}>Import groups in Students tab, then click Auto-Populate</td></tr>
                ) : groups.map((g) => (
                  <tr key={g.id} style={{ borderBottom: "1px solid " + B.borderLight }}>
                    <td style={{ ...tdStyle, fontWeight: 600, fontSize: 9, position: "sticky", left: 0, background: B.white, zIndex: 1 }}>{g.agent}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: B.navy, fontSize: 10, position: "sticky", left: 100, background: B.white, zIndex: 1 }}>{g.group}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, textAlign: "center", fontSize: 10, position: "sticky", left: 190, background: B.white, zIndex: 1 }}>{(g.stu || 0) + (g.gl || 0)}</td>
                    {dates.map((d) => ["AM", "PM"].map((sl) => {
                      const s = dayKey(d); const key = g.id + "-" + s + "-" + sl;
                      const val = grid[key]; const on = inRange(s, g.arr, g.dep);
                      const cls = classify(val); const isEd = editingCell === key;
                      return (
                        <td key={key} onDoubleClick={() => on && startEdit(key, val)} style={{
                          padding: "1px 2px", borderLeft: sl === "AM" ? "2px solid " + B.border : "1px solid " + B.borderLight,
                          verticalAlign: "middle", minWidth: 44, maxWidth: 80,
                          background: !on ? "#f5f5f5" : cls.bg, cursor: on ? "pointer" : "default",
                        }}>
                          {isEd ? (
                            <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                              style={{ width: "100%", fontSize: 8, padding: "2px", border: "1px solid " + B.navy, borderRadius: 2, fontFamily: "inherit" }} />
                          ) : val ? (
                            <div style={{ color: cls.color, fontSize: 8, fontWeight: 600, padding: "2px 3px", borderRadius: 2, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 75 }} title={val}>{val}</div>
                          ) : on ? <div style={{ height: 18 }} /> : <div style={{ height: 18 }} />}
                        </td>
                      );
                    }))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "6px 12px", fontSize: 9, color: B.textMuted }}>Double-click any cell to edit · Click date headers to toggle excursion days · Scroll horizontally to see all dates</div>
        </div>
      )}

      {/* ── VIEW 2: BY GROUP ────────────────────────────── */}
      {viewMode === "group" && (
        <div>
          <div style={{ padding: "10px 20px", background: B.white, borderBottom: "1px solid " + B.border, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: B.textMuted }}>Select group:</span>
            {groups.map((g) => (
              <button key={g.id} onClick={() => setSelectedGroupId(g.id)} style={{
                padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit",
                cursor: "pointer", border: selectedGroupId === g.id ? "2px solid " + B.navy : "1px solid " + B.border,
                background: selectedGroupId === g.id ? B.navy : B.white, color: selectedGroupId === g.id ? B.white : B.navy,
              }}>{g.group} <span style={{ opacity: 0.6 }}>({(g.stu || 0) + (g.gl || 0)})</span></button>
            ))}
          </div>
          {selGroup && (
            <div>
              <div style={{ padding: "8px 20px", display: "flex", gap: 16, fontSize: 10, color: B.textMuted }}>
                <span><strong style={{ color: B.navy }}>Agent:</strong> {selGroup.agent}</span>
                <span><strong style={{ color: B.navy }}>Nat:</strong> {selGroup.nat}</span>
                <span><strong style={{ color: B.navy }}>Pax:</strong> {(selGroup.stu || 0) + (selGroup.gl || 0)}</span>
                <span><strong style={{ color: B.navy }}>Arr:</strong> {fmtDate(selGroup.arr)}</span>
                <span><strong style={{ color: B.navy }}>Dep:</strong> {fmtDate(selGroup.dep)}</span>
              </div>
              <div style={{ overflow: "auto", padding: "0 8px 16px" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 10, background: B.white, borderRadius: 10, border: "1px solid " + B.border, minWidth: dates.filter((d) => inRange(dayKey(d), selGroup.arr, selGroup.dep)).length * 90 + 40 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 30 }}></th>
                      {dates.filter((d) => inRange(dayKey(d), selGroup.arr, selGroup.dep)).map((d) => {
                        const s = dayKey(d); const we = isWeekend(d); const exc = excDays[s];
                        return (
                          <th key={s} style={{ ...thStyle, textAlign: "center", minWidth: 85, background: exc ? "#fff7ed" : we ? "#fef2f2" : "#f8fafc" }}>
                            <div style={{ fontSize: 7, color: B.textMuted }}>{fmtDate(d)}</div>
                            <div style={{ fontWeight: 800, fontSize: 9, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {["AM", "PM"].map((sl) => (
                      <tr key={sl} style={{ borderBottom: "1px solid " + B.borderLight }}>
                        <td style={{ ...tdStyle, fontWeight: 800, fontSize: 8, color: B.textMuted, textAlign: "center" }}>{sl}</td>
                        {dates.filter((d) => inRange(dayKey(d), selGroup.arr, selGroup.dep)).map((d) => {
                          const key = selGroup.id + "-" + dayKey(d) + "-" + sl;
                          const val = grid[key]; const cls = classify(val); const isEd = editingCell === key;
                          return (
                            <td key={key} onDoubleClick={() => startEdit(key, val)} style={{ padding: "4px 6px", borderLeft: "1px solid " + B.borderLight, verticalAlign: "top", cursor: "pointer" }}>
                              {isEd ? (
                                <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                                  style={{ width: "100%", fontSize: 9, padding: "4px", border: "1px solid " + B.navy, borderRadius: 3, fontFamily: "inherit" }} />
                              ) : (
                                <div style={{ background: cls.bg, color: cls.color, padding: "4px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, minHeight: 32, display: "flex", alignItems: "center" }}>{val || "\u2014"}</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "6px 12px", fontSize: 9, color: B.textMuted }}>Double-click cells to edit</div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 3: TEMPLATES ───────────────────────────── */}
      {viewMode === "template" && (
        <div>
          <div style={{ padding: "10px 20px", background: B.white, borderBottom: "1px solid " + B.border }}>
            {centre ? (centreProgs.length > 0 ? (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: B.textMuted, marginBottom: 6, textTransform: "uppercase" }}>Programme templates for {centre}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {centreProgs.map((p, i) => (
                    <button key={i} onClick={() => setSelectedTemplate(selectedTemplate === i ? null : i)} style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                      border: selectedTemplate === i ? "2px solid " + B.navy : "1px solid " + B.border,
                      background: selectedTemplate === i ? B.navy : B.white, color: selectedTemplate === i ? B.white : B.navy,
                    }}>{p.nights} {p.period ? "\u00B7 " + p.period.split("-")[0].trim() : ""}</button>
                  ))}
                </div>
              </div>
            ) : <div style={{ fontSize: 11, color: B.textMuted }}>No templates for this centre</div>
            ) : <div style={{ fontSize: 11, color: B.warning, fontWeight: 600 }}>Select a centre in the header to see templates</div>}
          </div>
          {activeTemplate && (
            <div style={{ padding: "0 12px 16px" }}>
              <div style={{ padding: "8px 8px 4px", fontSize: 10, color: B.textMuted }}>{activeTemplate.centre} · {activeTemplate.nights} · {activeTemplate.period}</div>
              {activeTemplate.weeks.map((wk) => (
                <div key={wk.week} style={{ marginBottom: 12 }}>
                  <div style={{ padding: "6px 8px", fontWeight: 800, fontSize: 11, color: B.navy }}>Week {wk.week}</div>
                  <div style={{ overflow: "auto" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 10, background: B.white, borderRadius: 10, border: "1px solid " + B.border, minWidth: wk.days.length * 120 + 40 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, width: 30 }}></th>
                          {wk.days.map((d, i) => (
                            <th key={i} style={{ ...thStyle, textAlign: "center", minWidth: 110 }}>
                              <div style={{ fontWeight: 800, fontSize: 10, color: (d.day === "Saturday" || d.day === "Sunday") ? B.red : B.navy }}>{d.day}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {["am", "pm"].map((slot) => (
                          <tr key={slot} style={{ borderBottom: "1px solid " + B.borderLight }}>
                            <td style={{ ...tdStyle, fontWeight: 800, fontSize: 8, color: B.textMuted, textAlign: "center" }}>{slot.toUpperCase()}</td>
                            {wk.days.map((d, i) => {
                              const cls = classify(d[slot]);
                              return (
                                <td key={i} style={{ padding: "4px 6px", borderLeft: "1px solid " + B.borderLight, verticalAlign: "top" }}>
                                  <div style={{ background: cls.bg, color: cls.color, padding: "4px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, minHeight: 32, display: "flex", alignItems: "center" }}>{d[slot] || "\u2014"}</div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
