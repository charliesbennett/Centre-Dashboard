"use client";
import { useState, useMemo } from "react";
import { B, SESSION_TYPES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { StatCard, IcWand, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const SLOTS = ["AM", "PM", "Eve"];

function calcRequiredStaff(n) { return n > 0 ? Math.ceil(n / 20) : 0; }

// Determine which lesson slot a group has on a given date
// Week 1 = lessonSlot as set. Week 2 = flipped. Alternates each week.
function getGroupLessonSlot(group, dateStr) {
  if (!group.arr || !group.lessonSlot) return group.lessonSlot || "AM";
  const arrDate = new Date(group.arr);
  const curDate = new Date(dateStr);
  const daysSinceArr = Math.floor((curDate - arrDate) / 86400000);
  const weekNum = Math.floor(daysSinceArr / 7); // 0 = week 1, 1 = week 2, etc.
  return weekNum % 2 === 0 ? group.lessonSlot : (group.lessonSlot === "AM" ? "PM" : "AM");
}

export default function RotaTab({ staff, progStart, progEnd, excDays, groups, rotaGrid, setRotaGrid }) {
  const [filled, setFilled] = useState(false);
  const [showRatios, setShowRatios] = useState(true);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const grid = rotaGrid;
  const setGrid = setRotaGrid;

  const dates = useMemo(() => (progStart && progEnd) ? genDates(progStart, progEnd) : [], [progStart, progEnd]);

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
      if (isWeekend(d)) return; // No lessons on weekends
      let amStudents = 0, pmStudents = 0;
      groups.forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (g.arr && ds === dayKey(new Date(g.arr))) return; // arrival day
        if (g.dep && ds === dayKey(new Date(g.dep))) return;
        const slot = getGroupLessonSlot(g, ds);
        if (slot === "AM") amStudents += g.stu || 0;
        else pmStudents += g.stu || 0;
      });
      demand[ds] = {
        amStudents, pmStudents,
        amTeachersNeeded: Math.ceil(amStudents / 15), // ~15 students per class
        pmTeachersNeeded: Math.ceil(pmStudents / 15),
      };
    });
    return demand;
  }, [groups, dates]);

  // ── Auto-generate ─────────────────────────────────────
  const autoGenerate = () => {
    const ng = {};

    // Separate teachers (TAL, FTT, DRAMA, DANCE) from activity staff
    const teachers = staff.filter((s) => ["TAL", "FTT", "DRAMA", "DANCE"].includes(s.role));
    const activityStaff = staff.filter((s) => ["SAI", "SC", "EAC", "EAL"].includes(s.role));
    const mgmt = staff.filter((s) => ["CM", "CD", "EAM", "SWC"].includes(s.role));

    const allStaffList = [...mgmt, ...teachers, ...activityStaff];

    allStaffList.forEach((s) => {
      const role = s.role;
      const tos = parseTimeOff(s.to);
      const isTeacher = ["TAL", "FTT", "DRAMA", "DANCE"].includes(role);
      const isActivity = ["SAI", "SC", "EAC", "EAL"].includes(role);
      const isMgmt = ["CM", "CD", "EAM", "SWC"].includes(role);

      const onSiteDates = [];
      dates.forEach((d) => {
        const ds = dayKey(d);
        if (inRange(ds, s.arr, s.dep)) onSiteDates.push({ date: d, ds });
      });
      if (!onSiteDates.length) return;

      // Induction & Setup
      const indSet = new Set();
      const setupSet = new Set();
      if (onSiteDates.length >= 1) indSet.add(onSiteDates[0].ds);
      if (onSiteDates.length >= 2) setupSet.add(onSiteDates[1].ds);
      if (groupArrivalDate) {
        for (let i = 2; i < onSiteDates.length; i++) {
          if (onSiteDates[i].ds < groupArrivalDate) setupSet.add(onSiteDates[i].ds);
          else break;
        }
      }

      const progDays = onSiteDates.filter((wd) => !indSet.has(wd.ds) && !setupSet.has(wd.ds));
      const dayOffSet = new Set();
      const weeks = Math.ceil(progDays.length / 7);

      if (role === "FTT") {
        // Saturday off
        let ws = 0;
        for (let w = 0; w < weeks; w++) {
          const wk = progDays.slice(ws, ws + 7);
          const sat = wk.find((wd) => wd.date.getDay() === 6);
          if (sat) dayOffSet.add(sat.ds);
          else if (wk.length) dayOffSet.add(wk[wk.length - 1].ds);
          ws += 7;
        }
      } else if (!isMgmt) {
        // 1 mid-week day off
        let ws = 0;
        const pref = [3, 4, 2, 5, 1];
        for (let w = 0; w < weeks; w++) {
          const wk = progDays.slice(ws, ws + 7);
          let placed = false;
          for (const pd of pref) {
            const m = wk.find((wd) => wd.date.getDay() === pd && !isFullDayOff(tos, wd.ds));
            if (m) { dayOffSet.add(m.ds); placed = true; break; }
          }
          if (!placed && wk.length) {
            const fb = wk.find((wd) => !isFullDayOff(tos, wd.ds));
            if (fb) dayOffSet.add(fb.ds);
          }
          ws += 7;
        }
      }

      let altIdx = 0;

      onSiteDates.forEach((wd) => {
        const { date: d, ds } = wd;
        const we = isWeekend(d);
        const isSat = d.getDay() === 6;
        const isSun = d.getDay() === 0;
        const fe = excDays && excDays[ds] === "Full";
        const he = excDays && excDays[ds] === "Half";
        const isArr = allArrivalDates.has(ds);
        const isLast = s.dep && ds === dayKey(new Date(s.dep));

        const set2 = (a, b, c) => {
          if (a) ng[s.id+"-"+ds+"-AM"] = a;
          if (b) ng[s.id+"-"+ds+"-PM"] = b;
          if (c) ng[s.id+"-"+ds+"-Eve"] = c;
        };

        if (indSet.has(ds)) { set2("Induction", "Induction", null); return; }
        if (setupSet.has(ds)) { set2("Setup", "Setup", null); return; }
        if (isLast) { ng[s.id+"-"+ds+"-AM"] = "Airport"; return; }
        if (isFullDayOff(tos, ds) || dayOffSet.has(ds)) {
          SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          altIdx++; return;
        }

        // Arrival day
        if (isArr) {
          if (role === "FTT") {
            SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          } else {
            set2("Airport", null, "Eve Ents");
          }
          altIdx++; return;
        }

        // ── FTT ──
        if (role === "FTT") {
          if (isSat) {
            SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; });
          } else if (isSun) {
            set2("Lesson Prep", "Floating", null);
          } else {
            // Weekday: Check lesson demand to decide AM or PM teaching
            const dem = lessonDemand[ds];
            // Count how many FTTs/TALs are already assigned to AM vs PM lessons today
            // For now, use the default AM+PM lessons (FTTs teach both slots)
            set2("Lessons", "Lessons", null);
          }
          altIdx++; return;
        }

        // ── Management ──
        if (isMgmt) {
          if (we || fe) {
            set2("Floating", "Floating", null);
          } else {
            set2("Floating", "Floating", null);
          }
          altIdx++; return;
        }

        // ── TAL / DRAMA / DANCE ──
        if (role === "TAL" || role === "DRAMA" || role === "DANCE") {
          if (we || fe) {
            set2("Excursion", "Excursion", null);
          } else if (he) {
            set2("Lessons", "Half Exc", null);
          } else {
            // Weekday: Check which slot needs teachers
            const dem = lessonDemand[ds];
            if (dem && dem.pmTeachersNeeded > 0 && altIdx % 3 === 2) {
              // Some TALs teach PM instead of AM when PM demand exists
              set2(null, "Lessons", "Eve Ents");
            } else if (altIdx % 2 === 0) {
              set2("Lessons", "Activities", null);
            } else {
              set2("Lessons", null, "Eve Ents");
            }
          }
          altIdx++; return;
        }

        // ── Activity Staff (EAL, EAC, SAI, SC) ──
        if (we || fe) {
          set2("Excursion", "Excursion", null);
        } else if (he) {
          set2("Activities", "Half Exc", null);
        } else {
          if (altIdx % 2 === 0) {
            set2("Activities", "Activities", null);
          } else {
            set2(null, "Activities", "Eve Ents");
          }
        }
        altIdx++;
      });
    });

    // Evening coverage sweep
    dates.forEach((d) => {
      const ds = dayKey(d);
      if (!groupArrivalDate || ds < groupArrivalDate) return;
      let eveCount = 0;
      staff.forEach((s) => {
        const v = ng[s.id+"-"+ds+"-Eve"];
        if (v && v !== "Day Off") eveCount++;
      });
      if (eveCount === 0) {
        for (const s of staff) {
          if (!inRange(ds, s.arr, s.dep)) continue;
          if (s.role === "FTT") continue;
          const am = ng[s.id+"-"+ds+"-AM"];
          const pm = ng[s.id+"-"+ds+"-PM"];
          const eve = ng[s.id+"-"+ds+"-Eve"];
          if (am === "Day Off" || am === "Induction" || am === "Setup") continue;
          if (am && pm && !eve && am !== "Excursion") {
            ng[s.id+"-"+ds+"-PM"] = undefined;
            ng[s.id+"-"+ds+"-Eve"] = "Eve Ents";
            break;
          }
        }
      }
    });

    setGrid(ng);
    setFilled(true);
  };

  // ── Double-click to edit ──────────────────────────────
  const startEdit = (key, val) => { setEditingCell(key); setEditValue(val || ""); };
  const commitEdit = () => {
    if (editingCell) {
      setGrid((prev) => ({ ...prev, [editingCell]: editValue || undefined }));
      setEditingCell(null);
    }
  };

  // Single click to cycle type
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
        if (v === "Day Off") { /* counted below */ }
        else if (v && v !== "Induction" && v !== "Setup") sess++;
      });
      const a = grid[sid+"-"+ds+"-AM"], b = grid[sid+"-"+ds+"-PM"], c = grid[sid+"-"+ds+"-Eve"];
      if (a === "Day Off" && b === "Day Off" && c === "Day Off") offs++;
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
    if (!filled || !groups || !groups.length) return [];
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
  }, [grid, ratioData, filled, dates, groups]);

  // Classify cell colour (match known types or use default)
  const cellColor = (v) => {
    if (!v) return null;
    if (v === "Day Off") return "#f59e0b";
    if (SESSION_TYPES[v]) return SESSION_TYPES[v];
    // Custom text: try to match by first word
    const first = v.split(" ")[0].toLowerCase();
    if (first.includes("lesson")) return SESSION_TYPES["Lessons"];
    if (first.includes("exc")) return SESSION_TYPES["Excursion"];
    if (first.includes("act")) return SESSION_TYPES["Activities"];
    if (first.includes("eve") || first.includes("disco") || first.includes("bbq") || first.includes("quiz") || first.includes("karaoke") || first.includes("talent")) return SESSION_TYPES["Eve Ents"];
    return "#6b7280"; // default gray for custom text
  };

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

      {/* Lesson demand summary */}
      {filled && groups && groups.length > 0 && (
        <div style={{ margin: "0 20px 4px", padding: "6px 14px", background: "#e0f2fe", borderRadius: 8, fontSize: 10, color: "#0369a1", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700 }}>{"\ud83d\udcda"} Lesson slots (Week 1):</span>
          {groups.map((g) => (
            <span key={g.id}>
              <strong>{g.group}</strong>: {g.lessonSlot || "AM"} ({g.stu} stu)
            </span>
          ))}
          <span style={{ color: "#64748b" }}>· Set in Students tab · Auto-flips each week</span>
        </div>
      )}

      {showRatios && filled && (
        <div style={{ margin: "0 20px 8px" }}>
          {groups && groups.length > 0 ? (
            ratioAlerts.length > 0 ? (
              <div style={{ background: B.dangerBg, border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontWeight: 800, fontSize: 11, color: B.danger, marginBottom: 6 }}>{"\u26a0\ufe0f"} Staffing Shortfalls ({ratioAlerts.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {ratioAlerts.slice(0, 8).map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10, color: "#991b1b" }}>
                      <span style={{ fontWeight: 800, minWidth: 55 }}>{fmtDate(a.date)}</span>
                      <span style={{ background: "#fee2e2", padding: "1px 6px", borderRadius: 3, fontWeight: 700, fontSize: 9 }}>{a.slot}</span>
                      <span>{a.students} stu need {a.required} — have {a.staffWorking} staff + {a.gls} GLs = {a.total}</span>
                      <span style={{ fontWeight: 800 }}>Need {a.shortfall} more</span>
                    </div>
                  ))}
                  {ratioAlerts.length > 8 && <div style={{ fontSize: 9 }}>...and {ratioAlerts.length - 8} more</div>}
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

      <div style={{ padding: "4px 20px 6px", display: "flex", gap: 3, flexWrap: "wrap" }}>
        {Object.entries(SESSION_TYPES).map(([n, c]) => (
          <span key={n} style={{ background: c+"20", color: c, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{n}</span>
        ))}
        <span style={{ background: "#f59e0b20", color: "#f59e0b", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>Day Off</span>
        <span style={{ fontSize: 9, color: B.textMuted, marginLeft: 4 }}>Click = cycle type · Double-click = edit text</span>
      </div>

      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 280px)", padding: "0 4px 16px" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: tableMinWidth, background: B.white, borderRadius: 10, border: "1px solid "+B.border }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 42, position: "sticky", left: 0, zIndex: 3, background: "#f8fafc" }}>Role</th>
              <th style={{ ...thStyle, width: 105, position: "sticky", left: 42, zIndex: 3, background: "#f8fafc" }}>Name</th>
              <th style={{ ...thStyle, width: 28, textAlign: "center", position: "sticky", left: 147, zIndex: 3, background: "#f8fafc", fontSize: 7 }}>Sess</th>
              <th style={{ ...thStyle, width: 24, textAlign: "center", position: "sticky", left: 175, zIndex: 3, background: "#f8fafc", fontSize: 7 }}>Off</th>
              {dates.map((d) => {
                const we = isWeekend(d); const ds = dayKey(d); const exc = excDays && excDays[ds];
                const isArr = allArrivalDates.has(ds);
                return (
                  <th key={ds} colSpan={3} style={{ ...thStyle, textAlign: "center", borderLeft: "2px solid "+B.border, padding: "3px 0", minWidth: 66, background: isArr ? "#dcfce7" : exc ? "#fff7ed" : we ? "#fef2f2" : "#f8fafc" }}>
                    <div style={{ fontSize: 7, color: B.textMuted }}>{fmtDate(d)}</div>
                    <div style={{ fontWeight: 800, fontSize: 8, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                    {exc && <div style={{ fontSize: 6, color: "#ea580c", fontWeight: 800 }}>{exc === "Full" ? "FD" : "HD"}</div>}
                    {isArr && <div style={{ fontSize: 5, color: B.success, fontWeight: 800 }}>ARRIVE</div>}
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
                    const tot = sw + rd.gls;
                    const ok = tot >= rd.required;
                    return (
                      <td key={ds+"-"+sl} style={{ padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, textAlign: "center", background: ok ? "#f0fdf4" : "#fee2e2" }}>
                        <div style={{ fontSize: 7, fontWeight: 800, color: ok ? B.success : B.danger, lineHeight: 1 }}>{tot}/{rd.required}</div>
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
              const lim = ["TAL","FTT","DRAMA","DANCE"].includes(s.role) ? 22 : ["SC","EAC","SAI","EAL"].includes(s.role) ? 24 : 34;
              const wks = Math.max(1, Math.floor(dates.length / 7));
              const maxTotal = Math.ceil(lim * (wks / 2));
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
                      const col = cellColor(v);
                      const isEd = editingCell === key;
                      return (
                        <td key={key}
                          onClick={() => on && !isEd && cycleCell(s.id, ds, sl)}
                          onDoubleClick={(e) => { e.preventDefault(); if (on) startEdit(key, v); }}
                          style={{
                            padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight,
                            textAlign: "center", cursor: on ? "pointer" : "default",
                            minWidth: 22, background: !on ? "#f5f5f5" : off ? "#f59e0b10" : "transparent",
                          }}>
                          {isEd ? (
                            <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                              style={{ width: "100%", fontSize: 7, padding: "2px", border: "1px solid "+B.navy, borderRadius: 2, fontFamily: "inherit" }} />
                          ) : col ? (
                            <div style={{ background: col+"30", color: col, borderRadius: 2, fontSize: 6, fontWeight: 800, height: 22, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", textOverflow: "ellipsis" }} title={v}>
                              {off ? "OFF" : (v || "").length > 4 ? (v || "").slice(0, 4) : v}
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
      <div style={{ padding: "6px 20px", fontSize: 9, color: B.textMuted }}>Click = cycle type · Double-click = type custom text (e.g. "Disco Night") · FTT: Sat off, Sun Prep · 1 day off/wk</div>
    </div>
  );
}
