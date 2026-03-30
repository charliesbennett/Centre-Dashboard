import { dayKey, dayName, fmtDate } from "@/lib/constants";

/**
 * buildChatContext
 * Pure function — no Supabase calls.
 * Takes centreData object and centreName string.
 * Returns a plain-text structured summary for use as AI context.
 *
 * @param {Object} centreData
 * @param {string} centreName
 * @returns {string}
 */
export function buildChatContext(centreData, centreName) {
  const data = centreData || {};
  const groups = data.groups || [];
  const students = data.students || [];
  const staff = data.staff || [];
  const rotaGrid = data.rotaGrid || {};
  const progGrid = data.progGrid || {};
  const excursions = data.excursions || [];
  const roomingHouses = data.roomingHouses || [];
  const roomingRooms = data.roomingRooms || [];
  const roomingAssignments = data.roomingAssignments || [];
  const transfers = data.transfers || [];
  const settings = data.settings || {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = today.toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const progStart = settings.prog_start || settings.progStart || "—";
  const progEnd = settings.prog_end || settings.progEnd || "—";

  const lines = [];

  // ── Header ───────────────────────────────────────────────────────────────
  lines.push(`CENTRE: ${centreName || "Unknown"}`);
  lines.push(`CURRENT DATE: ${todayStr}`);
  lines.push(`PROGRAMME: ${progStart} to ${progEnd}`);
  lines.push("");

  // ── Groups ───────────────────────────────────────────────────────────────
  lines.push(`GROUPS (${groups.length} total):`);
  groups.forEach((g) => {
    const stuCount = g.stu || 0;
    const arr = g.arr ? fmtDate(g.arr) : "—";
    const dep = g.dep ? fmtDate(g.dep) : "—";
    const slot = g.lessonSlot || "—";
    lines.push(`- ${g.group || g.name || "Unnamed"}: ${stuCount} students, arr ${arr}, dep ${dep}, lesson slot ${slot}`);
  });
  lines.push("");

  // ── Students ─────────────────────────────────────────────────────────────
  lines.push(`STUDENTS (${students.length} total):`);
  students.forEach((s) => {
    const group = groups.find((g) => g.id === s.groupId);
    const groupName = group ? (group.group || group.name || s.groupId) : (s.groupId || "—");

    // Look up room assignment
    const assignment = roomingAssignments.find(
      (a) => a.occupantName && s.name &&
        a.occupantName.trim().toLowerCase() === s.name.trim().toLowerCase()
    );
    let roomLabel = "unassigned";
    if (assignment) {
      const room = roomingRooms.find((r) => r.id === assignment.roomId);
      roomLabel = room ? (room.roomName || room.name || assignment.roomId) : "unassigned";
    }

    const arr = group && group.arr ? fmtDate(group.arr) : "—";
    const dep = group && group.dep ? fmtDate(group.dep) : "—";
    lines.push(`- ${s.name || "Unnamed"} (Group: ${groupName}, Room: ${roomLabel}, Arr: ${arr}, Dep: ${dep})`);
  });
  lines.push("");

  // ── Staff ────────────────────────────────────────────────────────────────
  lines.push(`STAFF (${staff.length} total):`);
  staff.forEach((s) => {
    lines.push(`- ${s.name || "Unnamed"} (Role: ${s.role || "—"})`);
  });
  lines.push("");

  // ── Rota (next 7 days from today) ────────────────────────────────────────
  lines.push("ROTA (next 7 days from today):");
  const next7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    next7.push(d);
  }

  next7.forEach((d) => {
    const dk = dayKey(d);
    const dn = dayName(d);
    const displayDate = fmtDate(dk);
    lines.push(`${displayDate} ${dn}:`);

    const slots = ["AM", "PM", "Eve"];
    slots.forEach((slot) => {
      const entries = [];
      staff.forEach((s) => {
        const val = rotaGrid[`${s.id}-${dk}-${slot}`];
        if (val) {
          entries.push(`${s.name || s.id}: ${val}`);
        }
      });
      if (entries.length > 0) {
        lines.push(`  ${slot}: ${entries.join(", ")}`);
      }
    });
  });
  lines.push("");

  // ── Programme Grid (next 7 days from today) ──────────────────────────────
  lines.push("PROGRAMME GRID (next 7 days from today):");
  next7.forEach((d) => {
    const dk = dayKey(d);
    const dn = dayName(d);
    const displayDate = fmtDate(dk);
    lines.push(`${displayDate} ${dn}:`);

    const slots = ["AM", "PM"];
    slots.forEach((slot) => {
      const entries = [];
      groups.forEach((g) => {
        const val = progGrid[`${g.id}-${dk}-${slot}`];
        if (val) {
          entries.push(`${g.group || g.name || g.id}: ${val}`);
        }
      });
      if (entries.length > 0) {
        lines.push(`  ${slot}: ${entries.join(", ")}`);
      }
    });
  });
  lines.push("");

  // ── Excursions ───────────────────────────────────────────────────────────
  lines.push("EXCURSIONS:");
  if (excursions.length === 0) {
    lines.push("  (none recorded)");
  } else {
    excursions.forEach((exc) => {
      const dateStr = exc.date ? fmtDate(exc.date) : "—";
      const dest = exc.destination || "—";
      const coaches = exc.coaches !== undefined ? exc.coaches : "—";
      lines.push(`- ${dateStr}: ${dest}, coaches: ${coaches}`);
    });
  }
  lines.push("");

  // ── Rooming ──────────────────────────────────────────────────────────────
  lines.push("ROOMING:");
  if (roomingHouses.length === 0) {
    lines.push("  (no houses configured)");
  } else {
    roomingHouses.forEach((house) => {
      lines.push(`House ${house.name || house.id}:`);
      const rooms = roomingRooms.filter((r) => r.houseId === house.id);
      if (rooms.length === 0) {
        lines.push("  (no rooms)");
      } else {
        rooms.forEach((room) => {
          const occupants = roomingAssignments
            .filter((a) => a.roomId === room.id && a.occupantName)
            .map((a) => a.occupantName);
          if (occupants.length > 0) {
            lines.push(`  Room ${room.roomName || room.name || room.id}: ${occupants.join(", ")}`);
          } else {
            lines.push(`  Room ${room.roomName || room.name || room.id}: unoccupied`);
          }
        });
      }
    });
  }
  lines.push("");

  // ── Transfers ────────────────────────────────────────────────────────────
  lines.push("TRANSFERS:");
  if (transfers.length === 0) {
    lines.push("  (none recorded)");
  } else {
    transfers.forEach((t) => {
      const dateStr = t.date ? fmtDate(t.date) : "—";
      const type = t.type || "—";
      const group = groups.find((g) => g.id === t.groupId);
      const groupName = group ? (group.group || group.name || t.groupId) : (t.groupId || "—");
      const stuCount = t.students || 0;
      lines.push(`- ${dateStr} ${type}: ${groupName}, ${stuCount} students`);
    });
  }

  return lines.join("\n");
}
