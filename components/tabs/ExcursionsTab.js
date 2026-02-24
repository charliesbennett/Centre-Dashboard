"use client";
import { useState, useMemo } from "react";
import { B, uid, fmtDate, dayName, isWeekend, genDates, dayKey, inRange } from "@/lib/constants";
import { Fld, StatusBadge, TableWrap, IconBtn, IcPlus, IcTrash, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const COACH_STATUS = {
  Pending: { color: B.warning, bg: B.warningBg },
  Requested: { color: "#0369a1", bg: "#e0f2fe" },
  Confirmed: { color: B.success, bg: B.successBg },
  Paid: { color: "#5b21b6", bg: "#ede9fe" },
};

export default function ExcursionsTab({ excDays, setExcDays, groups, progStart, progEnd, excursions, setExcursions }) {
  const [showCoachForm, setShowCoachForm] = useState(null);
  const [coachForm, setCoachForm] = useState({ company: "", phone: "", cost: "", pickupTime: "", dropoffTime: "", vehicle: "Coach", notes: "", status: "Pending" });
  const [editingDest, setEditingDest] = useState(null);
  const [destValue, setDestValue] = useState("");

  const dates = useMemo(() => (progStart && progEnd) ? genDates(progStart, progEnd) : [], [progStart, progEnd]);

  const excList = useMemo(() => {
    return Object.entries(excDays || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, type]) => {
        const d = new Date(date + "T12:00:00");
        let stuCount = 0, glCount = 0;
        (groups || []).forEach((g) => {
          if (!inRange(date, g.arr, g.dep)) return;
          if (g.arr && date === dayKey(new Date(g.arr))) return;
          if (g.dep && date === dayKey(new Date(g.dep))) return;
          stuCount += g.stu || 0;
          glCount += g.gl || 0;
        });
        const exc = (excursions || []).find((e) => e.date === date) || {};
        return { date, type, day: d, stuCount, glCount, total: stuCount + glCount, destination: exc.destination || "", coaches: exc.coaches || [], notes: exc.notes || "" };
      });
  }, [excDays, groups, excursions]);

  const weekendExcs = useMemo(() => {
    return dates.filter((d) => isWeekend(d)).map((d) => {
      const ds = dayKey(d);
      let stuCount = 0, glCount = 0;
      (groups || []).forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (g.arr && ds === dayKey(new Date(g.arr))) return;
        if (g.dep && ds === dayKey(new Date(g.dep))) return;
        stuCount += g.stu || 0;
        glCount += g.gl || 0;
      });
      if (stuCount === 0) return null;
      const exc = (excursions || []).find((e) => e.date === ds) || {};
      return { date: ds, type: "Full", day: d, stuCount, glCount, total: stuCount + glCount, destination: exc.destination || "", coaches: exc.coaches || [], notes: exc.notes || "", isWeekend: true };
    }).filter(Boolean);
  }, [dates, groups, excursions]);

  const allExcs = useMemo(() => {
    const combined = [...excList];
    weekendExcs.forEach((we) => {
      if (!combined.find((e) => e.date === we.date)) combined.push(we);
    });
    return combined.sort((a, b) => a.date.localeCompare(b.date));
  }, [excList, weekendExcs]);

  const saveDest = (date, dest) => {
    const existing = (excursions || []).find((e) => e.date === date);
    if (existing) {
      setExcursions((p) => p.map((e) => e.date === date ? { ...e, destination: dest } : e));
    } else {
      setExcursions((p) => [...p, { id: uid(), date, destination: dest, coaches: [], notes: "" }]);
    }
    setEditingDest(null);
  };

  const addCoach = (date) => {
    const coach = { id: uid(), ...coachForm, cost: parseFloat(coachForm.cost) || 0 };
    const existing = (excursions || []).find((e) => e.date === date);
    if (existing) {
      setExcursions((p) => p.map((e) => e.date === date ? { ...e, coaches: [...(e.coaches || []), coach] } : e));
    } else {
      setExcursions((p) => [...p, { id: uid(), date, destination: "", coaches: [coach], notes: "" }]);
    }
    setCoachForm({ company: "", phone: "", cost: "", pickupTime: "", dropoffTime: "", vehicle: "Coach", notes: "", status: "Pending" });
    setShowCoachForm(null);
  };

  const removeCoach = (date, coachId) => {
    setExcursions((p) => p.map((e) => e.date === date ? { ...e, coaches: (e.coaches || []).filter((c) => c.id !== coachId) } : e));
  };

  const totalCoachCost = allExcs.reduce((sum, exc) => sum + (exc.coaches || []).reduce((s, c) => s + (c.cost || 0), 0), 0);
  const totalCoaches = allExcs.reduce((sum, exc) => sum + (exc.coaches || []).length, 0);
  const confirmedCoaches = allExcs.reduce((sum, exc) => sum + (exc.coaches || []).filter((c) => c.status === "Confirmed" || c.status === "Paid").length, 0);

  const fi = inputStyle;

  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#ea580c" }}>{allExcs.length}</div>
          <div style={{ fontSize: 9, color: "#9a3412", fontWeight: 600 }}>Excursion Days</div>
        </div>
        <div style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0369a1" }}>{allExcs.filter((e) => e.type === "Full").length}</div>
          <div style={{ fontSize: 9, color: "#0c4a6e", fontWeight: 600 }}>Full Day</div>
        </div>
        <div style={{ background: "#faf5ff", border: "1px solid #d8b4fe", borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#7c3aed" }}>{allExcs.filter((e) => e.type === "Half").length}</div>
          <div style={{ fontSize: 9, color: "#5b21b6", fontWeight: 600 }}>Half Day</div>
        </div>
        <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: B.navy }}>{totalCoaches}</div>
          <div style={{ fontSize: 9, color: B.textMuted, fontWeight: 600 }}>Coaches</div>
        </div>
        {totalCoaches > 0 && (
          <div style={{ background: confirmedCoaches === totalCoaches ? B.successBg : B.warningBg, border: "1px solid " + (confirmedCoaches === totalCoaches ? "#86efac" : "#fcd34d"), borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: confirmedCoaches === totalCoaches ? B.success : B.warning }}>{confirmedCoaches}/{totalCoaches}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: B.textMuted }}>Confirmed</div>
          </div>
        )}
        {totalCoachCost > 0 && (
          <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: B.navy }}>{"\u00a3"}{totalCoachCost.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: B.textMuted, fontWeight: 600 }}>Coach Cost</div>
          </div>
        )}
        <div style={{ fontSize: 9, color: B.textMuted, marginLeft: "auto" }}>Set exc days in Programmes tab {"\u00b7"} Weekends auto-included</div>
      </div>

      {allExcs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: B.textLight, fontSize: 13 }}>
          No excursion days. Click date headers in the Programmes tab to toggle Full/Half excursion days.
        </div>
      ) : (
        <div style={{ padding: "0 12px 20px" }}>
          {allExcs.map((exc) => (
            <div key={exc.date} style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid " + B.borderLight, background: exc.isWeekend ? "#fef2f2" : exc.type === "Full" ? "#fff7ed" : "#f0f9ff" }}>
                <div style={{ minWidth: 90 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: B.navy }}>{dayName(exc.day)}</div>
                  <div style={{ fontSize: 10, color: B.textMuted }}>{fmtDate(exc.date)}</div>
                </div>
                <span style={{
                  background: exc.type === "Full" ? "#fed7aa" : "#bae6fd",
                  color: exc.type === "Full" ? "#ea580c" : "#0369a1",
                  padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 800,
                }}>{exc.type === "Full" ? "Full Day" : "Half Day"}</span>
                {exc.isWeekend && <span style={{ background: "#fee2e2", color: "#dc2626", padding: "3px 8px", borderRadius: 5, fontSize: 9, fontWeight: 800 }}>Weekend</span>}
                <span style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{exc.total} pax</span>
                <span style={{ fontSize: 9, color: B.textMuted }}>({exc.stuCount} stu + {exc.glCount} GL)</span>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted }}>Destination:</span>
                  {editingDest === exc.date ? (
                    <input autoFocus value={destValue} onChange={(e) => setDestValue(e.target.value)}
                      onBlur={() => saveDest(exc.date, destValue)}
                      onKeyDown={(e) => e.key === "Enter" && saveDest(exc.date, destValue)}
                      style={{ ...fi, width: 180, fontSize: 11 }} placeholder="e.g. London Eye" />
                  ) : (
                    <span onClick={() => { setEditingDest(exc.date); setDestValue(exc.destination); }}
                      style={{ fontSize: 11, fontWeight: 700, color: exc.destination ? B.navy : B.textLight, cursor: "pointer", padding: "3px 8px", borderRadius: 4, border: "1px dashed " + (exc.destination ? "transparent" : B.border), minWidth: 120 }}>
                      {exc.destination || "Click to set..."}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding: "6px 16px 10px" }}>
                {(exc.coaches || []).length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 6 }}>
                    <thead>
                      <tr>{["Company", "Vehicle", "Pickup", "Dropoff", "Cost", "Status", "Notes", ""].map((h) => (
                        <th key={h} style={{ ...thStyle, fontSize: 9, padding: "4px 8px" }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {(exc.coaches || []).map((c) => (
                        <tr key={c.id} style={{ borderBottom: "1px solid " + B.borderLight }}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{c.company}</td>
                          <td style={tdStyle}><span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{c.vehicle}</span></td>
                          <td style={tdStyle}>{c.pickupTime || "\u2014"}</td>
                          <td style={tdStyle}>{c.dropoffTime || "\u2014"}</td>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{c.cost ? "\u00a3" + c.cost.toLocaleString() : "\u2014"}</td>
                          <td style={tdStyle}><StatusBadge status={c.status} map={COACH_STATUS} /></td>
                          <td style={{ ...tdStyle, fontSize: 9, color: B.textMuted, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{c.notes || "\u2014"}</td>
                          <td style={tdStyle}><IconBtn danger onClick={() => removeCoach(exc.date, c.id)}><IcTrash /></IconBtn></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {showCoachForm === exc.date ? (
                  <div style={{ background: "#f8fafc", border: "1px solid " + B.border, borderRadius: 8, padding: "8px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <Fld label="Company"><input value={coachForm.company} onChange={(e) => setCoachForm((p) => ({ ...p, company: e.target.value }))} style={{ ...fi, width: 140 }} placeholder="e.g. National Express" /></Fld>
                    <Fld label="Vehicle">
                      <select value={coachForm.vehicle} onChange={(e) => setCoachForm((p) => ({ ...p, vehicle: e.target.value }))} style={{ ...fi, cursor: "pointer", width: 90 }}>
                        {["Coach", "Minibus", "Double Decker", "Train", "Other"].map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </Fld>
                    <Fld label="Pickup"><input value={coachForm.pickupTime} onChange={(e) => setCoachForm((p) => ({ ...p, pickupTime: e.target.value }))} style={{ ...fi, width: 70 }} placeholder="09:00" /></Fld>
                    <Fld label="Dropoff"><input value={coachForm.dropoffTime} onChange={(e) => setCoachForm((p) => ({ ...p, dropoffTime: e.target.value }))} style={{ ...fi, width: 70 }} placeholder="17:00" /></Fld>
                    <Fld label="Cost (\u00a3)"><input type="number" value={coachForm.cost} onChange={(e) => setCoachForm((p) => ({ ...p, cost: e.target.value }))} style={{ ...fi, width: 70 }} /></Fld>
                    <Fld label="Status">
                      <select value={coachForm.status} onChange={(e) => setCoachForm((p) => ({ ...p, status: e.target.value }))} style={{ ...fi, cursor: "pointer", width: 90 }}>
                        {Object.keys(COACH_STATUS).map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </Fld>
                    <Fld label="Notes"><input value={coachForm.notes} onChange={(e) => setCoachForm((p) => ({ ...p, notes: e.target.value }))} style={{ ...fi, width: 120 }} /></Fld>
                    <button onClick={() => addCoach(exc.date)} style={{ padding: "5px 14px", background: B.navy, border: "none", color: B.white, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit", height: 30 }}>Add</button>
                    <button onClick={() => setShowCoachForm(null)} style={{ padding: "5px 10px", background: "transparent", border: "1px solid " + B.border, color: B.textMuted, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", height: 30 }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setShowCoachForm(exc.date)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "transparent", border: "1px dashed " + B.border, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", color: B.textMuted }}>
                    <IcPlus /> Add Coach
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
