"use client";
import { useState, useMemo } from "react";
import { uid, fmtDate, dayName, isWeekend, genDates, dayKey, inRange } from "@/lib/constants";
import { useB } from "@/lib/theme";
import { Fld, StatusBadge, IconBtn, IcPlus, IcTrash, IcEdit, IcCheck, IcCopy, IcX, inputStyle, thStyle, tdStyle, btnNavy } from "@/components/ui";
import ExcursionsImportModal from "@/components/ExcursionsImportModal";
import { emptyBooking, bookingCounts, mergeBookingUpserts } from "@/lib/excursionBookings";

const DAY_PARTS = ["Full", "AM Half", "PM Half"];
const TRANSPORT_METHODS = ["Coach", "Walk", "Train", "Minibus", "Other"];

export default function ExcursionsTab({ excDays, setExcDays, groups, progStart, progEnd, excursions, setExcursions, centre, progGrid, settings, readOnly = false }) {
  const B = useB();
  const COACH_STATUS = {
    Pending: { color: B.warning, bg: B.warningBg },
    Requested: { color: B.link, bg: B.cyanBg },
    Confirmed: { color: B.success, bg: B.successBg },
    Paid: { color: "#5b21b6", bg: "#ede9fe" },
  };
  const isMinistay = /mini[\s-]?stay/i.test(centre || "");
  const [showImport, setShowImport] = useState(false);
  const [editingGroupsFor, setEditingGroupsFor] = useState(null); // booking id
  const [showCoachForm, setShowCoachForm] = useState(null); // booking id
  const [coachForm, setCoachForm] = useState({ company: "", phone: "", invoiceNo: "", bookingRef: "", pickupTime: "", dropoffTime: "", vehicle: "Coach", notes: "", status: "Pending" });
  const [editCoachKey, setEditCoachKey] = useState(null); // "bookingId-coachId"
  const [editCoachForm, setEditCoachForm] = useState({});

  const dates = useMemo(() => (progStart && progEnd) ? genDates(progStart, progEnd) : [], [progStart, progEnd]);

  const onSitePax = (date) => {
    let stuCount = 0, glCount = 0;
    (groups || []).forEach((g) => {
      if (!inRange(date, g.arr, g.dep)) return;
      if (g.arr && date === dayKey(new Date(g.arr))) return;
      if (g.dep && date === dayKey(new Date(g.dep))) return;
      stuCount += g.stu || 0;
      glCount += g.gl || 0;
    });
    return { stuCount, glCount };
  };

  const excList = useMemo(() => {
    return Object.entries(excDays || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, type]) => {
        const d = new Date(date + "T12:00:00");
        const { stuCount, glCount } = onSitePax(date);
        const bookings = (excursions || []).filter((e) => e.date === date);
        return { date, type, day: d, stuCount, glCount, total: stuCount + glCount, bookings };
      });
  }, [excDays, groups, excursions]);

  const weekendExcs = useMemo(() => {
    return dates.filter((d) => isWeekend(d)).map((d) => {
      const ds = dayKey(d);
      const { stuCount, glCount } = onSitePax(ds);
      if (stuCount === 0) return null;
      const bookings = (excursions || []).filter((e) => e.date === ds);
      return { date: ds, type: "Full", day: d, stuCount, glCount, total: stuCount + glCount, bookings, isWeekend: true };
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

  const applyResult = (newExcDays, bookingUpserts) => {
    setExcDays(newExcDays);
    if (bookingUpserts.length > 0) {
      setExcursions((prev) => mergeBookingUpserts(prev || [], bookingUpserts));
    }
  };

  const autoFromProgramme = () => {
    const newExcDays = {};
    const bookingUpserts = [];
    const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

    const addBookingUpsert = (date, attraction, dayPart, groupId) => {
      if (!attraction) return;
      let entry = bookingUpserts.find((b) => b.date === date && b.attraction === attraction && b.dayPart === dayPart);
      if (!entry) { entry = { date, attraction, dayPart, groupIds: [] }; bookingUpserts.push(entry); }
      if (groupId && !entry.groupIds.includes(groupId)) entry.groupIds.push(groupId);
    };

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
              if (day.exc_dest) addBookingUpsert(ds, day.exc_dest, "Full", g.id);
            } else if (day?.exc === "Half" && !newExcDays[ds]) {
              newExcDays[ds] = "Half"; found = true;
              if (day.exc_dest) addBookingUpsert(ds, day.exc_dest, "Half", g.id);
            }
          });
        });
        if (found) { applyResult(newExcDays, bookingUpserts); return; }
      } catch {}
    }

    // Path 2: scan progGrid — keywords ("Full Exc"/"Half Exc") + heuristic for custom names,
    // attributing each group's own custom destination text to a booking for that group
    dates.forEach((d) => {
      const ds = dayKey(d);
      let hasFullKw = false, hasHalfKw = false;
      (groups || []).forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        const am = (progGrid || {})[`${g.id}-${ds}-AM`] || "";
        const pm = (progGrid || {})[`${g.id}-${ds}-PM`] || "";
        const amL = am.toLowerCase(), pmL = pm.toLowerCase();
        if (amL.includes("full") && amL.includes("exc")) hasFullKw = true;
        if (pmL.includes("full") && pmL.includes("exc")) hasFullKw = true;
        if (amL.includes("half") && amL.includes("exc")) hasHalfKw = true;
        if (pmL.includes("half") && pmL.includes("exc")) hasHalfKw = true;

        const amIsCustom = isExcActivity(am);
        const pmIsCustom = isExcActivity(pm);
        if (amIsCustom && pmIsCustom && am === pm) {
          addBookingUpsert(ds, am, "Full", g.id);
        } else {
          if (amIsCustom) addBookingUpsert(ds, am, "AM Half", g.id);
          if (pmIsCustom) addBookingUpsert(ds, pm, "PM Half", g.id);
        }
      });
      const amExc = (groups || []).some((g) => inRange(ds, g.arr, g.dep) && isExcActivity((progGrid || {})[`${g.id}-${ds}-AM`] || ""));
      const pmExc = (groups || []).some((g) => inRange(ds, g.arr, g.dep) && isExcActivity((progGrid || {})[`${g.id}-${ds}-PM`] || ""));
      let excType = hasFullKw || (amExc && pmExc) ? "Full"
        : hasHalfKw || amExc || pmExc ? "Half" : null;
      if (excType) newExcDays[ds] = excType;
    });
    applyResult(newExcDays, bookingUpserts);
  };

  const addBooking = (date) => {
    setExcursions((p) => [...(p || []), emptyBooking(date)]);
  };

  const updateBooking = (id, patch) => {
    setExcursions((p) => p.map((e) => e.id === id ? { ...e, ...patch } : e));
  };

  const removeBooking = (id) => {
    setExcursions((p) => p.filter((e) => e.id !== id));
  };

  const toggleBookingGroup = (id, groupId) => {
    setExcursions((p) => p.map((e) => {
      if (e.id !== id) return e;
      const has = (e.groupIds || []).includes(groupId);
      const groupIds = has ? e.groupIds.filter((g) => g !== groupId) : [...(e.groupIds || []), groupId];
      return { ...e, groupIds };
    }));
  };

  const addCoach = (bookingId) => {
    const coach = { id: uid(), ...coachForm };
    setExcursions((p) => p.map((e) => e.id === bookingId ? { ...e, coaches: [...(e.coaches || []), coach] } : e));
    setCoachForm({ company: "", phone: "", invoiceNo: "", bookingRef: "", pickupTime: "", dropoffTime: "", vehicle: "Coach", notes: "", status: "Pending" });
    setShowCoachForm(null);
  };

  const removeCoach = (bookingId, coachId) => {
    setExcursions((p) => p.map((e) => e.id === bookingId ? { ...e, coaches: (e.coaches || []).filter((c) => c.id !== coachId) } : e));
  };

  const startEditCoach = (bookingId, coach) => {
    setEditCoachKey(bookingId + "-" + coach.id);
    setEditCoachForm({ ...coach });
  };

  const saveCoachEdit = (bookingId) => {
    setExcursions((p) => p.map((e) => e.id === bookingId
      ? { ...e, coaches: (e.coaches || []).map((c) => c.id === editCoachForm.id ? { ...editCoachForm } : c) }
      : e));
    setEditCoachKey(null);
  };

  const duplicateCoach = (bookingId, coach) => {
    const copy = { ...coach, id: uid() };
    setExcursions((p) => p.map((e) => e.id === bookingId ? { ...e, coaches: [...(e.coaches || []), copy] } : e));
  };

  const allBookings = useMemo(() => allExcs.flatMap((e) => e.bookings), [allExcs]);
  const totalCoaches = allBookings.reduce((sum, b) => sum + (b.coaches || []).length, 0);
  const confirmedCoaches = allBookings.reduce((sum, b) => sum + (b.coaches || []).filter((c) => c.status === "Confirmed" || c.status === "Paid").length, 0);

  const fi = inputStyle;
  const chip = { display: "inline-flex", alignItems: "center", gap: 4, background: B.cyanBg, color: B.link, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700 };
  const dashedBtn = { display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "transparent", border: "1px dashed " + B.border, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", color: B.textMuted };

  const availableGroupsForDate = (date) => (groups || []).filter((g) => inRange(date, g.arr, g.dep));

  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ background: B.warningBg, border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: B.warning }}>{allExcs.length}</div>
          <div style={{ fontSize: 9, color: "#9a3412", fontWeight: 600 }}>Excursion Days</div>
        </div>
        <div style={{ background: B.cyanBg, border: "1px solid #7dd3fc", borderRadius: 10, padding: "8px 16px", minWidth: 80 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: B.link }}>{allBookings.length}</div>
          <div style={{ fontSize: 9, color: "#0c4a6e", fontWeight: 600 }}>Bookings</div>
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
        {!readOnly && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setShowImport(true)} style={{ ...btnNavy, background: B.card, color: B.navy, border: "1px solid " + B.border, boxShadow: "none" }}>
              Import from Spreadsheet
            </button>
            <button onClick={autoFromProgramme}
              title={isMinistay ? "Reads exc days from ministay template first, then falls back to scanning the programme grid for Full Exc / Half Exc keywords or custom activity names" : "Scans the programme grid for Full Exc / Half Exc keywords or custom activity names and marks those days as excursion days"}
              style={btnNavy}>
              Auto from Programme
            </button>
          </div>
        )}
        <div style={{ fontSize: 9, color: B.textMuted, ...(readOnly ? { marginLeft: "auto" } : {}) }}>
          {isMinistay ? "Ministay: set exc days via Programme tab or Auto from Programme" : "Set exc days in Programmes tab · Weekends auto-included"}
        </div>
      </div>

      {showImport && (
        <ExcursionsImportModal
          groups={groups}
          centreName={centre}
          onClose={() => setShowImport(false)}
          onImported={(bookings) => {
            setExcursions((p) => [...(p || []), ...bookings]);
            const newExcDays = { ...excDays };
            bookings.forEach((b) => {
              if (!newExcDays[b.date]) newExcDays[b.date] = b.dayPart === "Full" ? "Full" : "Half";
            });
            setExcDays(newExcDays);
            setShowImport(false);
          }}
        />
      )}

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
                <span style={{ background: B.cyanBg, color: B.link, padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{exc.total} pax on site</span>
                <span style={{ fontSize: 9, color: B.textMuted }}>({exc.stuCount} stu + {exc.glCount} GL)</span>
                {exc.bookings.length > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: 9, color: B.textMuted, fontWeight: 700 }}>
                    {exc.bookings.length} booking{exc.bookings.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div style={{ padding: "8px 16px 12px" }}>
                {exc.bookings.length === 0 && (
                  <div style={{ fontSize: 10, color: B.textLight, padding: "6px 0" }}>No bookings yet for this day.</div>
                )}

                {exc.bookings.map((booking) => {
                  const counts = bookingCounts(booking, groups);
                  return (
                    <div key={booking.id} style={{ background: B.bg, border: "1px solid " + B.border, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <div style={{ marginBottom: 8 }}>
                        <Fld label="Attraction">
                          <textarea disabled={readOnly} value={booking.attraction} onChange={(e) => updateBooking(booking.id, { attraction: e.target.value })}
                            rows={2} style={{ ...fi, width: "100%", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} placeholder="e.g. Chester with Roman Tour" />
                        </Fld>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}>
                        <Fld label="Day Part">
                          <select disabled={readOnly} value={booking.dayPart} onChange={(e) => updateBooking(booking.id, { dayPart: e.target.value })}
                            style={{ ...fi, width: 95, cursor: "pointer" }}>
                            {DAY_PARTS.map((p) => <option key={p}>{p}</option>)}
                          </select>
                        </Fld>
                        <Fld label="Transport">
                          <select disabled={readOnly} value={booking.transportMethod} onChange={(e) => updateBooking(booking.id, { transportMethod: e.target.value })}
                            style={{ ...fi, width: 95, cursor: "pointer" }}>
                            {TRANSPORT_METHODS.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </Fld>
                        <Fld label="UKLC Staff">
                          <input disabled={readOnly} type="number" min={0} value={booking.staffCount}
                            onChange={(e) => updateBooking(booking.id, { staffCount: parseInt(e.target.value) || 0 })}
                            style={{ ...fi, width: 60 }} />
                        </Fld>
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ ...chip, background: B.successBg, color: B.success }}>{counts.total} pax</span>
                          <span style={{ fontSize: 9, color: B.textMuted }}>({counts.stu} stu + {counts.gl} GL + {counts.staff} staff)</span>
                          {!readOnly && <IconBtn danger title="Remove booking" onClick={() => removeBooking(booking.id)}><IcTrash /></IconBtn>}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted }}>Groups:</span>
                        {counts.linked.length > 0 ? counts.linked.map((g) => (
                          <span key={g.id} style={chip}>
                            {g.group}
                            {!readOnly && <span onClick={() => toggleBookingGroup(booking.id, g.id)} style={{ cursor: "pointer" }}><IcX /></span>}
                          </span>
                        )) : (
                          <span style={{ fontSize: 10, color: B.textLight }}>None linked — using manual counts below</span>
                        )}
                        {!readOnly && (
                          <button onClick={() => setEditingGroupsFor(editingGroupsFor === booking.id ? null : booking.id)} style={dashedBtn}>
                            {editingGroupsFor === booking.id ? "Done" : "+ Groups"}
                          </button>
                        )}
                        {counts.linked.length === 0 && (
                          <>
                            <Fld label="Students (manual)">
                              <input disabled={readOnly} type="number" min={0} value={booking.manualStudentCount}
                                onChange={(e) => updateBooking(booking.id, { manualStudentCount: parseInt(e.target.value) || 0 })}
                                style={{ ...fi, width: 65 }} />
                            </Fld>
                            <Fld label="Leaders (manual)">
                              <input disabled={readOnly} type="number" min={0} value={booking.manualLeaderCount}
                                onChange={(e) => updateBooking(booking.id, { manualLeaderCount: parseInt(e.target.value) || 0 })}
                                style={{ ...fi, width: 65 }} />
                            </Fld>
                          </>
                        )}
                      </div>

                      {editingGroupsFor === booking.id && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "2px 0 8px" }}>
                          {availableGroupsForDate(booking.date).map((g) => (
                            <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, background: B.card, border: "1px solid " + B.border, borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}>
                              <input type="checkbox" checked={(booking.groupIds || []).includes(g.id)} onChange={() => toggleBookingGroup(booking.id, g.id)} />
                              {g.group} <span style={{ color: B.textMuted }}>({(g.stu || 0) + (g.gl || 0)})</span>
                            </label>
                          ))}
                          {availableGroupsForDate(booking.date).length === 0 && (
                            <span style={{ fontSize: 9, color: B.textLight }}>No groups on site this date.</span>
                          )}
                        </div>
                      )}

                      <div style={{ marginBottom: 8 }}>
                        <Fld label="Booking Ref + Time">
                          <textarea disabled={readOnly} value={booking.bookingRef} onChange={(e) => updateBooking(booking.id, { bookingRef: e.target.value })}
                            rows={2} style={{ ...fi, width: "100%", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} placeholder="e.g. #ABC-123 @ 10:30" />
                        </Fld>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <Fld label="Email Contact">
                          <input disabled={readOnly} value={booking.emailContact} onChange={(e) => updateBooking(booking.id, { emailContact: e.target.value })}
                            style={{ ...fi, width: 160 }} placeholder="bookings@venue.com" />
                        </Fld>
                        <Fld label="Ticket / Confirmation Link">
                          {booking.bookingLink && readOnly ? (
                            <a href={booking.bookingLink} target="_blank" rel="noopener noreferrer" style={{ ...fi, display: "inline-block", width: 200, textDecoration: "none", color: B.link, boxSizing: "border-box" }}>{booking.bookingLink}</a>
                          ) : (
                            <input disabled={readOnly} value={booking.bookingLink} onChange={(e) => updateBooking(booking.id, { bookingLink: e.target.value })}
                              style={{ ...fi, width: 200 }} placeholder="https://..." />
                          )}
                        </Fld>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <Fld label="Notes">
                          <textarea disabled={readOnly} value={booking.notes} onChange={(e) => updateBooking(booking.id, { notes: e.target.value })}
                            rows={2} style={{ ...fi, width: "100%", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} placeholder="Coach / booking notes..." />
                        </Fld>
                      </div>

                      {(booking.coaches || []).length > 0 && (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 6 }}>
                          <thead>
                            <tr>{["Company", "Vehicle", "Pickup", "Dropoff", "Invoice No", "Booking Ref", "Status", "Notes", ""].map((h) => (
                              <th key={h} style={{ ...thStyle, fontSize: 9, padding: "4px 8px" }}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {(booking.coaches || []).map((c) => {
                              const eck = booking.id + "-" + c.id;
                              const isEd = editCoachKey === eck;
                              const ecFi = { ...fi, fontSize: 9, padding: "2px 4px" };
                              return (
                                <tr key={c.id} style={{ borderBottom: "1px solid " + B.borderLight, background: isEd ? "#f0f4ff" : "transparent" }}>
                                  <td style={{ ...tdStyle, fontWeight: 700, color: B.text }}>{isEd ? <input value={editCoachForm.company || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, company: e.target.value }))} style={{ ...ecFi, width: 120 }} /> : c.company}</td>
                                  <td style={tdStyle}>{isEd ? (
                                    <select value={editCoachForm.vehicle || "Coach"} onChange={(e) => setEditCoachForm((p) => ({ ...p, vehicle: e.target.value }))} style={{ ...ecFi, cursor: "pointer", width: 80 }}>
                                      {["Coach", "Minibus", "Double Decker", "Train", "Other"].map((v) => <option key={v}>{v}</option>)}
                                    </select>
                                  ) : <span style={{ background: B.bg, padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{c.vehicle}</span>}</td>
                                  <td style={tdStyle}>{isEd ? <input value={editCoachForm.pickupTime || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, pickupTime: e.target.value }))} style={{ ...ecFi, width: 55 }} placeholder="09:00" /> : c.pickupTime || "—"}</td>
                                  <td style={tdStyle}>{isEd ? <input value={editCoachForm.dropoffTime || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, dropoffTime: e.target.value }))} style={{ ...ecFi, width: 55 }} placeholder="17:00" /> : c.dropoffTime || "—"}</td>
                                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 9 }}>{isEd ? <input value={editCoachForm.invoiceNo || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, invoiceNo: e.target.value }))} style={{ ...ecFi, width: 80 }} placeholder="INV-001" /> : c.invoiceNo || "—"}</td>
                                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 9 }}>{isEd ? <input value={editCoachForm.bookingRef || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, bookingRef: e.target.value }))} style={{ ...ecFi, width: 80 }} placeholder="REF-001" /> : c.bookingRef || "—"}</td>
                                  <td style={tdStyle}>{isEd ? (
                                    <select value={editCoachForm.status || "Pending"} onChange={(e) => setEditCoachForm((p) => ({ ...p, status: e.target.value }))} style={{ ...ecFi, cursor: "pointer", width: 85 }}>
                                      {Object.keys(COACH_STATUS).map((s) => <option key={s}>{s}</option>)}
                                    </select>
                                  ) : <StatusBadge status={c.status} map={COACH_STATUS} />}</td>
                                  <td style={{ ...tdStyle, fontSize: 9, color: B.textMuted, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{isEd ? <input value={editCoachForm.notes || ""} onChange={(e) => setEditCoachForm((p) => ({ ...p, notes: e.target.value }))} style={{ ...ecFi, width: 100 }} /> : c.notes || "—"}</td>
                                  <td style={tdStyle}>
                                    {!readOnly && <div style={{ display: "flex", gap: 2 }}>
                                      {isEd ? (
                                        <>
                                          <IconBtn onClick={() => saveCoachEdit(booking.id)}><IcCheck /></IconBtn>
                                          <IconBtn onClick={() => setEditCoachKey(null)}><IcX /></IconBtn>
                                        </>
                                      ) : (
                                        <>
                                          <IconBtn onClick={() => startEditCoach(booking.id, c)}><IcEdit /></IconBtn>
                                          <IconBtn title="Duplicate coach" onClick={() => duplicateCoach(booking.id, c)}><IcCopy /></IconBtn>
                                          <IconBtn danger onClick={() => removeCoach(booking.id, c.id)}><IcTrash /></IconBtn>
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

                      {showCoachForm === booking.id ? (
                        <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 8, padding: "8px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
                          <Fld label="Company"><input value={coachForm.company} onChange={(e) => setCoachForm((p) => ({ ...p, company: e.target.value }))} style={{ ...fi, width: 140 }} placeholder="e.g. National Express" /></Fld>
                          <Fld label="Vehicle">
                            <select value={coachForm.vehicle} onChange={(e) => setCoachForm((p) => ({ ...p, vehicle: e.target.value }))} style={{ ...fi, cursor: "pointer", width: 90 }}>
                              {["Coach", "Minibus", "Double Decker", "Train", "Other"].map((v) => <option key={v}>{v}</option>)}
                            </select>
                          </Fld>
                          <Fld label="Pickup"><input value={coachForm.pickupTime} onChange={(e) => setCoachForm((p) => ({ ...p, pickupTime: e.target.value }))} style={{ ...fi, width: 70 }} placeholder="09:00" /></Fld>
                          <Fld label="Dropoff"><input value={coachForm.dropoffTime} onChange={(e) => setCoachForm((p) => ({ ...p, dropoffTime: e.target.value }))} style={{ ...fi, width: 70 }} placeholder="17:00" /></Fld>
                          <Fld label="Invoice No"><input value={coachForm.invoiceNo} onChange={(e) => setCoachForm((p) => ({ ...p, invoiceNo: e.target.value }))} style={{ ...fi, width: 90 }} placeholder="INV-001" /></Fld>
                          <Fld label="Booking Ref"><input value={coachForm.bookingRef} onChange={(e) => setCoachForm((p) => ({ ...p, bookingRef: e.target.value }))} style={{ ...fi, width: 90 }} placeholder="REF-001" /></Fld>
                          <Fld label="Status">
                            <select value={coachForm.status} onChange={(e) => setCoachForm((p) => ({ ...p, status: e.target.value }))} style={{ ...fi, cursor: "pointer", width: 90 }}>
                              {Object.keys(COACH_STATUS).map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </Fld>
                          <Fld label="Notes"><input value={coachForm.notes} onChange={(e) => setCoachForm((p) => ({ ...p, notes: e.target.value }))} style={{ ...fi, width: 120 }} /></Fld>
                          <button onClick={() => addCoach(booking.id)} style={{ ...btnNavy, padding: "5px 14px", fontSize: 10 }}>Add</button>
                          <button onClick={() => setShowCoachForm(null)} style={{ padding: "5px 10px", background: "transparent", border: "1px solid " + B.border, color: B.textMuted, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", height: 30 }}>Cancel</button>
                        </div>
                      ) : (
                        !readOnly && <button onClick={() => setShowCoachForm(booking.id)} style={dashedBtn}>
                          <IcPlus /> Add Coach
                        </button>
                      )}
                    </div>
                  );
                })}

                {!readOnly && (
                  <button onClick={() => addBooking(exc.date)} style={{ ...dashedBtn, borderColor: B.link, color: B.link }}>
                    <IcPlus /> Add Booking
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
