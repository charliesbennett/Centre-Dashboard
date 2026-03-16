import * as XLSX from "xlsx";

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

// Convert Excel date serial or JS Date object → 'YYYY-MM-DD'
// Applies BST correction: dates stored as UTC 23:00 are actually BST midnight
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
  // BST fix: if stored as 23:xx UTC it's actually midnight of the next day
  if (d.getUTCHours() >= 20) d = new Date(d.getTime() + 3600000);
  return d.toISOString().split("T")[0];
}

// Parse a formatted date string like "4-Jul" or "4-Jul-25" → { month (0-based), day }
function parseDateLabel(str) {
  if (!str) return null;
  const s = str.trim();
  const m = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  return { month, day: parseInt(m[1]) };
}

// Build colIdx → 'YYYY-MM-DD' map from row-0 cells and a year hint
function buildColDateMap(ws, yearHint, startCol = 9) {
  const map = {};
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let c = startCol; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (!cell) continue;
    // Prefer formatted value (.w), fall back to raw
    let parsed = null;
    if (cell.w) {
      parsed = parseDateLabel(cell.w);
    }
    if (!parsed && cell.v instanceof Date) {
      // Adjust for BST then use month/day
      let d = cell.v;
      if (d.getUTCHours() >= 20) d = new Date(d.getTime() + 3600000);
      parsed = { month: d.getUTCMonth(), day: d.getUTCDate() };
    }
    if (!parsed) continue;
    const { month, day } = parsed;
    // Determine year: if month is earlier than Jan of yearHint and yearHint is near year-end,
    // it could be yearHint+1. Simple heuristic: trust yearHint for summer programmes.
    const y = yearHint;
    map[c] = `${y}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return map;
}

// Build colIdx → 'AM'|'PM' map from row 2 (index 2)
function buildColSlotMap(row2, startCol = 9) {
  const map = {};
  row2.forEach((v, c) => {
    if (c < startCol) return;
    const s = String(v || "").toUpperCase().trim();
    if (s === "AM" || s === "PM") map[c] = s;
  });
  return map;
}

// Infer the programme year from data rows' arrival/departure cells (cols 6, 7, 8)
function inferYear(rows) {
  for (let r = 3; r < rows.length; r++) {
    for (const c of [6, 7, 8]) {
      const v = rows[r][c];
      const ds = toDateStr(v);
      if (ds) return parseInt(ds.split("-")[0]);
    }
  }
  return new Date().getFullYear();
}

// Find the DATA_COL_START — first column index where row 2 has AM/PM pattern
function findDataColStart(rows) {
  const slotRow = rows[2] || [];
  for (let c = 0; c < slotRow.length; c++) {
    const s = String(slotRow[c] || "").toUpperCase().trim();
    if (s === "AM") return c;
  }
  return 9; // fallback
}

// Normalise an activity cell value
function normaliseActivity(str) {
  if (!str) return "";
  const s = str.replace(/\s+/g, " ").trim();
  if (!s || s === "~") return s; // tilde handled by caller
  if (/arriv/i.test(s)) return "ARRIVAL";
  if (/depart/i.test(s)) return "DEPARTURE";
  return s;
}

export async function parseMasterExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true, cellNF: true });

  // Find Programmes sheet (case-insensitive)
  const wsName = wb.SheetNames.find((n) => n.toLowerCase().trim() === "programmes");
  if (!wsName) {
    return { ok: false, error: `No 'Programmes' sheet found. Sheets in this file: ${wb.SheetNames.join(", ")}` };
  }

  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (rows.length < 4) {
    return { ok: false, error: "Programmes sheet has fewer than 4 rows — unexpected format." };
  }

  const startCol = findDataColStart(rows);
  const yearHint = inferYear(rows);
  const colDateMap = buildColDateMap(ws, yearHint, startCol);
  const colSlotMap = buildColSlotMap(rows[2], startCol);

  if (Object.keys(colDateMap).length === 0) {
    return { ok: false, error: "Could not read date columns from row 1. Check the Programmes sheet format." };
  }

  // Track last value per column (for "~" = same as above substitution)
  const lastValueByCol = {};
  const groups = [];

  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    const agent = String(row[0] || "").trim();
    const group = String(row[1] || "").trim();
    if (!agent && !group) continue; // blank row

    const nat = String(row[2] || "").trim();
    const stu = parseInt(row[3]) || 0;
    const gl  = parseInt(row[4]) || 0;
    const arr = toDateStr(row[6]);
    const dep = toDateStr(row[8]);
    if (!arr || !dep) continue; // no valid dates → skip

    const cells = {};
    Object.entries(colDateMap).forEach(([cStr, ds]) => {
      const c = parseInt(cStr);
      const slot = colSlotMap[c];
      if (!slot) return;

      const raw = String(row[c] || "").trim();
      let val;
      if (raw === "~") {
        // Substitute last non-empty, non-arrival/departure value from same column
        val = lastValueByCol[c] || "";
      } else {
        val = normaliseActivity(raw);
        // Update tracker (don't track ARRIVAL/DEPARTURE as inheritable)
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
    return { ok: false, error: "No group rows found in the Programmes sheet." };
  }

  return { ok: true, groups, yearHint };
}
