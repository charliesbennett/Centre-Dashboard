import * as XLSX from "xlsx";

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

// Convert a cell value (Date object or Excel serial) → 'YYYY-MM-DD'
// Handles BST: dates stored as UTC 23:xx are actually midnight of the next day
function toDateStr(v) {
  if (!v) return "";
  let d;
  if (v instanceof Date) {
    d = v;
  } else if (typeof v === "number" && v > 30000) {
    d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
  } else {
    return "";
  }
  if (d.getUTCHours() >= 20) d = new Date(d.getTime() + 3600000);
  const iso = d.toISOString().split("T")[0];
  if (iso < "1990-01-01") return ""; // reject epoch placeholder dates
  return iso;
}

// Parse formatted date string "4-Jul" or "4-Jul-25" → { month 0-based, day }
function parseDateLabel(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  return month !== undefined ? { month, day: parseInt(m[1]) } : null;
}

// Find column index where any label matches — searching across a range of rows.
// Skips cells longer than maxLen chars to avoid false positives from instruction text.
function findColInRows(rows, rowStart, rowEnd, maxLen, ...labels) {
  for (let r = rowStart; r <= rowEnd; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c] || "").toLowerCase().trim();
      if (!v || v.length > maxLen) continue;
      if (labels.some((l) => v.includes(l.toLowerCase()))) return c;
    }
  }
  return -1;
}

// Find the first row index where ≥4 cells are exactly "AM" or "PM" (the slot row)
function findSlotRowIdx(rows) {
  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const count = rows[r].filter((v) => /^(am|pm)$/i.test(String(v || "").trim())).length;
    if (count >= 4) return r;
  }
  return -1;
}

// Find first column index in a row containing a Date object or large serial (date header start)
function findFirstDateColInRow(row, searchFrom = 0) {
  for (let c = searchFrom; c < row.length; c++) {
    const v = row[c];
    if (v instanceof Date) return c;
    if (typeof v === "number" && v > 30000) return c;
    if (typeof v === "string" && parseDateLabel(v)) return c;
  }
  return -1;
}

