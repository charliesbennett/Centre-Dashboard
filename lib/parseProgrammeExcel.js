import * as XLSX from "xlsx";

const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_ABBR  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function findDayInText(text) {
  const t = (text ?? "").toString().toLowerCase().trim();
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (t.includes(DAY_NAMES[i].toLowerCase())) return DAY_NAMES[i];
    if (t === DAY_ABBR[i].toLowerCase())         return DAY_NAMES[i];
  }
  return null;
}

function slotOf(text) {
  const t = (text ?? "").toString().toLowerCase().trim();
  if (/^(am|a\.m\.?|morning|morn\.?)$/.test(t))                  return "am";
  if (/^(pm|p\.m\.?|afternoon|aft\.?|aftn\.?)$/.test(t))         return "pm";
  if (/^(eve\.?|evening|evening ents?|eve ents?|night)$/.test(t)) return "eve";
  return null;
}

function clean(v) {
  return (v ?? "").toString().replace(/\s+/g, " ").trim();
}

// Extract one week's activities given the day-header row and the rows belonging to that week
function extractWeek(rows, dayRowIdx, endRowIdx) {
  const hits = {};
  rows[dayRowIdx].forEach((cell, c) => {
    const day = findDayInText(String(cell ?? ""));
    if (day && !(day in hits)) hits[day] = c;
  });

  const daySequence = Object.entries(hits)
    .sort((a, b) => a[1] - b[1])
    .map(([dayName, colIdx]) => ({ dayName, colIdx }));

  const dayMap = {};
  daySequence.forEach(({ dayName }) => { dayMap[dayName] = { am: "", pm: "", eve: "" }; });

  const nextRow = rows[dayRowIdx + 1] || [];
  const amPmCount = nextRow.filter((c) => /^(am|pm)$/i.test(String(c ?? "").trim())).length;

  if (amPmCount >= 4) {
    // Sub-column format: each day has AM / PM sub-columns
    const colSlotMap = {};
    for (let c = 0; c < nextRow.length; c++) {
      const s = slotOf(String(nextRow[c] ?? ""));
      if (!s) continue;
      let bestDay = null, bestCol = -1;
      for (const { colIdx, dayName } of daySequence) {
        if (colIdx <= c && colIdx > bestCol) { bestCol = colIdx; bestDay = dayName; }
      }
      if (bestDay) colSlotMap[c] = { dayName: bestDay, slot: s };
    }
    for (let r = dayRowIdx + 2; r < endRowIdx; r++) {
      rows[r].forEach((cell, c) => {
        const val = clean(cell);
        if (!val || val.length > 80) return;
        const cs = colSlotMap[c];
        if (!cs || !dayMap[cs.dayName]) return;
        const prev = dayMap[cs.dayName][cs.slot];
        dayMap[cs.dayName][cs.slot] = prev ? prev + " " + val : val;
      });
    }
  } else {
    // Row-label format: AM/PM/EVE labels in first column
    for (let r = dayRowIdx + 1; r < endRowIdx; r++) {
      const row = rows[r];
      let s = null;
      for (let c = 0; c < Math.min(row.length, 3); c++) {
        s = slotOf(String(row[c] ?? ""));
        if (s) break;
      }
      if (!s) continue;
      for (const { colIdx, dayName } of daySequence) {
        const val = clean(row[colIdx]);
        if (val && val.length <= 80 && !slotOf(val) && dayMap[dayName]) {
          dayMap[dayName][s] = val;
        }
      }
    }
  }

  // Clean whitespace
  Object.values(dayMap).forEach((d) => {
    ["am","pm","eve"].forEach((s) => {
      d[s] = (d[s] || "").replace(/\s+/g, " ").trim();
    });
  });

  return dayMap;
}

function extractAllWeeks(rows) {
  // Find ALL rows that contain ≥ 3 day names — each is a week-section header
  const weekStarts = [];
  for (let r = 0; r < rows.length; r++) {
    const hits = {};
    rows[r].forEach((cell) => {
      const day = findDayInText(String(cell ?? ""));
      if (day && !(day in hits)) hits[day] = true;
    });
    if (Object.keys(hits).length >= 3) weekStarts.push(r);
  }

  if (weekStarts.length === 0) {
    return { ok: false, error: "Could not find a row with day names (Mon–Sun)." };
  }

  const weekTemplates = []; // array of dayMap objects

  for (let wi = 0; wi < weekStarts.length; wi++) {
    const startRow = weekStarts[wi];
    const endRow = wi + 1 < weekStarts.length ? weekStarts[wi + 1] : rows.length;
    const dayMap = extractWeek(rows, startRow, endRow);
    weekTemplates.push(dayMap);
  }

  const filled = weekTemplates.reduce(
    (total, wt) => total + Object.values(wt).reduce((n, d) => n + ["am","pm","eve"].filter((s) => d[s]).length, 0),
    0
  );

  if (filled === 0) {
    return { ok: false, error: "Found day headers but no activities could be extracted. Check the spreadsheet preview." };
  }

  // Build numeric-keyed template (week 1 only) for ministay backwards compat
  const firstWeek = weekTemplates[0];
  const daySequence = DAY_NAMES.filter((d) => firstWeek[d]);
  const template = {};
  for (let i = 1; i <= 7; i++) template[String(i)] = { am: "", pm: "", eve: "" };
  daySequence.forEach((dayName, i) => {
    const key = String(i + 1);
    if (template[key]) template[key] = { ...firstWeek[dayName] };
  });

  // dayNameTemplate for summer mode (first week, day-name keys)
  const dayNameTemplate = { ...firstWeek };

  const debug = `${filled} cells across ${weekTemplates.length} week(s)`;
  return { ok: true, template, dayNameTemplate, weekTemplates, numWeeks: weekTemplates.length, debug };
}

export async function parseProgrammeExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb     = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const ws     = wb.Sheets[wb.SheetNames[0]];
  const rows   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const nonEmpty = rows.filter((r) => r.some((c) => c !== "" && c != null));
  const result = extractAllWeeks(nonEmpty);
  return { ...result, rows: nonEmpty };
}
