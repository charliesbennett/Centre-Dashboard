import * as XLSX from "xlsx";

// Some spreadsheets declare a huge used range (e.g. "A1:XFA1048256") because
// formatting was applied to whole columns/rows, even though only a handful of
// cells actually hold data. Reading with that declared range via sheet_to_json
// allocates a row for every one of those million+ rows and can crash the tab.
// Cells without values aren't stored in the worksheet object, so scanning the
// sparse key set gives the real bounding box cheaply.
function actualRange(ws) {
  let maxRow = 0, maxCol = 0;
  for (const key in ws) {
    if (key[0] === "!") continue;
    const addr = XLSX.utils.decode_cell(key);
    if (addr.r > maxRow) maxRow = addr.r;
    if (addr.c > maxCol) maxCol = addr.c;
  }
  return { s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } };
}

// Convert Excel serial date → "YYYY-MM-DD" (mirrors parseGroupsExcel.js)
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
  return iso < "2020-01-01" ? "" : iso;
}

function titleCase(s) {
  return String(s || "").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function normaliseDayPart(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("am") && s.includes("half")) return "AM Half";
  if (s.includes("pm") && s.includes("half")) return "PM Half";
  if (s.includes("half")) return "AM Half";
  return "Full";
}

function normaliseTransport(raw) {
  const t = titleCase(raw);
  return ["Coach", "Walk", "Train", "Minibus"].includes(t) ? t : (t ? "Other" : "");
}

// Strip the leading centre name from a CENTRE cell to isolate the cohort/group
// suffix, e.g. "REASEHEATH - FOOTBALL" + "Reaseheath" → "FOOTBALL"
function cohortLabel(centreCell, centreName) {
  const raw = String(centreCell || "").trim();
  const norm = raw.toLowerCase();
  const baseNorm = String(centreName || "").trim().toLowerCase();
  if (baseNorm && norm.startsWith(baseNorm)) {
    return raw.slice(centreName.trim().length).replace(/^[\s\-–—]+/, "").trim();
  }
  const dashIdx = raw.search(/[\-–—]/);
  return dashIdx >= 0 ? raw.slice(dashIdx + 1).trim() : "";
}

// Fuzzy-match a cohort label against this centre's groups by name/agent word overlap
function matchGroups(label, groups) {
  if (!label) return [];
  const words = label.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return [];
  return (groups || [])
    .filter((g) => {
      const name = `${g.group || ""} ${g.agent || ""}`.toLowerCase();
      return words.some((w) => name.includes(w));
    })
    .map((g) => g.id);
}

// Parse a UKLC excursion bookings spreadsheet → array of booking objects.
// groups: this centre's groups (for fuzzy-matching the CENTRE column's cohort suffix)
// centreName: the active centre's name (stripped from CENTRE cells to find the suffix)
export async function parseExcursionsExcel(file, { groups = [], centreName = "" } = {}) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });

  const wsName = wb.SheetNames[0];
  if (!wsName) return { ok: false, error: "No sheets found in file." };

  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", range: actualRange(ws) });
  if (rows.length < 2) return { ok: false, error: "File has too few rows." };

  const headerRowIdx = rows.findIndex((row) =>
    row.some((c) => String(c).trim().toUpperCase() === "ATTRACTION") &&
    row.some((c) => String(c).trim().toUpperCase().includes("EXCURSION DATE")));
  if (headerRowIdx === -1) {
    return { ok: false, error: "Could not find the header row (expected an ATTRACTION and EXCURSION DATE column)." };
  }

  const headers = rows[headerRowIdx].map((h) => String(h || "").trim().toUpperCase());
  const col = (name) => headers.findIndex((h) => h === name);

  const centreCol      = col("CENTRE");
  const attractionCol   = col("ATTRACTION");
  const dayPartCol      = headers.findIndex((h) => h.includes("FULL DAY") || h.includes("HALF DAY"));
  const transportCol    = col("TRANSPORT METHOD");
  const stuCol          = col("STUDENT NO");
  const glCol           = col("LEADER NO");
  const staffCol        = col("UKLC STAFF NO");
  const dateCol         = headers.findIndex((h) => h.includes("EXCURSION DATE"));
  const refCol          = headers.findIndex((h) => h.includes("BOOKING REF"));
  const coachNotesCol   = col("COACH NOTES");
  const emailCol        = col("EMAIL CONTACT");
  const linkCol         = headers.findIndex((h) => h.includes("LINK TO BOOKING"));

  if (attractionCol === -1 || dateCol === -1) {
    return { ok: false, error: "Could not find 'Attraction' or 'Excursion Date' columns. Check this is the correct file." };
  }

  const bookings = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const attraction = String(row[attractionCol] || "").trim();
    const date = toDateStr(row[dateCol]);
    if (!attraction || !date) continue;

    const centreCell = centreCol >= 0 ? String(row[centreCol] || "").trim() : "";
    const label = cohortLabel(centreCell, centreName);
    const groupIds = matchGroups(label, groups);

    bookings.push({
      date,
      attraction,
      dayPart: dayPartCol >= 0 ? normaliseDayPart(row[dayPartCol]) : "Full",
      transportMethod: transportCol >= 0 ? normaliseTransport(row[transportCol]) : "",
      studentNo: stuCol >= 0 ? (parseInt(row[stuCol]) || 0) : 0,
      leaderNo: glCol >= 0 ? (parseInt(row[glCol]) || 0) : 0,
      staffCount: staffCol >= 0 ? (parseInt(row[staffCol]) || 0) : 0,
      bookingRef: refCol >= 0 ? String(row[refCol] || "").trim() : "",
      notes: coachNotesCol >= 0 ? String(row[coachNotesCol] || "").trim() : "",
      emailContact: emailCol >= 0 ? String(row[emailCol] || "").trim() : "",
      bookingLink: linkCol >= 0 ? String(row[linkCol] || "").trim() : "",
      cohortLabel: label,
      centreCell,
      groupIds,
    });
  }

  if (bookings.length === 0) return { ok: false, error: "No booking rows found in this file." };
  return { ok: true, bookings };
}
