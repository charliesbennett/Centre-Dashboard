"use client";
import { useState } from "react";
import { B, dayKey, dayName, isWeekend, fmtDate } from "@/lib/constants";
import { TableWrap, btnNavy, thStyle, tdStyle } from "@/components/ui";

const GROUP_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ea580c", "#16a34a",
  "#0891b2", "#d97706", "#dc2626", "#7c3aed", "#0369a1",
];

function inBed(dateStr, arrDate, depDate) {
  if (!arrDate || !depDate) return false;
  const dt = new Date(dateStr);
  const a = new Date(arrDate);
  const b = new Date(depDate);
  return dt >= a && dt < b;
}

export default function RoomingOverviewView({
  dates,
  activeGroups,
  bedsData,
  autoBedsData,
  dailyTotals,
  totalBeds,
  bedsGridRows,
  bedsGridTotals,
  roomingRooms,
  roomingOverrides,
  setRoomingOverrides,
  readOnly,
  onPrintBedsGrid,
  onPrintOverview,
}) {
  const [overviewSub, setOverviewSub] = useState("beds");
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");

  const overrideCount = Object.keys(roomingOverrides).length;

  const startCellEdit = (groupId, dateStr) => {
    const key = groupId + "-" + dateStr;
    setEditingCell(key);
    setEditValue(String(bedsData[groupId]?.[dateStr] || 0));
  };

  const commitCellEdit = () => {
    if (!editingCell) return;
    const parts = editingCell.match(/^(.+)-(\d{4}-\d{2}-\d{2})$/);
    if (!parts) { setEditingCell(null); return; }
    const gid = parts[1], ds = parts[2];
    const num = parseInt(editValue);
    const auto = autoBedsData[gid]?.[ds] || 0;
    const newOverrides = { ...roomingOverrides };
    if (isNaN(num) || num === auto) {
      delete newOverrides[editingCell];
    } else {
      newOverrides[editingCell] = num;
    }
    setRoomingOverrides(newOverrides);
    setEditingCell(null);
  };

  return (
    <div style={{ padding: "0 8px 16px", overflowX: "auto", maxWidth: "100vw" }}>
      {/* Sub-view switcher */}
      <div style={{ padding: "0 4px 8px", display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        {[
          { id: "beds", label: "\ud83d\udecf\ufe0f Heads on Beds" },
          { id: "summary", label: "\ud83d\udcca Group Summary" },
        ].map((sv) => (
          <button key={sv.id} onClick={() => setOverviewSub(sv.id)} style={{
            padding: "4px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700,
            fontFamily: "inherit", cursor: "pointer",
            border: "1px solid " + (overviewSub === sv.id ? B.navy : B.border),
            background: overviewSub === sv.id ? B.navy : B.white,
            color: overviewSub === sv.id ? B.white : B.textMuted,
          }}>{sv.label}</button>
        ))}
        {overviewSub === "beds" && (
          <button onClick={onPrintBedsGrid} style={{ ...btnNavy, fontSize: 9, padding: "3px 10px", marginLeft: "auto" }}>
            {"\ud83d\udda8\ufe0f"} Print Grid
          </button>
        )}
        {overviewSub === "summary" && (
          <>
            {overrideCount > 0 && (
              <>
                <span style={{ fontSize: 9, color: "#ea580c", fontWeight: 700 }}>{overrideCount} override{overrideCount !== 1 ? "s" : ""}</span>
                {!readOnly && <button onClick={() => setRoomingOverrides({})} style={{
                  fontSize: 9, color: B.textMuted, background: "transparent",
                  border: "1px solid " + B.border, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit",
                }}>Reset All</button>}
              </>
            )}
            <button onClick={onPrintOverview} style={{ ...btnNavy, fontSize: 9, padding: "3px 10px", marginLeft: "auto" }}>
              {"\ud83d\udda8\ufe0f"} Print Grid
            </button>
          </>
        )}
      </div>

      {/* ── BEDS GRID (Excel-style heads on beds) ─────── */}
      {overviewSub === "beds" && (
        bedsGridRows.length === 0 ? (
          <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, padding: 40, textAlign: "center", color: B.textLight }}>
            Set up houses and rooms in the <strong>Houses</strong> tab first
          </div>
        ) : (
          <>
            {/* Group colour legend */}
            <div style={{ padding: "0 4px 8px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Groups:</span>
              {activeGroups.map((g, i) => (
                <span key={g.id} style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] + "22", color: GROUP_COLORS[i % GROUP_COLORS.length], padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                  {g.group}
                </span>
              ))}
              <span style={{ fontSize: 9, color: B.textMuted, marginLeft: 4 }}>· empty cell = available bed</span>
            </div>
            <TableWrap>
              <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: Math.max(400, dates.length * 110 + 180), width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, position: "sticky", left: 0, zIndex: 3, background: "#f8fafc", minWidth: 90, textAlign: "left" }}>House</th>
                    <th style={{ ...thStyle, position: "sticky", left: 90, zIndex: 3, background: "#f8fafc", minWidth: 60, textAlign: "left" }}>Room</th>
                    <th style={{ ...thStyle, position: "sticky", left: 150, zIndex: 3, background: "#f8fafc", width: 28, textAlign: "center" }}>#</th>
                    {dates.map((d) => {
                      const we = isWeekend(d);
                      return (
                        <th key={dayKey(d)} style={{ ...thStyle, textAlign: "center", minWidth: 110, background: we ? "#fef2f2" : "#f8fafc" }}>
                          <div style={{ fontWeight: 800, fontSize: 8, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                          <div style={{ fontSize: 7, color: B.textMuted }}>{d.getDate()}/{d.getMonth() + 1}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {bedsGridRows.map((row) => {
                    if (row.type === "houseDivider") {
                      const hRooms = roomingRooms.filter((r) => r.houseId === row.house.id);
                      const hBeds = hRooms.reduce((s, r) => s + (r.capacity || 0), 0);
                      return (
                        <tr key={"house-" + row.house.id} style={{ background: B.navy }}>
                          <td colSpan={3 + dates.length} style={{ padding: "5px 10px", color: B.white, fontWeight: 800, fontSize: 11, position: "sticky", left: 0 }}>
                            {row.house.name}
                            <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(255,255,255,0.6)", marginLeft: 10 }}>
                              {hRooms.length} room{hRooms.length !== 1 ? "s" : ""} · {hBeds} bed{hBeds !== 1 ? "s" : ""}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                    const { house, room, slot, assignment, group } = row;
                    const gc = group ? GROUP_COLORS[activeGroups.indexOf(group) % GROUP_COLORS.length] : null;
                    const occupantName = assignment?.occupantName || "";
                    const houseRoomsForBg = roomingRooms.filter((r) => r.houseId === house.id);
                    const roomIdxForBg = houseRoomsForBg.findIndex((r) => r.id === room.id);
                    const rowBg = roomIdxForBg % 2 === 0 ? B.white : "#f8fafc";
                    return (
                      <tr key={room.id + "-" + slot} style={{ borderBottom: "1px solid " + B.borderLight }}>
                        <td style={{ padding: "4px 8px", position: "sticky", left: 0, zIndex: 1, background: rowBg, fontSize: 9, color: B.textMuted, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>
                          {house.name}
                        </td>
                        <td style={{ padding: "4px 8px", position: "sticky", left: 90, zIndex: 1, background: rowBg, fontWeight: 700, fontSize: 10, color: B.navy, whiteSpace: "nowrap" }}>
                          {room.roomName}
                        </td>
                        <td style={{ padding: "4px 4px", position: "sticky", left: 150, zIndex: 1, background: rowBg, textAlign: "center", fontSize: 9, color: B.textMuted }}>
                          {slot + 1}
                        </td>
                        {dates.map((d) => {
                          const ds = dayKey(d);
                          const onSite = group ? inBed(ds, group.arr, group.dep) : false;
                          return (
                            <td key={ds} style={{
                              padding: "3px 5px",
                              textAlign: "left",
                              borderLeft: "1px solid " + B.borderLight,
                              background: onSite ? gc + "18" : "transparent",
                              maxWidth: 110,
                            }}>
                              {onSite ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: gc, flexShrink: 0 }} />
                                  <span style={{ fontWeight: 600, fontSize: 9, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {occupantName || group.group.slice(0, 16)}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: B.borderLight, fontSize: 8 }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Totals footer */}
                  <tr style={{ background: B.navy }}>
                    <td colSpan={3} style={{ padding: "5px 10px", fontWeight: 800, color: B.white, fontSize: 10, position: "sticky", left: 0, zIndex: 1, background: B.navy }}>OCCUPIED</td>
                    {dates.map((d) => {
                      const ds = dayKey(d);
                      const t = bedsGridTotals[ds];
                      return (
                        <td key={ds} style={{ textAlign: "center", padding: "5px 1px", fontWeight: 800, color: B.white, fontSize: 10, borderLeft: "1px solid rgba(255,255,255,0.15)" }}>
                          {t ? (t.occupied || "\u2014") : "\u2014"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr style={{ background: "#f0fdf4" }}>
                    <td colSpan={3} style={{ padding: "5px 10px", fontWeight: 700, color: B.success, fontSize: 9, position: "sticky", left: 0, zIndex: 1, background: "#f0fdf4" }}>AVAILABLE</td>
                    {dates.map((d) => {
                      const ds = dayKey(d);
                      const t = bedsGridTotals[ds];
                      const avail = t ? t.available : 0;
                      return (
                        <td key={ds} style={{
                          textAlign: "center", padding: "4px 1px", fontSize: 9, fontWeight: 700,
                          color: avail > 0 ? B.success : avail === 0 ? B.warning : B.danger,
                          borderLeft: "1px solid #bbf7d0",
                        }}>
                          {avail > 0 ? "+" + avail : avail === 0 ? "Full" : avail}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </TableWrap>
          </>
        )
      )}

      {/* ── GROUP SUMMARY (original overview) ─────────── */}
      {overviewSub === "summary" && (
        <>
          <div style={{ padding: "0 4px 4px" }}>
            <span style={{ fontSize: 9, color: B.textMuted, fontWeight: 600 }}>
              Heads on beds per night (arrival inclusive, departure exclusive). Click to override.
            </span>
          </div>
          <TableWrap>
            <table style={{ minWidth: Math.max(600, dates.length * 38 + 160), width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 160, position: "sticky", left: 0, zIndex: 2, background: "#f8fafc" }}>Group</th>
                  {dates.map((d) => {
                    const s = dayKey(d);
                    const we = isWeekend(d);
                    return (
                      <th key={s} style={{ ...thStyle, textAlign: "center", minWidth: 36, background: we ? "#fef2f2" : "#f8fafc" }}>
                        <div style={{ fontWeight: 800, fontSize: 8, color: we ? B.red : B.navy }}>{dayName(d)}</div>
                        <div style={{ fontSize: 7, color: B.textMuted }}>{d.getDate()}/{d.getMonth() + 1}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {activeGroups.length === 0 ? (
                  <tr>
                    <td colSpan={dates.length + 1} style={{ textAlign: "center", padding: 36, color: B.textLight }}>
                      No groups — add groups in the Students tab
                    </td>
                  </tr>
                ) : activeGroups.map((g, gi) => (
                  <tr key={g.id} style={{ borderBottom: "1px solid " + B.borderLight }}>
                    <td style={{ padding: "5px 8px", position: "sticky", left: 0, background: B.white, zIndex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 10, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{g.group}</div>
                      <div style={{ fontSize: 8, color: B.textMuted }}>{(g.stu || 0) + (g.gl || 0)} pax · {fmtDate(g.arr)} {"\u2192"} {fmtDate(g.dep)}</div>
                    </td>
                    {dates.map((d) => {
                      const ds = dayKey(d);
                      const cellKey = g.id + "-" + ds;
                      const v = bedsData[g.id]?.[ds] || 0;
                      const isOverridden = roomingOverrides[cellKey] !== undefined;
                      const isEd = editingCell === cellKey;
                      return (
                        <td key={ds} onClick={() => !readOnly && !isEd && startCellEdit(g.id, ds)} style={{
                          textAlign: "center", padding: "4px 1px", cursor: "pointer",
                          borderLeft: "1px solid " + B.borderLight,
                          fontWeight: v ? 800 : 400,
                          color: v ? (isOverridden ? "#ea580c" : B.navy) : B.textLight,
                          fontSize: v ? 11 : 9,
                          background: isOverridden ? "#fff7ed" : v ? GROUP_COLORS[gi % GROUP_COLORS.length] + "18" : "transparent",
                        }}>
                          {isEd ? (
                            <input autoFocus value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitCellEdit}
                              onKeyDown={(e) => e.key === "Enter" && commitCellEdit()}
                              style={{ width: 32, fontSize: 10, textAlign: "center", border: "1px solid " + B.navy, borderRadius: 2, padding: 2, fontFamily: "inherit" }} />
                          ) : v || "\u2014"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr style={{ background: B.navy }}>
                  <td style={{ padding: "6px 8px", fontWeight: 800, color: B.white, fontSize: 10, position: "sticky", left: 0, zIndex: 1, background: B.navy }}>TOTAL BEDS</td>
                  {dates.map((d) => {
                    const ds = dayKey(d);
                    const tot = dailyTotals[ds] || 0;
                    return (
                      <td key={ds} style={{ textAlign: "center", padding: "5px 1px", fontWeight: 800, color: B.white, fontSize: 10, borderLeft: "1px solid rgba(255,255,255,0.15)" }}>
                        {tot || "\u2014"}
                      </td>
                    );
                  })}
                </tr>
                {totalBeds > 0 && (
                  <tr style={{ background: "#f0fdf4" }}>
                    <td style={{ padding: "5px 8px", fontWeight: 700, color: B.success, fontSize: 9, position: "sticky", left: 0, zIndex: 1, background: "#f0fdf4" }}>CAPACITY SPARE</td>
                    {dates.map((d) => {
                      const ds = dayKey(d);
                      const spare = totalBeds - (dailyTotals[ds] || 0);
                      return (
                        <td key={ds} style={{
                          textAlign: "center", padding: "4px 1px", fontSize: 9, fontWeight: 700,
                          color: spare < 0 ? B.danger : spare === 0 ? B.warning : B.success,
                          borderLeft: "1px solid #bbf7d0",
                        }}>
                          {spare > 0 ? "+" + spare : spare === 0 ? "=" : spare}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </>
      )}
    </div>
  );
}
