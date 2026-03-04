"use client";
import { useState, useMemo, useCallback, useRef } from "react";
import { B, uid, genDates, dayKey, dayName, isWeekend, fmtDate } from "@/lib/constants";
import { StatCard, Fld, TableWrap, IconBtn, IcPlus, IcTrash, IcEdit, IcCheck, inputStyle, thStyle, tdStyle, btnPrimary, btnNavy } from "@/components/ui";

// ── Helpers ────────────────────────────────────────────────
// Is date in [arr, dep)? (on beds night X means arr <= X < dep)
function inBed(dateStr, arrDate, depDate) {
  if (!arrDate || !depDate) return false;
  const dt = new Date(dateStr);
  const a = new Date(arrDate);
  const b = new Date(depDate);
  return dt >= a && dt < b;
}

const GROUP_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ea580c", "#16a34a",
  "#0891b2", "#d97706", "#dc2626", "#7c3aed", "#0369a1",
];

// ──────────────────────────────────────────────────────────
export default function RoomingTab({
  groups = [], progStart, progEnd,
  roomingHouses = [], setRoomingHouses,
  roomingRooms = [], setRoomingRooms,
  roomingAssignments = [], setRoomingAssignments,
  roomingOverrides = {}, setRoomingOverrides,
}) {
  const [view, setView] = useState("overview"); // "overview" | "houses"
  const dates = useMemo(() => genDates(progStart, progEnd), [progStart, progEnd]);
  const activeGroups = groups.filter((g) => !g.archived);

  // ── OVERVIEW ────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");

  // Auto-calculate heads on beds per group per night
  const autoBedsData = useMemo(() => {
    const data = {};
    activeGroups.forEach((g) => {
      data[g.id] = {};
      dates.forEach((d) => {
        const s = dayKey(d);
        data[g.id][s] = inBed(s, g.arr, g.dep) ? (g.stu || 0) + (g.gl || 0) : 0;
      });
    });
    return data;
  }, [activeGroups, dates]);

  // Merged = auto + overrides
  const bedsData = useMemo(() => {
    const data = {};
    activeGroups.forEach((g) => {
      data[g.id] = {};
      dates.forEach((d) => {
        const s = dayKey(d);
        const key = g.id + "-" + s;
        data[g.id][s] = roomingOverrides[key] !== undefined
          ? roomingOverrides[key]
          : (autoBedsData[g.id]?.[s] || 0);
      });
    });
    return data;
  }, [autoBedsData, roomingOverrides, activeGroups, dates]);

  const dailyTotals = useMemo(() => {
    const totals = {};
    dates.forEach((d) => {
      const s = dayKey(d);
      totals[s] = activeGroups.reduce((sum, g) => sum + (bedsData[g.id]?.[s] || 0), 0);
    });
    return totals;
  }, [bedsData, activeGroups, dates]);

  const overrideCount = Object.keys(roomingOverrides).length;

  const startCellEdit = (groupId, dateStr) => {
    const key = groupId + "-" + dateStr;
    setEditingCell(key);
    setEditValue(String(bedsData[groupId]?.[dateStr] || 0));
  };

  const commitCellEdit = () => {
    if (!editingCell) return;
    const [groupId, dateStr] = editingCell.split(/-(\d{4}-\d{2}-\d{2})$/).filter(Boolean);
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

  // ── HOUSES ──────────────────────────────────────────────
  const [houseView, setHouseView] = useState("setup"); // "setup" | "assign"
  const [showAddHouse, setShowAddHouse] = useState(false);
  const [newHouseName, setNewHouseName] = useState("");
  const [editingHouseId, setEditingHouseId] = useState(null);
  const [editingHouseName, setEditingHouseName] = useState("");
  const [expandedHouse, setExpandedHouse] = useState(null);
  const [showAddRoom, setShowAddRoom] = useState(null); // houseId
  const [newRoom, setNewRoom] = useState({ floorLabel: "", roomName: "", capacity: 2 });
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoom, setEditingRoom] = useState({});
  const [assignDate, setAssignDate] = useState(progStart || "");
  const saveTimer = useRef(null);

  const totalBeds = useMemo(() => roomingRooms.reduce((s, r) => s + (r.capacity || 0), 0), [roomingRooms]);
  const occupiedBeds = useMemo(() => roomingAssignments.filter((a) => a.occupantName).length, [roomingAssignments]);

  // Group colour map
  const groupColorMap = useMemo(() => {
    const map = {};
    activeGroups.forEach((g, i) => { map[g.id] = GROUP_COLORS[i % GROUP_COLORS.length]; });
    return map;
  }, [activeGroups]);

  // ── House actions ──────────────────────────────────────
  const addHouse = () => {
    if (!newHouseName.trim()) return;
    const house = { id: uid(), name: newHouseName.trim(), sortOrder: roomingHouses.length };
    setRoomingHouses((p) => [...p, house]);
    setNewHouseName("");
    setShowAddHouse(false);
  };

  const updateHouseName = (id) => {
    setRoomingHouses((p) => p.map((h) => h.id === id ? { ...h, name: editingHouseName } : h));
    setEditingHouseId(null);
  };

  const deleteHouse = (id) => {
    setRoomingHouses((p) => p.filter((h) => h.id !== id));
    // Remove rooms and assignments for this house
    const roomIds = roomingRooms.filter((r) => r.houseId === id).map((r) => r.id);
    setRoomingRooms((p) => p.filter((r) => r.houseId !== id));
    setRoomingAssignments((p) => p.filter((a) => !roomIds.includes(a.roomId)));
  };

  // ── Room actions ───────────────────────────────────────
  const addRoom = (houseId) => {
    if (!newRoom.roomName.trim()) return;
    const room = {
      id: uid(), houseId,
      floorLabel: newRoom.floorLabel.trim(),
      roomName: newRoom.roomName.trim(),
      capacity: parseInt(newRoom.capacity) || 2,
      sortOrder: roomingRooms.filter((r) => r.houseId === houseId).length,
    };
    setRoomingRooms((p) => [...p, room]);
    setNewRoom({ floorLabel: "", roomName: "", capacity: 2 });
    setShowAddRoom(null);
  };

  const updateRoom = (id) => {
    setRoomingRooms((p) => p.map((r) => r.id === id ? { ...r, ...editingRoom, capacity: parseInt(editingRoom.capacity) || r.capacity } : r));
    // If capacity reduced, trim assignments
    const updatedRoom = roomingRooms.find((r) => r.id === id);
    const newCap = parseInt(editingRoom.capacity) || updatedRoom?.capacity || 2;
    setRoomingAssignments((p) => p.filter((a) => a.roomId !== id || a.slotIndex < newCap));
    setEditingRoomId(null);
  };

  const deleteRoom = (id) => {
    setRoomingRooms((p) => p.filter((r) => r.id !== id));
    setRoomingAssignments((p) => p.filter((a) => a.roomId !== id));
  };

  // ── Assignment actions ─────────────────────────────────
  const getAssignment = (roomId, slotIndex) =>
    roomingAssignments.find((a) => a.roomId === roomId && a.slotIndex === slotIndex);

  const setSlot = useCallback((roomId, slotIndex, updates) => {
    setRoomingAssignments((p) => {
      const existing = p.find((a) => a.roomId === roomId && a.slotIndex === slotIndex);
      if (existing) {
        return p.map((a) =>
          a.roomId === roomId && a.slotIndex === slotIndex ? { ...a, ...updates } : a
        );
      } else {
        return [...p, { id: uid(), roomId, slotIndex, occupantName: "", groupId: "", occupantType: "student", notes: "", ...updates }];
      }
    });
  }, []);

  const clearSlot = useCallback((roomId, slotIndex) => {
    setRoomingAssignments((p) =>
      p.filter((a) => !(a.roomId === roomId && a.slotIndex === slotIndex))
    );
  }, []);

  // ── Render ─────────────────────────────────────────────
  const totalStu = activeGroups.reduce((s, g) => s + (g.stu || 0), 0);
  const totalGL = activeGroups.reduce((s, g) => s + (g.gl || 0), 0);
  const maxNight = dates.length > 0 ? Math.max(...dates.map((d) => dailyTotals[dayKey(d)] || 0)) : 0;

  return (
    <div>
      {/* Header stats + view switcher */}
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatCard label="Groups" value={activeGroups.length} accent={B.navy} />
        <StatCard label="Students" value={totalStu} accent={B.red} />
        <StatCard label="GLs" value={totalGL} accent="#7c3aed" />
        <StatCard label="Peak Night" value={maxNight} accent="#ea580c" />
        <StatCard label="Houses" value={roomingHouses.length} accent="#16a34a" />
        <StatCard label="Beds" value={totalBeds} accent="#0891b2" />
        {totalBeds > 0 && <StatCard label="Assigned" value={occupiedBeds} accent="#d97706" />}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["overview", "houses"].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "5px 14px", borderRadius: 5, fontSize: 10, fontWeight: 700,
              fontFamily: "inherit", cursor: "pointer",
              border: "1px solid " + (view === v ? B.navy : B.border),
              background: view === v ? B.navy : B.white,
              color: view === v ? B.white : B.textMuted,
            }}>
              {v === "overview" ? "\ud83d\udcca Overview" : "\ud83c\udfe0 Houses"}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW VIEW ───────────────────────────────── */}
      {view === "overview" && (
        <div style={{ padding: "0 8px 16px", overflowX: "auto", maxWidth: "100vw" }}>
          <div style={{ padding: "0 4px 6px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: B.textMuted, fontWeight: 600 }}>
              Heads on beds per night (arrival night included, departure night excluded). Click to override.
            </span>
            {overrideCount > 0 && (
              <>
                <span style={{ fontSize: 9, color: "#ea580c", fontWeight: 700 }}>{overrideCount} manual override{overrideCount !== 1 ? "s" : ""}</span>
                <button onClick={() => setRoomingOverrides({})} style={{
                  fontSize: 9, color: B.textMuted, background: "transparent",
                  border: "1px solid " + B.border, borderRadius: 4,
                  padding: "2px 8px", cursor: "pointer", fontFamily: "inherit",
                }}>Reset All</button>
              </>
            )}
          </div>
          <TableWrap>
            <table style={{ minWidth: Math.max(600, dates.length * 38 + 160), borderCollapse: "collapse", fontSize: 10 }}>
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
                        <td key={ds} onClick={() => !isEd && startCellEdit(g.id, ds)}
                          style={{
                            textAlign: "center", padding: "4px 1px", cursor: "pointer",
                            borderLeft: "1px solid " + B.borderLight,
                            fontWeight: v ? 800 : 400,
                            color: v ? (isOverridden ? "#ea580c" : B.navy) : B.textLight,
                            fontSize: v ? 11 : 9,
                            background: isOverridden ? "#fff7ed" : v
                              ? GROUP_COLORS[gi % GROUP_COLORS.length] + "18"
                              : "transparent",
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

                {/* Daily totals row */}
                <tr style={{ background: B.navy, borderTop: "2px solid " + B.navy }}>
                  <td style={{ padding: "6px 8px", fontWeight: 800, color: B.white, fontSize: 10, position: "sticky", left: 0, zIndex: 1, background: B.navy }}>
                    TOTAL BEDS
                  </td>
                  {dates.map((d) => {
                    const ds = dayKey(d);
                    const tot = dailyTotals[ds] || 0;
                    return (
                      <td key={ds} style={{
                        textAlign: "center", padding: "5px 1px", fontWeight: 800,
                        color: B.white, fontSize: 10, borderLeft: "1px solid rgba(255,255,255,0.15)",
                      }}>
                        {tot || "\u2014"}
                      </td>
                    );
                  })}
                </tr>

                {/* Houses capacity row */}
                {totalBeds > 0 && (
                  <tr style={{ background: "#f0fdf4", borderTop: "1px solid #86efac" }}>
                    <td style={{ padding: "5px 8px", fontWeight: 700, color: B.success, fontSize: 9, position: "sticky", left: 0, zIndex: 1, background: "#f0fdf4" }}>
                      HOUSE CAPACITY
                    </td>
                    {dates.map((d) => {
                      const ds = dayKey(d);
                      const tot = dailyTotals[ds] || 0;
                      const spare = totalBeds - tot;
                      return (
                        <td key={ds} style={{
                          textAlign: "center", padding: "4px 1px",
                          fontSize: 9, fontWeight: 700,
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
        </div>
      )}

      {/* ── HOUSES VIEW ─────────────────────────────────── */}
      {view === "houses" && (
        <div style={{ padding: "0 8px 16px" }}>
          {/* Sub-view switcher */}
          <div style={{ padding: "0 4px 8px", display: "flex", gap: 4, alignItems: "center" }}>
            {["setup", "assign"].map((sv) => (
              <button key={sv} onClick={() => setHouseView(sv)} style={{
                padding: "4px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                fontFamily: "inherit", cursor: "pointer",
                border: "1px solid " + (houseView === sv ? B.red : B.border),
                background: houseView === sv ? B.red : B.white,
                color: houseView === sv ? B.white : B.textMuted,
              }}>
                {sv === "setup" ? "\u2699\ufe0f Setup Houses & Rooms" : "\ud83d\udecf\ufe0f Assign Students"}
              </button>
            ))}
          </div>

          {/* ── SETUP SUB-VIEW ──────────────────────────── */}
          {houseView === "setup" && (
            <div>
              <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "10px 10px 0 0", border: "1px solid " + B.border, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: B.textMuted }}>
                  {roomingHouses.length} house{roomingHouses.length !== 1 ? "s" : ""} · {roomingRooms.length} rooms · {totalBeds} beds total
                </span>
                <button onClick={() => setShowAddHouse(true)} style={btnPrimary}><IcPlus /> Add House</button>
              </div>

              {showAddHouse && (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderTop: "none", padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <Fld label="House Name">
                    <input value={newHouseName} onChange={(e) => setNewHouseName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addHouse()}
                      placeholder="e.g. Earlsdown, High House..."
                      style={{ ...inputStyle, width: 200 }} autoFocus />
                  </Fld>
                  <button onClick={addHouse} style={{ ...btnNavy, height: 30, fontSize: 10 }}>Add</button>
                  <button onClick={() => { setShowAddHouse(false); setNewHouseName(""); }}
                    style={{ color: B.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10 }}>
                    Cancel
                  </button>
                </div>
              )}

              {roomingHouses.length === 0 ? (
                <div style={{ background: B.white, border: "1px solid " + B.border, borderTop: "none", padding: 40, textAlign: "center", color: B.textLight, borderRadius: "0 0 10px 10px" }}>
                  No houses defined — click <strong>Add House</strong> to start
                </div>
              ) : roomingHouses.map((house) => {
                const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
                const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);
                const houseOccupied = roomingAssignments.filter((a) => houseRooms.some((r) => r.id === a.roomId) && a.occupantName).length;
                const isExpanded = expandedHouse === house.id;

                // Group rooms by floor
                const floors = {};
                houseRooms.forEach((r) => {
                  const fl = r.floorLabel || "Main";
                  if (!floors[fl]) floors[fl] = [];
                  floors[fl].push(r);
                });

                return (
                  <div key={house.id} style={{ background: B.white, border: "1px solid " + B.border, borderTop: "none", marginBottom: 0, lastChild: { borderRadius: "0 0 10px 10px" } }}>
                    {/* House header */}
                    <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", cursor: "pointer", borderBottom: isExpanded ? "1px solid " + B.border : "none" }}
                      onClick={() => setExpandedHouse(isExpanded ? null : house.id)}>
                      <span style={{ fontSize: 11, color: B.textMuted }}>{isExpanded ? "\u25bc" : "\u25b6"}</span>
                      {editingHouseId === house.id ? (
                        <input value={editingHouseName}
                          onChange={(e) => setEditingHouseName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && updateHouseName(house.id)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          style={{ ...inputStyle, fontSize: 13, fontWeight: 700, width: 200 }} />
                      ) : (
                        <span style={{ fontWeight: 800, fontSize: 12, color: B.navy }}>{house.name}</span>
                      )}
                      <span style={{ fontSize: 9, color: B.textMuted, background: B.bg, padding: "2px 6px", borderRadius: 4 }}>
                        {houseRooms.length} rooms · {houseBeds} beds
                        {houseOccupied > 0 && <> · <span style={{ color: B.success }}>{houseOccupied} assigned</span></>}
                      </span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        {editingHouseId === house.id ? (
                          <IconBtn onClick={() => updateHouseName(house.id)}><IcCheck /></IconBtn>
                        ) : (
                          <IconBtn onClick={() => { setEditingHouseId(house.id); setEditingHouseName(house.name); }}><IcEdit /></IconBtn>
                        )}
                        <IconBtn danger onClick={() => { if (confirm("Delete " + house.name + " and all its rooms?")) deleteHouse(house.id); }}><IcTrash /></IconBtn>
                      </div>
                    </div>

                    {/* Rooms list */}
                    {isExpanded && (
                      <div style={{ padding: "8px 14px 12px" }}>
                        {Object.keys(floors).length === 0 ? (
                          <div style={{ fontSize: 10, color: B.textLight, padding: "8px 0" }}>No rooms — add rooms below</div>
                        ) : Object.entries(floors).map(([floor, fRooms]) => (
                          <div key={floor} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, paddingBottom: 2, borderBottom: "1px solid " + B.borderLight }}>
                              {floor}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {fRooms.map((room) => {
                                const roomAssigns = roomingAssignments.filter((a) => a.roomId === room.id && a.occupantName);
                                const occupancy = roomAssigns.length;
                                const isEditing = editingRoomId === room.id;
                                return (
                                  <div key={room.id} style={{
                                    border: "1px solid " + B.border, borderRadius: 6, padding: "6px 10px",
                                    minWidth: 120, background: occupancy >= room.capacity ? "#f0fdf4" : "#f8fafc",
                                    position: "relative",
                                  }}>
                                    {isEditing ? (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <input value={editingRoom.roomName ?? room.roomName}
                                          onChange={(e) => setEditingRoom((p) => ({ ...p, roomName: e.target.value }))}
                                          style={{ ...inputStyle, fontSize: 10, width: 80, padding: "3px 5px" }}
                                          placeholder="Room name" autoFocus />
                                        <input value={editingRoom.floorLabel ?? room.floorLabel}
                                          onChange={(e) => setEditingRoom((p) => ({ ...p, floorLabel: e.target.value }))}
                                          style={{ ...inputStyle, fontSize: 10, width: 80, padding: "3px 5px" }}
                                          placeholder="Floor" />
                                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                          <input type="number" min={1} max={20}
                                            value={editingRoom.capacity ?? room.capacity}
                                            onChange={(e) => setEditingRoom((p) => ({ ...p, capacity: e.target.value }))}
                                            style={{ ...inputStyle, fontSize: 10, width: 44, padding: "3px 5px" }} />
                                          <span style={{ fontSize: 9, color: B.textMuted }}>beds</span>
                                          <button onClick={() => updateRoom(room.id)} style={{ background: B.navy, border: "none", color: B.white, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}>Save</button>
                                          <button onClick={() => setEditingRoomId(null)} style={{ background: "none", border: "none", color: B.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: 9 }}>✕</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div style={{ fontWeight: 700, fontSize: 11, color: B.navy }}>{room.roomName}</div>
                                        <div style={{ fontSize: 9, color: occupancy >= room.capacity ? B.success : B.textMuted }}>
                                          {occupancy}/{room.capacity} beds
                                        </div>
                                        {roomAssigns.slice(0, 2).map((a) => (
                                          <div key={a.id} style={{ fontSize: 8, color: groupColorMap[a.groupId] || B.textMuted, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>
                                            {a.occupantName}
                                          </div>
                                        ))}
                                        {roomAssigns.length > 2 && <div style={{ fontSize: 8, color: B.textLight }}>+{roomAssigns.length - 2} more</div>}
                                        <div style={{ display: "flex", gap: 2, marginTop: 4, position: "absolute", top: 4, right: 4 }}>
                                          <IconBtn onClick={() => { setEditingRoomId(room.id); setEditingRoom({ roomName: room.roomName, floorLabel: room.floorLabel, capacity: room.capacity }); }}><IcEdit /></IconBtn>
                                          <IconBtn danger onClick={() => deleteRoom(room.id)}><IcTrash /></IconBtn>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {/* Add room form */}
                        {showAddRoom === house.id ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 8, padding: "8px 10px", background: "#f0f9ff", borderRadius: 6, border: "1px dashed #bae6fd" }}>
                            <Fld label="Room Name">
                              <input value={newRoom.roomName} onChange={(e) => setNewRoom((p) => ({ ...p, roomName: e.target.value }))}
                                placeholder="e.g. Room 1, Dorm A..." style={{ ...inputStyle, width: 120 }} autoFocus />
                            </Fld>
                            <Fld label="Floor">
                              <input value={newRoom.floorLabel} onChange={(e) => setNewRoom((p) => ({ ...p, floorLabel: e.target.value }))}
                                placeholder="Ground, 1st..." style={{ ...inputStyle, width: 80 }} />
                            </Fld>
                            <Fld label="Beds">
                              <input type="number" min={1} max={20} value={newRoom.capacity}
                                onChange={(e) => setNewRoom((p) => ({ ...p, capacity: e.target.value }))}
                                style={{ ...inputStyle, width: 55 }} />
                            </Fld>
                            <button onClick={() => addRoom(house.id)} style={{ ...btnNavy, height: 30, fontSize: 10 }}>Add Room</button>
                            <button onClick={() => setShowAddRoom(null)} style={{ color: B.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10 }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => { setShowAddRoom(house.id); setNewRoom({ floorLabel: "", roomName: "", capacity: 2 }); }}
                            style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#0891b2", background: "transparent", border: "1px dashed #bae6fd", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                            <IcPlus /> Add Room
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ASSIGN SUB-VIEW ─────────────────────────── */}
          {houseView === "assign" && (
            <div>
              {roomingHouses.length === 0 ? (
                <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, padding: 40, textAlign: "center", color: B.textLight }}>
                  Set up houses and rooms first in the <strong>Setup</strong> view
                </div>
              ) : (
                <>
                  {/* Group legend */}
                  <div style={{ padding: "0 4px 8px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Groups:</span>
                    {activeGroups.map((g, i) => (
                      <span key={g.id} style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] + "20", color: GROUP_COLORS[i % GROUP_COLORS.length], padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                        {g.group} ({(g.stu || 0) + (g.gl || 0)} pax)
                      </span>
                    ))}
                  </div>

                  {/* Houses + rooms with assignment slots */}
                  {roomingHouses.map((house) => {
                    const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
                    if (houseRooms.length === 0) return null;

                    // Group rooms by floor
                    const floors = {};
                    houseRooms.forEach((r) => {
                      const fl = r.floorLabel || "Main";
                      if (!floors[fl]) floors[fl] = [];
                      floors[fl].push(r);
                    });

                    const houseOccupied = roomingAssignments.filter((a) => houseRooms.some((r) => r.id === a.roomId) && a.occupantName).length;
                    const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);

                    return (
                      <div key={house.id} style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
                        <div style={{ padding: "8px 16px", display: "flex", gap: 8, alignItems: "center", background: B.navy }}>
                          <span style={{ fontWeight: 800, fontSize: 12, color: B.white }}>{house.name}</span>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                            {houseOccupied}/{houseBeds} beds filled
                          </span>
                          {houseBeds > 0 && (
                            <div style={{ marginLeft: "auto", height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 3, width: 100, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: Math.min(100, (houseOccupied / houseBeds) * 100) + "%", background: houseOccupied >= houseBeds ? "#4ade80" : "#60a5fa", borderRadius: 3, transition: "width 0.3s" }} />
                            </div>
                          )}
                        </div>

                        {Object.entries(floors).map(([floor, fRooms]) => (
                          <div key={floor}>
                            {Object.keys(floors).length > 1 && (
                              <div style={{ padding: "4px 16px", fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, background: "#f8fafc", borderBottom: "1px solid " + B.borderLight }}>
                                {floor}
                              </div>
                            )}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "10px 16px 14px" }}>
                              {fRooms.map((room) => {
                                const slots = Array.from({ length: room.capacity }, (_, i) => i);
                                const roomFilled = slots.filter((i) => getAssignment(room.id, i)?.occupantName).length;
                                return (
                                  <div key={room.id} style={{
                                    border: "1px solid " + (roomFilled >= room.capacity ? "#86efac" : B.border),
                                    borderRadius: 8, padding: "8px 10px", minWidth: 160,
                                    background: roomFilled >= room.capacity ? "#f0fdf4" : B.white,
                                    flex: "0 0 auto",
                                  }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                      <div style={{ fontWeight: 700, fontSize: 11, color: B.navy }}>{room.roomName}</div>
                                      <span style={{ fontSize: 9, fontWeight: 700, color: roomFilled >= room.capacity ? B.success : B.textMuted }}>
                                        {roomFilled}/{room.capacity}
                                      </span>
                                    </div>
                                    {slots.map((slotIdx) => {
                                      const a = getAssignment(room.id, slotIdx);
                                      const groupColor = a?.groupId ? groupColorMap[a.groupId] : null;
                                      return (
                                        <div key={slotIdx} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
                                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: groupColor || B.border, flexShrink: 0 }} />
                                          <input
                                            value={a?.occupantName || ""}
                                            onChange={(e) => {
                                              if (e.target.value) {
                                                setSlot(room.id, slotIdx, { occupantName: e.target.value, groupId: a?.groupId || "" });
                                              } else {
                                                clearSlot(room.id, slotIdx);
                                              }
                                            }}
                                            placeholder={"Bed " + (slotIdx + 1)}
                                            style={{
                                              background: groupColor ? groupColor + "12" : "#f8fafc",
                                              border: "1px solid " + (groupColor ? groupColor + "40" : B.borderLight),
                                              color: B.text, padding: "3px 6px",
                                              borderRadius: 4, fontSize: 10, fontFamily: "inherit",
                                              width: "100%", minWidth: 0,
                                            }}
                                          />
                                          {a?.occupantName && (
                                            <select
                                              value={a?.groupId || ""}
                                              onChange={(e) => setSlot(room.id, slotIdx, { groupId: e.target.value })}
                                              title="Assign to group"
                                              style={{
                                                background: groupColor ? groupColor + "12" : "#f8fafc",
                                                border: "1px solid " + (groupColor ? groupColor + "40" : B.borderLight),
                                                color: groupColor || B.textMuted,
                                                padding: "3px 2px", borderRadius: 4,
                                                fontSize: 9, fontFamily: "inherit", cursor: "pointer",
                                                width: 36,
                                              }}>
                                              <option value="">—</option>
                                              {activeGroups.map((g) => <option key={g.id} value={g.id}>{g.group.slice(0, 10)}</option>)}
                                            </select>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Summary occupancy table */}
                  <div style={{ marginTop: 8 }}>
                    <TableWrap>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                        <thead>
                          <tr>
                            {["House", "Rooms", "Beds", "Assigned", "Vacant", "Occupancy"].map((h) => (
                              <th key={h} style={thStyle}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {roomingHouses.map((house) => {
                            const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
                            const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);
                            const houseOccupied = roomingAssignments.filter((a) => houseRooms.some((r) => r.id === a.roomId) && a.occupantName).length;
                            const pct = houseBeds ? Math.round((houseOccupied / houseBeds) * 100) : 0;
                            return (
                              <tr key={house.id} style={{ borderBottom: "1px solid " + B.borderLight }}>
                                <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{house.name}</td>
                                <td style={{ ...tdStyle, textAlign: "center" }}>{houseRooms.length}</td>
                                <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{houseBeds}</td>
                                <td style={{ ...tdStyle, textAlign: "center", color: B.success, fontWeight: 700 }}>{houseOccupied}</td>
                                <td style={{ ...tdStyle, textAlign: "center", color: houseBeds - houseOccupied === 0 ? B.textLight : B.warning, fontWeight: 700 }}>{houseBeds - houseOccupied}</td>
                                <td style={{ ...tdStyle }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ flex: 1, height: 6, background: B.borderLight, borderRadius: 3, overflow: "hidden" }}>
                                      <div style={{ height: "100%", width: pct + "%", background: pct >= 100 ? B.success : pct > 50 ? "#3b82f6" : B.warning, borderRadius: 3 }} />
                                    </div>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted, minWidth: 28 }}>{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {/* Total row */}
                          <tr style={{ background: "#f8fafc", borderTop: "2px solid " + B.border }}>
                            <td style={{ ...tdStyle, fontWeight: 800, color: B.navy }}>TOTAL</td>
                            <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800 }}>{roomingRooms.length}</td>
                            <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800 }}>{totalBeds}</td>
                            <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: B.success }}>{occupiedBeds}</td>
                            <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: B.warning }}>{totalBeds - occupiedBeds}</td>
                            <td style={{ ...tdStyle, fontSize: 9, fontWeight: 800, color: B.textMuted }}>
                              {totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </TableWrap>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "0 20px 8px", fontSize: 9, color: B.success, fontWeight: 600 }}>
        {"\u2713"} Overview auto-calculates from group dates (arrival inclusive, departure exclusive) · Click cells to override · Houses &amp; rooms configured per centre
      </div>
    </div>
  );
}
