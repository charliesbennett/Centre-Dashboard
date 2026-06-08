import * as XLSX from "xlsx";

export function parseRoomingExcel(arrayBuffer) {
  try {
    const wb = XLSX.read(arrayBuffer, { type: "array" });

    // Prefer "Overview" sheet, fall back to first
    const sheetName =
      wb.SheetNames.find((n) => n.toLowerCase() === "overview") ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return { error: "No worksheet found in the file." };

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    // Detect Heads-on-Beds format: col D contains "Bed N" entries
    const bedRows = rows.filter((r) => /^bed\s+\d+$/i.test(String(r[3] || "").trim()));
    if (bedRows.length >= 2) return parseHeadsOnBeds(rows);

    return parseNamedLayout(wb, ws, rows);
  } catch (err) {
    return { error: "Failed to parse file: " + err.message };
  }
}

// ── Heads-on-Beds format ──────────────────────────────────────────────────────
// Col A: House name  (sparse — carry forward)
// Col B: Floor label (sparse — carry forward)
// Col C: Room name   (sparse — e.g. "Room 1"; may contain \r\n — cleaned)
// Col D: Bed rows    ("Bed 1", "Bed 2" …) OR bare integers (1, 2, 3…) — count = capacity
function parseHeadsOnBeds(rows) {
  const houses = [];
  let curHouse = null;
  let curFloor = "";
  let curRoom = null;
  let curRoomName = "";

  const isBedRow = (v) => /^bed\s+\d+$/i.test(v) || /^\d+$/.test(v);

  for (const row of rows) {
    const houseVal = String(row[0] || "").trim();
    const floorVal = String(row[1] || "").trim();
    const roomVal  = String(row[2] || "").trim().replace(/[\r\n]+/g, " ");
    const bedVal   = String(row[3] || "").trim();

    if (houseVal && (!curHouse || houseVal !== curHouse.name)) {
      curFloor = "";
      curRoomName = "";
      curRoom = null;
      curHouse = { name: houseVal, rooms: [] };
      houses.push(curHouse);
    }

    if (floorVal) curFloor = floorVal;

    if (roomVal && roomVal !== curRoomName) {
      curRoomName = roomVal;
      curRoom = { houseName: curHouse?.name ?? "", floor: curFloor, roomName: roomVal, beds: [] };
      curHouse?.rooms.push(curRoom);
    }

    if (isBedRow(bedVal) && curRoom) {
      curRoom.beds.push({ firstName: "", lastName: "", occType: "" });
    }
  }

  const validHouses = houses.filter((h) => h.rooms.length > 0);
  if (validHouses.length === 0) {
    return {
      error:
        "No rooms found. Ensure the Overview tab has House (A), Floor (B), Room (C), and Bed (D) columns.",
    };
  }

  const totalRooms = validHouses.reduce((s, h) => s + h.rooms.length, 0);
  const totalBeds  = validHouses.reduce(
    (s, h) => s + h.rooms.reduce((rs, r) => rs + r.beds.length, 0),
    0
  );
  return { houses: validHouses, totalRooms, totalBeds, namedBeds: 0 };
}

// ── Named-occupant layout ─────────────────────────────────────────────────────
// Auto-detects the column containing integer room numbers, then reads:
//   roomCol-2: floor,  roomCol-1: house,  roomCol: room#,
//   roomCol+1: type,   roomCol+2: first,  roomCol+3: last
function parseNamedLayout(wb, ws, rows) {
  const sheetRange = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
  const colOffset  = sheetRange ? sheetRange.s.c : 0;
  const merges     = ws["!merges"] || [];

  // Auto-detect room number column (most positive-integer values, skip col 0)
  const colScores = {};
  rows.forEach((row) => {
    row.forEach((cell, relCi) => {
      if (relCi < 1) return;
      const n = typeof cell === "number" ? cell : parseInt(cell);
      if (!isNaN(n) && n > 0 && n < 1000) colScores[relCi] = (colScores[relCi] || 0) + 1;
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

  const floorRelCol = roomCol - 2;
  const houseRelCol = roomCol - 1;
  const typeRelCol  = roomCol + 1;
  const fnRelCol    = roomCol + 2;
  const lnRelCol    = roomCol + 3;
  const floorAbsCol = floorRelCol + colOffset;
  const houseAbsCol = houseRelCol + colOffset;

  // Resolve merged floor labels
  const floorByRow = {};
  merges
    .filter((m) => m.s.c === floorAbsCol)
    .forEach((m) => {
      const val = ws[XLSX.utils.encode_cell({ r: m.s.r, c: floorAbsCol })]?.v;
      if (val && String(val).trim()) {
        for (let r = m.s.r; r <= m.e.r; r++) floorByRow[r] = String(val).trim();
      }
    });
  let lastFloor = "";
  rows.forEach((row, i) => {
    if (floorRelCol < 0) return;
    const v = String(row[floorRelCol] || "").trim();
    if (v && isNaN(Number(v))) lastFloor = v;
    if (!floorByRow[i] && lastFloor) floorByRow[i] = lastFloor;
  });

  // Resolve merged house names
  const houseByRow = {};
  merges
    .filter((m) => m.s.c === houseAbsCol)
    .forEach((m) => {
      const val = ws[XLSX.utils.encode_cell({ r: m.s.r, c: houseAbsCol })]?.v;
      if (val && String(val).trim()) {
        for (let r = m.s.r; r <= m.e.r; r++) houseByRow[r] = String(val).trim();
      }
    });
  let lastHouse = "";
  rows.forEach((row, i) => {
    const v = String(row[houseRelCol] || "").trim();
    if (v && isNaN(Number(v))) lastHouse = v;
    if (!houseByRow[i] && lastHouse) houseByRow[i] = lastHouse;
  });

  // Build room map
  const roomsMap = new Map();
  rows.forEach((row, i) => {
    const houseName = houseByRow[i] || "";
    const rawRoom   = row[roomCol];
    if (!houseName) return;
    const roomNum = typeof rawRoom === "number" ? rawRoom : parseInt(rawRoom);
    if (isNaN(roomNum)) return;
    const floor = floorByRow[i] || "";
    const key   = `${houseName}|||${roomNum}`;
    if (!roomsMap.has(key)) {
      roomsMap.set(key, { houseName, floor, roomNum, roomName: String(roomNum), beds: [] });
    }
    roomsMap.get(key).beds.push({
      firstName: String(row[fnRelCol]   || "").trim(),
      lastName:  String(row[lnRelCol]   || "").trim(),
      occType:   String(row[typeRelCol] || "").trim(),
    });
  });

  if (roomsMap.size === 0) {
    return {
      error:
        "No room data found. The file was read but no rows had both a building name and a room number.",
    };
  }

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
}
