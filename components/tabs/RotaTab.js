"use client";
import { useState, useMemo } from "react";
import { B, SESSION_TYPES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { StatCard, IcWand, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const SLOTS = ["AM", "PM", "Eve"];

// Role day patterns: each entry = { work: [slot1, slot2], acts: [act1, act2], off: slotOff }
const ROLE_DAYS = {
  TAL: {
    weekday: [
      { work: ["AM", "PM"], acts: ["Lessons", "Activities"], off: "Eve" },
      { work: ["PM", "Eve"], acts: ["Activities", "Eve Ents"], off: "AM" },
    ],
    weekend: [
      { work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" },
      { work: ["AM", "Eve"], acts: ["Excursion", "Eve Ents"], off: "PM" },
    ],
    halfExc: [
      { work: ["AM", "PM"], acts: ["Lessons", "Half Exc"], off: "Eve" },
      { work: ["PM", "Eve"], acts: ["Half Exc", "Eve Ents"], off: "AM" },
    ],
    fullExc: [
      { work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" },
      { work: ["AM", "Eve"], acts: ["Excursion", "Eve Ents"], off: "PM" },
    ],
    sessPerFn: 22, countsForRatio: true,
  },
  FTT: {
    weekday: [{ work: ["AM", "PM"], acts: ["Lessons", "Lessons"], off: "Eve" }],
    weekend: [{ work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" }],
    halfExc: [{ work: ["AM", "PM"], acts: ["Lessons", "Lessons"], off: "Eve" }],
    fullExc: [{ work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" }],
    sessPerFn: 22, weekendDayOff: true, countsForRatio: true,
  },
  FTT5: {
    weekday: [{ work: ["AM", "PM"], acts: ["Lessons", "Lessons"], off: "Eve" }],
    weekend: [], halfExc: [{ work: ["AM", "PM"], acts: ["Lessons", "Lessons"], off: "Eve" }], fullExc: [],
    sessPerFn: 20, weekendFullOff: true, countsForRatio: true,
  },
  EAL: {
    weekday: [
      { work: ["AM", "PM"], acts: ["Lessons", "Activities"], off: "Eve" },
      { work: ["PM", "Eve"], acts: ["Activities", "Eve Ents"], off: "AM" },
    ],
    weekend: [
      { work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" },
      { work: ["AM", "Eve"], acts: ["Excursion", "Eve Ents"], off: "PM" },
    ],
    halfExc: [
      { work: ["AM", "PM"], acts: ["Lessons", "Half Exc"], off: "Eve" },
      { work: ["PM", "Eve"], acts: ["Half Exc", "Eve Ents"], off: "AM" },
    ],
    fullExc: [
      { work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" },
      { work: ["AM", "Eve"], acts: ["Excursion", "Eve Ents"], off: "PM" },
    ],
    sessPerFn: 24, countsForRatio: true,
  },
  EAC: {
    weekday: [
      { work: ["AM", "PM"], acts: ["Activities", "Activities"], off: "Eve" },
      { work: ["PM", "Eve"], acts: ["Activities", "Eve Ents"], off: "AM" },
    ],
    weekend: [
      { work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" },
      { work: ["AM", "Eve"], acts: ["Excursion", "Eve Ents"], off: "PM" },
    ],
    halfExc: [{ work: ["AM", "PM"], acts: ["Activities", "Half Exc"], off: "Eve" }],
    fullExc: [{ work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" }],
    sessPerFn: 24, countsForRatio: true,
  },
  SAI: {
    weekday: [
      { work: ["AM", "PM"], acts: ["Activities", "Activities"], off: "Eve" },
      { work: ["PM", "Eve"], acts: ["Activities", "Eve Ents"], off: "AM" },
    ],
    weekend: [
      { work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" },
      { work: ["AM", "Eve"], acts: ["Excursion", "Eve Ents"], off: "PM" },
    ],
    halfExc: [{ work: ["AM", "PM"], acts: ["Activities", "Half Exc"], off: "Eve" }],
    fullExc: [{ work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" }],
    sessPerFn: 24, countsForRatio: true,
  },
  SC: {
    weekday: [
      { work: ["AM", "PM"], acts: ["Activities", "Activities"], off: "Eve" },
      { work: ["PM", "Eve"], acts: ["Activities", "Eve Ents"], off: "AM" },
    ],
    weekend: [
      { work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" },
      { work: ["AM", "Eve"], acts: ["Excursion", "Eve Ents"], off: "PM" },
    ],
    halfExc: [{ work: ["AM", "PM"], acts: ["Activities", "Half Exc"], off: "Eve" }],
    fullExc: [{ work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" }],
    sessPerFn: 24, countsForRatio: true,
  },
  DRAMA: {
    weekday: [
      { work: ["AM", "PM"], acts: ["Lessons", "Activities"], off: "Eve" },
      { work: ["PM", "Eve"], acts: ["Activities", "Eve Ents"], off: "AM" },
    ],
    weekend: [{ work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" }],
    halfExc: [{ work: ["AM", "PM"], acts: ["Lessons", "Half Exc"], off: "Eve" }],
    fullExc: [{ work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" }],
    sessPerFn: 22, countsForRatio: true,
  },
  DANCE: {
    weekday: [
      { work: ["AM", "PM"], acts: ["Lessons", "Activities"], off: "Eve" },
      { work: ["PM", "Eve"], acts: ["Activities", "Eve Ents"], off: "AM" },
    ],
    weekend: [{ work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" }],
    halfExc: [{ work: ["AM", "PM"], acts: ["Lessons", "Half Exc"], off: "Eve" }],
    fullExc: [{ work: ["AM", "PM"], acts: ["Excursion", "Excursion"], off: "Eve" }],
    sessPerFn: 22, countsForRatio: true,
  },
  CM:  { weekday: [{ work: ["AM","PM"], acts: ["Floating","Floating"], off: "Eve" }], weekend: [{ work: ["AM","PM"], acts: ["Floating","Floating"], off: "Eve" }], halfExc: [{ work: ["AM","PM"], acts: ["Floating","Floating"], off: "Eve" }], fullExc: [{ work: ["AM","PM"], acts: ["Excursion","Excursion"], off: "Eve" }], sessPerFn: 34, countsForRatio: false },
  EAM: { weekday: [{ work: ["AM","PM"], acts: ["Floating","Activities"], off: "Eve" }], weekend: [{ work: ["AM","PM"], acts: ["Excursion","Excursion"], off: "Eve" }], halfExc: [{ work: ["AM","PM"], acts: ["Floating","Half Exc"], off: "Eve" }], fullExc: [{ work: ["AM","PM"], acts: ["Excursion","Excursion"], off: "Eve" }], sessPerFn: 34, countsForRatio: true },
  CD:  { weekday: [{ work: ["AM","PM"], acts: ["Floating","Floating"], off: "Eve" }], weekend: [{ work: ["AM","PM"], acts: ["Floating","Floating"], off: "Eve" }], halfExc: [{ work: ["AM","PM"], acts: ["Floating","Floating"], off: "Eve" }], fullExc: [{ work: ["AM","PM"], acts: ["Excursion","Excursion"], off: "Eve" }], sessPerFn: 28, countsForRatio: false },
  SWC: { weekday: [{ work: ["AM","PM"], acts: ["Floating","Floating"], off: "Eve" }], weekend: [{ work: ["AM","PM"], acts: ["Floating","Floating"], off: "Eve" }], halfExc: [{ work: ["AM","PM"], acts: ["Floating","Floating"], off: "Eve" }], fullExc: [{ work: ["AM","PM"], acts: ["Excursion","Excursion"], off: "Eve" }], sessPerFn: 28, countsForRatio: false },
};

// ── Safeguarding ratios ─────────────────────────────────
// 12+ → 1:20, 10-12 → 1:15, 8-10 → 1:10
// We'll use 1:20 as default since most UKLC students are 13-16
function calcRequiredStaff(studentCount, avgAge) {
  if (!studentCount || studentCount <= 0) return 0;
  const ratio = avgAge && avgAge < 10 ? 10 : avgAge && avgAge < 12 ? 15 : 20;
  return Math.ceil(studentCount / ratio);
}

export default function RotaTab({ staff, progStart, progEnd, excDays, groups }) {
  const [grid, setGrid] = useState({});
  const [filled, setFilled] = useState(false);
  const [showRatios, setShowRatios] = useState(true);

  const dates = useMemo(() => {
    if (!progStart || !progEnd) return [];
    return genDates(progStart, progEnd);
  }, [progStart, progEnd]);

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

  const isTimeOff = (tos, ds, sl) => {
    for (const to of tos) {
      if (to.start && to.end && ds >= to.start && ds <= to.end) return true;
      if (to.date === ds) { if (!to.slot) return true; if (to.slot.toLowerCase() === sl.toLowerCase()) return true; }
    }
    return false;
  };

  const isFullDayOff = (tos, ds) => {
    for (const to of tos) {
      if (to.start && to.end && ds >= to.start && ds <= to.end) return true;
      if (to.date === ds && !to.slot) return true;
    }
    return false;
  };

  // ── Ratio calculations ────────────────────────────────
  const ratioData = useMemo(() => {
    if (!groups || groups.length === 0) return {};
    const data = {};

    dates.forEach((d) => {
      const ds = dayKey(d);

      // Count students on-site this day
      let totalStudents = 0;
      let totalGLs = 0;
      const groupsOnSite = [];

      groups.forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        // Skip arrival/departure days for activity ratios
        if (g.arr && ds === dayKey(new Date(g.arr))) return;
        if (g.dep && ds === dayKey(new Date(g.dep))) return;

        totalStudents += g.stu || 0;
        totalGLs += g.gl || 0;
        groupsOnSite.push(g);
      });

      if (totalStudents === 0) return;

      const required = calcRequiredStaff(totalStudents);

      data[ds] = { students: totalStudents, gls: totalGLs, required, groupsOnSite };
    });

    return data;
  }, [groups, dates]);

  // Count staff working per slot per day (from grid)
  const getStaffWorking = (ds, sl) => {
    let count = 0;
    staff.forEach((s) => {
      const v = grid[s.id + "-" + ds + "-" + sl];
      if (v && v !== "Day Off") count++;
    });
    return count;
  };

  // ── Auto-generate ─────────────────────────────────────
  const autoGenerate = () => {
    const ng = {};

    staff.forEach((s) => {
      let roleKey = s.role;
      if (s.role === "FTT" && s.london5day) roleKey = "FTT5";
      const rd = ROLE_DAYS[roleKey];
      if (!rd) return;

      const tos = parseTimeOff(s.to);

      // Collect working dates
      const workingDates = [];
      dates.forEach((d) => {
        const ds = dayKey(d);
        if (inRange(ds, s.arr, s.dep)) workingDates.push({ date: d, ds });
      });

      // Plan 1 day off per week
      const totalWeeks = Math.ceil(workingDates.length / 7);
      const dayOffSet = new Set();

      if (rd.weekendDayOff) {
        // FTT: Saturday off (prefer Sat, then Sun)
        let ws = 0;
        for (let w = 0; w < totalWeeks; w++) {
          const week = workingDates.slice(ws, ws + 7);
          const sat = week.find((wd) => wd.date.getDay() === 6);
          const sun = week.find((wd) => wd.date.getDay() === 0);
          if (sat) dayOffSet.add(sat.ds);
          else if (sun) dayOffSet.add(sun.ds);
          else if (week.length > 0) dayOffSet.add(week[week.length - 1].ds);
          ws += 7;
        }
      } else if (rd.weekendFullOff) {
        workingDates.forEach((wd) => { if (isWeekend(wd.date)) dayOffSet.add(wd.ds); });
      } else {
        // 1 day off per week, mid-week preferred
        let ws = 0;
        const pref = [3, 4, 2, 5, 1]; // Wed, Thu, Tue, Fri, Mon
        for (let w = 0; w < totalWeeks; w++) {
          const week = workingDates.slice(ws, ws + 7);
          let placed = false;
          for (const pd of pref) {
            const m = week.find((wd) => wd.date.getDay() === pd && !isFullDayOff(tos, wd.ds));
            if (m) { dayOffSet.add(m.ds); placed = true; break; }
          }
          if (!placed && week.length > 0) {
            const fallback = week.find((wd) => !isFullDayOff(tos, wd.ds));
            if (fallback) dayOffSet.add(fallback.ds);
          }
          ws += 7;
        }
      }

      // Fill grid
      let dayIdx = 0;
      workingDates.forEach((wd) => {
        const { date: d, ds } = wd;
        const we = isWeekend(d);
        const fe = excDays && excDays[ds] === "Full";
        const he = excDays && excDays[ds] === "Half";
        const isFirst = s.arr && ds === dayKey(new Date(s.arr));
        const isLast = s.dep && ds === dayKey(new Date(s.dep));

        if (isFirst) { ng[s.id+"-"+ds+"-PM"] = "Airport"; dayIdx++; return; }
        if (isLast) { ng[s.id+"-"+ds+"-AM"] = "Airport"; dayIdx++; return; }

        if (isFullDayOff(tos, ds) || dayOffSet.has(ds)) {
          SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          dayIdx++; return;
        }

        if (rd.weekendFullOff && we) {
          SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          dayIdx++; return;
        }

        let patterns = fe ? rd.fullExc : he ? rd.halfExc : we ? rd.weekend : rd.weekday;
        if (!patterns || patterns.length === 0) {
          SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          dayIdx++; return;
        }

        const pat = patterns[dayIdx % patterns.length];

        SLOTS.forEach((sl) => {
          if (isTimeOff(tos, ds, sl)) { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; }
          else if (pat.work.includes(sl)) {
            const idx = pat.work.indexOf(sl);
            ng[s.id+"-"+ds+"-"+sl] = pat.acts[idx];
          }
        });

        dayIdx++;
      });
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

  // Stats
  const getStats = (sid) => {
    let sess = 0, offs = 0;
    dates.forEach((d) => {
      const ds = dayKey(d);
      let allOff = true;
      SLOTS.forEach((sl) => {
        const v = grid[sid+"-"+ds+"-"+sl];
        if (v && v !== "Day Off") { sess++; allOff = false; }
        else if (v !== "Day Off") allOff = false;
      });
      if (allOff && grid[sid+"-"+ds+"-AM"] === "Day Off") offs++;
    });
    return { sess, offs };
  };

  // Ratio alerts
  const ratioAlerts = useMemo(() => {
    if (!filled || !groups || groups.length === 0) return [];
    const alerts = [];

    dates.forEach((d) => {
      const ds = dayKey(d);
      const rd = ratioData[ds];
      if (!rd) return;

      SLOTS.forEach((sl) => {
        const staffCount = getStaffWorking(ds, sl);
        const totalSupervision = staffCount + rd.gls;
        const shortfall = rd.required - totalSupervision;

        if (shortfall > 0) {
          alerts.push({
            date: ds, slot: sl, students: rd.students,
            staffWorking: staffCount, gls: rd.gls,
            total: totalSupervision, required: rd.required,
            shortfall,
          });
        }
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
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => setShowRatios(!showRatios)} style={{ padding: "5px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1px solid " + (showRatios ? B.navy : B.border), background: showRatios ? B.navy : B.white, color: showRatios ? B.white : B.textMuted }}>
            {"\ud83d\udee1\ufe0f"} Ratios {ratioAlerts.length > 0 && <span style={{ background: B.danger, color: B.white, borderRadius: 8, padding: "1px 5px", fontSize: 8, marginLeft: 4 }}>{ratioAlerts.length}</span>}
          </button>
          <button onClick={autoGenerate} style={{ ...btnPrimary, background: B.navy }}><IcWand /> {filled ? "Re-generate" : "Auto-Generate Rota"}</button>
        </div>
      </div>

      {/* ── Safeguarding Ratio Panel ───────────────────── */}
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
                      <span>{a.students} students need {a.required} supervisors — have {a.staffWorking} staff + {a.gls} GLs = {a.total}</span>
                      <span style={{ fontWeight: 800, color: B.danger }}>Need {a.shortfall} more</span>
                    </div>
                  ))}
                  {ratioAlerts.length > 10 && <div style={{ fontSize: 9, color: "#991b1b" }}>...and {ratioAlerts.length - 10} more</div>}
                </div>
              </div>
            ) : (
              <div style={{ background: B.successBg, border: "1px solid #86efac", borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700, color: B.success }}>
                {"\u2705"} All sessions meet safeguarding ratios (1:20 for 12+, 1:15 for 10-12, 1:10 for 8-10)
              </div>
            )
          ) : (
            <div style={{ background: "#e0f2fe", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "#0369a1" }}>
              {"\u2139\ufe0f"} Import groups in Students tab to see safeguarding ratio checks
            </div>
          )}
        </div>
      )}

      {!filled && staff.length > 0 && (
        <div style={{ margin: "0 20px 8px", padding: "10px 14px", background: "#e0f2fe", borderRadius: 8, fontSize: 11, color: "#0369a1", fontWeight: 600 }}>
          Add staff in Team tab (role, dates, time off) then click Auto-Generate. Click any cell to adjust.
        </div>
      )}

      <div style={{ padding: "4px 20px 6px", display: "flex", gap: 3, flexWrap: "wrap" }}>
        {Object.entries(SESSION_TYPES).map(([n, c]) => (
          <span key={n} style={{ background: c+"20", color: c, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{n}</span>
        ))}
        <span style={{ background: "#f59e0b20", color: "#f59e0b", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>Day Off</span>
        <span style={{ fontSize: 9, color: B.textMuted, marginLeft: 4 }}>2 sess/day · 1 day off/wk · Click to edit</span>
      </div>

      {/* ── Ratio row in table ─────────────────────────── */}
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
                return (
                  <th key={ds} colSpan={3} style={{ ...thStyle, textAlign: "center", borderLeft: "2px solid "+B.border, padding: "3px 0", minWidth: 66, background: exc ? "#fff7ed" : we ? "#fef2f2" : "#f8fafc" }}>
                    <div style={{ fontSize: 7, color: B.textMuted }}>{fmtDate(d)}</div>
                    <div style={{ fontWeight: 800, fontSize: 8, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                    {exc && <div style={{ fontSize: 6, color: "#ea580c", fontWeight: 800 }}>{exc === "Full" ? "FD" : "HD"}</div>}
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
            {/* Ratio summary row */}
            {filled && groups && groups.length > 0 && (
              <tr style={{ borderBottom: "2px solid "+B.border, background: "#f0fdf4" }}>
                <td style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 1, background: "#f0fdf4", fontSize: 7, fontWeight: 800, color: B.success }}>{"\ud83d\udee1\ufe0f"}</td>
                <td style={{ ...tdStyle, position: "sticky", left: 42, zIndex: 1, background: "#f0fdf4", fontSize: 8, fontWeight: 700, color: B.navy }}>Staff / Need</td>
                <td style={{ ...tdStyle, position: "sticky", left: 147, zIndex: 1, background: "#f0fdf4" }}></td>
                <td style={{ ...tdStyle, position: "sticky", left: 175, zIndex: 1, background: "#f0fdf4" }}></td>
                {dates.map((d) => {
                  const ds = dayKey(d);
                  const rd = ratioData[ds];
                  return SLOTS.map((sl) => {
                    if (!rd) return <td key={ds+"-"+sl} style={{ padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, background: "#f0fdf4" }}><div style={{ height: 18 }} /></td>;
                    const sw = getStaffWorking(ds, sl);
                    const total = sw + rd.gls;
                    const ok = total >= rd.required;
                    return (
                      <td key={ds+"-"+sl} style={{ padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, textAlign: "center", background: ok ? "#f0fdf4" : "#fee2e2" }}>
                        <div style={{ fontSize: 7, fontWeight: 800, color: ok ? B.success : B.danger, lineHeight: 1 }}>
                          {total}/{rd.required}
                        </div>
                        <div style={{ fontSize: 6, color: B.textMuted }}>{rd.students}s</div>
                      </td>
                    );
                  });
                })}
              </tr>
            )}

            {staff.length === 0 ? (
              <tr><td colSpan={4 + dates.length * 3} style={{ textAlign: "center", padding: 36, color: B.textLight }}>Add staff in Team tab with role + contract dates, then Auto-Generate</td></tr>
            ) : staff.map((s) => {
              const st = getStats(s.id);
              const rd = ROLE_DAYS[s.role];
              const maxExpected = rd ? Math.ceil(rd.sessPerFn * (dates.length / 14)) : 999;
              const over = st.sess > maxExpected;

              return (
                <tr key={s.id} style={{ borderBottom: "1px solid "+B.borderLight }}>
                  <td style={{ ...tdStyle, position: "sticky", left: 0, background: B.white, zIndex: 1 }}>
                    <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 5px", borderRadius: 3, fontSize: 8, fontWeight: 800 }}>{s.role}</span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: B.navy, fontSize: 9, position: "sticky", left: 42, background: B.white, zIndex: 1, whiteSpace: "nowrap" }}>
                    {s.name}
                    {s.acc !== "Residential" && <span style={{ fontSize: 7, color: B.textMuted, marginLeft: 3 }}>NR</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, fontSize: 9, position: "sticky", left: 147, background: B.white, zIndex: 1, color: over ? B.danger : B.navy }}>{st.sess}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, fontSize: 9, position: "sticky", left: 175, background: B.white, zIndex: 1, color: st.offs > 0 ? "#f59e0b" : B.textLight }}>{st.offs}</td>
                  {dates.map((d) => {
                    const ds = dayKey(d);
                    const on = inRange(ds, s.arr, s.dep);
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
      <div style={{ padding: "6px 20px", fontSize: 9, color: B.textMuted }}>
        {"\ud83d\udee1\ufe0f"} Ratio row: staff+GLs / required (1:20 for 12+, 1:15 for 10-12, 1:10 for 8-10) · Red = shortfall
      </div>
    </div>
  );
}
