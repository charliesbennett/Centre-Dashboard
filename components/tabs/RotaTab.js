"use client";
import { useState, useMemo } from "react";
import { B, SESSION_TYPES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { StatCard, IcWand, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const SLOTS = ["AM", "PM", "Eve"];

/*
  Role schedules derived from UKLC template PDFs.
  Sessions per fortnight:
    TAL, FTT = 22
    SC, EAC, SAI, EAL = 24
    CM, EAM = ~34 (60hrs/wk)
    CD, SWC = ~28 (50hrs/wk)

  ZZ = zig-zag (AM/PM swap on alternating days)
  NZZ = non zig-zag (lessons always AM)

  Each pattern returns [AM, PM, Eve] for a given day type.
  null = not working that slot.
*/

// Standard weekday/weekend/excursion patterns per role
// Returns function(dayIndex, isZZ) => [AM, PM, Eve]
const ROLE_PATTERNS = {
  // TAL: 22 sessions/fortnight. Weekday: AM Lessons, PM Activities, Eve Ents. Weekend: Full Exc + Eve.
  TAL: {
    max: 22,
    weekday: (di, isZZ, isHalfExcDay) => {
      if (isHalfExcDay) {
        return isZZ && di % 2 === 0
          ? ["Half Exc", "Lessons", "Eve Ents"]
          : ["Lessons", "Half Exc", "Eve Ents"];
      }
      return isZZ && di % 2 === 0
        ? ["Activities", "Lessons", "Eve Ents"]
        : ["Lessons", "Activities", "Eve Ents"];
    },
    weekend: () => ["Excursion", "Excursion", "Eve Ents"],
    fullExc: () => ["Excursion", "Excursion", "Eve Ents"],
  },

  // FTT Standard: 22 sessions/fortnight. Weekday: AM Lessons, PM Lessons. 1 weekend day working (Full Exc), 1 day off.
  FTT: {
    max: 22,
    weekday: () => ["Lessons", "Lessons", null],
    weekend: (di) => di % 2 === 0 ? ["Excursion", "Excursion", null] : [null, null, null], // alternate weekends
    fullExc: () => ["Excursion", "Excursion", null],
  },

  // FTT 5-Day (London): Weekdays only, no weekends
  FTT5: {
    max: 22,
    weekday: () => ["Lessons", "Lessons", null],
    weekend: () => [null, null, null],
    fullExc: () => [null, null, null],
  },

  // EAL (Activity Leader NZZ): 24 sessions. Weekday: AM Lessons, PM Activities, Eve. Weekend: Exc.
  EAL: {
    max: 24,
    weekday: (di, isZZ, isHalfExcDay) => {
      if (isHalfExcDay) {
        return isZZ && di % 2 === 0
          ? ["Half Exc", "Lessons", "Eve Ents"]
          : ["Lessons", "Half Exc", "Eve Ents"];
      }
      return isZZ && di % 2 === 0
        ? ["Activities", "Lessons", "Eve Ents"]
        : ["Lessons", "Activities", "Eve Ents"];
    },
    weekend: () => ["Excursion", "Excursion", "Eve Ents"],
    fullExc: () => ["Excursion", "Excursion", "Eve Ents"],
  },

  // EAC (Activity Coordinator): 24 sessions. Same pattern as EAL.
  EAC: {
    max: 24,
    weekday: (di, isZZ, isHalfExcDay) => {
      if (isHalfExcDay) {
        return isZZ && di % 2 === 0
          ? ["Half Exc", "Activities", "Eve Ents"]
          : ["Activities", "Half Exc", "Eve Ents"];
      }
      return isZZ && di % 2 === 0
        ? ["Activities", "Activities", "Eve Ents"]
        : ["Activities", "Activities", "Eve Ents"];
    },
    weekend: () => ["Excursion", "Excursion", "Eve Ents"],
    fullExc: () => ["Excursion", "Excursion", "Eve Ents"],
  },

  // SAI (Sport & Activity Instructor): 24 sessions. AM Sports, PM varies.
  SAI: {
    max: 24,
    weekday: (di, isZZ, isHalfExcDay) => {
      if (isHalfExcDay) {
        return isZZ && di % 2 === 0
          ? ["Half Exc", "Activities", "Eve Ents"]
          : ["Activities", "Half Exc", "Eve Ents"];
      }
      return isZZ && di % 2 === 0
        ? ["Activities", "Activities", "Eve Ents"]
        : ["Activities", "Activities", "Eve Ents"];
    },
    weekend: () => ["Excursion", "Excursion", "Eve Ents"],
    fullExc: () => ["Excursion", "Excursion", "Eve Ents"],
  },

  // SC (Sport Coordinator): 24 sessions. Same as SAI.
  SC: {
    max: 24,
    weekday: (di, isZZ, isHalfExcDay) => {
      if (isHalfExcDay) {
        return isZZ && di % 2 === 0
          ? ["Half Exc", "Activities", "Eve Ents"]
          : ["Activities", "Half Exc", "Eve Ents"];
      }
      return isZZ && di % 2 === 0
        ? ["Activities", "Activities", "Eve Ents"]
        : ["Activities", "Activities", "Eve Ents"];
    },
    weekend: () => ["Excursion", "Excursion", "Eve Ents"],
    fullExc: () => ["Excursion", "Excursion", "Eve Ents"],
  },

  // DRAMA / DANCE: Same as TAL pattern
  DRAMA: {
    max: 22,
    weekday: (di, isZZ, isHalfExcDay) => {
      if (isHalfExcDay) return ["Lessons", "Half Exc", "Eve Ents"];
      return ["Lessons", "Activities", "Eve Ents"];
    },
    weekend: () => ["Excursion", "Excursion", "Eve Ents"],
    fullExc: () => ["Excursion", "Excursion", "Eve Ents"],
  },
  DANCE: {
    max: 22,
    weekday: (di, isZZ, isHalfExcDay) => {
      if (isHalfExcDay) return ["Lessons", "Half Exc", "Eve Ents"];
      return ["Lessons", "Activities", "Eve Ents"];
    },
    weekend: () => ["Excursion", "Excursion", "Eve Ents"],
    fullExc: () => ["Excursion", "Excursion", "Eve Ents"],
  },

  // Management: CM/EAM 60hrs (~34 sessions), CD/SWC 50hrs (~28 sessions)
  CM:  { max: 34, weekday: () => ["Floating","Floating","Eve Ents"], weekend: () => ["Floating","Floating","Eve Ents"], fullExc: () => ["Excursion","Excursion","Eve Ents"] },
  EAM: { max: 34, weekday: () => ["Floating","Activities","Eve Ents"], weekend: () => ["Excursion","Excursion","Eve Ents"], fullExc: () => ["Excursion","Excursion","Eve Ents"] },
  CD:  { max: 28, weekday: () => ["Floating","Floating",null], weekend: () => ["Floating","Floating",null], fullExc: () => ["Excursion","Excursion",null] },
  SWC: { max: 28, weekday: () => ["Floating","Floating",null], weekend: () => ["Floating","Floating",null], fullExc: () => ["Excursion","Excursion",null] },
};

export default function RotaTab({ staff, progStart, progEnd, excDays }) {
  const [grid, setGrid] = useState({});
  const [filled, setFilled] = useState(false);

  const dates = useMemo(() => {
    if (!progStart || !progEnd) return [];
    return genDates(progStart, progEnd);
  }, [progStart, progEnd]);

  // Parse time off: "16/07 eve, 20/07-22/07"
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

  // ── Auto-generate ─────────────────────────────────────
  const autoGenerate = () => {
    const ng = {};

    staff.forEach((s) => {
      // Determine role pattern (FTT5 for London 5-day FTT)
      let roleKey = s.role;
      if (s.role === "FTT" && s.london5day) roleKey = "FTT5";
      const pattern = ROLE_PATTERNS[roleKey];
      if (!pattern) return;

      const tos = parseTimeOff(s.to);
      const isZZ = s.zigzag !== false; // default to ZZ unless set to false

      let fnSessions = 0;
      let fnDay = 0;
      let dayIndex = 0; // for zig-zag alternating
      let dayOffScheduled = false; // track if we've given a day off this fortnight
      let weekendDayWorked = false; // for FTT weekend rotation

      dates.forEach((d) => {
        const ds = dayKey(d);
        if (!inRange(ds, s.arr, s.dep)) return;

        fnDay++;
        if (fnDay > 14) { fnDay = 1; fnSessions = 0; dayOffScheduled = false; weekendDayWorked = false; }

        const we = isWeekend(d);
        const fe = excDays && excDays[ds] === "Full";
        const he = excDays && excDays[ds] === "Half";
        const isFirst = s.arr && ds === dayKey(new Date(s.arr));
        const isLast = s.dep && ds === dayKey(new Date(s.dep));

        // Arrival day
        if (isFirst) {
          ng[s.id+"-"+ds+"-AM"] = null;
          ng[s.id+"-"+ds+"-PM"] = "Airport";
          ng[s.id+"-"+ds+"-Eve"] = "Eve Ents";
          fnSessions += 2;
          dayIndex++;
          return;
        }

        // Departure day
        if (isLast) {
          ng[s.id+"-"+ds+"-AM"] = "Airport";
          fnSessions += 1;
          return;
        }

        // Check time off
        let allOff = true;
        SLOTS.forEach((sl) => {
          if (!isTimeOff(tos, ds, sl)) allOff = false;
        });
        if (allOff) {
          SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-" + sl] = "Day Off"; });
          dayIndex++;
          return;
        }

        // FTT weekend logic: work 1 day, off 1 day
        if (roleKey === "FTT" && we) {
          if (!weekendDayWorked) {
            // Work this weekend day
            const slots = pattern.weekend(dayIndex);
            SLOTS.forEach((sl, si) => {
              const key = s.id+"-"+ds+"-"+sl;
              if (isTimeOff(tos, ds, sl)) { ng[key] = "Day Off"; }
              else if (slots[si]) { ng[key] = slots[si]; fnSessions++; }
            });
            weekendDayWorked = true;
          } else {
            // Day off
            SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          }
          dayIndex++;
          return;
        }

        // Day off scheduling: when approaching limit
        // Need to check remaining work days in fortnight vs remaining sessions
        const sessionsRemaining = pattern.max - fnSessions;
        const daysRemainingInFn = 14 - fnDay;

        // If we've hit the limit, rest of fortnight is off (on non-exc days)
        if (fnSessions >= pattern.max && !we && !fe) {
          SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          dayIndex++;
          return;
        }

        // Get the appropriate pattern for this day
        let slots;
        if (fe) {
          slots = pattern.fullExc(dayIndex);
        } else if (we) {
          slots = pattern.weekend(dayIndex);
        } else {
          slots = pattern.weekday(dayIndex, isZZ, he);
        }

        // Apply
        SLOTS.forEach((sl, si) => {
          const key = s.id+"-"+ds+"-"+sl;
          if (isTimeOff(tos, ds, sl)) { ng[key] = "Day Off"; }
          else if (slots[si]) { ng[key] = slots[si]; fnSessions++; }
        });

        dayIndex++;
      });
    });

    setGrid(ng);
    setFilled(true);
  };

  // ── Click to cycle ────────────────────────────────────
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
      SLOTS.forEach((sl) => {
        const v = grid[sid+"-"+ds+"-"+sl];
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
          Add staff in Team tab (role, dates, time off) then click Auto-Generate. Click any cell to manually adjust afterwards.
        </div>
      )}

      <div style={{ padding: "4px 20px 6px", display: "flex", gap: 3, flexWrap: "wrap" }}>
        {Object.entries(SESSION_TYPES).map(([n, c]) => (
          <span key={n} style={{ background: c+"20", color: c, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{n}</span>
        ))}
        <span style={{ background: "#f59e0b20", color: "#f59e0b", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>Day Off</span>
        <span style={{ fontSize: 9, color: B.textMuted, marginLeft: 4 }}>22 sess/fn: TAL, FTT · 24: SC, EAC, SAI, EAL</span>
      </div>

      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 220px)", padding: "0 4px 16px" }}>
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
            {staff.length === 0 ? (
              <tr><td colSpan={4 + dates.length * 3} style={{ textAlign: "center", padding: 36, color: B.textLight }}>Add staff in Team tab with role + contract dates, then Auto-Generate</td></tr>
            ) : staff.map((s) => {
              const st = getStats(s.id);
              const pat = ROLE_PATTERNS[s.role];
              const maxExpected = pat ? Math.ceil(pat.max * (dates.length / 14)) : 999;
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
      <div style={{ padding: "6px 20px", fontSize: 9, color: B.textMuted }}>Scroll horizontally for full range · Red count = over session limit · Click cells to cycle types</div>
    </div>
  );
}
