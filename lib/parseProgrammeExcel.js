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

// Template uses relative day numbers: "1" = arrival day, "2" = day 2, …
function emptyTemplate() {
  const t = {};
  for (let i = 1; i <= 7; i++) t[String(i)] = { am: "", pm: "", eve: "" };
  return t;
}

function clean(v) {
  return (v ?? "").toString().replace(/\s+/g, " ").trim();
}

function extractTemplate(rows) {
  // Find a row with ≥ 3 day names → day-header row
  let dayRowIdx = -1;
  let dayColMap = {}; // dayName → col index

  for (let r = 0; r < rows.length; r++) {
    const hits = {};
    rows[r].forEach((cell, c) => {
      const day = findDayInText(String(cell ?? ""));
      if (day && !(day in hits)) hits[day] = c;
    });
    if (Object.keys(hits).length >= 3) {
      dayRowIdx = r;
      dayColMap = hits;
      break;
    }
  }

  if (dayRowIdx < 0) {
    return { ok: false, error: "Could not find a row with day names (Mon–Sun)." };
  }

  // Sort day columns left-to-right → Day 1, Day 2, …, Day N
  const daySequence = Object.entries(dayColMap)
    .sort((a, b) => a[1] - b[1])
    .map(([dayName, colIdx], i) => ({ dayName, colIdx, dayNum: String(i + 1) }));

  const template = emptyTemplate();
  const nextRow  = rows[dayRowIdx + 1] || [];
  const amPmCount = nextRow.filter((c) => /^(am|pm)$/i.test(String(c ?? "").trim())).length;

  if (amPmCount >= 4) {
    // ── Sub-column format: each day has AM / PM sub-columns ───────────────
    // Map each sub-column index → { dayNum, slot }
    const colSlotMap = {};
    for (let c = 0; c < nextRow.length; c++) {
      const s = slotOf(String(nextRow[c] ?? ""));
      if (!s) continue;
      // Rightmost day-header at or before this column
      let bestNum = null, bestCol = -1;
      for (const { colIdx, dayNum } of daySequence) {
        if (colIdx <= c && colIdx > bestCol) { bestCol = colIdx; bestNum = dayNum; }
      }
      if (bestNum) colSlotMap[c] = { dayNum: bestNum, slot: s };
    }

    for (let r = dayRowIdx + 2; r < rows.length; r++) {
      rows[r].forEach((cell, c) => {
        const val = clean(cell);
        if (!val || val.length > 80) return;   // skip empty or footnote text
        const cs = colSlotMap[c];
        if (!cs || !template[cs.dayNum]) return;
        const prev = template[cs.dayNum][cs.slot];
        template[cs.dayNum][cs.slot] = prev ? prev + " " + val : val;
      });
    }
  } else {
    // ── Row-label format: AM/PM/EVE labels in first column ────────────────
    for (let r = dayRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      let s = null;
      for (let c = 0; c < Math.min(row.length, 3); c++) {
        s = slotOf(String(row[c] ?? ""));
        if (s) break;
      }
      if (!s) continue;
      for (const { colIdx, dayNum } of daySequence) {
        const val = clean(row[colIdx]);
        if (val && val.length <= 80 && !slotOf(val) && template[dayNum]) {
          template[dayNum][s] = val;
        }
      }
    }
  }

  // Clean whitespace
  for (let i = 1; i <= 7; i++) {
    const key = String(i);
    if (template[key]) {
      ["am","pm","eve"].forEach((s) => {
        template[key][s] = (template[key][s] || "").replace(/\s+/g, " ").trim();
      });
    }
  }

  const filled = Object.values(template)
    .reduce((n, d) => n + ["am","pm","eve"].filter((s) => d[s]).length, 0);

  if (filled === 0) {
    return { ok: false, error: "Found day headers but no activities could be extracted. Check the spreadsheet preview." };
  }

  // Also build a day-name keyed version for summer mode
  const dayNameTemplate = {};
  daySequence.forEach(({ dayName, dayNum }) => {
    if (template[dayNum]) dayNameTemplate[dayName] = { ...template[dayNum] };
  });

  const dayNamesStr = daySequence.map(({ dayName, dayNum }) => `Day ${dayNum}=${dayName}`).join(", ");
  return { ok: true, template, dayNameTemplate, debug: `${filled} cells (${dayNamesStr})` };
}

export async function parseProgrammeExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb     = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const ws     = wb.Sheets[wb.SheetNames[0]];
  const rows   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const nonEmpty = rows.filter((r) => r.some((c) => c !== "" && c != null));
  const result = extractTemplate(nonEmpty);
  return { ...result, rows: nonEmpty };
}
