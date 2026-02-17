"use client";
import { useState, useMemo } from "react";
import { B, ROLES, SESSION_TYPES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { Fld, TableWrap, thStyle, tdStyle, inputStyle } from "@/components/ui";

export default function RotaTab({ staff, progStart }) {
  const [startDate, setStartDate] = useState(progStart);
  const [grid, setGrid] = useState({});

  const dates = useMemo(() => {
    const end = new Date(new Date(startDate).getTime() + 13 * 86400000);
    return genDates(startDate, end.toISOString().split("T")[0]);
  }, [startDate]);

  const SLOTS = ["AM", "PM", "Eve"];

  const toggle = (staffId, dStr, slot) => {
    const key = `${staffId}-${dStr}-${slot}`;
    const types = Object.keys(SESSION_TYPES);
    setGrid((prev) => {
      const cur = prev[key];
      const idx = cur ? types.indexOf(cur) : -1;
      const next = idx < types.length - 1 ? types[idx + 1] : undefined;
      return { ...prev, [key]: next };
    });
  };

  const sessionCount = (staffId) => {
    let count = 0;
    dates.forEach((d) =>
      SLOTS.forEach((sl) => {
        if (grid[`${staffId}-${dayKey(d)}-${sl}`]) count++;
      })
    );
    return count;
  };

  return (
    <div>
      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Fld label="Fortnight Start">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </Fld>
          <span style={{ fontSize: 11, fontWeight: 700, color: B.navy }}>
            {fmtDate(dates[0])} — {fmtDate(dates[dates.length - 1])}
          </span>
        </div>
        <span style={{ fontSize: 10, color: B.success, fontWeight: 600 }}>✓ {staff.length} staff from Team tab</span>
      </div>

      <div style={{ padding: "4px 20px", display: "flex", gap: 3, flexWrap: "wrap" }}>
        {Object.entries(SESSION_TYPES).map(([name, color]) => (
          <span key={name} style={{ background: color + "20", color, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{name}</span>
        ))}
        <span style={{ fontSize: 9, color: B.textMuted, marginLeft: 4 }}>Click cells to cycle</span>
      </div>

      <div style={{ padding: "0 8px 16px", overflowX: "auto" }}>
        <TableWrap>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 40 }}>Role</th>
                <th style={{ ...thStyle, width: 100 }}>Name</th>
                <th style={{ ...thStyle, width: 28, textAlign: "center" }}>#</th>
                {dates.map((d) => (
                  <th key={dayKey(d)} colSpan={3} style={{ ...thStyle, textAlign: "center", borderLeft: `2px solid ${B.border}`, padding: "4px 0", minWidth: 66 }}>
                    <div style={{ fontWeight: 800, fontSize: 9, color: isWeekend(d) ? B.red : B.navy }}>{dayName(d)}</div>
                    <div style={{ fontSize: 7, color: B.textMuted }}>{d.getDate()}</div>
                  </th>
                ))}
              </tr>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}></th>
                <th style={thStyle}></th>
                {dates.map((d) =>
                  SLOTS.map((sl) => (
                    <th key={`${dayKey(d)}-${sl}`} style={{
                      ...thStyle, textAlign: "center", fontSize: 7, padding: "2px 0",
                      borderLeft: sl === "AM" ? `2px solid ${B.border}` : `1px solid ${B.borderLight}`,
                    }}>{sl}</th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr><td colSpan={100} style={{ textAlign: "center", padding: 36, color: B.textLight }}>Add staff in Team tab — they appear here automatically</td></tr>
              ) : staff.filter((s) => ROLES.includes(s.role)).map((s) => {
                const count = sessionCount(s.id);
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                    <td style={tdStyle}>
                      <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 5px", borderRadius: 3, fontSize: 9, fontWeight: 800 }}>{s.role}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: B.navy, fontSize: 10 }}>{s.name}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, fontSize: 10, color: count > 24 ? B.danger : B.navy }}>{count}</td>
                    {dates.map((d) => {
                      const onSite = inRange(dayKey(d), s.arr, s.dep);
                      return SLOTS.map((sl) => {
                        const key = `${s.id}-${dayKey(d)}-${sl}`;
                        const v = grid[key];
                        const color = v ? SESSION_TYPES[v] : null;
                        return (
                          <td key={key} onClick={() => onSite && toggle(s.id, dayKey(d), sl)} style={{
                            padding: "1px",
                            borderLeft: sl === "AM" ? `2px solid ${B.border}` : `1px solid ${B.borderLight}`,
                            textAlign: "center", cursor: onSite ? "pointer" : "default",
                            minWidth: 22, background: !onSite ? "#f5f5f5" : "transparent",
                          }}>
                            {color ? (
                              <div style={{ background: color + "30", color, borderRadius: 2, fontSize: 7, fontWeight: 800, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {v.slice(0, 3)}
                              </div>
                            ) : onSite ? (
                              <div style={{ height: 22 }} />
                            ) : (
                              <div style={{ height: 22, background: "#eee", borderRadius: 2 }} />
                            )}
                          </td>
                        );
                      });
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </div>
  );
}
