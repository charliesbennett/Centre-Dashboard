"use client";
import { useState, useMemo } from "react";
import { B, SESSION_TYPES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { StatCard, IcWand, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const SLOTS = ["AM", "PM", "Eve"];
const CELL_W = 88;
const CELL_H = 52;

function calcRequiredStaff(n) { return n > 0 ? Math.ceil(n / 20) : 0; }

// Which lesson slot does this group have on a given date?
function getGroupLessonSlot(group, dateStr) {
  if (!group.arr || !group.lessonSlot) return group.lessonSlot || "AM";
  const arrDate = new Date(group.arr);
  const curDate = new Date(dateStr);
  const daysSince = Math.floor((curDate - arrDate) / 86400000);
  const weekNum = Math.floor(daysSince / 7);
  return weekNum % 2 === 0 ? group.lessonSlot : (group.lessonSlot === "AM" ? "PM" : "AM");
}

export default function RotaTab({ staff, progStart, progEnd, excDays, groups, rotaGrid, setRotaGrid, readOnly = false }) {
  const [showRatios, setShowRatios] = useState(true);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const grid = rotaGrid;
  const setGrid = setRotaGrid;

  const dates = useMemo(() => (progStart && progEnd) ? genDates(progStart, progEnd) : [], [progStart, progEnd]);
  const hasRotaData = useMemo(() => Object.values(rotaGrid || {}).some(Boolean), [rotaGrid]);

  const groupArrivalDate = useMemo(() => {
    if (!groups || !groups.length) return null;
    return groups.map((g) => g.arr).filter(Boolean).sort()[0] || null;
  }, [groups]);

  const allArrivalDates = useMemo(() => new Set(groups ? groups.map((g) => g.arr).filter(Boolean) : []), [groups]);

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

  // ── Lesson demand per slot per day ────────────────────
  const lessonDemand = useMemo(() => {
    const demand = {};
    if (!groups || !groups.length) return demand;
    dates.forEach((d) => {
      const ds = dayKey(d);
      if (isWeekend(d)) return;
      let amStudents = 0, pmStudents = 0;
      groups.forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (g.arr && ds === dayKey(new Date(g.arr))) return;
        if (g.dep && ds === dayKey(new Date(g.dep))) return;
        const slot = getGroupLessonSlot(g, ds);
        if (slot === "AM") amStudents += g.stu || 0;
        else pmStudents += g.stu || 0;
      });
      demand[ds] = {
        amStudents, pmStudents,
        amTeachers: Math.ceil(amStudents / 15),
        pmTeachers: Math.ceil(pmStudents / 15),
      };
    });
    return demand;
  }, [groups, dates]);

  // ── Auto-generate ─────────────────────────────────────
  const autoGenerate = () => {
    const ng = {};

    // Separate by role
    const teachers = staff.filter((s) => ["TAL","FTT","DRAMA","DANCE"].includes(s.role));
    const actStaff = staff.filter((s) => ["SAI","SC","EAC","EAL"].includes(s.role));
    const mgmt = staff.filter((s) => !["TAL","FTT","DRAMA","DANCE","SAI","SC","EAC","EAL"].includes(s.role));

    // PASS 1: Assign induction, setup, day offs for everyone
    const allStaff = [...mgmt, ...teachers, ...actStaff];
    const dayOffSets = {};
    const indSets = {};
    const setupSets = {};

    // Global staff index for staggering day offs and AM/PM rotation
    const staffGlobalIdx = {};
    allStaff.forEach((s, i) => { staffGlobalIdx[s.id] = i; });

    allStaff.forEach((s) => {
      const tos = parseTimeOff(s.to);
      const onSiteDates = dates.map((d) => ({ date: d, ds: dayKey(d) })).filter((wd) => inRange(wd.ds, s.arr, s.dep));
      if (!onSiteDates.length) return;

      // Induction & Setup
      const ind = new Set(); const setup = new Set();
      if (onSiteDates.length >= 1) ind.add(onSiteDates[0].ds);
      if (onSiteDates.length >= 2) setup.add(onSiteDates[1].ds);
      if (groupArrivalDate) {
        for (let i = 2; i < onSiteDates.length; i++) {
          if (onSiteDates[i].ds < groupArrivalDate) setup.add(onSiteDates[i].ds);
          else break;
        }
      }
      indSets[s.id] = ind;
      setupSets[s.id] = setup;

      // Day offs — stagger by staff index so different people get different days off
      const progDays = onSiteDates.filter((wd) => !ind.has(wd.ds) && !setup.has(wd.ds));
      const doffs = new Set();
      const weeks = Math.ceil(progDays.length / 7);
      const gIdx = staffGlobalIdx[s.id] || 0;

      const isTeacher = ["TAL","FTT","DRAMA","DANCE"].includes(s.role);
      const isActStaff = ["SAI","SC","EAC","EAL"].includes(s.role);

      if (isTeacher) {
        // Teachers (TAL/FTT/DRAMA/DANCE) must have weekdays free to teach.
        // Day off = Saturday first, then Sunday. Stagger: even-indexed → Sat, odd → Sun.
        let ws = 0;
        for (let w = 0; w < weeks; w++) {
          const wk = progDays.slice(ws, ws + 7);
          const sat = wk.find((wd) => wd.date.getDay() === 6);
          const sun = wk.find((wd) => wd.date.getDay() === 0);
          // Stagger: staff 0,2,4... get Saturday; staff 1,3,5... get Sunday (then fallback to the other)
          const first  = (gIdx % 2 === 0) ? sat : sun;
          const second = (gIdx % 2 === 0) ? sun : sat;
          if (first)        doffs.add(first.ds);
          else if (second)  doffs.add(second.ds);
          else if (wk.length) doffs.add(wk[wk.length - 1].ds); // fallback
          ws += 7;
        }
      } else if (isActStaff) {
        // Activity staff can have any day off. Prefer weekdays first (spread across team),
        // then weekends as fallback. Any day is valid as long as ratios are met.
        const basePref = [3, 4, 2, 5, 1, 6, 0]; // Wed, Thu, Tue, Fri, Mon, Sat, Sun
        let ws = 0;
        for (let w = 0; w < weeks; w++) {
          const wk = progDays.slice(ws, ws + 7);
          const pref = basePref.map((_, i) => basePref[(i + gIdx + w) % basePref.length]);
          let placed = false;
          for (const pd of pref) {
            const m = wk.find((wd) => wd.date.getDay() === pd && !isFullDayOff(tos, wd.ds));
            if (m) { doffs.add(m.ds); placed = true; break; }
          }
          if (!placed && wk.length) {
            const fb = wk.find((wd) => !isFullDayOff(tos, wd.ds));
            if (fb) doffs.add(fb.ds);
          }
          ws += 7;
        }
      } else if (!["CM","CD","EAM","SWC"].includes(s.role)) {
        // Other non-mgmt roles: weekday preference
        const basePref = [3, 4, 2, 5, 1];
        let ws = 0;
        for (let w = 0; w < weeks; w++) {
          const wk = progDays.slice(ws, ws + 7);
          const pref = basePref.map((_, i) => basePref[(i + gIdx + w) % basePref.length]);
          let placed = false;
          for (const pd of pref) {
            const m = wk.find((wd) => wd.date.getDay() === pd && !isFullDayOff(tos, wd.ds));
            if (m) { doffs.add(m.ds); placed = true; break; }
          }
          if (!placed && wk.length) {
            const fb = wk.find((wd) => !isFullDayOff(tos, wd.ds));
            if (fb) doffs.add(fb.ds);
          }
          ws += 7;
        }
      }
      dayOffSets[s.id] = doffs;

      // Fill induction, setup, day off, departure in Pass 1
      // Arrival days are handled in Pass 2 so we can control how many staff do airport
      onSiteDates.forEach((wd) => {
        const { ds } = wd;
        if (ind.has(ds)) { ng[s.id+"-"+ds+"-AM"] = "Induction"; ng[s.id+"-"+ds+"-PM"] = "Induction"; return; }
        if (setup.has(ds)) { ng[s.id+"-"+ds+"-AM"] = "Setup"; ng[s.id+"-"+ds+"-PM"] = "Setup"; return; }
        if (s.dep && ds === dayKey(new Date(s.dep))) { ng[s.id+"-"+ds+"-AM"] = "Airport"; return; }
        if (isFullDayOff(tos, ds) || doffs.has(ds)) {
          SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
        }
      });
    });

    // Pre-build arriving students per date for airport sizing
    const arrivingStudentsByDate = {};
    if (groups) {
      groups.forEach((g) => {
        if (g.arr) arrivingStudentsByDate[g.arr] = (arrivingStudentsByDate[g.arr] || 0) + (g.stu || 0) + (g.gl || 0);
      });
    }

    // PASS 2: For each programme day, allocate teachers based on lesson demand
    dates.forEach((d) => {
      const ds = dayKey(d);
      const we = isWeekend(d);
      const fe = excDays && excDays[ds] === "Full";
      const he = excDays && excDays[ds] === "Half";
      const dem = lessonDemand[ds];
      const isArrDay = allArrivalDates.has(ds);
      const weekNum = groupArrivalDate ? Math.max(0, Math.floor((new Date(ds) - new Date(groupArrivalDate)) / (7 * 86400000))) : 0;

      // isAvail: not already assigned in Pass 1 (day off, induction, setup, departure airport)
      const isAvail = (s) => {
        if (!inRange(ds, s.arr, s.dep)) return false;
        const am = ng[s.id+"-"+ds+"-AM"];
        return am !== "Day Off" && am !== "Induction" && am !== "Setup" && am !== "Airport";
      };

      const availTeachers = teachers.filter(isAvail);
      const availAct = actStaff.filter(isAvail);

      // ── Arrival day: limited airport duty, rest do activities ──
      if (isArrDay) {
        const arriving = arrivingStudentsByDate[ds] || 0;
        const airportNeed = Math.max(2, Math.ceil(arriving / 40));
        let airportCount = 0;
        // Assign Airport to first N available non-FTT staff (teachers first, then act)
        const allAvailNonFTT = [...availTeachers.filter(s => s.role !== "FTT"), ...availAct];
        allAvailNonFTT.forEach((s) => {
          if (airportCount < airportNeed) {
            ng[s.id+"-"+ds+"-AM"] = "Airport";
            airportCount++;
          } else {
            ng[s.id+"-"+ds+"-AM"] = "Activities";
            ng[s.id+"-"+ds+"-PM"] = "Activities";
          }
        });
        // FTTs: Day Off on group arrival days
        availTeachers.filter(s => s.role === "FTT").forEach((s) => {
          SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
        });
        return;
      }

      // ── Weekend / Full excursion ──
      if (we || fe) {
        availTeachers.forEach((s) => {
          if (s.role === "FTT") {
            if (d.getDay() === 0) { ng[s.id+"-"+ds+"-AM"] = "Lesson Prep"; ng[s.id+"-"+ds+"-PM"] = "Floating"; }
          } else {
            ng[s.id+"-"+ds+"-AM"] = "Excursion"; ng[s.id+"-"+ds+"-PM"] = "Excursion";
          }
        });
        availAct.forEach((s) => {
          ng[s.id+"-"+ds+"-AM"] = "Excursion"; ng[s.id+"-"+ds+"-PM"] = "Excursion";
        });
        return;
      }

      // ── Normal weekday: split TALs between AM and PM lessons ──
      const amNeed = dem ? dem.amTeachers : 0;
      const pmNeed = dem ? dem.pmTeachers : 0;

      const ftts = availTeachers.filter((s) => s.role === "FTT");
      const tals = availTeachers.filter((s) => s.role !== "FTT");

      let amAssigned = 0, pmAssigned = 0;

      // FTTs teach both slots
      ftts.forEach((s) => {
        ng[s.id+"-"+ds+"-AM"] = "Lessons"; ng[s.id+"-"+ds+"-PM"] = "Lessons";
        amAssigned++; pmAssigned++;
      });

      // TALs: split between AM and PM based on demand.
      // Rotate weekly (gIdx + weekNum) so the same person doesn't always teach AM.
      tals.forEach((s) => {
        const gIdx = staffGlobalIdx[s.id] || 0;
        const preferAM = ((gIdx + weekNum) % 2 === 0);
        const remAM = amNeed - amAssigned;
        const remPM = pmNeed - pmAssigned;

        let teachAM;
        if (remAM > 0 && remPM > 0) teachAM = preferAM;      // both needed: use rotation
        else if (remAM > 0)          teachAM = true;           // only AM needed
        else if (remPM > 0)          teachAM = false;          // only PM needed
        else                         teachAM = preferAM;       // surplus: follow rotation

        if (he) {
          if (remAM > 0) {
            ng[s.id+"-"+ds+"-AM"] = "Lessons"; ng[s.id+"-"+ds+"-PM"] = "Half Exc"; amAssigned++;
          } else if (remPM > 0) {
            ng[s.id+"-"+ds+"-AM"] = "Half Exc"; ng[s.id+"-"+ds+"-PM"] = "Lessons"; pmAssigned++;
          } else {
            ng[s.id+"-"+ds+"-AM"] = "Lessons"; ng[s.id+"-"+ds+"-PM"] = "Half Exc";
          }
        } else if (teachAM) {
          ng[s.id+"-"+ds+"-AM"] = "Lessons"; ng[s.id+"-"+ds+"-PM"] = "Activities"; amAssigned++;
        } else {
          ng[s.id+"-"+ds+"-AM"] = "Activities"; ng[s.id+"-"+ds+"-PM"] = "Lessons"; pmAssigned++;
        }
      });

      // Activity staff: AM + PM Activities (Eve assigned by sweep below)
      availAct.forEach((s) => {
        if (he) {
          ng[s.id+"-"+ds+"-AM"] = "Activities"; ng[s.id+"-"+ds+"-PM"] = "Half Exc";
        } else {
          ng[s.id+"-"+ds+"-AM"] = "Activities"; ng[s.id+"-"+ds+"-PM"] = "Activities";
        }
      });

      // Mgmt
      mgmt.forEach((s) => {
        if (!inRange(ds, s.arr, s.dep)) return;
        if (ng[s.id+"-"+ds+"-AM"]) return;
        ng[s.id+"-"+ds+"-AM"] = "Floating"; ng[s.id+"-"+ds+"-PM"] = "Floating";
      });
    });

    // Evening coverage sweep — rotate through staff so the same person isn't always on Eve
    dates.forEach((d) => {
      const ds = dayKey(d);
      if (!groupArrivalDate || ds < groupArrivalDate) return;
      let eveCount = 0;
      staff.forEach((s) => {
        const v = ng[s.id+"-"+ds+"-Eve"];
        if (v && v !== "Day Off") eveCount++;
      });
      if (eveCount === 0) {
        // Find the first available staff member (rotate starting point by day index to spread load)
        const dayIdx = dates.findIndex((x) => dayKey(x) === ds);
        const orderedStaff = [...staff.slice(dayIdx % staff.length), ...staff.slice(0, dayIdx % staff.length)];
        for (const s of orderedStaff) {
          if (!inRange(ds, s.arr, s.dep)) continue;
          if (s.role === "FTT") continue;
          const am = ng[s.id+"-"+ds+"-AM"];
          const pm = ng[s.id+"-"+ds+"-PM"];
          const eve = ng[s.id+"-"+ds+"-Eve"];
          if (am === "Day Off" || am === "Induction" || am === "Setup") continue;
          if (am && pm && !eve && am !== "Excursion" && pm !== "Excursion" && am !== "Airport") {
            delete ng[s.id+"-"+ds+"-PM"];
            ng[s.id+"-"+ds+"-Eve"] = "Eve Ents";
            break;
          }
        }
      }
    });

    setGrid(ng);
  };

  // ── Double-click to edit ──────────────────────────────
  const startEdit = (key, val) => { setEditingCell(key); setEditValue(val || ""); };
  const commitEdit = () => {
    if (editingCell) {
      setGrid((prev) => {
        const nv = editValue.trim();
        if (!nv) { const n = {...prev}; delete n[editingCell]; return n; }
        return { ...prev, [editingCell]: nv };
      });
      setEditingCell(null);
    }
  };

  // Single click cycle
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

  // Stats
  const getStats = (sid) => {
    let sess = 0, offs = 0;
    dates.forEach((d) => {
      const ds = dayKey(d);
      let allOff = true;
      SLOTS.forEach((sl) => {
        const v = grid[sid+"-"+ds+"-"+sl];
        if (v && v !== "Day Off" && v !== "Induction" && v !== "Setup") sess++;
        if (v && v !== "Day Off") allOff = false;
      });
      if (allOff) {
        const a = grid[sid+"-"+ds+"-AM"], b = grid[sid+"-"+ds+"-PM"], c = grid[sid+"-"+ds+"-Eve"];
        if (a === "Day Off" || b === "Day Off" || c === "Day Off") offs++;
      }
    });
    return { sess, offs };
  };

  // Ratios
  const ratioData = useMemo(() => {
    if (!groups || !groups.length) return {};
    const data = {};
    dates.forEach((d) => {
      const ds = dayKey(d);
      let stu = 0, gls = 0;
      groups.forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (g.arr && ds === dayKey(new Date(g.arr))) return;
        if (g.dep && ds === dayKey(new Date(g.dep))) return;
        stu += g.stu || 0; gls += g.gl || 0;
      });
      if (stu > 0) data[ds] = { students: stu, gls, required: calcRequiredStaff(stu) };
    });
    return data;
  }, [groups, dates]);

  const getStaffWorking = (ds, sl) => {
    let c = 0;
    staff.forEach((s) => {
      const v = grid[s.id+"-"+ds+"-"+sl];
      if (v && v !== "Day Off" && v !== "Induction" && v !== "Setup") c++;
    });
    return c;
  };

  const ratioAlerts = useMemo(() => {
    if (!groups || !groups.length) return [];
    const a = [];
    dates.forEach((d) => {
      const ds = dayKey(d); const rd = ratioData[ds];
      if (!rd) return;
      SLOTS.forEach((sl) => {
        const sw = getStaffWorking(ds, sl);
        const tot = sw + rd.gls;
        const short = rd.required - tot;
        if (short > 0) a.push({ date: ds, slot: sl, students: rd.students, staffWorking: sw, gls: rd.gls, total: tot, required: rd.required, shortfall: short });
      });
    });
    return a;
  }, [grid, ratioData, dates, groups]);

  const cellColor = (v) => {
    if (!v) return null;
    if (v === "Day Off") return "#f59e0b";
    if (SESSION_TYPES[v]) return SESSION_TYPES[v];
    const f = v.split(" ")[0].toLowerCase();
    if (f.includes("lesson")) return SESSION_TYPES["Lessons"];
    if (f.includes("exc")) return SESSION_TYPES["Excursion"];
    if (f.includes("act")) return SESSION_TYPES["Activities"];
    if (f.includes("eve") || f.includes("disco") || f.includes("bbq") || f.includes("quiz") || f.includes("karaoke")) return SESSION_TYPES["Eve Ents"];
    return "#6b7280";
  };

  const tableMinWidth = 272 + dates.length * (CELL_W * 3 + 6);

  // Total chrome height: header 68 + strip 4 + nav 48 = 120px
  const CHROME = 120;

  return (
    <div style={{ height: `calc(100vh - ${CHROME}px)`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top controls bar ─────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "8px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${B.border}`, background: B.white }}>
        <StatCard label="Staff" value={staff.length} accent={B.navy} />
        <StatCard label="Days" value={dates.length} accent={B.textMuted} />
        <StatCard label="TALs" value={staff.filter((s) => s.role === "TAL").length} accent="#3b82f6" />
        <StatCard label="FTTs" value={staff.filter((s) => s.role === "FTT").length} accent="#0891b2" />
        {groupArrivalDate && <span style={{ fontSize: 9, color: B.textMuted }}>Students arrive: <strong style={{ color: B.navy }}>{fmtDate(groupArrivalDate)}</strong></span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setShowRatios(!showRatios)} style={{ padding: "5px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1px solid "+(showRatios ? B.navy : B.border), background: showRatios ? B.navy : B.white, color: showRatios ? B.white : B.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
            Ratios {ratioAlerts.length > 0 && <span style={{ background: B.danger, color: B.white, borderRadius: 8, padding: "1px 5px", fontSize: 8 }}>{ratioAlerts.length}</span>}
          </button>
          {!readOnly && <button onClick={() => {
            const hasData = Object.values(rotaGrid).some((v) => v);
            if (hasData && !window.confirm("Auto-generate will overwrite all existing rota entries. Continue?")) return;
            autoGenerate();
          }} style={{ ...btnPrimary, background: B.navy }}><IcWand /> {hasRotaData ? "Re-generate" : "Auto-Generate"}</button>}
        </div>
      </div>

      {/* ── Inline alerts / info strip ───────────────────── */}
      {(hasRotaData || showRatios) && (
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${B.border}` }}>
          {hasRotaData && groups && groups.length > 0 && (
            <div style={{ padding: "4px 16px", background: "#e0f2fe", fontSize: 9, color: "#0369a1", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>Lesson slots (Wk1):</span>
              {groups.map((g) => (
                <span key={g.id}><strong>{g.group}</strong>: {g.lessonSlot || "AM"} ({g.stu} stu)</span>
              ))}
              <span style={{ color: "#64748b" }}>· Set in Students tab · Auto-flips weekly</span>
            </div>
          )}
          {showRatios && (
            <div style={{ padding: "4px 16px" }}>
              {groups && groups.length > 0 ? (
                ratioAlerts.length > 0 ? (
                  <div style={{ background: B.dangerBg, border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 12px", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 10, color: B.danger, whiteSpace: "nowrap" }}>Shortfalls ({ratioAlerts.length})</span>
                    {ratioAlerts.slice(0, 5).map((a, i) => (
                      <span key={i} style={{ fontSize: 9, color: "#991b1b" }}>
                        <strong>{fmtDate(a.date)}</strong> {a.slot}: {a.total}/{a.required} (need {a.shortfall} more)
                      </span>
                    ))}
                    {ratioAlerts.length > 5 && <span style={{ fontSize: 9, color: "#991b1b" }}>+{ratioAlerts.length - 5} more</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, fontWeight: 700, color: B.success }}>All sessions meet safeguarding ratios</div>
                )
              ) : (
                <div style={{ fontSize: 10, color: "#0369a1" }}>Import groups in Students tab to see ratio checks</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "3px 16px 4px", display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center", background: B.bg, borderBottom: `1px solid ${B.border}` }}>
        {Object.entries(SESSION_TYPES).map(([n, c]) => (
          <span key={n} style={{ background: c+"20", color: c, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{n}</span>
        ))}
        <span style={{ background: "#f59e0b20", color: "#f59e0b", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>Day Off</span>
        <span style={{ fontSize: 8, color: B.textMuted, marginLeft: 6 }}>Click = cycle · Double-click = edit</span>
      </div>

      {/* ── Scrollable table ─────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: tableMinWidth, background: B.white }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 52, position: "sticky", left: 0, zIndex: 3 }}>Role</th>
              <th style={{ ...thStyle, width: 140, position: "sticky", left: 52, zIndex: 3 }}>Name</th>
              <th style={{ ...thStyle, width: 44, textAlign: "center", position: "sticky", left: 192, zIndex: 3, fontSize: 9 }}>Sess</th>
              <th style={{ ...thStyle, width: 36, textAlign: "center", position: "sticky", left: 236, zIndex: 3, fontSize: 9 }}>Off</th>
              {dates.map((d) => {
                const we = isWeekend(d); const ds = dayKey(d); const exc = excDays && excDays[ds];
                const isArr = allArrivalDates.has(ds);
                const dem = lessonDemand[ds];
                return (
                  <th key={ds} colSpan={3} style={{ ...thStyle, textAlign: "center", borderLeft: "2px solid rgba(255,255,255,0.2)", padding: "4px 2px", minWidth: CELL_W*3+4, background: isArr ? "#166534" : exc ? "#92400e" : we ? "#7f1d1d" : B.navy }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{fmtDate(d)}</div>
                    <div style={{ fontWeight: 900, fontSize: 13, color: B.white, letterSpacing: 0.5 }}>{dayName(d)}</div>
                    {exc && <div style={{ fontSize: 8, color: B.yellow, fontWeight: 800 }}>{exc === "Full" ? "Full Day Exc" : "Half Day Exc"}</div>}
                    {isArr && <div style={{ fontSize: 8, color: "#86efac", fontWeight: 800 }}>ARRIVAL</div>}
                    {dem && !we && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>{dem.amStudents>0?"AM:"+dem.amStudents:""}{dem.amStudents>0&&dem.pmStudents>0?" · ":""}{dem.pmStudents>0?"PM:"+dem.pmStudents:""}</div>}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th style={{ ...thStyle, position: "sticky", left: 0, zIndex: 3 }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 52, zIndex: 3 }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 192, zIndex: 3 }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 236, zIndex: 3 }}></th>
              {dates.map((d) => SLOTS.map((sl) => (
                <th key={dayKey(d)+"-"+sl} style={{ ...thStyle, textAlign: "center", fontSize: 9, padding: "4px 0", borderLeft: sl === "AM" ? "2px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.1)", minWidth: CELL_W }}>{sl}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {hasRotaData && groups && groups.length > 0 && (
              <tr style={{ borderBottom: "2px solid "+B.border, background: "#f0fdf4" }}>
                <td style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 1, background: "#f0fdf4", fontSize: 9, fontWeight: 800, color: B.success }}>Ratio</td>
                <td style={{ ...tdStyle, position: "sticky", left: 52, zIndex: 1, background: "#f0fdf4", fontSize: 10, fontWeight: 700, color: B.navy }}>Staff+GL / Need</td>
                <td style={{ ...tdStyle, position: "sticky", left: 192, zIndex: 1, background: "#f0fdf4" }}></td>
                <td style={{ ...tdStyle, position: "sticky", left: 236, zIndex: 1, background: "#f0fdf4" }}></td>
                {dates.map((d) => {
                  const ds = dayKey(d); const rd = ratioData[ds];
                  return SLOTS.map((sl) => {
                    if (!rd) return <td key={ds+"-"+sl} style={{ padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, background: "#f0fdf4" }}><div style={{ height: 20 }} /></td>;
                    const sw = getStaffWorking(ds, sl);
                    const tot = sw + rd.gls;
                    const ok = tot >= rd.required;
                    return (
                      <td key={ds+"-"+sl} style={{ padding: "2px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, textAlign: "center", background: ok ? "#f0fdf4" : "#fee2e2" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: ok ? B.success : B.danger, lineHeight: 1 }}>{tot}/{rd.required}</div>
                        <div style={{ fontSize: 9, color: B.textMuted }}>{rd.students}s</div>
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
              const lim = ["TAL","FTT","DRAMA","DANCE"].includes(s.role) ? 22 : ["SC","EAC","SAI","EAL"].includes(s.role) ? 24 : 34;
              const wks = Math.max(1, Math.floor(dates.length / 7));
              const maxTotal = Math.ceil(lim * (wks / 2));
              const over = st.sess > maxTotal;

              return (
                <tr key={s.id} style={{ borderBottom: "1px solid "+B.borderLight }}>
                  <td style={{ ...tdStyle, position: "sticky", left: 0, background: B.white, zIndex: 1 }}>
                    <span style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 7px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>{s.role}</span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: B.navy, fontSize: 12, position: "sticky", left: 52, background: B.white, zIndex: 1, whiteSpace: "nowrap" }}>{s.name}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, fontSize: 12, position: "sticky", left: 192, background: B.white, zIndex: 1, color: over ? B.danger : B.navy }}>{st.sess}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, fontSize: 12, position: "sticky", left: 236, background: B.white, zIndex: 1, color: st.offs > 0 ? "#f59e0b" : B.textLight }}>{st.offs}</td>
                  {dates.map((d) => {
                    const ds = dayKey(d); const on = inRange(ds, s.arr, s.dep);
                    return SLOTS.map((sl) => {
                      const key = s.id+"-"+ds+"-"+sl;
                      const v = grid[key];
                      const off = v === "Day Off";
                      const col = cellColor(v);
                      const isEd = editingCell === key;
                      return (
                        <td key={key}
                          onClick={() => !readOnly && on && !isEd && cycleCell(s.id, ds, sl)}
                          onDoubleClick={(e) => { e.preventDefault(); if (!readOnly && on) startEdit(key, v); }}
                          style={{
                            padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight,
                            textAlign: "center", cursor: on ? "pointer" : "default",
                            minWidth: CELL_W, background: !on ? "#f5f5f5" : off ? "#f59e0b10" : "transparent",
                          }}>
                          {isEd ? (
                            <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                              style={{ width: "100%", fontSize: 10, padding: "4px", border: "1px solid "+B.navy, borderRadius: 3, fontFamily: "inherit", height: CELL_H }} />
                          ) : col ? (
                            <div style={{ background: col+"25", color: col, borderRadius: 4, fontSize: 10, fontWeight: 800, height: CELL_H, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", textAlign: "center", lineHeight: 1.2 }} title={v}>
                              {off ? "Day Off" : v}
                            </div>
                          ) : on ? <div style={{ height: CELL_H }} /> : <div style={{ height: CELL_H, background: "#f0f0f0", borderRadius: 3 }} />}
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
    </div>
  );
}
