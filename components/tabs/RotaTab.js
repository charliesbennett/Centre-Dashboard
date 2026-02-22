"use client";
import { useState, useMemo } from "react";
import { B, SESSION_TYPES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { StatCard, IcWand, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const SLOTS = ["AM", "PM", "Eve"];

/*
  RULES (corrected):
  1. TAL: Teaches EVERY weekday (Mon-Fri) in one consistent slot (AM).
     The other working slot alternates between PM (Activities) and Eve (Eve Ents).
     Weekends: AM+PM Excursion (full day). 22 sessions/fn. 1 day off/week.
  2. FTT: AM+PM Lessons Mon-Fri. NEVER excursions. Day off = Sat OR Sun. 22 sess/fn.
  3. SAI/SC/EAC/EAL: AM+PM Activities weekdays. AM+PM Excursion weekends (FULL DAY always).
     Eve Ents some evenings. 24 sess/fn. 1 day off/week.
  4. Arrival day: No lessons. TALs/Activity staff do Airport pickups. FTTs are off.
  5. Someone must ALWAYS be on Eve Ents every night (ensure coverage).
  6. Induction/Setup days don't count towards session totals.
  7. Weekend excursions are ALWAYS full-day (AM + PM).
*/

function calcRequiredStaff(studentCount) {
  if (!studentCount || studentCount <= 0) return 0;
  return Math.ceil(studentCount / 20);
}

export default function RotaTab({ staff, progStart, progEnd, excDays, groups, rotaGrid, setRotaGrid }) {
  const [filled, setFilled] = useState(false);
  const [showRatios, setShowRatios] = useState(true);
  const grid = rotaGrid;
  const setGrid = setRotaGrid;

  const dates = useMemo(() => {
    if (!progStart || !progEnd) return [];
    return genDates(progStart, progEnd);
  }, [progStart, progEnd]);

  const groupArrivalDate = useMemo(() => {
    if (!groups || groups.length === 0) return null;
    const arrivals = groups.map((g) => g.arr).filter(Boolean).sort();
    return arrivals[0] || null;
  }, [groups]);

  // All group arrival dates (there may be multiple)
  const allArrivalDates = useMemo(() => {
    if (!groups) return new Set();
    return new Set(groups.map((g) => g.arr).filter(Boolean));
  }, [groups]);

  const parseTimeOff = (toStr) => {
    if (!toStr) return [];
    const yr = new Date(progStart).getFullYear();
    return toStr.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
      const rm = p.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
      if (rm) return { start: yr+"-"+rm[2].padStart(2,"0")+"-"+rm[1].padStart(2,"0"), end: yr+"-"+rm[4].padStart(2,"0")+"-"+rm[3].padStart(2,"0") };
      const sm = p.match(/(\d{1,2})\/(\d{1,2})\s*(am|pm|eve)?/i);
      if (sm) return { date: yr+"-"+sm[2].padStart(2,"0")+"-"+sm[1].padStart(2,"0"), slot: sm[3] || null };
      return null;
    }).filter(Boolean);
  };

  const isFullDayOff = (tos, ds) => {
    for (const to of tos) {
      if (to.start && to.end && ds >= to.start && ds <= to.end) return true;
      if (to.date === ds && !to.slot) return true;
    }
    return false;
  };

  // ── Auto-generate ─────────────────────────────────────
  const autoGenerate = () => {
    const ng = {};

    staff.forEach((s) => {
      const tos = parseTimeOff(s.to);
      const role = s.role;

      const workingDates = [];
      dates.forEach((d) => {
        const ds = dayKey(d);
        if (inRange(ds, s.arr, s.dep)) workingDates.push({ date: d, ds });
      });
      if (workingDates.length === 0) return;

      // ── Induction & Setup days ──
      const inductionDays = new Set();
      const setupDays = new Set();
      if (workingDates.length >= 1) inductionDays.add(workingDates[0].ds);
      if (workingDates.length >= 2) setupDays.add(workingDates[1].ds);
      if (groupArrivalDate) {
        for (let i = 2; i < workingDates.length; i++) {
          if (workingDates[i].ds < groupArrivalDate) setupDays.add(workingDates[i].ds);
          else break;
        }
      }

      // ── Programme days (after induction/setup) ──
      const progDays = workingDates.filter((wd) => !inductionDays.has(wd.ds) && !setupDays.has(wd.ds));

      // ── Plan day offs: 1 per week ──
      const dayOffSet = new Set();
      const totalWeeks = Math.ceil(progDays.length / 7);

      if (role === "FTT") {
        // FTT: day off on Saturday (prefer) or Sunday
        let ws = 0;
        for (let w = 0; w < totalWeeks; w++) {
          const week = progDays.slice(ws, ws + 7);
          const sat = week.find((wd) => wd.date.getDay() === 6);
          const sun = week.find((wd) => wd.date.getDay() === 0);
          // FTTs get both weekend days off since they only work weekdays
          // But they work 1 weekend day for excursion duty — NO, FTTs NEVER do excursions
          // FTT works Mon-Fri only, both Sat and Sun off
          if (sat) dayOffSet.add(sat.ds);
          if (sun) dayOffSet.add(sun.ds);
          ws += 7;
        }
      } else {
        // Activity staff / TAL: 1 day off per week, mid-week preferred
        let ws = 0;
        const pref = [3, 4, 2, 5, 1]; // Wed, Thu, Tue, Fri, Mon
        for (let w = 0; w < totalWeeks; w++) {
          const week = progDays.slice(ws, ws + 7);
          let placed = false;
          for (const pd of pref) {
            const m = week.find((wd) => wd.date.getDay() === pd && !isFullDayOff(tos, wd.ds));
            if (m) { dayOffSet.add(m.ds); placed = true; break; }
          }
          if (!placed && week.length > 0) {
            const fb = week.find((wd) => !isFullDayOff(tos, wd.ds));
            if (fb) dayOffSet.add(fb.ds);
          }
          ws += 7;
        }
      }

      // ── Fill each day ──
      let progDayIdx = 0;

      workingDates.forEach((wd) => {
        const { date: d, ds } = wd;
        const we = isWeekend(d);
        const fe = excDays && excDays[ds] === "Full";
        const he = excDays && excDays[ds] === "Half";
        const isArrDay = allArrivalDates.has(ds);
        const isLast = s.dep && ds === dayKey(new Date(s.dep));
        const wday = d.getDay(); // 0=Sun, 1=Mon...6=Sat

        // Induction
        if (inductionDays.has(ds)) {
          ng[s.id+"-"+ds+"-AM"] = "Induction";
          ng[s.id+"-"+ds+"-PM"] = "Induction";
          return;
        }

        // Setup
        if (setupDays.has(ds)) {
          ng[s.id+"-"+ds+"-AM"] = "Setup";
          ng[s.id+"-"+ds+"-PM"] = "Setup";
          return;
        }

        // Departure day
        if (isLast) {
          ng[s.id+"-"+ds+"-AM"] = "Airport";
          return;
        }

        // Time off / day off
        if (isFullDayOff(tos, ds) || dayOffSet.has(ds)) {
          SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          progDayIdx++;
          return;
        }

        // ── ARRIVAL DAY ──
        // No lessons. TALs/Activity staff do Airport pickups. FTTs off.
        if (isArrDay) {
          if (role === "FTT") {
            // FTT: off on arrival day (no lessons)
            SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          } else {
            // TAL/Activity: Airport pickups + Eve Ents
            ng[s.id+"-"+ds+"-AM"] = "Airport";
            ng[s.id+"-"+ds+"-PM"] = "Airport";
            // Alternate: some do eve ents on arrival day
            if (progDayIdx % 2 === 0) {
              ng[s.id+"-"+ds+"-Eve"] = "Eve Ents";
              // Only 2 sessions: remove one airport
              ng[s.id+"-"+ds+"-AM"] = "Airport";
              ng[s.id+"-"+ds+"-PM"] = null;
              ng[s.id+"-"+ds+"-Eve"] = "Eve Ents";
            }
          }
          progDayIdx++;
          return;
        }

        // ── FTT ──
        if (role === "FTT") {
          if (we) {
            // FTT: NEVER works weekends, NEVER does excursions
            SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          } else {
            // Weekday: AM Lessons + PM Lessons, Eve off
            ng[s.id+"-"+ds+"-AM"] = "Lessons";
            ng[s.id+"-"+ds+"-PM"] = "Lessons";
          }
          progDayIdx++;
          return;
        }

        // ── TAL ──
        if (role === "TAL" || role === "DRAMA" || role === "DANCE") {
          if (we || fe) {
            // Weekend / Full excursion: ALWAYS AM + PM (full day excursion)
            ng[s.id+"-"+ds+"-AM"] = "Excursion";
            ng[s.id+"-"+ds+"-PM"] = "Excursion";
            // No eve (2 sessions only)
          } else if (he) {
            // Half excursion day: AM Lessons, PM Half Exc
            ng[s.id+"-"+ds+"-AM"] = "Lessons";
            ng[s.id+"-"+ds+"-PM"] = "Half Exc";
          } else {
            // WEEKDAY: TAL teaches CONSISTENTLY in AM every weekday
            // Second slot alternates: PM (Activities) or Eve (Eve Ents)
            ng[s.id+"-"+ds+"-AM"] = "Lessons";
            if (progDayIdx % 2 === 0) {
              ng[s.id+"-"+ds+"-PM"] = "Activities";
              // Eve off
            } else {
              // AM lessons already set, Eve Ents
              ng[s.id+"-"+ds+"-Eve"] = "Eve Ents";
              // PM off
            }
          }
          progDayIdx++;
          return;
        }

        // ── Activity Staff (EAL, EAC, SAI, SC) ──
        if (we || fe) {
          // Weekend / Full excursion: ALWAYS AM + PM (full day)
          ng[s.id+"-"+ds+"-AM"] = "Excursion";
          ng[s.id+"-"+ds+"-PM"] = "Excursion";
        } else if (he) {
          // Half excursion
          ng[s.id+"-"+ds+"-AM"] = "Activities";
          ng[s.id+"-"+ds+"-PM"] = "Half Exc";
        } else {
          // Weekday: 2 of 3 slots
          if (progDayIdx % 2 === 0) {
            ng[s.id+"-"+ds+"-AM"] = "Activities";
            ng[s.id+"-"+ds+"-PM"] = "Activities";
          } else {
            ng[s.id+"-"+ds+"-PM"] = "Activities";
            ng[s.id+"-"+ds+"-Eve"] = "Eve Ents";
          }
        }
        progDayIdx++;
      });
    });

    // ── Ensure evening coverage every night ──
    // Check each programme day — if nobody is on Eve Ents, assign someone
    dates.forEach((d) => {
      const ds = dayKey(d);
      if (!groupArrivalDate || ds < groupArrivalDate) return;

      let eveCount = 0;
      staff.forEach((s) => {
        const v = ng[s.id+"-"+ds+"-Eve"];
        if (v && v !== "Day Off") eveCount++;
      });

      if (eveCount === 0) {
        // Find a TAL or activity staff who is on-site, not on day off, and doesn't have eve assigned
        for (const s of staff) {
          if (!inRange(ds, s.arr, s.dep)) continue;
          if (s.role === "FTT") continue; // FTTs don't do eves
          const amVal = ng[s.id+"-"+ds+"-AM"];
          const pmVal = ng[s.id+"-"+ds+"-PM"];
          const eveVal = ng[s.id+"-"+ds+"-Eve"];
          if (eveVal === "Day Off") continue;
          if (amVal === "Day Off" && pmVal === "Day Off") continue; // full day off
          if (amVal === "Induction" || amVal === "Setup") continue;

          // If they're working AM but not PM and not Eve, assign Eve
          if (amVal && !pmVal && !eveVal) {
            ng[s.id+"-"+ds+"-Eve"] = "Eve Ents";
            // Remove AM so they still only do 2 sessions? No — they had AM + Eve = 2 sessions
            break;
          }
          // If they're working AM + PM, swap PM for Eve
          if (amVal && pmVal && !eveVal && amVal !== "Excursion") {
            ng[s.id+"-"+ds+"-PM"] = null;
            ng[s.id+"-"+ds+"-Eve"] = "Eve Ents";
            break;
          }
        }
      }
    });

    setGrid(ng);
    setFilled(true);
  };

  // Click to cycle
  const allTypes = [...Object.keys(SESSION_TYPES), "Day Off"];
  const cycleCell = (sid, ds, sl) => {
    const key = sid+"-"+ds+"-"+sl;
    setGrid((prev) => {
      const cur = prev[key];
      if (!cur) return { ...prev, [key]: allTypes[0] };
      const idx = allTypes.indexOf(cur);
      if (idx >= allTypes.length - 1) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: allTypes[idx + 1] };
    });
  };

  // Stats — exclude Induction and Setup from session count
  const getStats = (sid) => {
    let sess = 0, offs = 0;
    dates.forEach((d) => {
      const ds = dayKey(d);
      let allOff = true;
      SLOTS.forEach((sl) => {
        const v = grid[sid+"-"+ds+"-"+sl];
        if (v && v !== "Day Off" && v !== "Induction" && v !== "Setup") { sess++; allOff = false; }
        else if (v !== "Day Off") allOff = false;
      });
      if (allOff && grid[sid+"-"+ds+"-AM"] === "Day Off") offs++;
    });
    return { sess, offs };
  };

  // Ratio data
  const ratioData = useMemo(() => {
    if (!groups || groups.length === 0) return {};
    const data = {};
    dates.forEach((d) => {
      const ds = dayKey(d);
      let totalStudents = 0, totalGLs = 0;
      groups.forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (g.arr && ds === dayKey(new Date(g.arr))) return;
        if (g.dep && ds === dayKey(new Date(g.dep))) return;
        totalStudents += g.stu || 0;
        totalGLs += g.gl || 0;
      });
      if (totalStudents > 0) data[ds] = { students: totalStudents, gls: totalGLs, required: calcRequiredStaff(totalStudents) };
    });
    return data;
  }, [groups, dates]);

  const getStaffWorking = (ds, sl) => {
    let count = 0;
    staff.forEach((s) => {
      const v = grid[s.id+"-"+ds+"-"+sl];
      if (v && v !== "Day Off" && v !== "Induction" && v !== "Setup") count++;
    });
    return count;
  };

  const ratioAlerts = useMemo(() => {
    if (!filled || !groups || groups.length === 0) return [];
    const alerts = [];
    dates.forEach((d) => {
      const ds = dayKey(d);
      const rd = ratioData[ds];
      if (!rd) return;
      SLOTS.forEach((sl) => {
        const sw = getStaffWorking(ds, sl);
        const total = sw + rd.gls;
        const shortfall = rd.required - total;
        if (shortfall > 0) alerts.push({ date: ds, slot: sl, students: rd.students, staffWorking: sw, gls: rd.gls, total, required: rd.required, shortfall });
      });
    });
    return alerts;
  }, [grid, ratioData, filled, dates, groups]);

  const tableMinWidth = 260 + dates.length * 70;

  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatCard label="Staff" value={staff.length} accent={B.navy} />
        <StatCard label="Days" value={dates.length} accent={B.textMuted} />
        <StatCard label="TALs" value={staff.filter((s) => s.role === "TAL").length} accent="#3b82f6" />
        <StatCard label="FTTs" value={staff.filter((s) => s.role === "FTT").length} accent="#0891b2" />
        {groupArrivalDate && <span style={{ fontSize: 9, color: B.textMuted }}>Students arrive: <strong style={{ color: B.navy }}>{fmtDate(groupArrivalDate)}</strong></span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => setShowRatios(!showRatios)} style={{ padding: "5px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1px solid "+(showRatios ? B.navy : B.border), background: showRatios ? B.navy : B.white, color: showRatios ? B.white : B.textMuted }}>
            {"\ud83d\udee1\ufe0f"} Ratios {ratioAlerts.length > 0 && <span style={{ background: B.danger, color: B.white, borderRadius: 8, padding: "1px 5px", fontSize: 8, marginLeft: 4 }}>{ratioAlerts.length}</span>}
          </button>
          <button onClick={autoGenerate} style={{ ...btnPrimary, background: B.navy }}><IcWand /> {filled ? "Re-generate" : "Auto-Generate Rota"}</button>
        </div>
      </div>

      {showRatios && filled && (
        <div style={{ margin: "0 20px 8px" }}>
          {groups && groups.length > 0 ? (
            ratioAlerts.length > 0 ? (
              <div style={{ background: B.dangerBg, border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontWeight: 800, fontSize: 11, color: B.danger, marginBottom: 6 }}>{"\u26a0\ufe0f"} Staffing Shortfalls ({ratioAlerts.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {ratioAlerts.slice(0, 10).map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10, color: "#991b1b" }}>
                      <span style={{ fontWeight: 800, minWidth: 55 }}>{fmtDate(a.date)}</span>
                      <span style={{ background: "#fee2e2", padding: "1px 6px", borderRadius: 3, fontWeight: 700, fontSize: 9 }}>{a.slot}</span>
                      <span>{a.students} students need {a.required} — have {a.staffWorking} staff + {a.gls} GLs = {a.total}</span>
                      <span style={{ fontWeight: 800, color: B.danger }}>Need {a.shortfall} more</span>
                    </div>
                  ))}
                  {ratioAlerts.length > 10 && <div style={{ fontSize: 9, color: "#991b1b" }}>...and {ratioAlerts.length - 10} more</div>}
                </div>
              </div>
            ) : (
              <div style={{ background: B.successBg, border: "1px solid #86efac", borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700, color: B.success }}>{"\u2705"} All sessions meet safeguarding ratios</div>
            )
          ) : (
            <div style={{ background: "#e0f2fe", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "#0369a1" }}>{"\u2139\ufe0f"} Import groups in Students tab to see ratio checks</div>
          )}
        </div>
      )}

      {!filled && staff.length > 0 && (
        <div style={{ margin: "0 20px 8px", padding: "10px 14px", background: "#e0f2fe", borderRadius: 8, fontSize: 11, color: "#0369a1", fontWeight: 600 }}>
          Add staff in Team tab then click Auto-Generate. Day 1 = Induction, Day 2+ before students = Setup.
        </div>
      )}

      <div style={{ padding: "4px 20px 6px", display: "flex", gap: 3, flexWrap: "wrap" }}>
        {Object.entries(SESSION_TYPES).map(([n, c]) => (
          <span key={n} style={{ background: c+"20", color: c, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{n}</span>
        ))}
        <span style={{ background: "#f59e0b20", color: "#f59e0b", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>Day Off</span>
      </div>

      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)", padding: "0 4px 16px" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: tableMinWidth, background: B.white, borderRadius: 10, border: "1px solid "+B.border }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 42, position: "sticky", left: 0, zIndex: 3, background: "#f8fafc" }}>Role</th>
              <th style={{ ...thStyle, width: 105, position: "sticky", left: 42, zIndex: 3, background: "#f8fafc" }}>Name</th>
              <th style={{ ...thStyle, width: 28, textAlign: "center", position: "sticky", left: 147, zIndex: 3, background: "#f8fafc", fontSize: 7 }}>Sess</th>
              <th style={{ ...thStyle, width: 24, textAlign: "center", position: "sticky", left: 175, zIndex: 3, background: "#f8fafc", fontSize: 7 }}>Off</th>
              {dates.map((d) => {
                const we = isWeekend(d); const ds = dayKey(d); const exc = excDays && excDays[ds];
                const isArrDay = allArrivalDates.has(ds);
                return (
                  <th key={ds} colSpan={3} style={{ ...thStyle, textAlign: "center", borderLeft: "2px solid "+B.border, padding: "3px 0", minWidth: 66, background: isArrDay ? "#dcfce7" : exc ? "#fff7ed" : we ? "#fef2f2" : "#f8fafc" }}>
                    <div style={{ fontSize: 7, color: B.textMuted }}>{fmtDate(d)}</div>
                    <div style={{ fontWeight: 800, fontSize: 8, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                    {exc && <div style={{ fontSize: 6, color: "#ea580c", fontWeight: 800 }}>{exc === "Full" ? "FD" : "HD"}</div>}
                    {isArrDay && <div style={{ fontSize: 5, color: B.success, fontWeight: 800 }}>ARRIVE</div>}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th style={{ ...thStyle, position: "sticky", left: 0, zIndex: 3, background: "#f8fafc" }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 42, zIndex: 3, background: "#f8fafc" }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 147, zIndex: 3, background: "#f8fafc" }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 175, zIndex: 3, background: "#f8fafc" }}></th>
              {dates.map((d) => SLOTS.map((sl) => (
                <th key={dayKey(d)+"-"+sl} style={{ ...thStyle, textAlign: "center", fontSize: 6, padding: "2px 0", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, minWidth: 22 }}>{sl}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {filled && groups && groups.length > 0 && (
              <tr style={{ borderBottom: "2px solid "+B.border, background: "#f0fdf4" }}>
                <td style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 1, background: "#f0fdf4", fontSize: 7, fontWeight: 800, color: B.success }}>{"\ud83d\udee1\ufe0f"}</td>
                <td style={{ ...tdStyle, position: "sticky", left: 42, zIndex: 1, background: "#f0fdf4", fontSize: 8, fontWeight: 700, color: B.navy }}>Staff+GL / Need</td>
                <td style={{ ...tdStyle, position: "sticky", left: 147, zIndex: 1, background: "#f0fdf4" }}></td>
                <td style={{ ...tdStyle, position: "sticky", left: 175, zIndex: 1, background: "#f0fdf4" }}></td>
                {dates.map((d) => {
                  const ds = dayKey(d); const rd = ratioData[ds];
                  return SLOTS.map((sl) => {
                    if (!rd) return <td key={ds+"-"+sl} style={{ padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, background: "#f0fdf4" }}><div style={{ height: 18 }} /></td>;
                    const sw = getStaffWorking(ds, sl);
                    const total = sw + rd.gls;
                    const ok = total >= rd.required;
                    return (
                      <td key={ds+"-"+sl} style={{ padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, textAlign: "center", background: ok ? "#f0fdf4" : "#fee2e2" }}>
                        <div style={{ fontSize: 7, fontWeight: 800, color: ok ? B.success : B.danger, lineHeight: 1 }}>{total}/{rd.required}</div>
                        <div style={{ fontSize: 6, color: B.textMuted }}>{rd.students}s</div>
                      </td>
                    );
                  });
                })}
              </tr>
            )}
            {staff.length === 0 ? (
              <tr><td colSpan={4 + dates.length * 3} style={{ textAlign: "center", padding: 36, color: B.textLight }}>Add staff in Team tab, then Auto-Generate</td></tr>
            ) : staff.map((s) => {
              const st = getStats(s.id);
              const maxExp = (s.role === "TAL" || s.role === "FTT" || s.role === "DRAMA" || s.role === "DANCE") ? 22 : (s.role === "SC" || s.role === "EAC" || s.role === "SAI" || s.role === "EAL") ? 24 : 34;
              const weeks = Math.max(1, Math.floor(dates.length / 7));
              const maxTotal = Math.ceil(maxExp * (weeks / 2));
              const over = st.sess > maxTotal;

              return (
                <tr key={s.id} style={{ borderBottom: "1px solid "+B.borderLight }}>
                  <td style={{ ...tdStyle, position: "sticky", left: 0, background: B.white, zIndex: 1 }}>
                    <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 5px", borderRadius: 3, fontSize: 8, fontWeight: 800 }}>{s.role}</span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: B.navy, fontSize: 9, position: "sticky", left: 42, background: B.white, zIndex: 1, whiteSpace: "nowrap" }}>{s.name}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, fontSize: 9, position: "sticky", left: 147, background: B.white, zIndex: 1, color: over ? B.danger : B.navy }}>{st.sess}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, fontSize: 9, position: "sticky", left: 175, background: B.white, zIndex: 1, color: st.offs > 0 ? "#f59e0b" : B.textLight }}>{st.offs}</td>
                  {dates.map((d) => {
                    const ds = dayKey(d); const on = inRange(ds, s.arr, s.dep);
                    return SLOTS.map((sl) => {
                      const key = s.id+"-"+ds+"-"+sl;
                      const v = grid[key];
                      const off = v === "Day Off";
                      const col = off ? "#f59e0b" : v ? (SESSION_TYPES[v] || "#6b7280") : null;
                      return (
                        <td key={key} onClick={() => on && cycleCell(s.id, ds, sl)} style={{
                          padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight,
                          textAlign: "center", cursor: on ? "pointer" : "default",
                          minWidth: 22, background: !on ? "#f5f5f5" : off ? "#f59e0b10" : "transparent",
                        }}>
                          {col ? (
                            <div style={{ background: col+"30", color: col, borderRadius: 2, fontSize: 6, fontWeight: 800, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {off ? "OFF" : v.slice(0, 3)}
                            </div>
                          ) : on ? <div style={{ height: 22 }} /> : <div style={{ height: 22, background: "#eee", borderRadius: 2 }} />}
                        </td>
                      );
                    });
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "6px 20px", fontSize: 9, color: B.textMuted }}>TALs: AM Lessons every weekday · FTTs: never excursions/weekends · Weekends always full-day exc · 1 day off/wk · Click to edit</div>
    </div>
  );
}
