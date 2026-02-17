"use client";
import { useState, useMemo } from "react";
import { B, SESSION_TYPES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { StatCard, IcWand, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const SLOTS = ["AM", "PM", "Eve"];

// Role-based default schedules: weekday, weekend/full-exc, half-exc, max sessions per 14 days
const R = {
  CM:    { wk: ["Floating","Floating",null],       we: ["Floating","Floating",null],     exc: ["Excursion","Excursion",null],   hexc: ["Floating","Excursion",null],   max: 30 },
  CD:    { wk: ["Floating","Floating",null],       we: ["Floating","Floating",null],     exc: ["Excursion","Excursion",null],   hexc: ["Floating","Excursion",null],   max: 30 },
  EAM:   { wk: ["Floating","Activities",null],     we: ["Excursion","Excursion",null],   exc: ["Excursion","Excursion",null],   hexc: ["Floating","Excursion",null],   max: 30 },
  SWC:   { wk: ["Floating","Floating",null],       we: ["Excursion","Excursion",null],   exc: ["Excursion","Excursion",null],   hexc: ["Floating","Excursion",null],   max: 30 },
  TAL:   { wk: ["Lessons","Activities","Eve Ents"],we: ["Excursion","Excursion","Eve Ents"], exc: ["Excursion","Excursion","Eve Ents"], hexc: ["Lessons","Excursion","Eve Ents"], max: 27 },
  FTT:   { wk: ["Lessons","Lesson Prep",null],     we: [null,null,null],                 exc: ["Lessons",null,null],            hexc: ["Lessons","Lesson Prep",null],  max: 20 },
  SC:    { wk: ["Floating","Activities","Eve Ents"],we: ["Excursion","Excursion","Eve Ents"], exc: ["Excursion","Excursion","Eve Ents"], hexc: ["Floating","Excursion","Eve Ents"], max: 27 },
  EAC:   { wk: ["Activities","Activities","Eve Ents"],we: ["Excursion","Excursion","Eve Ents"], exc: ["Excursion","Excursion","Eve Ents"], hexc: ["Activities","Excursion","Eve Ents"], max: 27 },
  SAI:   { wk: ["Activities","Activities","Eve Ents"],we: ["Excursion","Excursion","Eve Ents"], exc: ["Excursion","Excursion","Eve Ents"], hexc: ["Activities","Excursion","Eve Ents"], max: 27 },
  EAL:   { wk: ["Lessons","Activities","Eve Ents"],we: ["Excursion","Excursion","Eve Ents"], exc: ["Excursion","Excursion","Eve Ents"], hexc: ["Lessons","Excursion","Eve Ents"], max: 27 },
  DRAMA: { wk: ["Lessons","Activities","Eve Ents"],we: ["Excursion","Excursion","Eve Ents"], exc: ["Excursion","Excursion","Eve Ents"], hexc: ["Lessons","Excursion","Eve Ents"], max: 27 },
  DANCE: { wk: ["Lessons","Activities","Eve Ents"],we: ["Excursion","Excursion","Eve Ents"], exc: ["Excursion","Excursion","Eve Ents"], hexc: ["Lessons","Excursion","Eve Ents"], max: 27 },
};

export default function RotaTab({ staff, progStart, progEnd, excDays }) {
  const [grid, setGrid] = useState({});
  const [filled, setFilled] = useState(false);

  const dates = useMemo(() => {
    if (!progStart || !progEnd) return [];
    return genDates(progStart, progEnd);
  }, [progStart, progEnd]);

  // Parse time off: "16/07 eve, 20/07-22/07, 25/07"
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
      if (to.date === ds) {
        if (!to.slot) return true;
        if (to.slot.toLowerCase() === sl.toLowerCase()) return true;
      }
    }
    return false;
  };

  // ── Auto-generate ─────────────────────────────────────
  const autoGenerate = () => {
    const ng = {};

    staff.forEach((s) => {
      const rd = R[s.role];
      if (!rd) return;
      const tos = parseTimeOff(s.to);
      let fnSessions = 0;
      let fnDay = 0;

      dates.forEach((d) => {
        const ds = dayKey(d);
        if (!inRange(ds, s.arr, s.dep)) return;

        // Reset fortnight counter every 14 days
        fnDay++;
        if (fnDay > 14) { fnDay = 1; fnSessions = 0; }

        const we = isWeekend(d);
        const fe = excDays && excDays[ds] === "Full";
        const he = excDays && excDays[ds] === "Half";
        const isFirst = s.arr && ds === dayKey(new Date(s.arr));
        const isLast = s.dep && ds === dayKey(new Date(s.dep));

        // Determine the schedule template for this day type
        const tmpl = fe ? rd.exc : he ? rd.hexc : we ? rd.we : rd.wk;

        // Check if approaching session limit — schedule day off
        const approachingLimit = fnSessions >= rd.max - 3 && !we && !fe;

        SLOTS.forEach((sl, si) => {
          const key = s.id + "-" + ds + "-" + sl;

          // Time off request
          if (isTimeOff(tos, ds, sl)) { ng[key] = "Day Off"; return; }

          // Auto day off when near limit (full day off on a weekday)
          if (approachingLimit) { ng[key] = "Day Off"; return; }

          // Arrival day: PM + Eve only
          if (isFirst) {
            if (sl === "AM") return;
            if (sl === "PM") { ng[key] = "Floating"; fnSessions++; return; }
            if (sl === "Eve" && tmpl[2]) { ng[key] = "Eve Ents"; fnSessions++; return; }
            return;
          }

          // Departure day: AM only
          if (isLast) {
            if (sl === "AM") { ng[key] = "Floating"; fnSessions++; }
            return;
          }

          // Normal: use role template
          const val = tmpl[si];
          if (val) { ng[key] = val; fnSessions++; }
        });
      });
    });

    setGrid(ng);
    setFilled(true);
  };

  // ── Click to cycle ────────────────────────────────────
  const allTypes = [...Object.keys(SESSION_TYPES), "Day Off"];
  const cycleCell = (sid, ds, sl) => {
    const key = sid + "-" + ds + "-" + sl;
    setGrid((prev) => {
      const cur = prev[key];
      if (!cur) return { ...prev, [key]: allTypes[0] };
      const idx = allTypes.indexOf(cur);
      if (idx >= allTypes.length - 1) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: allTypes[idx + 1] };
    });
  };

  // ── Stats per staff ───────────────────────────────────
  const getStats = (sid) => {
    let sess = 0, offs = 0;
    dates.forEach((d) => {
      const ds = dayKey(d);
      SLOTS.forEach((sl) => {
        const v = grid[sid + "-" + ds + "-" + sl];
        if (v === "Day Off") offs++;
        else if (v) sess++;
      });
    });
    return { sess, offs };
  };

  const tableMinWidth = 260 + dates.length * 70;

  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatCard label="Staff" value={staff.length} accent={B.navy} />
        <StatCard label="Days" value={dates.length} accent={B.textMuted} />
        <StatCard label="TALs" value={staff.filter((s) => s.role === "TAL").length} accent="#3b82f6" />
        <StatCard label="FTTs" value={staff.filter((s) => s.role === "FTT").length} accent="#0891b2" />
        <div style={{ marginLeft: "auto" }}>
          <button onClick={autoGenerate} style={{ ...btnPrimary, background: B.navy }}><IcWand /> {filled ? "Re-generate" : "Auto-Generate Rota"}</button>
        </div>
      </div>

      {!filled && staff.length > 0 && (
        <div style={{ margin: "0 20px 8px", padding: "10px 14px", background: "#e0f2fe", borderRadius: 8, fontSize: 11, color: "#0369a1", fontWeight: 600 }}>
          Add staff in Team tab (role, dates, time off) then click Auto-Generate. Click any cell to manually adjust.
        </div>
      )}

      <div style={{ padding: "4px 20px 6px", display: "flex", gap: 3, flexWrap: "wrap" }}>
        {Object.entries(SESSION_TYPES).map(([n, c]) => (
          <span key={n} style={{ background: c + "20", color: c, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{n}</span>
        ))}
        <span style={{ background: "#f59e0b20", color: "#f59e0b", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>Day Off</span>
      </div>

      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 220px)", padding: "0 4px 16px" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: tableMinWidth, background: B.white, borderRadius: 10, border: "1px solid " + B.border }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 42, position: "sticky", left: 0, zIndex: 3, background: "#f8fafc" }}>Role</th>
              <th style={{ ...thStyle, width: 105, position: "sticky", left: 42, zIndex: 3, background: "#f8fafc" }}>Name</th>
              <th style={{ ...thStyle, width: 28, textAlign: "center", position: "sticky", left: 147, zIndex: 3, background: "#f8fafc", fontSize: 7 }}>Sess</th>
              <th style={{ ...thStyle, width: 24, textAlign: "center", position: "sticky", left: 175, zIndex: 3, background: "#f8fafc", fontSize: 7 }}>Off</th>
              {dates.map((d) => {
                const we = isWeekend(d); const ds = dayKey(d); const exc = excDays && excDays[ds];
                return (
                  <th key={ds} colSpan={3} style={{ ...thStyle, textAlign: "center", borderLeft: "2px solid " + B.border, padding: "3px 0", minWidth: 66, background: exc ? "#fff7ed" : we ? "#fef2f2" : "#f8fafc" }}>
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
                <th key={dayKey(d) + "-" + sl} style={{ ...thStyle, textAlign: "center", fontSize: 6, padding: "2px 0", borderLeft: sl === "AM" ? "2px solid " + B.border : "1px solid " + B.borderLight, minWidth: 22 }}>{sl}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr><td colSpan={4 + dates.length * 3} style={{ textAlign: "center", padding: 36, color: B.textLight }}>Add staff in Team tab with role + dates, then Auto-Generate</td></tr>
            ) : staff.map((s) => {
              const st = getStats(s.id);
              const rd = R[s.role];
              const maxExpected = rd ? Math.ceil(rd.max * (dates.length / 14)) : 999;
              const over = st.sess > maxExpected;

              return (
                <tr key={s.id} style={{ borderBottom: "1px solid " + B.borderLight }}>
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
                      const key = s.id + "-" + ds + "-" + sl;
                      const v = grid[key];
                      const off = v === "Day Off";
                      const col = off ? "#f59e0b" : v ? SESSION_TYPES[v] : null;
                      return (
                        <td key={key} onClick={() => on && cycleCell(s.id, ds, sl)} style={{
                          padding: "1px", borderLeft: sl === "AM" ? "2px solid " + B.border : "1px solid " + B.borderLight,
                          textAlign: "center", cursor: on ? "pointer" : "default",
                          minWidth: 22, background: !on ? "#f5f5f5" : off ? "#f59e0b10" : "transparent",
                        }}>
                          {col ? (
                            <div style={{ background: col + "30", color: col, borderRadius: 2, fontSize: 6, fontWeight: 800, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
      <div style={{ padding: "6px 20px", fontSize: 9, color: B.textMuted }}>Scroll horizontally for full range · Red count = over session limit for role · Click cells to cycle</div>
    </div>
  );
}
