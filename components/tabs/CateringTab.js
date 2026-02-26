"use client";
import { useState, useMemo, useRef } from "react";
import { B, uid, MEALS, MEAL_COLORS, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { StatCard, Fld, TableWrap, IconBtn, IcPlus, IcTrash, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const DIET_TYPES = ["Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-Free", "Dairy-Free", "Nut Allergy", "Egg Allergy", "Fish Allergy", "Other"];

export default function CateringTab({ groups, staff, progStart, progEnd, excDays, cateringData, setCateringData }) {
  const dates = useMemo(() => genDates(progStart, progEnd), [progStart, progEnd]);
  const teamSize = staff.length;
  const cd = cateringData || {};
  const dietary = cd.dietary || [];
  const specialMeals = cd.specialMeals || [];
  const overrides = cd.overrides || {};
  const [view, setView] = useState("grid"); // grid | dietary | specials | groups
  const [showDietForm, setShowDietForm] = useState(false);
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [dietForm, setDietForm] = useState({ name: "", group: "", type: "Vegetarian", details: "" });
  const [specialForm, setSpecialForm] = useState({ date: "", meal: "Dinner", description: "", count: 1 });
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const printRef = useRef(null);
  const fi = inputStyle;

  const update = (key, val) => setCateringData({ ...cd, [key]: val });

  // ── Auto-calculated meal counts ─────────────────────
  const autoData = useMemo(() => {
    const totals = {};
    dates.forEach((d) => {
      const s = dayKey(d);
      totals[s] = {};
      MEALS.forEach((m) => (totals[s][m] = 0));
      const isFE = excDays[s] === "Full";
      const we = isWeekend(d);

      if (teamSize > 0) {
        totals[s]["Breakfast"] += teamSize;
        totals[s][(isFE || we) ? "Packed Lunch" : "Lunch"] += teamSize;
        totals[s]["Dinner"] += teamSize;
      }

      groups.forEach((g) => {
        const pax = (g.stu || 0) + (g.gl || 0);
        if (!pax || !inRange(s, g.arr, g.dep)) return;
        const isArr = g.arr && s === dayKey(new Date(g.arr));
        const isDep = g.dep && s === dayKey(new Date(g.dep));

        if (isArr) {
          const fm = g.firstMeal || "Dinner";
          if (fm === "Breakfast" || fm === "Packed Bkfst") { totals[s][fm] += pax; totals[s]["Lunch"] += pax; totals[s]["Dinner"] += pax; }
          else if (fm === "Lunch" || fm === "Packed Lunch") { totals[s][fm] += pax; totals[s]["Dinner"] += pax; }
          else { totals[s]["Dinner"] += pax; }
          return;
        }
        if (isDep) {
          const lm = g.lastMeal || "Packed Lunch";
          totals[s]["Breakfast"] += pax;
          if (lm !== "Breakfast" && lm !== "Packed Bkfst") totals[s][lm] += pax;
          if (lm === "Dinner" || lm === "Packed Dinner") totals[s]["Lunch"] += pax;
          return;
        }
        totals[s]["Breakfast"] += pax;
        totals[s][(isFE || we) ? "Packed Lunch" : "Lunch"] += pax;
        totals[s]["Dinner"] += pax;
      });
    });
    return totals;
  }, [dates, groups, teamSize, excDays]);

  // Per-group data
  const groupData = useMemo(() => {
    const gd = {};
    groups.forEach((g) => {
      gd[g.id] = {};
      dates.forEach((d) => {
        const s = dayKey(d);
        gd[g.id][s] = {};
        MEALS.forEach((m) => (gd[g.id][s][m] = 0));
        const pax = (g.stu || 0) + (g.gl || 0);
        if (!pax || !inRange(s, g.arr, g.dep)) return;
        const isFE = excDays[s] === "Full";
        const we = isWeekend(d);
        const isArr = g.arr && s === dayKey(new Date(g.arr));
        const isDep = g.dep && s === dayKey(new Date(g.dep));

        if (isArr) {
          const fm = g.firstMeal || "Dinner";
          if (fm === "Breakfast" || fm === "Packed Bkfst") { gd[g.id][s][fm] += pax; gd[g.id][s]["Lunch"] += pax; gd[g.id][s]["Dinner"] += pax; }
          else if (fm === "Lunch" || fm === "Packed Lunch") { gd[g.id][s][fm] += pax; gd[g.id][s]["Dinner"] += pax; }
          else { gd[g.id][s]["Dinner"] += pax; }
          return;
        }
        if (isDep) {
          const lm = g.lastMeal || "Packed Lunch";
          gd[g.id][s]["Breakfast"] += pax;
          if (lm !== "Breakfast" && lm !== "Packed Bkfst") gd[g.id][s][lm] += pax;
          if (lm === "Dinner" || lm === "Packed Dinner") gd[g.id][s]["Lunch"] += pax;
          return;
        }
        gd[g.id][s]["Breakfast"] += pax;
        gd[g.id][s][(isFE || we) ? "Packed Lunch" : "Lunch"] += pax;
        gd[g.id][s]["Dinner"] += pax;
      });
    });
    return gd;
  }, [dates, groups, excDays]);

  // Merged data (auto + overrides)
  const mergedData = useMemo(() => {
    const m = {};
    dates.forEach((d) => {
      const s = dayKey(d);
      m[s] = {};
      MEALS.forEach((meal) => {
        const key = s + "-" + meal;
        m[s][meal] = overrides[key] !== undefined ? overrides[key] : (autoData[s] || {})[meal] || 0;
      });
    });
    return m;
  }, [autoData, overrides, dates]);

  // Dietary summary
  const dietSummary = useMemo(() => {
    const counts = {};
    dietary.forEach((d) => { counts[d.type] = (counts[d.type] || 0) + 1; });
    return counts;
  }, [dietary]);

  // Override a cell
  const setOverride = (dateStr, meal, val) => {
    const key = dateStr + "-" + meal;
    const newOverrides = { ...overrides };
    const num = parseInt(val);
    if (isNaN(num) || num === ((autoData[dateStr] || {})[meal] || 0)) {
      delete newOverrides[key];
    } else {
      newOverrides[key] = num;
    }
    update("overrides", newOverrides);
  };

  const startEdit = (dateStr, meal) => {
    const key = dateStr + "-" + meal;
    setEditingCell(key);
    setEditValue(String(overrides[key] !== undefined ? overrides[key] : (autoData[dateStr] || {})[meal] || 0));
  };

  const commitEdit = () => {
    if (editingCell) {
      const [dateStr, ...mealParts] = editingCell.split("-");
      const dateKey = editingCell.slice(0, 10);
      const meal = editingCell.slice(11);
      setOverride(dateKey, meal, editValue);
      setEditingCell(null);
    }
  };

  // Add dietary
  const addDietary = () => {
    if (!dietForm.name.trim()) return;
    update("dietary", [...dietary, { ...dietForm, id: uid() }]);
    setDietForm({ name: "", group: "", type: "Vegetarian", details: "" });
    setShowDietForm(false);
  };

  // Add special meal
  const addSpecial = () => {
    if (!specialForm.description.trim()) return;
    update("specialMeals", [...specialMeals, { ...specialForm, id: uid(), count: parseInt(specialForm.count) || 1 }]);
    setSpecialForm({ date: "", meal: "Dinner", description: "", count: 1 });
    setShowSpecialForm(false);
  };

  // Print
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Catering - Meal Counts</title><style>
      body{font-family:sans-serif;font-size:11px;padding:16px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ccc;padding:4px 6px;text-align:center}
      th{background:#f0f0f0;font-size:9px}
      .diet{margin-top:20px} .diet td{text-align:left}
      h2{font-size:14px;margin:8px 0 4px}
      @media print{body{padding:0}}
    </style></head><body>`);
    w.document.write("<h2>Meal Counts</h2>");
    w.document.write(el.innerHTML);
    if (dietary.length > 0) {
      w.document.write('<div class="diet"><h2>Dietary Requirements</h2><table><tr><th>Name</th><th>Group</th><th>Type</th><th>Details</th></tr>');
      dietary.forEach((d) => { w.document.write(`<tr><td>${d.name}</td><td>${d.group}</td><td>${d.type}</td><td>${d.details}</td></tr>`); });
      w.document.write("</table></div>");
    }
    if (specialMeals.length > 0) {
      w.document.write('<div class="diet"><h2>Special Meals</h2><table><tr><th>Date</th><th>Meal</th><th>Description</th><th>Count</th></tr>');
      specialMeals.forEach((s) => { w.document.write(`<tr><td>${fmtDate(s.date)}</td><td>${s.meal}</td><td>${s.description}</td><td>${s.count}</td></tr>`); });
      w.document.write("</table></div>");
    }
    w.document.write("</body></html>");
    w.document.close();
    w.print();
  };

  const overrideCount = Object.keys(overrides).length;

  return (
    <div>
      {/* Header */}
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatCard label="Groups" value={groups.length} accent={B.navy} />
        <StatCard label="Team" value={teamSize} accent="#0369a1" />
        <StatCard label="Days" value={dates.length} accent={B.textMuted} />
        <StatCard label="Dietary" value={dietary.length} accent="#dc2626" />
        <StatCard label="Specials" value={specialMeals.length} accent="#7c3aed" />
        {overrideCount > 0 && <StatCard label="Overrides" value={overrideCount} accent="#ea580c" />}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["grid", "groups", "dietary", "specials"].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "5px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
              border: "1px solid " + (view === v ? B.navy : B.border),
              background: view === v ? B.navy : B.white, color: view === v ? B.white : B.textMuted,
            }}>{v === "grid" ? "\ud83c\udf7d\ufe0f Meals" : v === "groups" ? "\ud83d\udc65 By Group" : v === "dietary" ? "\u26a0\ufe0f Dietary" : "\u2b50 Specials"}</button>
          ))}
          <button onClick={handlePrint} style={{ ...btnPrimary, background: B.navy, marginLeft: 4 }}>{"\ud83d\udda8\ufe0f"} Print</button>
        </div>
      </div>

      {/* Meal legend */}
      <div style={{ padding: "0 20px 6px", display: "flex", gap: 4, flexWrap: "wrap" }}>
        {MEALS.map((m) => (
          <span key={m} style={{ background: MEAL_COLORS[m] + "20", color: MEAL_COLORS[m], padding: "2px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{m}</span>
        ))}
        {overrideCount > 0 && <span style={{ background: "#fff7ed", color: "#ea580c", padding: "2px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{overrideCount} manual overrides</span>}
        <span style={{ fontSize: 9, color: B.textMuted, marginLeft: 4 }}>Click cell to override {"\u00b7"} Clear to reset to auto</span>
      </div>

      {/* ── GRID VIEW ──────────────────────────────────── */}
      {view === "grid" && (
        <div style={{ padding: "0 8px 16px", overflowX: "auto", maxWidth: "100vw" }} ref={printRef}>
          <TableWrap>
            <table style={{ minWidth: 1200, borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 110, position: "sticky", left: 0, zIndex: 2, background: "#f8fafc" }}>Meal</th>
                  {dates.map((d) => {
                    const s = dayKey(d); const we = isWeekend(d); const exc = excDays[s];
                    const specials = specialMeals.filter((sm) => sm.date === s);
                    return (
                      <th key={s} style={{ ...thStyle, textAlign: "center", minWidth: 36, background: exc ? "#fff7ed" : we ? "#fef2f2" : "#f8fafc" }}>
                        <div style={{ fontWeight: 800, fontSize: 8, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                        <div style={{ fontSize: 7, color: B.textMuted }}>{d.getDate()}/{d.getMonth()+1}</div>
                        {exc && <div style={{ fontSize: 6, color: "#ea580c", fontWeight: 800 }}>{exc === "Full" ? "FD" : "HD"}</div>}
                        {specials.length > 0 && <div style={{ fontSize: 6, color: "#7c3aed", fontWeight: 800 }}>{"\u2b50"}</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {MEALS.map((m) => (
                  <tr key={m} style={{ borderBottom: "1px solid " + B.borderLight }}>
                    <td style={{ padding: "6px 8px", position: "sticky", left: 0, background: B.white, zIndex: 1 }}>
                      <span style={{ background: MEAL_COLORS[m] + "20", color: MEAL_COLORS[m], padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>{m}</span>
                    </td>
                    {dates.map((d) => {
                      const s = dayKey(d);
                      const cellKey = s + "-" + m;
                      const v = (mergedData[s] || {})[m] || 0;
                      const autoV = (autoData[s] || {})[m] || 0;
                      const isOverridden = overrides[cellKey] !== undefined;
                      const isEd = editingCell === cellKey;
                      return (
                        <td key={s} onClick={() => !isEd && startEdit(s, m)} style={{
                          textAlign: "center", padding: "4px 1px", cursor: "pointer",
                          fontWeight: v ? 800 : 400, color: v ? (isOverridden ? "#ea580c" : B.navy) : B.textLight,
                          fontSize: v ? 11 : 9, borderLeft: "1px solid " + B.borderLight,
                          background: isOverridden ? "#fff7ed" : v ? MEAL_COLORS[m] + "10" : "transparent",
                        }}>
                          {isEd ? (
                            <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                              style={{ width: 32, fontSize: 10, textAlign: "center", border: "1px solid " + B.navy, borderRadius: 2, padding: "2px", fontFamily: "inherit" }} />
                          ) : v || "\u2014"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr style={{ background: B.navy }}>
                  <td style={{ padding: "6px 8px", fontWeight: 800, color: B.white, fontSize: 10, position: "sticky", left: 0, zIndex: 1, background: B.navy }}>TOTAL</td>
                  {dates.map((d) => {
                    const s = dayKey(d);
                    const tot = MEALS.reduce((sum, m) => sum + ((mergedData[s] || {})[m] || 0), 0);
                    return <td key={s} style={{ textAlign: "center", padding: "5px 1px", fontWeight: 800, color: B.white, fontSize: 10, borderLeft: "1px solid rgba(255,255,255,0.15)" }}>{tot || "\u2014"}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </TableWrap>
          {overrideCount > 0 && (
            <div style={{ padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "#ea580c" }}>{"\u26a0\ufe0f"} {overrideCount} cells manually overridden (shown in orange)</span>
              <button onClick={() => update("overrides", {})} style={{ fontSize: 9, color: B.textMuted, background: "transparent", border: "1px solid " + B.border, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>Reset All Overrides</button>
            </div>
          )}
        </div>
      )}

      {/* ── GROUP BREAKDOWN VIEW ───────────────────────── */}
      {view === "groups" && (
        <div style={{ padding: "0 8px 16px", overflowX: "auto" }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: B.textLight }}>Import groups in Students tab</div>
          ) : (
            <>
              {/* Team row */}
              <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ padding: "8px 16px", fontWeight: 800, fontSize: 11, color: "#0369a1", background: "#e0f2fe", borderBottom: "1px solid #bae6fd" }}>
                  {"\ud83d\udc64"} Staff Team ({teamSize} people)
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead><tr>
                      <th style={{ ...thStyle, width: 90 }}>Meal</th>
                      {dates.map((d) => <th key={dayKey(d)} style={{ ...thStyle, textAlign: "center", minWidth: 28, fontSize: 7 }}>{dayName(d).slice(0,3)}<br/>{d.getDate()}</th>)}
                    </tr></thead>
                    <tbody>
                      {["Breakfast", "Lunch", "Packed Lunch", "Dinner"].map((m) => (
                        <tr key={m} style={{ borderBottom: "1px solid " + B.borderLight }}>
                          <td style={{ padding: "4px 8px" }}><span style={{ background: MEAL_COLORS[m] + "20", color: MEAL_COLORS[m], padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{m}</span></td>
                          {dates.map((d) => {
                            const s = dayKey(d); const isFE = excDays[s] === "Full"; const we = isWeekend(d);
                            let v = 0;
                            if (m === "Breakfast") v = teamSize;
                            else if (m === "Lunch" && !isFE && !we) v = teamSize;
                            else if (m === "Packed Lunch" && (isFE || we)) v = teamSize;
                            else if (m === "Dinner") v = teamSize;
                            return <td key={s} style={{ textAlign: "center", fontSize: 9, fontWeight: v ? 700 : 400, color: v ? B.navy : B.textLight, borderLeft: "1px solid " + B.borderLight }}>{v || ""}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Each group */}
              {groups.map((g) => (
                <div key={g.id} style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 16px", display: "flex", gap: 8, alignItems: "center", background: "#f0f9ff", borderBottom: "1px solid " + B.borderLight }}>
                    <span style={{ fontWeight: 800, fontSize: 11, color: B.navy }}>{g.group}</span>
                    <span style={{ fontSize: 9, color: B.textMuted }}>{g.agent}</span>
                    <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{(g.stu||0)+(g.gl||0)} pax</span>
                    <span style={{ fontSize: 9, color: B.textMuted }}>{fmtDate(g.arr)} {"\u2192"} {fmtDate(g.dep)}</span>
                    <span style={{ fontSize: 9, color: B.textMuted }}>1st: {g.firstMeal || "Dinner"} {"\u00b7"} Last: {g.lastMeal || "Packed Lunch"}</span>
                    {dietary.filter((d) => d.group === g.group).length > 0 && (
                      <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 800 }}>
                        {"\u26a0\ufe0f"} {dietary.filter((d) => d.group === g.group).length} dietary
                      </span>
                    )}
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <thead><tr>
                        <th style={{ ...thStyle, width: 90 }}>Meal</th>
                        {dates.map((d) => <th key={dayKey(d)} style={{ ...thStyle, textAlign: "center", minWidth: 28, fontSize: 7 }}>{dayName(d).slice(0,3)}<br/>{d.getDate()}</th>)}
                      </tr></thead>
                      <tbody>
                        {MEALS.map((m) => {
                          const hasValues = dates.some((d) => ((groupData[g.id] || {})[dayKey(d)] || {})[m] > 0);
                          if (!hasValues) return null;
                          return (
                            <tr key={m} style={{ borderBottom: "1px solid " + B.borderLight }}>
                              <td style={{ padding: "4px 8px" }}><span style={{ background: MEAL_COLORS[m] + "20", color: MEAL_COLORS[m], padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{m}</span></td>
                              {dates.map((d) => {
                                const v = ((groupData[g.id] || {})[dayKey(d)] || {})[m] || 0;
                                return <td key={dayKey(d)} style={{ textAlign: "center", fontSize: 9, fontWeight: v ? 700 : 400, color: v ? B.navy : B.textLight, borderLeft: "1px solid " + B.borderLight }}>{v || ""}</td>;
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── DIETARY VIEW ───────────────────────────────── */}
      {view === "dietary" && (
        <div style={{ padding: "0 12px 16px" }}>
          {/* Summary badges */}
          {Object.keys(dietSummary).length > 0 && (
            <div style={{ padding: "8px 8px 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(dietSummary).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <span key={type} style={{ background: "#fee2e2", color: "#dc2626", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                  {type}: {count}
                </span>
              ))}
            </div>
          )}

          <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: B.textMuted }}>{dietary.length} dietary requirements</span>
            <button onClick={() => setShowDietForm(!showDietForm)} style={btnPrimary}><IcPlus /> Add</button>
          </div>

          {showDietForm && (
            <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "10px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Fld label="Name"><input value={dietForm.name} onChange={(e) => setDietForm((p) => ({ ...p, name: e.target.value }))} style={{ ...fi, width: 130 }} placeholder="Student name" /></Fld>
              <Fld label="Group">
                <select value={dietForm.group} onChange={(e) => setDietForm((p) => ({ ...p, group: e.target.value }))} style={{ ...fi, cursor: "pointer", width: 120 }}>
                  <option value="">Select...</option>
                  {groups.map((g) => <option key={g.id} value={g.group}>{g.group}</option>)}
                  <option value="Staff">Staff</option>
                </select>
              </Fld>
              <Fld label="Type">
                <select value={dietForm.type} onChange={(e) => setDietForm((p) => ({ ...p, type: e.target.value }))} style={{ ...fi, cursor: "pointer", width: 110 }}>
                  {DIET_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Fld>
              <Fld label="Details"><input value={dietForm.details} onChange={(e) => setDietForm((p) => ({ ...p, details: e.target.value }))} style={{ ...fi, width: 180 }} placeholder="Severity, alternatives..." /></Fld>
              <button onClick={addDietary} style={{ padding: "5px 14px", background: B.navy, border: "none", color: B.white, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit", height: 30 }}>Add</button>
            </div>
          )}

          <TableWrap>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr>{["Name", "Group", "Type", "Details", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {dietary.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 36, color: B.textLight }}>No dietary requirements recorded</td></tr>
                ) : dietary.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid " + B.borderLight }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{d.name}</td>
                    <td style={tdStyle}>{d.group || "\u2014"}</td>
                    <td style={tdStyle}>
                      <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800 }}>{d.type}</span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 10, color: B.textMuted }}>{d.details || "\u2014"}</td>
                    <td style={tdStyle}><IconBtn danger onClick={() => update("dietary", dietary.filter((x) => x.id !== d.id))}><IcTrash /></IconBtn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}

      {/* ── SPECIALS VIEW ──────────────────────────────── */}
      {view === "specials" && (
        <div style={{ padding: "0 12px 16px" }}>
          <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: B.textMuted }}>{specialMeals.length} special meals</span>
            <button onClick={() => setShowSpecialForm(!showSpecialForm)} style={btnPrimary}><IcPlus /> Add Special Meal</button>
          </div>

          {showSpecialForm && (
            <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "10px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Fld label="Date"><input type="date" value={specialForm.date} onChange={(e) => setSpecialForm((p) => ({ ...p, date: e.target.value }))} style={fi} /></Fld>
              <Fld label="Meal">
                <select value={specialForm.meal} onChange={(e) => setSpecialForm((p) => ({ ...p, meal: e.target.value }))} style={{ ...fi, cursor: "pointer", width: 90 }}>
                  {["Breakfast", "Lunch", "Dinner", "Snack", "BBQ", "Party"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </Fld>
              <Fld label="Description"><input value={specialForm.description} onChange={(e) => setSpecialForm((p) => ({ ...p, description: e.target.value }))} style={{ ...fi, width: 200 }} placeholder="e.g. Birthday cake for Maria" /></Fld>
              <Fld label="Count"><input type="number" value={specialForm.count} onChange={(e) => setSpecialForm((p) => ({ ...p, count: e.target.value }))} style={{ ...fi, width: 55 }} /></Fld>
              <button onClick={addSpecial} style={{ padding: "5px 14px", background: B.navy, border: "none", color: B.white, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit", height: 30 }}>Add</button>
            </div>
          )}

          <TableWrap>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr>{["Date", "Meal", "Description", "Count", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {specialMeals.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 36, color: B.textLight }}>No special meals — add birthday cakes, BBQ nights, themed dinners, etc.</td></tr>
                ) : specialMeals.sort((a, b) => (a.date || "").localeCompare(b.date || "")).map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid " + B.borderLight }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{fmtDate(s.date)}</td>
                    <td style={tdStyle}>
                      <span style={{ background: s.meal === "BBQ" ? "#fed7aa" : s.meal === "Party" ? "#e9d5ff" : "#dbeafe", color: s.meal === "BBQ" ? "#ea580c" : s.meal === "Party" ? "#7c3aed" : "#1e40af", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800 }}>{s.meal}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{s.description}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, textAlign: "center" }}>{s.count}</td>
                    <td style={tdStyle}><IconBtn danger onClick={() => update("specialMeals", specialMeals.filter((x) => x.id !== s.id))}><IcTrash /></IconBtn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}

      <div style={{ padding: "0 20px 8px", fontSize: 9, color: B.success, fontWeight: 600 }}>
        {"\u2713"} Auto-calculated: {groups.length} groups + {teamSize} team {"\u00b7"} Exc days & weekends {"\u2192"} packed lunches {"\u00b7"} Click cells to override
      </div>
    </div>
  );
}
