import * as XLSX from "xlsx";

/**
 * Parse a rooming list Excel file (.xlsx / .xlsm / .xls).
 *
 * Auto-detects column layout by finding the column that contains room numbers.
 * Handles sheets that start at column A or column B (both layouts are common).
 *
 * Detected layout (relative to room number column):
 *   roomCol - 2 : floor label   (may be a merged cell spanning the floor's rows)
 *   roomCol - 1 : house / building name
 *   roomCol     : room number   (positive integer)
 *   roomCol + 1 : occupant type (M / F / GL / UKLC / …)
 *   roomCol + 2 : first name
 *   roomCol + 3 : last name
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

    // Sheet may not start at column A — track the offset so we can convert
    // between sheet_to_json relative indices and the absolute column indices
    // used by ws["!merges"] and XLSX.utils.encode_cell.
    const sheetRange = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
    const colOffset  = sheetRange ? sheetRange.s.c : 0; // absolute col of relative index 0

    const merges = ws["!merges"] || [];

    // ── 1. Auto-detect the room number column (relative index) ───────
    // Score each column by how many rows contain a positive integer ≤ 999.
    // Skip the first relative column (usually a floor/title label).
    const colScores = {};
    rows.forEach((row) => {
      row.forEach((cell, relCi) => {
        if (relCi < 1) return;
        const n = typeof cell === "number" ? cell : parseInt(cell);
        if (!isNaN(n) && n > 0 && n < 1000) {
          colScores[relCi] = (colScores[relCi] || 0) + 1;
        }
      });
    });

    const roomCol = Object.entries(colScores)
      .sort((a, b) => b[1] - a[1])
      .map(([ci]) => parseInt(ci))[0];

    if (roomCol === undefined || roomCol < 1) {
      return {
        error:
          "No room numbers found. Make sure the file has a column of room numbers (e.g. 1, 2, 3…).",
      };
    }

    const floorRelCol = roomCol - 2; // relative index of floor column
    const houseRelCol = roomCol - 1; // relative index of house column
    const typeRelCol  = roomCol + 1;
    const fnRelCol    = roomCol + 2;
    const lnRelCol    = roomCol + 3;

    // Absolute column indices (for merge lookup and encode_cell)
    const floorAbsCol = floorRelCol + colOffset;
    const houseAbsCol = houseRelCol + colOffset;

    // ── 2. Resolve floor labels ──────────────────────────────────────
    // Floor labels are often in a vertically merged cell — propagate the
    // value across all rows the merge spans.
    const floorByRow = {};
    merges
      .filter((m) => m.s.c === floorAbsCol)
      .forEach((m) => {
        const cellAddr = XLSX.utils.encode_cell({ r: m.s.r, c: floorAbsCol });
        const val = ws[cellAddr]?.v;
        if (val && String(val).trim()) {
          for (let r = m.s.r; r <= m.e.r; r++) {
            floorByRow[r] = String(val).trim();
          }
        }
      });
    // Also carry-forward any non-empty un-merged floor values
    let lastFloor = "";
    rows.forEach((row, i) => {
      if (floorRelCol < 0) return;
      const v = String(row[floorRelCol] || "").trim();
      // Treat as a floor label only if it's non-numeric and different from house name
      if (v && isNaN(Number(v))) lastFloor = v;
      if (!floorByRow[i] && lastFloor) floorByRow[i] = lastFloor;
    });

    // ── 3. Resolve house names ───────────────────────────────────────
    // House names may be merged or simply repeated in every row.
    const houseByRow = {};
    merges
      .filter((m) => m.s.c === houseAbsCol)
      .forEach((m) => {
        const cellAddr = XLSX.utils.encode_cell({ r: m.s.r, c: houseAbsCol });
        const val = ws[cellAddr]?.v;
        if (val && String(val).trim()) {
          for (let r = m.s.r; r <= m.e.r; r++) {
            houseByRow[r] = String(val).trim();
          }
        }
      });
    // Carry-forward repeated (un-merged) house names
    let lastHouse = "";
    rows.forEach((row, i) => {
      const v = String(row[houseRelCol] || "").trim();
      if (v && isNaN(Number(v))) lastHouse = v;
      if (!houseByRow[i] && lastHouse) houseByRow[i] = lastHouse;
    });

    // ── 4. Build room map ────────────────────────────────────────────
    const roomsMap = new Map();

    rows.forEach((row, i) => {
      const houseName = houseByRow[i] || "";
      const rawRoom   = row[roomCol];
      const occType   = String(row[typeRelCol] || "").trim();
      const firstName = String(row[fnRelCol]   || "").trim();
      const lastName  = String(row[lnRelCol]   || "").trim();

      if (!houseName) return;
      const roomNum = typeof rawRoom === "number" ? rawRoom : parseInt(rawRoom);
      if (isNaN(roomNum)) return;

      const floor = floorByRow[i] || "";
      const key   = `${houseName}|||${roomNum}`;

      if (!roomsMap.has(key)) {
        roomsMap.set(key, {
          houseName,
          floor,
          roomNum,
          roomName: String(roomNum), // use the raw number as-is, no "Room X" prefix
          beds: [],
        });
      }
      roomsMap.get(key).beds.push({ firstName, lastName, occType });
    });

    if (roomsMap.size === 0) {
      return {
        error:
          "No room data found. The file was read but no rows had both a building name and a room number. Check the file is not password-protected.",
      };
    }

    // ── 5. Group into houses ─────────────────────────────────────────
    const housesMap = new Map();
    for (const room of roomsMap.values()) {
      if (!housesMap.has(room.houseName)) {
        housesMap.set(room.houseName, { name: room.houseName, rooms: [] });
      }
      housesMap.get(room.houseName).rooms.push(room);
    }

    const houses     = Array.from(housesMap.values());
    const totalRooms = houses.reduce((s, h) => s + h.rooms.length, 0);
    const totalBeds  = houses.reduce(
      (s, h) => s + h.rooms.reduce((rs, r) => rs + r.beds.length, 0),
      0
    );
    const namedBeds  = houses.reduce(
      (s, h) =>
        s + h.rooms.reduce(
          (rs, r) => rs + r.beds.filter((b) => b.firstName || b.lastName).length,
          0
        ),
      0
    );

    return { houses, totalRooms, totalBeds, namedBeds };
  } catch (err) {
    return { error: "Failed to parse file: " + err.message };
  }
}
