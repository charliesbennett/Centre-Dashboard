import * as XLSX from "xlsx";
import { uid } from "@/lib/constants";

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

// Find the header row in a sheet's raw rows: the first row containing both
// an ATTRACTION column and a column mentioning EXCURSION DATE.
function findHeader(rows) {
  const idx = rows.findIndex((row) =>
    row.some((c) => String(c).trim().toUpperCase() === "ATTRACTION") &&
    row.some((c) => String(c).trim().toUpperCase().includes("EXCURSION DATE")));
  if (idx === -1) return null;
  return { headerRowIdx: idx, headers: rows[idx].map((h) => String(h || "").trim().toUpperCase()) };
}

// Parse one sheet (bookings or coaches — both use the same UKLC column layout)
// into row records. groups/centreName are only used to guess group links.
function parseSheetRows(rows, headerRowIdx, headers, { groups, centreName }) {
  const col = (name) => headers.findIndex((h) => h === name);
  const centreCol     = col("CENTRE");
  const attractionCol  = col("ATTRACTION");
  const dayPartCol     = headers.findIndex((h) => h.includes("FULL DAY") || h.includes("HALF DAY"));
  const transportCol   = col("TRANSPORT METHOD");
  const stuCol         = col("STUDENT NO");
  const glCol          = col("LEADER NO");
  const staffCol       = col("UKLC STAFF NO");
  const dateCol        = headers.findIndex((h) => h.includes("EXCURSION DATE"));
  const refCol         = headers.findIndex((h) => h.includes("BOOKING REF"));
  const coachNotesCol  = col("COACH NOTES");
  const emailCol       = col("EMAIL CONTACT");
  const linkCol        = headers.findIndex((h) => h.includes("LINK TO BOOKING"));

  if (attractionCol === -1 || dateCol === -1) return null;

  const out = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const attraction = String(row[attractionCol] || "").trim();
    const date = toDateStr(row[dateCol]);
    if (!attraction || !date) continue;

    const centreCell = centreCol >= 0 ? String(row[centreCol] || "").trim() : "";
    const label = cohortLabel(centreCell, centreName);

    out.push({
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
      groupIds: matchGroups(label, groups),
    });
  }
  return out;
}

// Find booking(s) matching a coach row's date + attraction (case/whitespace-insensitive),
// preferring a day-part match when a date+attraction has more than one booking (AM/PM split).
export function findMatchingBookings(coachRow, bookings) {
  const norm = coachRow.attraction.trim().toLowerCase();
  const sameDateAttraction = bookings.filter((b) => b.date === coachRow.date && b.attraction.trim().toLowerCase() === norm);
  if (sameDateAttraction.length <= 1) return sameDateAttraction;
  const dayPartMatch = sameDateAttraction.filter((b) => b.dayPart === coachRow.dayPart);
  return dayPartMatch.length > 0 ? dayPartMatch : sameDateAttraction;
}

export function coachRowToCoach(coachRow) {
  return {
    id: uid(),
    company: "", phone: "", invoiceNo: "",
    bookingRef: coachRow.bookingRef,
    pickupTime: "", dropoffTime: "",
    vehicle: coachRow.transportMethod || "Coach",
    notes: coachRow.notes,
    status: "Pending",
  };
}

// Parse a UKLC excursion spreadsheet → bookings (each with coaches attached where a
// matching coach-sheet row exists) plus any coach rows that couldn't be matched within
// this file (e.g. a coaches-only upload) for the caller to resolve against existing data.
// groups: this centre's groups (for fuzzy-matching the CENTRE column's cohort suffix)
// centreName: the active centre's name (stripped from CENTRE cells to find the suffix)
export async function parseExcursionsExcel(file, { groups = [], centreName = "" } = {}) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });

  if (wb.SheetNames.length === 0) return { ok: false, error: "No sheets found in file." };

  const bookings = [];
  let coachRows = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", range: actualRange(ws) });
    if (rows.length < 2) continue;

    const header = findHeader(rows);
    if (!header) continue;

    const parsed = parseSheetRows(rows, header.headerRowIdx, header.headers, { groups, centreName });
    if (!parsed) continue;

    if (/coach/i.test(sheetName)) {
      coachRows = coachRows.concat(parsed);
    } else {
      bookings.push(...parsed);
    }
  }

  if (bookings.length === 0 && coachRows.length === 0) {
    return { ok: false, error: "No booking or coach rows found. Check this is the correct file — expected an ATTRACTION and EXCURSION DATE column." };
  }

  bookings.forEach((b) => { b.coaches = []; });
  const unmatchedCoachRows = [];
  coachRows.forEach((coachRow) => {
    const matches = findMatchingBookings(coachRow, bookings);
    if (matches.length > 0) {
      matches[0].coaches.push(coachRowToCoach(coachRow));
    } else {
      unmatchedCoachRows.push(coachRow);
    }
  });

  return { ok: true, bookings, unmatchedCoachRows };
}