// Build colIdx → 'YYYY-MM-DD'.
// For each date header cell: prefer actual Date object (most reliable);
// fall back to formatted label (.w) + yearHint when Date has wrong year.
function buildColDateMap(ws, headerRowIdx, firstDateCol, yearHint) {
  const map = {};
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  // headerRowIdx is 0-based from the first row returned by sheet_to_json,
  // which starts at range.s.r — so translate to absolute sheet row.
  const absRow = range.s.r + headerRowIdx;
  let lastDs = null; // for forward-fill: date header only appears in AM col, PM col is blank
  for (let c = firstDateCol; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: absRow, c });
    const cell = ws[addr];
    if (!cell) {
      // Blank column — forward-fill the last date (covers paired AM/PM structure)
      if (lastDs) map[c] = lastDs;
      continue;
    }

    // Try raw date value first
    const rawDs = toDateStr(cell.v);
    if (rawDs) {
      const rawYear = parseInt(rawDs.split("-")[0]);
      if (rawYear === yearHint || Math.abs(rawYear - yearHint) <= 1) {
        // Date is plausible — use it directly
        map[c] = rawDs;
        lastDs = rawDs;
        continue;
      }
      // Date has wrong year (common in copy-pasted templates) — fall through to .w
    }

    // Fall back to formatted label (.w) + yearHint, e.g. "4-Jul" → "2025-07-04"
    if (cell.w) {
      const parsed = parseDateLabel(cell.w);
      if (parsed) {
        const { month, day } = parsed;
        const ds = `${yearHint}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        map[c] = ds;
        lastDs = ds;
      }
    }
  }
  return map;
}

// Infer programme year from arrival/departure dates in data rows
function inferYearFromDataRows(rows, dataStartRow, arrCol, depCol) {
  for (let r = dataStartRow; r < rows.length; r++) {
    for (const c of [arrCol, depCol].filter((x) => x >= 0)) {
      const ds = toDateStr(rows[r][c]);
      if (ds && ds > "1990-01-01") return parseInt(ds.split("-")[0]);
    }
  }
  return new Date().getFullYear();
}

// Normalise an activity string
function normaliseActivity(str) {
  if (!str) return "";
  const s = str.replace(/\s+/g, " ").trim();
  if (!s || s === "~") return s;
  if (/arriv/i.test(s)) return "ARRIVAL";
  if (/depart/i.test(s)) return "DEPARTURE";
  return s;
}

export async function parseMasterExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true, cellNF: true });

  // Find Programmes sheet
  const wsName =
    wb.SheetNames.find((n) => n.toLowerCase().trim() === "programmes") ||
    wb.SheetNames.find((n) => n.toLowerCase().includes("programme"));

  if (!wsName) {
    return {
      ok: false,
      error: `No 'Programmes' sheet found. Sheets in this file: ${wb.SheetNames.join(", ")}`,
    };
  }

  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (rows.length < 4) {
    return { ok: false, error: "Programmes sheet has fewer than 4 rows — unexpected format." };
  }

  // ── Detect structure ───────────────────────────────────────────────────────
  const slotRowIdx = findSlotRowIdx(rows);
  if (slotRowIdx === -1) {
    return { ok: false, error: "Could not find AM/PM slot row. Check the Programmes sheet has AM and PM column headers." };
  }

  // Header rows: slotRowIdx-2 (metadata + dates) and slotRowIdx-1 (day names, sometimes also metadata)
  const metaRowIdx = slotRowIdx - 2;
  if (metaRowIdx < 0) {
    return { ok: false, error: "Unexpected sheet layout: AM/PM row appears too early." };
  }

  // Search for column labels across BOTH header rows (some files split labels across rows)
  // Max 20 chars to skip long instructional cells like ">> UNHIDE ROW 12-13 FOR EXAMPLE GROUP <<"
  const agentCol = findColInRows(rows, metaRowIdx, slotRowIdx - 1, 20, "agent");
  const groupCol = findColInRows(rows, metaRowIdx, slotRowIdx - 1, 20, "group name", "group");
  const natCol   = findColInRows(rows, metaRowIdx, slotRowIdx - 1, 20, "nationality", "nat");
  const stuCol   = findColInRows(rows, metaRowIdx, slotRowIdx - 1, 20, "student");
  const glCol    = findColInRows(rows, metaRowIdx, slotRowIdx - 1, 20, "leader");
  const arrCol   = findColInRows(rows, metaRowIdx, slotRowIdx - 1, 20, "arrival");
  // "Deaprture" is a known typo in some files — include "deapr" to catch it
  const depCol   = findColInRows(rows, metaRowIdx, slotRowIdx - 1, 20, "departure", "depart", "deapr");

  if (groupCol === -1 || arrCol === -1 || depCol === -1) {
    return {
      ok: false,
      error: `Could not locate required columns (Group=${groupCol}, Arrival=${arrCol}, Depart=${depCol}). ` +
        `Check that the Programmes sheet has 'Group', 'Arrival', and 'Departure'/'Depart' column headers.`,
    };
  }

  // Find where date columns start (after all metadata columns)
  const lastMetaCol = Math.max(agentCol, groupCol, natCol, stuCol, glCol, arrCol, depCol);
  const metaRow = rows[metaRowIdx];
  const firstDateColIdx = findFirstDateColInRow(metaRow, lastMetaCol + 1);

  if (firstDateColIdx === -1) {
    return { ok: false, error: "Could not find date columns in the header row. Check the Programmes sheet format." };
  }

  // ── Year inference ─────────────────────────────────────────────────────────
  // Always derive year from actual arrival/departure dates in data rows (most reliable).
  // Date serials in header rows are sometimes wrong year (copy-paste artefact).
  const dataStartRow = slotRowIdx + 1;
  const yearHint = inferYearFromDataRows(rows, dataStartRow, arrCol, depCol);

  // ── Build date and slot maps ───────────────────────────────────────────────
  const colDateMap = buildColDateMap(ws, metaRowIdx, firstDateColIdx, yearHint);
  const colSlotMap = {};
  rows[slotRowIdx].forEach((v, c) => {
    const s = String(v || "").toUpperCase().trim();
    if (s === "AM" || s === "PM") colSlotMap[c] = s;
  });

  if (Object.keys(colDateMap).length === 0) {
    return { ok: false, error: "Parsed 0 date columns — could not read dates from the header row." };
  }

  // ── Parse group rows ───────────────────────────────────────────────────────
  const lastValueByCol = {};
  const groups = [];

  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r];

    // Skip totals / summary rows
    const arrVal = String(row[arrCol] || "").trim();
    if (/totals/i.test(arrVal)) continue;

    const agent = agentCol >= 0 ? String(row[agentCol] || "").trim() : "";
    const group = String(row[groupCol] || "").trim();

    // Skip blank rows and unfilled template placeholders
    if (!group) continue;
    if (/^group\s*\d+$/i.test(group)) continue;
    if (/^example/i.test(group)) continue;

    const arr = toDateStr(row[arrCol]);
    const dep = toDateStr(row[depCol]);
    if (!arr || !dep) continue;

    const nat = natCol >= 0 ? String(row[natCol] || "").trim() : "";
    const stu = stuCol >= 0 ? (parseInt(row[stuCol]) || 0) : 0;
    const gl  = glCol  >= 0 ? (parseInt(row[glCol])  || 0) : 0;

    const cells = {};
    Object.entries(colDateMap).forEach(([cStr, ds]) => {
      const c = parseInt(cStr);
      const slot = colSlotMap[c];
      if (!slot) return;

      const raw = String(row[c] || "").trim();
      let val;
      if (raw === "~") {
        val = lastValueByCol[c] || "";
      } else {
        val = normaliseActivity(raw);
        if (val && val !== "ARRIVAL" && val !== "DEPARTURE") {
          lastValueByCol[c] = val;
        }
      }

      if (!val) return;
      cells[`${ds}-${slot}`] = val;
    });

    groups.push({ agent, group, nat, stu, gl, arr, dep, cells });
  }

  if (groups.length === 0) {
    return {
      ok: false,
      error: "No group rows found. Make sure groups have Agent, Group Name, Arrival and Departure dates filled in.",
    };
  }

  return { ok: true, groups, yearHint };
}
