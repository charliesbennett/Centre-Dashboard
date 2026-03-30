"use client";
import { useState, useMemo } from "react";
import { B, uid, genDates, dayKey, dayName, fmtDate } from "@/lib/constants";
import { StatCard, btnNavy } from "@/components/ui";
import RoomingOverviewView from "@/components/RoomingOverviewView";
import RoomingHousesView from "@/components/RoomingHousesView";

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

// ──────────────────────────────────────────────────────────
export default function RoomingTab({
  groups = [], progStart, progEnd,
  roomingHouses = [], setRoomingHouses,
  roomingRooms = [], setRoomingRooms,
  roomingAssignments = [], setRoomingAssignments,
  roomingOverrides = {}, setRoomingOverrides,
  centreId = "", readOnly = false,
}) {
  const [view, setView] = useState("overview");
  const dates = useMemo(() => genDates(progStart, progEnd), [progStart, progEnd]);
  const activeGroups = groups.filter((g) => !g.archived);

  // ── Shared computed data ─────────────────────────────────
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

  // Beds grid rows for overview
  const bedsGridRows = useMemo(() => {
    const rows = [];
    roomingHouses.forEach((house) => {
      const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
      if (houseRooms.length === 0) return;
      rows.push({ type: "houseDivider", house });
      houseRooms.forEach((room) => {
        for (let slot = 0; slot < (room.capacity || 1); slot++) {
          const a = roomingAssignments.find((x) => x.roomId === room.id && x.slotIndex === slot);
          const g = a?.groupId ? activeGroups.find((x) => x.id === a.groupId) : null;
          rows.push({ type: "slot", house, room, slot, assignment: a, group: g });
        }
      });
    });
    return rows;
  }, [roomingHouses, roomingRooms, roomingAssignments, activeGroups]);

  const bedsGridTotals = useMemo(() => {
    const totals = {};
    const totalSlots = bedsGridRows.filter((r) => r.type === "slot").length;
    dates.forEach((d) => {
      const ds = dayKey(d);
      let occupied = 0;
      bedsGridRows.forEach((r) => {
        if (r.type !== "slot") return;
        if (r.group && inBed(ds, r.group.arr, r.group.dep)) occupied++;
      });
      totals[ds] = { occupied, available: totalSlots - occupied };
    });
    return totals;
  }, [bedsGridRows, dates]);

  const totalBeds = useMemo(() => roomingRooms.reduce((s, r) => s + (r.capacity || 0), 0), [roomingRooms]);
  const occupiedBeds = useMemo(() => roomingAssignments.filter((a) => a.occupantName).length, [roomingAssignments]);

  const groupColorMap = useMemo(() => {
    const map = {};
    activeGroups.forEach((g, i) => { map[g.id] = GROUP_COLORS[i % GROUP_COLORS.length]; });
    return map;
  }, [activeGroups]);

  const totalStu = activeGroups.reduce((s, g) => s + (g.stu || 0), 0);
  const totalGL = activeGroups.reduce((s, g) => s + (g.gl || 0), 0);
  const maxNight = dates.length > 0 ? Math.max(...dates.map((d) => dailyTotals[dayKey(d)] || 0)) : 0;

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

  // ── Print: Heads on Beds grid ──────────────────────────
  const handlePrintBedsGrid = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Heads on Beds Grid</title><style>
      body{font-family:sans-serif;font-size:9px;padding:12px}
      h2{font-size:13px;margin:0 0 8px;color:#1c3048}
      table{border-collapse:collapse}
      th{background:#f0f0f0;font-size:7px;padding:3px 4px;border:1px solid #ccc;text-align:center;white-space:nowrap}
      th.lbl{text-align:left;min-width:70px}
      td{border:1px solid #e5e7eb;padding:2px 3px;font-size:8px;text-align:center;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis}
      td.lbl{text-align:left;font-weight:600;color:#1c3048;min-width:70px}
      tr.house-hdr td{background:#1c3048;color:#fff;font-weight:800;font-size:9px;padding:3px 6px;text-align:left}
      tr.totals td{background:#1c3048;color:#fff;font-weight:800}
      tr.avail td{background:#f0fdf4;color:#16a34a;font-weight:700}
      @media print{body{padding:0}@page{size:A3 landscape;margin:10mm}}
    </style></head><body>`);
    w.document.write("<h2>Heads on Beds — Bed Slot Grid</h2>");
    w.document.write('<table><thead><tr><th class="lbl">House</th><th class="lbl">Room</th><th>Bed</th>');
    dates.forEach((d) => {
      w.document.write(`<th>${dayName(d).slice(0, 2)}<br>${d.getDate()}/${d.getMonth() + 1}</th>`);
    });
    w.document.write("</tr></thead><tbody>");
    bedsGridRows.forEach((row) => {
      if (row.type === "houseDivider") {
        w.document.write(`<tr class="house-hdr"><td colspan="${3 + dates.length}">${row.house.name}</td></tr>`);
        return;
      }
      const { room, slot, group } = row;
      w.document.write(`<tr><td class="lbl">${row.house.name}</td><td class="lbl">${room.roomName}</td><td style="color:#888">${slot + 1}</td>`);
      dates.forEach((d) => {
        const ds = dayKey(d);
        const onSite = group ? inBed(ds, group.arr, group.dep) : false;
        const gc = group && onSite ? GROUP_COLORS[activeGroups.indexOf(group) % GROUP_COLORS.length] : null;
        w.document.write(`<td style="${gc ? `background:${gc}22;color:${gc};font-weight:700` : "color:#bbb"}">${onSite ? group.group.slice(0, 14) : ""}</td>`);
      });
      w.document.write("</tr>");
    });
    w.document.write('<tr class="totals"><td colspan="3">OCCUPIED</td>');
    dates.forEach((d) => {
      const t = bedsGridTotals[dayKey(d)];
      w.document.write(`<td>${t ? t.occupied || "—" : "—"}</td>`);
    });
    w.document.write("</tr>");
    w.document.write('<tr class="avail"><td colspan="3">AVAILABLE</td>');
    dates.forEach((d) => {
      const t = bedsGridTotals[dayKey(d)];
      w.document.write(`<td>${t && t.available > 0 ? "+" + t.available : t ? "0" : "—"}</td>`);
    });
    w.document.write("</tr></tbody></table></body></html>");
    w.document.close();
    w.print();
  };

  // ── Print: Nightly rooming list ────────────────────────
  const handlePrintNightly = () => {
    const nightDate = progStart || "";
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
      .name.away{color:#bbb;text-decoration:line-through}
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
                <span class="name${away ? " away" : ""}">${a.occupantName}</span>
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

  return (
    <div>
      {/* ── Header stats + top-level view switcher ──────── */}
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatCard label="Groups" value={activeGroups.length} accent={B.navy} />
        <StatCard label="Students" value={totalStu} accent={B.red} />
        <StatCard label="GLs" value={totalGL} accent={B.purple} />
        <StatCard label="Peak Night" value={maxNight} accent={B.warning} />
        <StatCard label="Houses" value={roomingHouses.length} accent={B.success} />
        <StatCard label="Beds" value={totalBeds} accent={B.cyan} />
        {totalBeds > 0 && <StatCard label="Assigned" value={occupiedBeds} accent={B.warning} />}
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
        <RoomingOverviewView
          dates={dates}
          activeGroups={activeGroups}
          bedsData={bedsData}
          autoBedsData={autoBedsData}
          dailyTotals={dailyTotals}
          totalBeds={totalBeds}
          bedsGridRows={bedsGridRows}
          bedsGridTotals={bedsGridTotals}
          roomingRooms={roomingRooms}
          roomingOverrides={roomingOverrides}
          setRoomingOverrides={setRoomingOverrides}
          readOnly={readOnly}
          onPrintBedsGrid={handlePrintBedsGrid}
          onPrintOverview={handlePrintOverview}
        />
      )}

      {/* ── HOUSES VIEW ─────────────────────────────────── */}
      {view === "houses" && (
        <RoomingHousesView
          dates={dates}
          activeGroups={activeGroups}
          groupColorMap={groupColorMap}
          roomingHouses={roomingHouses}
          setRoomingHouses={setRoomingHouses}
          roomingRooms={roomingRooms}
          setRoomingRooms={setRoomingRooms}
          roomingAssignments={roomingAssignments}
          setRoomingAssignments={setRoomingAssignments}
          totalBeds={totalBeds}
          occupiedBeds={occupiedBeds}
          centreId={centreId}
          readOnly={readOnly}
          progStart={progStart}
          progEnd={progEnd}
          onPrintNightly={handlePrintNightly}
          onPrintRoomingList={handlePrintRoomingList}
        />
      )}

      <div style={{ padding: "0 20px 8px", fontSize: 9, color: B.success, fontWeight: 600 }}>
        {"\u2713"} Overview auto-calculates from group dates · Click cells to override · Nightly view cross-references group arrival/departure dates
      </div>
    </div>
  );
}
