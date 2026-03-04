"use client";
import { useState, useMemo, useCallback, useRef } from "react";
import { B, uid, genDates, dayKey, dayName, isWeekend, fmtDate } from "@/lib/constants";
import { StatCard, Fld, TableWrap, IconBtn, IcPlus, IcTrash, IcEdit, IcCheck, inputStyle, thStyle, tdStyle, btnPrimary, btnNavy } from "@/components/ui";

// ── Helpers ────────────────────────────────────────────────
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

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

// ──────────────────────────────────────────────────────────
export default function RoomingTab({
  groups = [], progStart, progEnd,
  roomingHouses = [], setRoomingHouses,
  roomingRooms = [], setRoomingRooms,
  roomingAssignments = [], setRoomingAssignments,
  roomingOverrides = {}, setRoomingOverrides,
}) {
  const [view, setView] = useState("overview");
  const dates = useMemo(() => genDates(progStart, progEnd), [progStart, progEnd]);
  const activeGroups = groups.filter((g) => !g.archived);

  // ── OVERVIEW state ──────────────────────────────────────
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");

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

  // ── HOUSES state ────────────────────────────────────────
  const [houseView, setHouseView] = useState("setup");
  const [showAddHouse, setShowAddHouse] = useState(false);
  const [newHouseName, setNewHouseName] = useState("");
  const [editingHouseId, setEditingHouseId] = useState(null);
  const [editingHouseName, setEditingHouseName] = useState("");
  const [expandedHouse, setExpandedHouse] = useState(null);
  const [showAddRoom, setShowAddRoom] = useState(null);
  const [newRoom, setNewRoom] = useState({ floorLabel: "", roomName: "", capacity: 2 });
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoom, setEditingRoom] = useState({});
  const [nightDate, setNightDate] = useState(progStart || "");
  const saveTimer = useRef(null);

  const totalBeds = useMemo(() => roomingRooms.reduce((s, r) => s + (r.capacity || 0), 0), [roomingRooms]);
  const occupiedBeds = useMemo(() => roomingAssignments.filter((a) => a.occupantName).length, [roomingAssignments]);

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
    const newCap = parseInt(editingRoom.capacity) || roomingRooms.find((r) => r.id === id)?.capacity || 2;
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
      }
      return [...p, { id: uid(), roomId, slotIndex, occupantName: "", groupId: "", occupantType: "student", notes: "", ...updates }];
    });
  }, []);

  const clearSlot = useCallback((roomId, slotIndex) => {
    setRoomingAssignments((p) =>
      p.filter((a) => !(a.roomId === roomId && a.slotIndex === slotIndex))
    );
  }, []);

  // ── Print: Overview grid ───────────────────────────────
  const handlePrintOverview = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Rooming Overview</title><style>
      body{font-family:sans-serif;font-size:10px;padding:12px}
      h2{font-size:13px;margin:0 0 8px;color:#1c3048}
      table{border-collapse:collapse;width:100%}
      th{background:#f0f0f0;font-size:8px;padding:4px 5px;border:1px solid #ccc;text-align:center;white-space:nowrap}
      th.grp{text-align:left;min-width:120px}
      td{border:1px solid #ddd;padding:3px 5px;text-align:center;font-size:9px}
      td.grp{text-align:left;font-weight:700;color:#1c3048}
      tr.totals{background:#1c3048;color:#fff;font-weight:800}
      tr.totals td{color:#fff;border-color:#2a4060}
      tr.capacity{background:#f0fdf4}
      tr.capacity td{color:#16a34a;font-weight:700;font-size:8px}
      @media print{body{padding:0}}
    </style></head><body>`);
    w.document.write("<h2>Rooming Overview — Heads on Beds per Night</h2>");
    w.document.write('<table><thead><tr><th class="grp">Group</th>');
    dates.forEach((d) => {
      w.document.write(`<th>${dayName(d).slice(0, 2)}<br>${d.getDate()}/${d.getMonth() + 1}</th>`);
    });
    w.document.write("</tr></thead><tbody>");
    activeGroups.forEach((g) => {
      w.document.write(`<tr><td class="grp">${g.group}<br><span style="font-weight:400;color:#666;font-size:8px">${(g.stu || 0) + (g.gl || 0)} pax · ${fmtDate(g.arr)} → ${fmtDate(g.dep)}</span></td>`);
      dates.forEach((d) => {
        const ds = dayKey(d);
        const v = bedsData[g.id]?.[ds] || 0;
        const isOvr = roomingOverrides[g.id + "-" + ds] !== undefined;
        w.document.write(`<td style="${v ? "font-weight:800;" : "color:#bbb;"}${isOvr ? "background:#fff7ed;color:#ea580c;" : ""}">${v || "—"}</td>`);
      });
      w.document.write("</tr>");
    });
    w.document.write('<tr class="totals"><td class="grp" style="color:#fff">TOTAL BEDS</td>');
    dates.forEach((d) => {
      const tot = dailyTotals[dayKey(d)] || 0;
      w.document.write(`<td>${tot || "—"}</td>`);
    });
    w.document.write("</tr>");
    if (totalBeds > 0) {
      w.document.write('<tr class="capacity"><td style="font-weight:700">CAPACITY SPARE</td>');
      dates.forEach((d) => {
        const spare = totalBeds - (dailyTotals[dayKey(d)] || 0);
        w.document.write(`<td style="color:${spare < 0 ? "#dc2626" : spare === 0 ? "#d97706" : "#16a34a"}">${spare > 0 ? "+" + spare : spare}</td>`);
      });
      w.document.write("</tr>");
    }
    w.document.write("</tbody></table></body></html>");
    w.document.close();
    w.print();
  };

  // ── Print: Nightly rooming list ────────────────────────
  const handlePrintNightly = () => {
    if (!nightDate) return;
    const w = window.open("", "_blank");
    const centreTitle = "Night of " + fmtDate(nightDate);
    w.document.write(`<html><head><title>Rooming List — ${centreTitle}</title><style>
      body{font-family:sans-serif;font-size:11px;padding:16px;color:#1c3048}
      h1{font-size:15px;margin:0 0 4px}
      .sub{font-size:10px;color:#666;margin-bottom:14px}
      h2{font-size:12px;margin:14px 0 6px;color:#1c3048;border-bottom:2px solid #1c3048;padding-bottom:3px}
      .floor-label{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 4px}
      .rooms{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px}
      .room{border:1px solid #ccc;border-radius:5px;padding:8px 10px;min-width:130px;break-inside:avoid}
      .room-name{font-weight:800;font-size:11px;margin-bottom:5px;border-bottom:1px solid #eee;padding-bottom:3px}
      .bed{font-size:10px;padding:2px 0;display:flex;align-items:center;gap:5px}
      .dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
      .bed.empty .name{color:#bbb}
      .bed.away .name{color:#bbb;text-decoration:line-through}
      .grp-tag{font-size:8px;color:#888}
      .stats{font-size:9px;color:#888;margin-top:3px}
      @media print{body{padding:0}@page{size:A4 portrait;margin:15mm}}
    </style></head><body>`);
    w.document.write(`<h1>Rooming List</h1><div class="sub">${centreTitle}</div>`);

    let anyHouse = false;
    roomingHouses.forEach((house) => {
      const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
      if (houseRooms.length === 0) return;
      anyHouse = true;

      const floors = {};
      houseRooms.forEach((r) => {
        const fl = r.floorLabel || "Main";
        if (!floors[fl]) floors[fl] = [];
        floors[fl].push(r);
      });

      let onSiteCount = 0;
      houseRooms.forEach((room) => {
        const slots = Array.from({ length: room.capacity }, (_, i) => i);
        slots.forEach((idx) => {
          const a = roomingAssignments.find((x) => x.roomId === room.id && x.slotIndex === idx);
          if (a?.occupantName && a?.groupId) {
            const g = activeGroups.find((x) => x.id === a.groupId);
            if (g && inBed(nightDate, g.arr, g.dep)) onSiteCount++;
          }
        });
      });
      const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);

      w.document.write(`<h2>${house.name} <span style="font-weight:400;font-size:10px;color:#555">${onSiteCount}/${houseBeds} occupied tonight</span></h2>`);

      Object.entries(floors).forEach(([floor, fRooms]) => {
        if (Object.keys(floors).length > 1) {
          w.document.write(`<div class="floor-label">${floor}</div>`);
        }
        w.document.write('<div class="rooms">');
        fRooms.forEach((room) => {
          const slots = Array.from({ length: room.capacity }, (_, i) => i);
          const presentCount = slots.filter((idx) => {
            const a = roomingAssignments.find((x) => x.roomId === room.id && x.slotIndex === idx);
            if (!a?.occupantName) return false;
            const g = a.groupId ? activeGroups.find((x) => x.id === a.groupId) : null;
            return g ? inBed(nightDate, g.arr, g.dep) : false;
          }).length;
          w.document.write(`<div class="room"><div class="room-name">${room.roomName} <span style="font-weight:400;font-size:9px;color:#888">${presentCount}/${room.capacity}</span></div>`);
          slots.forEach((idx) => {
            const a = roomingAssignments.find((x) => x.roomId === room.id && x.slotIndex === idx);
            const g = a?.groupId ? activeGroups.find((x) => x.id === a.groupId) : null;
            const onSite = a?.occupantName && g ? inBed(nightDate, g.arr, g.dep) : false;
            const away = a?.occupantName && !onSite;
            const gc = g ? GROUP_COLORS[activeGroups.indexOf(g) % GROUP_COLORS.length] : null;
            if (a?.occupantName) {
              w.document.write(`<div class="bed ${away ? "away" : ""}">
                <span class="dot" style="background:${onSite ? (gc || "#999") : "#ddd"}"></span>
                <span class="name">${a.occupantName}</span>
                ${g ? `<span class="grp-tag">${g.group.slice(0, 12)}</span>` : ""}
              </div>`);
            } else {
              w.document.write(`<div class="bed empty"><span class="dot" style="background:#e5e7eb"></span><span class="name">—</span></div>`);
            }
          });
          w.document.write("</div>");
        });
        w.document.write("</div>");
      });
    });

    if (!anyHouse) w.document.write("<p>No houses configured.</p>");
    w.document.write("</body></html>");
    w.document.close();
    w.print();
  };

  // ── Print: Full static rooming list ───────────────────
  const handlePrintRoomingList = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Full Rooming List</title><style>
      body{font-family:sans-serif;font-size:11px;padding:16px;color:#1c3048}
      h1{font-size:15px;margin:0 0 4px}
      .sub{font-size:10px;color:#666;margin-bottom:14px}
      h2{font-size:12px;margin:14px 0 6px;color:#1c3048;border-bottom:2px solid #1c3048;padding-bottom:3px}
      .floor-label{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 4px}
      .rooms{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px}
      .room{border:1px solid #ccc;border-radius:5px;padding:8px 10px;min-width:130px;break-inside:avoid}
      .room-name{font-weight:800;font-size:11px;margin-bottom:5px;border-bottom:1px solid #eee;padding-bottom:3px}
      .bed{font-size:10px;padding:2px 0;display:flex;align-items:center;gap:5px}
      .dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
      .bed.empty .name{color:#bbb}
      .grp-tag{font-size:8px;color:#888}
      @media print{body{padding:0}@page{size:A4 portrait;margin:15mm}}
    </style></head><body>`);
    w.document.write(`<h1>Full Rooming List</h1><div class="sub">All assignments for the programme</div>`);

    roomingHouses.forEach((house) => {
      const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
      if (houseRooms.length === 0) return;
      const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);
      const houseOcc = roomingAssignments.filter((a) => houseRooms.some((r) => r.id === a.roomId) && a.occupantName).length;
      const floors = {};
      houseRooms.forEach((r) => {
        const fl = r.floorLabel || "Main";
        if (!floors[fl]) floors[fl] = [];
        floors[fl].push(r);
      });
      w.document.write(`<h2>${house.name} <span style="font-weight:400;font-size:10px;color:#555">${houseOcc}/${houseBeds} beds assigned</span></h2>`);
      Object.entries(floors).forEach(([floor, fRooms]) => {
        if (Object.keys(floors).length > 1) w.document.write(`<div class="floor-label">${floor}</div>`);
        w.document.write('<div class="rooms">');
        fRooms.forEach((room) => {
          const slots = Array.from({ length: room.capacity }, (_, i) => i);
          const filled = slots.filter((idx) => roomingAssignments.find((a) => a.roomId === room.id && a.slotIndex === idx && a.occupantName)).length;
          w.document.write(`<div class="room"><div class="room-name">${room.roomName} <span style="font-weight:400;font-size:9px;color:#888">${filled}/${room.capacity}</span></div>`);
          slots.forEach((idx) => {
            const a = roomingAssignments.find((x) => x.roomId === room.id && x.slotIndex === idx);
            const g = a?.groupId ? activeGroups.find((x) => x.id === a.groupId) : null;
            const gc = g ? GROUP_COLORS[activeGroups.indexOf(g) % GROUP_COLORS.length] : null;
            if (a?.occupantName) {
              w.document.write(`<div class="bed"><span class="dot" style="background:${gc || "#999"}"></span><span class="name">${a.occupantName}</span>${g ? `<span class="grp-tag">${g.group.slice(0, 12)}</span>` : ""}</div>`);
            } else {
              w.document.write(`<div class="bed empty"><span class="dot" style="background:#e5e7eb"></span><span class="name">—</span></div>`);
            }
          });
          w.document.write("</div>");
        });
        w.document.write("</div>");
      });
    });
    w.document.write("</body></html>");
    w.document.close();
    w.print();
  };

  // ── Computed ───────────────────────────────────────────
  const totalStu = activeGroups.reduce((s, g) => s + (g.stu || 0), 0);
  const totalGL = activeGroups.reduce((s, g) => s + (g.gl || 0), 0);
  const maxNight = dates.length > 0 ? Math.max(...dates.map((d) => dailyTotals[dayKey(d)] || 0)) : 0;

  // Shared: group rooms by floor helper
  const groupByFloor = (rooms) => {
    const floors = {};
    rooms.forEach((r) => {
      const fl = r.floorLabel || "Main";
      if (!floors[fl]) floors[fl] = [];
      floors[fl].push(r);
    });
    return floors;
  };

  return (
    <div>
      {/* ── Header stats + top-level view switcher ──────── */}
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
              Heads on beds per night (arrival inclusive, departure exclusive). Click to override.
            </span>
            {overrideCount > 0 && (
              <>
                <span style={{ fontSize: 9, color: "#ea580c", fontWeight: 700 }}>{overrideCount} override{overrideCount !== 1 ? "s" : ""}</span>
                <button onClick={() => setRoomingOverrides({})} style={{
                  fontSize: 9, color: B.textMuted, background: "transparent",
                  border: "1px solid " + B.border, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit",
                }}>Reset All</button>
              </>
            )}
            <button onClick={handlePrintOverview} style={{ ...btnNavy, fontSize: 9, padding: "3px 10px", marginLeft: "auto" }}>
              {"\ud83d\udda8\ufe0f"} Print Grid
            </button>
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
                        <td key={ds} onClick={() => !isEd && startCellEdit(g.id, ds)} style={{
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
        </div>
      )}

      {/* ── HOUSES VIEW ─────────────────────────────────── */}
      {view === "houses" && (
        <div style={{ padding: "0 8px 16px" }}>
          {/* Sub-view switcher */}
          <div style={{ padding: "0 4px 8px", display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { id: "setup", label: "\u2699\ufe0f Setup Houses & Rooms" },
              { id: "assign", label: "\ud83d\udecf\ufe0f Assign Students" },
              { id: "nightly", label: "\ud83c\udf19 Nightly View" },
            ].map((sv) => (
              <button key={sv.id} onClick={() => setHouseView(sv.id)} style={{
                padding: "4px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                fontFamily: "inherit", cursor: "pointer",
                border: "1px solid " + (houseView === sv.id ? B.red : B.border),
                background: houseView === sv.id ? B.red : B.white,
                color: houseView === sv.id ? B.white : B.textMuted,
              }}>{sv.label}</button>
            ))}
            {houseView === "assign" && (
              <button onClick={handlePrintRoomingList} style={{ ...btnNavy, fontSize: 9, padding: "4px 10px", marginLeft: "auto" }}>
                {"\ud83d\udda8\ufe0f"} Print Rooming List
              </button>
            )}
          </div>

          {/* ── SETUP ─────────────────────────────────────── */}
          {houseView === "setup" && (
            <div>
              <div style={{ background: B.white, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "10px 10px 0 0", border: "1px solid " + B.border, borderBottom: "1px solid " + B.border }}>
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
                      style={{ ...inputStyle, width: 220 }} autoFocus />
                  </Fld>
                  <button onClick={addHouse} style={{ ...btnNavy, height: 30, fontSize: 10 }}>Add</button>
                  <button onClick={() => { setShowAddHouse(false); setNewHouseName(""); }}
                    style={{ color: B.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10 }}>Cancel</button>
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
                const floors = groupByFloor(houseRooms);

                return (
                  <div key={house.id} style={{ background: B.white, border: "1px solid " + B.border, borderTop: "none" }}>
                    <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", cursor: "pointer", borderBottom: isExpanded ? "1px solid " + B.border : "none" }}
                      onClick={() => setExpandedHouse(isExpanded ? null : house.id)}>
                      <span style={{ fontSize: 11, color: B.textMuted }}>{isExpanded ? "\u25bc" : "\u25b6"}</span>
                      {editingHouseId === house.id ? (
                        <input value={editingHouseName}
                          onChange={(e) => setEditingHouseName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && updateHouseName(house.id)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus style={{ ...inputStyle, fontSize: 13, fontWeight: 700, width: 200 }} />
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
                                          style={{ ...inputStyle, fontSize: 10, width: 90, padding: "3px 5px" }}
                                          placeholder="Room name" autoFocus />
                                        <input value={editingRoom.floorLabel ?? room.floorLabel}
                                          onChange={(e) => setEditingRoom((p) => ({ ...p, floorLabel: e.target.value }))}
                                          style={{ ...inputStyle, fontSize: 10, width: 90, padding: "3px 5px" }}
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
                                        <div style={{ display: "flex", gap: 2, position: "absolute", top: 4, right: 4 }}>
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

          {/* ── ASSIGN ────────────────────────────────────── */}
          {houseView === "assign" && (
            <div>
              {roomingHouses.length === 0 ? (
                <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, padding: 40, textAlign: "center", color: B.textLight }}>
                  Set up houses and rooms first in the <strong>Setup</strong> view
                </div>
              ) : (
                <>
                  <div style={{ padding: "0 4px 8px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Groups:</span>
                    {activeGroups.map((g, i) => (
                      <span key={g.id} style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] + "20", color: GROUP_COLORS[i % GROUP_COLORS.length], padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                        {g.group} ({(g.stu || 0) + (g.gl || 0)} pax)
                      </span>
                    ))}
                  </div>

                  {roomingHouses.map((house) => {
                    const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
                    if (houseRooms.length === 0) return null;
                    const floors = groupByFloor(houseRooms);
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
                              <div style={{ height: "100%", width: Math.min(100, (houseOccupied / houseBeds) * 100) + "%", background: houseOccupied >= houseBeds ? "#4ade80" : "#60a5fa", borderRadius: 3 }} />
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
                                    borderRadius: 8, padding: "8px 10px", minWidth: 170, flex: "0 0 auto",
                                    background: roomFilled >= room.capacity ? "#f0fdf4" : B.white,
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
                                            onChange={(e) => e.target.value
                                              ? setSlot(room.id, slotIdx, { occupantName: e.target.value, groupId: a?.groupId || "" })
                                              : clearSlot(room.id, slotIdx)
                                            }
                                            placeholder={"Bed " + (slotIdx + 1)}
                                            style={{
                                              background: groupColor ? groupColor + "12" : "#f8fafc",
                                              border: "1px solid " + (groupColor ? groupColor + "40" : B.borderLight),
                                              color: B.text, padding: "3px 6px", borderRadius: 4,
                                              fontSize: 10, fontFamily: "inherit", width: "100%", minWidth: 0,
                                            }}
                                          />
                                          {a?.occupantName && (
                                            <select value={a?.groupId || ""}
                                              onChange={(e) => setSlot(room.id, slotIdx, { groupId: e.target.value })}
                                              title="Assign to group"
                                              style={{
                                                background: groupColor ? groupColor + "12" : "#f8fafc",
                                                border: "1px solid " + (groupColor ? groupColor + "40" : B.borderLight),
                                                color: groupColor || B.textMuted,
                                                padding: "3px 2px", borderRadius: 4,
                                                fontSize: 9, fontFamily: "inherit", cursor: "pointer", width: 36,
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

                  {/* Occupancy summary */}
                  <TableWrap>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <thead>
                        <tr>{["House", "Rooms", "Beds", "Assigned", "Vacant", "Occupancy"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
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
                              <td style={tdStyle}>
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
                </>
              )}
            </div>
          )}

          {/* ── NIGHTLY VIEW ──────────────────────────────── */}
          {houseView === "nightly" && (
            <div>
              {roomingHouses.length === 0 ? (
                <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, padding: 40, textAlign: "center", color: B.textLight }}>
                  Set up houses and rooms first in the <strong>Setup</strong> view
                </div>
              ) : (
                <>
                  {/* Date navigator */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 12px", flexWrap: "wrap" }}>
                    <button onClick={() => setNightDate((d) => shiftDate(d || progStart, -1))}
                      disabled={nightDate <= progStart}
                      style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 5, padding: "4px 10px", cursor: nightDate <= progStart ? "default" : "pointer", fontSize: 13, color: nightDate <= progStart ? B.textLight : B.navy, fontFamily: "inherit" }}>
                      ←
                    </button>
                    <div style={{ fontWeight: 800, fontSize: 13, color: B.navy, minWidth: 120, textAlign: "center" }}>
                      {nightDate ? fmtDate(nightDate) : "—"}
                      <div style={{ fontSize: 9, fontWeight: 600, color: B.textMuted }}>
                        {nightDate ? new Date(nightDate).toLocaleDateString("en-GB", { weekday: "long" }) : ""}
                      </div>
                    </div>
                    <button onClick={() => setNightDate((d) => shiftDate(d || progStart, 1))}
                      disabled={nightDate >= progEnd}
                      style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 5, padding: "4px 10px", cursor: nightDate >= progEnd ? "default" : "pointer", fontSize: 13, color: nightDate >= progEnd ? B.textLight : B.navy, fontFamily: "inherit" }}>
                      →
                    </button>
                    <input type="date" value={nightDate} min={progStart} max={progEnd}
                      onChange={(e) => setNightDate(e.target.value)}
                      style={{ ...inputStyle, fontSize: 11 }} />

                    {/* On-site group badges */}
                    {nightDate && activeGroups.filter((g) => inBed(nightDate, g.arr, g.dep)).map((g, i) => (
                      <span key={g.id} style={{ background: groupColorMap[g.id] + "20", color: groupColorMap[g.id], padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                        {g.group}
                      </span>
                    ))}

                    <button onClick={handlePrintNightly} style={{ ...btnNavy, fontSize: 9, padding: "4px 10px", marginLeft: "auto" }}>
                      {"\ud83d\udda8\ufe0f"} Print This Night
                    </button>
                  </div>

                  {/* Houses */}
                  {roomingHouses.map((house) => {
                    const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
                    if (houseRooms.length === 0) return null;
                    const floors = groupByFloor(houseRooms);

                    // Count on-site occupants for this house tonight
                    let onSiteCount = 0;
                    houseRooms.forEach((room) => {
                      Array.from({ length: room.capacity }, (_, i) => i).forEach((idx) => {
                        const a = getAssignment(room.id, idx);
                        if (a?.occupantName && a.groupId) {
                          const g = activeGroups.find((x) => x.id === a.groupId);
                          if (g && inBed(nightDate, g.arr, g.dep)) onSiteCount++;
                        }
                      });
                    });
                    const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);

                    return (
                      <div key={house.id} style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
                        {/* House header */}
                        <div style={{ padding: "8px 16px", display: "flex", gap: 10, alignItems: "center", background: B.navy }}>
                          <span style={{ fontWeight: 800, fontSize: 12, color: B.white }}>{house.name}</span>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                            {onSiteCount} on-site tonight / {houseBeds} beds
                          </span>
                          {houseBeds > 0 && (
                            <div style={{ marginLeft: "auto", height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 3, width: 100, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: Math.min(100, (onSiteCount / houseBeds) * 100) + "%", background: "#4ade80", borderRadius: 3 }} />
                            </div>
                          )}
                        </div>

                        {/* Floors + rooms */}
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
                                const presentSlots = slots.map((idx) => {
                                  const a = getAssignment(room.id, idx);
                                  const g = a?.groupId ? activeGroups.find((x) => x.id === a.groupId) : null;
                                  const present = a?.occupantName && g ? inBed(nightDate, g.arr, g.dep) : false;
                                  const away = a?.occupantName && !present;
                                  return { a, g, present, away, idx };
                                });
                                const presentCount = presentSlots.filter((s) => s.present).length;
                                const isEmpty = presentCount === 0;

                                return (
                                  <div key={room.id} style={{
                                    border: "2px solid " + (presentCount >= room.capacity ? "#86efac" : isEmpty ? B.borderLight : B.border),
                                    borderRadius: 8, padding: "8px 10px", minWidth: 150, flex: "0 0 auto",
                                    background: presentCount >= room.capacity ? "#f0fdf4" : isEmpty ? "#fafafa" : B.white,
                                    opacity: isEmpty && roomingAssignments.filter((a) => a.roomId === room.id && a.occupantName).length === 0 ? 0.5 : 1,
                                  }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 800, fontSize: 11, color: B.navy }}>{room.roomName}</div>
                                      <span style={{
                                        fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                                        background: presentCount >= room.capacity ? "#dcfce7" : presentCount > 0 ? "#dbeafe" : "#f1f5f9",
                                        color: presentCount >= room.capacity ? B.success : presentCount > 0 ? "#1e40af" : B.textLight,
                                      }}>
                                        {presentCount}/{room.capacity}
                                      </span>
                                    </div>

                                    {presentSlots.map(({ a, g, present, away, idx }) => {
                                      const gc = g ? groupColorMap[g.id] : null;
                                      return (
                                        <div key={idx} style={{
                                          display: "flex", alignItems: "center", gap: 6, padding: "4px 6px",
                                          marginBottom: 3, borderRadius: 5,
                                          background: present ? (gc ? gc + "15" : "#f0fdf4") : away ? "#f5f5f5" : "#f8fafc",
                                          border: "1px solid " + (present ? (gc ? gc + "30" : "#86efac") : away ? "#e5e7eb" : B.borderLight),
                                          opacity: away ? 0.45 : 1,
                                        }}>
                                          <div style={{
                                            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                            background: present ? (gc || B.success) : away ? "#d1d5db" : "#e5e7eb",
                                          }} />
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            {a?.occupantName ? (
                                              <>
                                                <div style={{ fontSize: 10, fontWeight: present ? 700 : 400, color: present ? B.navy : B.textLight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                  {a.occupantName}
                                                  {away && <span style={{ fontSize: 8, marginLeft: 4, color: B.textLight }}>(not on-site)</span>}
                                                </div>
                                                {g && present && (
                                                  <div style={{ fontSize: 8, color: gc || B.textMuted, fontWeight: 600 }}>{g.group}</div>
                                                )}
                                              </>
                                            ) : (
                                              <div style={{ fontSize: 9, color: B.textLight, fontStyle: "italic" }}>Empty bed</div>
                                            )}
                                          </div>
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
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "0 20px 8px", fontSize: 9, color: B.success, fontWeight: 600 }}>
        {"\u2713"} Overview auto-calculates from group dates · Click cells to override · Nightly view cross-references group arrival/departure dates
      </div>
    </div>
  );
}
