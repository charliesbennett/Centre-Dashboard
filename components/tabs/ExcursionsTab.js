"use client";
import { useState, useMemo } from "react";
import { uid, fmtDate, dayName, isWeekend, genDates, dayKey, inRange } from "@/lib/constants";
import { useB } from "@/lib/theme";
import { Fld, StatusBadge, TableWrap, IconBtn, IcPlus, IcTrash, IcEdit, IcCheck, IcCopy, inputStyle, thStyle, tdStyle, btnPrimary, btnNavy } from "@/components/ui";

export default function ExcursionsTab({ excDays, setExcDays, groups, progStart, progEnd, excursions, setExcursions, centre, progGrid, settings, readOnly = false }) {
  const B = useB();
  const COACH_STATUS = {
    Pending: { color: B.warning, bg: B.warningBg },
    Requested: { color: B.link, bg: B.cyanBg },
    Confirmed: { color: B.success, bg: B.successBg },
    Paid: { color: "#5b21b6", bg: "#ede9fe" },
  };
  const isMinistay = /mini[\s-]?stay/i.test(centre || "");
  const [showCoachForm, setShowCoachForm] = useState(null);
  const [coachForm, setCoachForm] = useState({ company: "", phone: "", cost: "", pickupTime: "", dropoffTime: "", vehicle: "Coach", notes: "", status: "Pending" });
  const [editingDest, setEditingDest] = useState(null);
  const [destValue, setDestValue] = useState("");
  const [editCoachKey, setEditCoachKey] = useState(null); // "date-coachId"
  const [editCoachForm, setEditCoachForm] = useState({});
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesValue, setNotesValue] = useState("");

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
    if (!isMinistay) {
      weekendExcs.forEach((we) => {
        if (!combined.find((e) => e.date === we.date)) combined.push(we);
      });
    }
    return combined.sort((a, b) => a.date.localeCompare(b.date));
  }, [excList, weekendExcs, isMinistay]);

  // Returns true if this cell value looks like a custom excursion destination
  // (non-standard activity — mirrors the orange catch-all in ProgrammesTab classify())
  const isExcActivity = (text) => {
    if (!text) return false;
    const t = text.toLowerCase();
    return !t.includes("arrival") && !t.includes("depart") &&
      !t.includes("english") && !t.includes("lesson") && !t.includes(" test") &&
      !t.includes("multi-activity") && !t.includes("chosen programme") &&
      !t.includes("activity") && !t.includes("free time") && !t.includes("optional") &&
      !t.includes("orientation") && !t.includes("welcome") &&
      !t.includes("evening") && !t.includes(" ee") && t !== "ee" &&
      !t.includes("disco") && !t.includes("quiz") && !t.includes("movie") &&
      !t.includes("trashion") && !t.includes("speed dating") && !t.includes("paparazzi") &&
      !t.includes("sports") && !t.includes("games") && !t.includes("arts & crafts") &&
      !t.includes("full exc") && !t.includes("half exc");
  };

  const applyResult = (newExcDays, destUpdates) => {
    setExcDays(newExcDays);
    if (destUpdates.length > 0) {
      setExcursions((prev) => {
        const updated = [...(prev || [])];
        destUpdates.forEach(({ date, destination }) => {
          const idx = updated.findIndex((e) => e.date === date);
          if (idx >= 0) { updated[idx] = { ...updated[idx], destination }; }
          else { updated.push({ id: uid(), date, destination, coaches: [], notes: "" }); }
        });
        return updated;
      });
    }
  };

  const autoFromProgramme = () => {
    const newExcDays = {};
    const destUpdates = [];
    const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

    // Path 1: template exc fields (ministay, if any day has an exc field set)
    if (isMinistay && settings?.ministay_template) {
      try {
        const tmpl = JSON.parse(settings.ministay_template);
        const isRelative = Object.keys(tmpl).some((k) => /^\d+$/.test(k));
        let found = false;
        (groups || []).forEach((g) => {
          const arrTime = g.arr ? new Date(g.arr + "T00:00:00").getTime() : null;
          if (!arrTime) return;
          dates.forEach((d) => {
            const ds = dayKey(d);
            if (!inRange(ds, g.arr, g.dep)) return;
            let day = isRelative
              ? tmpl[String(Math.round((d.getTime() - arrTime) / 86400000) + 1)]
              : tmpl[DOW[d.getDay()]];
            if (day?.exc === "Full") {
              newExcDays[ds] = "Full"; found = true;
              if (day.exc_dest) destUpdates.push({ date: ds, destination: day.exc_dest });
            } else if (day?.exc === "Half" && !newExcDays[ds]) {
              newExcDays[ds] = "Half"; found = true;
              if (day.exc_dest) destUpdates.push({ date: ds, destination: day.exc_dest });
            }
          });
        });
        if (found) { applyResult(newExcDays, destUpdates); return; }
      } catch {}
    }

    // Path 2: scan progGrid — keywords ("Full Exc"/"Half Exc") + heuristic for custom names
    dates.forEach((d) => {
      const ds = dayKey(d);
      let hasFullKw = false, hasHalfKw = false, amDest = "", pmDest = "";
      (groups || []).forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        const am = (progGrid || {})[`${g.id}-${ds}-AM`] || "";
        const pm = (progGrid || {})[`${g.id}-${ds}-PM`] || "";
        const amL = am.toLowerCase(), pmL = pm.toLowerCase();
        if (amL.includes("full") && amL.includes("exc")) hasFullKw = true;
        if (pmL.includes("full") && pmL.includes("exc")) hasFullKw = true;
        if (amL.includes("half") && amL.includes("exc")) hasHalfKw = true;
        if (pmL.includes("half") && pmL.includes("exc")) hasHalfKw = true;
        if (!amDest && isExcActivity(am)) amDest = am;
        if (!pmDest && isExcActivity(pm)) pmDest = pm;
      });
      const amExc = isMinistay && (groups || []).some((g) => isExcActivity((progGrid || {})[`${g.id}-${ds}-AM`] || ""));
      const pmExc = isMinistay && (groups || []).some((g) => isExcActivity((progGrid || {})[`${g.id}-${ds}-PM`] || ""));
      let excType = hasFullKw || (amExc && pmExc) ? "Full"
        : hasHalfKw || amExc || pmExc ? "Half" : null;
      if (excType) {
        newExcDays[ds] = excType;
        const dest = pmDest || amDest;
        if (dest) destUpdates.push({ date: ds, destination: dest });
      }
    });
    applyResult(newExcDays, destUpdates);
  };

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

  const startEditCoach = (date, coach) => {
    setEditCoachKey(date + "-" + coach.id);
    setEditCoachForm({ ...coach });
  };

  const saveCoachEdit = (date) => {
    setExcursions((p) => p.map((e) => e.date === date
      ? { ...e, coaches: (e.coaches || []).map((c) => c.id === editCoachForm.id ? { ...editCoachForm, cost: parseFloat(editCoachForm.cost) || 0 } : c) }
      : e));
    setEditCoachKey(null);
  };

  const duplicateCoach = (date, coach) => {
    const copy = { ...coach, id: uid() };
    setExcursions((p) => p.map((e) => e.date === date ? { ...e, coaches: [...(e.coaches || []), copy] } : e));
  };

  const saveNotes = (date, notes) => {
    const existing = (excursions || []).find((e) => e.date === date);
    if (existing) {
      setExcursions((p) => p.map((e) => e.date === date ? { ...e, notes } : e));
    } else {
      setExcursions((p) => [...p, { id: uid(), date, destination: "", coaches: [], notes }]);
    }
    setEditingNotes(null);
  };

  const totalCoachCost = allExcs.reduce((sum, exc) => sum + (exc.coaches || []).reduce((s, c) => s + (c.cost || 0), 0), 0);
  const totalCoaches = allExcs.reduce((sum, exc) => sum + (exc.coaches || []).length, 0);
  const confirmedCoaches = allExcs.reduce((sum, exc) => sum + (exc.coaches || []).filter((c) => c.status === "Confirmed" || c.status === "Paid").length, 0);

  const fi = inputStyle;

  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ background: B.warningBg, border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: B.warning }}>{allExcs.length}</div>
          <div style={{ fontSize: 9, color: "#9a3412", fontWeight: 600 }}>Excursion Days</div>
        </div>
        <div style={{ background: B.cyanBg, border: "1px solid #7dd3fc", borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: B.link }}>{allExcs.filter((e) => e.type === "Full").length}</div>
          <div style={{ fontSize: 9, color: "#0c4a6e", fontWeight: 600 }}>Full Day</div>
        </div>
        <div style={{ background: B.purpleBg, border: "1px solid #d8b4fe", borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: B.purple }}>{allExcs.filter((e) => e.type === "Half").length}</div>
          <div style={{ fontSize: 9, color: "#5b21b6", fontWeight: 600 }}>Half Day</div>
        </div>
        <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: B.text }}>{totalCoaches}</div>
          <div style={{ fontSize: 9, color: B.textMuted, fontWeight: 600 }}>Coaches</div>
        </div>
        {totalCoaches > 0 && (
          <div style={{ background: confirmedCoaches === totalCoaches ? B.successBg : B.warningBg, border: "1px solid " + (confirmedCoaches === totalCoaches ? "#86efac" : "#fcd34d"), borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: confirmedCoaches === totalCoaches ? B.success : B.warning }}>{confirmedCoaches}/{totalCoaches}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: B.textMuted }}>Confirmed</div>
          </div>
        )}
        {totalCoachCost > 0 && (
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: B.text }}>{"\u00a3"}{totalCoachCost.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: B.textMuted, fontWeight: 600 }}>Coach Cost</div>
          </div>
        )}
        <button onClick={autoFromProgramme}
          title={isMinistay ? "Reads exc days from ministay template first, then falls back to scanning the programme grid for Full Exc / Half Exc keywords or custom activity names" : "Scans the programme grid for Full Exc / Half Exc keywords or custom activity names and marks those days as excursion days"}
          style={{ ...btnNavy, marginLeft: "auto" }}>
          Auto from Programme
        </button>
        <div style={{ fontSize: 9, color: B.textMuted }}>
          {isMinistay ? "Ministay: set exc days via Programme tab or Auto from Programme" : "Set exc days in Programmes tab \u00b7 Weekends auto-included"}
        </div>
      </div>

      {allExcs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: B.textLight, fontSize: 13 }}>
          No excursion days. Click date headers in the Programmes tab to toggle Full/Half excursion days.
        </div>
      ) : (
        <div style={{ padding: "0 12px 20px" }}>
          {allExcs.map((exc) => (
            <div key={exc.date} style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid " + B.borderLight, background: exc.isWeekend ? B.dangerBg : exc.type === "Full" ? B.warningBg : B.cyanBg }}>
                <div style={{ minWidth: 90 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: B.text }}>{dayName(exc.day)}</div>
                  <div style={{ fontSize: 10, color: B.textMuted }}>{fmtDate(exc.date)}</div>
                </div>
                <span style={{
                  background: exc.type === "Full" ? "#fed7aa" : "#bae6fd",
                  color: exc.type === "Full" ? B.warning : B.link,
                  padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 800,
                }}>{exc.type === "Full" ? "Full Day" : "Half Day"}</span>
                {exc.isWeekend && <span style={{ background: B.dangerBg, color: B.danger, padding: "3px 8px", borderRadius: 5, fontSize: 9, fontWeight: 800 }}>Weekend</span>}
                <span style={{ background: B.cyanBg, color: B.link, padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{exc.total} pax</span>
                <span style={{ fontSize: 9, color: B.textMuted }}>({exc.stuCount} stu + {exc.glCount} GL)</span>

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted }}>Destination:</span>
                  {editingDest === exc.date ? (
                    <input autoFocus value={destValue} onChange={(e) => setDestValue(e.target.value)}
                      onBlur={() => saveDest(exc.date, destValue)}
                      onKeyDown={(e) => e.key === "Enter" && saveDest(exc.date, destValue)}
                      style={{ ...fi, width: 180, fontSize: 11 }} placeholder="e.g. London Eye" />
                  ) : (
                    <span onClick={() => { if (!readOnly) { setEditingDest(exc.date); setDestValue(exc.destination); } }}
                      style={{ fontSize: 11, fontWeight: 700, color: exc.destination ? B.text : B.textLight, cursor: readOnly ? "default" : "pointer", padding: "3px 8px", borderRadius: 4, border: "1px dashed " + (exc.destination ? "transparent" : B.border), minWidth: 120 }}>
                      {exc.destination || (readOnly ? "—" : "Click to set...")}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding: "4px 16px 2px", display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid " + B.borderLight }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted, whiteSpace: "nowrap" }}>Notes:</span>
                {editingNotes === exc.date ? (
                  <input autoFocus value={notesValue} onChange={(e) => setNotesValue(e.target.value)}
                    onBlur={() => saveNotes(exc.date, notesValue)}
                    onKeyDown={(e) => e.key === "Enter" && saveNotes(exc.date, notesValue)}
                    style={{ ...fi, fontSize: 10, flex: 1 }} placeholder="Any notes..." />
                ) : (
                  <span onClick={() => { if (!readOnly) { setEditingNotes(exc.date); setNotesValue(exc.notes || ""); } }}
                    style={{ fontSize: 10, color: exc.notes ? B.text : B.textLight, cursor: readOnly ? "default" : "pointer", flex: 1, padding: "2px 6px", borderRadius: 4, border: "1px dashed " + (exc.notes ? "transparent" : B.border) }}>
                    {exc.notes || (readOnly ? "—" : "Click to add notes...")}
                  </span>
                )}
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
                      {(exc.coaches || []).map((c) => {
                        const eck = exc.date + "-" + c.id;
                        const isEd = editCoachKey === eck;
                        const ecFi = { ...fi, fontSize: 9, padding: "2px 4px" };
                        return (
                          <tr key={c.id} style={{ borderBottom: "1px solid " + B.borderLight, background: isEd ? "#f0f4ff" : "transparent" }}>
                            <td style={{ ...tdStyle, fontWeight: 700, color: B.text }}>{isEd ? <input value={editCoachForm.company || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, company: e.target.value }))} style={{ ...ecFi, width: 120 }} /> : c.company}</td>
                            <td style={tdStyle}>{isEd ? (
                              <select value={editCoachForm.vehicle || "Coach"} onChange={(e) => setEditCoachForm((p) => ({ ...p, vehicle: e.target.value }))} style={{ ...ecFi, cursor: "pointer", width: 80 }}>
                                {["Coach", "Minibus", "Double Decker", "Train", "Other"].map((v) => <option key={v}>{v}</option>)}
                              </select>
                            ) : <span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{c.vehicle}</span>}</td>
                            <td style={tdStyle}>{isEd ? <input value={editCoachForm.pickupTime || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, pickupTime: e.target.value }))} style={{ ...ecFi, width: 55 }} placeholder="09:00" /> : c.pickupTime || "\u2014"}</td>
                            <td style={tdStyle}>{isEd ? <input value={editCoachForm.dropoffTime || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, dropoffTime: e.target.value }))} style={{ ...ecFi, width: 55 }} placeholder="17:00" /> : c.dropoffTime || "\u2014"}</td>
                            <td style={{ ...tdStyle, fontWeight: 700 }}>{isEd ? <input type="number" value={editCoachForm.cost || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, cost: e.target.value }))} style={{ ...ecFi, width: 60 }} /> : c.cost ? "\u00a3" + c.cost.toLocaleString() : "\u2014"}</td>
                            <td style={tdStyle}>{isEd ? (
                              <select value={editCoachForm.status || "Pending"} onChange={(e) => setEditCoachForm((p) => ({ ...p, status: e.target.value }))} style={{ ...ecFi, cursor: "pointer", width: 85 }}>
                                {Object.keys(COACH_STATUS).map((s) => <option key={s}>{s}</option>)}
                              </select>
                            ) : <StatusBadge status={c.status} map={COACH_STATUS} />}</td>
                            <td style={{ ...tdStyle, fontSize: 9, color: B.textMuted, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{isEd ? <input value={editCoachForm.notes || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, notes: e.target.value }))} style={{ ...ecFi, width: 100 }} /> : c.notes || "\u2014"}</td>
                            <td style={tdStyle}>
                              {!readOnly && <div style={{ display: "flex", gap: 2 }}>
                                {isEd ? (
                                  <>
                                    <IconBtn onClick={() => saveCoachEdit(exc.date)}><IcCheck /></IconBtn>
                                    <IconBtn onClick={() => setEditCoachKey(null)}><span style={{ fontSize: 9, color: B.textMuted }}>✕</span></IconBtn>
                                  </>
                                ) : (
                                  <>
                                    <IconBtn onClick={() => startEditCoach(exc.date, c)}><IcEdit /></IconBtn>
                                    <IconBtn title="Duplicate coach" onClick={() => duplicateCoach(exc.date, c)}><IcCopy /></IconBtn>
                                    <IconBtn danger onClick={() => removeCoach(exc.date, c.id)}><IcTrash /></IconBtn>
                                  </>
                                )}
                              </div>}
                            </td>
                          </tr>
                        );
                      })}
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
                    <button onClick={() => addCoach(exc.date)} style={{ ...btnNavy, padding: "5px 14px", fontSize: 10 }}>Add</button>
                    <button onClick={() => setShowCoachForm(null)} style={{ padding: "5px 10px", background: "transparent", border: "1px solid " + B.border, color: B.textMuted, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", height: 30 }}>Cancel</button>
                  </div>
                ) : (
                  !readOnly && <button onClick={() => setShowCoachForm(exc.date)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "transparent", border: "1px dashed " + B.border, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", color: B.textMuted }}>
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
