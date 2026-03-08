import * as XLSX from "xlsx";

/**
 * Parse a rooming list Excel file (.xlsx / .xlsm).
 *
 * Expected column layout (1-indexed):
 *   B: floor label (often a merged cell spanning the floor's rows)
 *   C: building / house name
 *   D: room number (integer)
 *   E: occupant type  (M / F / GL / UKLC / …)
 *   F: first name
 *   G: last name
 *
 * Returns:
 *   { houses, totalRooms, totalBeds, namedBeds }
 *   or { error: string }
 */
export function parseRoomingExcel(arrayBuffer) {
  try {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { error: "No worksheet found in the file." };

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const merges = ws["!merges"] || [];

    // ── 1. Resolve floor labels from merged cells in column B ────────
    const floorByRow = {};
    merges
      .filter((m) => m.s.c === 1) // column B (index 1)
      .forEach((m) => {
        const cellAddr = XLSX.utils.encode_cell({ r: m.s.r, c: 1 });
        const val = ws[cellAddr]?.v;
        if (val && typeof val === "string" && val.trim()) {
          for (let r = m.s.r; r <= m.e.r; r++) {
            floorByRow[r] = val.trim();
          }
        }
      });
    // Also capture un-merged labels (any non-empty text in column B)
    rows.forEach((row, i) => {
      const b = String(row[1] || "").trim();
      if (b && !floorByRow[i]) floorByRow[i] = b;
    });

    // ── 2. Build room map ────────────────────────────────────────────
    // key: `${houseName}|||${roomNum}`
    const roomsMap = new Map();

    rows.forEach((row, i) => {
      const houseName = String(row[2] || "").trim();
      const rawRoom = row[3];
      const occType = String(row[4] || "").trim();
      const firstName = String(row[5] || "").trim();
      const lastName = String(row[6] || "").trim();

      if (!houseName) return;
      const roomNum = typeof rawRoom === "number" ? rawRoom : parseInt(rawRoom);
      if (isNaN(roomNum) && rawRoom !== 0) return;

      const floor = floorByRow[i] || "";
      const key = `${houseName}|||${roomNum}`;

      if (!roomsMap.has(key)) {
        roomsMap.set(key, {
          houseName,
          floor,
          roomNum,
          roomName: "Room " + roomNum,
          beds: [],
        });
      }
      roomsMap.get(key).beds.push({ firstName, lastName, occType });
    });

    if (roomsMap.size === 0) {
      return {
        error:
          "No room data found. Check that column C has a building name and column D has room numbers.",
      };
    }

    // ── 3. Group into houses ─────────────────────────────────────────
    const housesMap = new Map();
    for (const room of roomsMap.values()) {
      if (!housesMap.has(room.houseName)) {
        housesMap.set(room.houseName, { name: room.houseName, rooms: [] });
      }
      housesMap.get(room.houseName).rooms.push(room);
    }

    const houses = Array.from(housesMap.values());
    const totalRooms = houses.reduce((s, h) => s + h.rooms.length, 0);
    const totalBeds = houses.reduce(
      (s, h) => s + h.rooms.reduce((rs, r) => rs + r.beds.length, 0),
      0
    );
    const namedBeds = houses.reduce(
      (s, h) =>
        s +
        h.rooms.reduce(
          (rs, r) =>
            rs + r.beds.filter((b) => b.firstName || b.lastName).length,
          0
        ),
      0
    );

    return { houses, totalRooms, totalBeds, namedBeds };
  } catch (err) {
    return { error: "Failed to parse file: " + err.message };
  }
}
