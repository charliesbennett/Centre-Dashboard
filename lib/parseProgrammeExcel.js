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

function emptyTemplate() {
  const t = {};
  DAY_NAMES.forEach((d) => { t[d] = { am: "", pm: "", eve: "" }; });
  return t;
}

function clean(v) {
  return (v ?? "").toString().replace(/\s+/g, " ").trim();
}

function extractTemplate(rows) {
  // Find a row containing ≥ 3 day names → this is the day-header row
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

  const template = emptyTemplate();
  const nextRow  = rows[dayRowIdx + 1] || [];
  const amPmCount = nextRow.filter((c) => /^(am|pm)$/i.test(String(c ?? "").trim())).length;

  if (amPmCount >= 4) {
    // ── Sub-column format ─────────────────────────────────────────────────
    // Each day has separate AM / PM (/ EVE) sub-columns.
    // Strategy: for each sub-column, find the rightmost day-header that is
    // at or to the LEFT of this column (handles merged-cell date headers).
    const colSlotMap = {}; // col index → { day, slot }

    for (let c = 0; c < nextRow.length; c++) {
      const s = slotOf(String(nextRow[c] ?? ""));
      if (!s) continue;
      let bestDay = null, bestDayCol = -1;
      for (const [day, dayCol] of Object.entries(dayColMap)) {
        if (dayCol <= c && dayCol > bestDayCol) { bestDayCol = dayCol; bestDay = day; }
      }
      if (bestDay) colSlotMap[c] = { day: bestDay, slot: s };
    }

    for (let r = dayRowIdx + 2; r < rows.length; r++) {
      rows[r].forEach((cell, c) => {
        const val = clean(cell);
        if (!val || !colSlotMap[c]) return;
        const { day, slot } = colSlotMap[c];
        const prev = template[day][slot];
        template[day][slot] = prev ? prev + " " + val : val;
      });
    }
  } else {
    // ── Row-label format ──────────────────────────────────────────────────
    // First few columns have AM / PM / EVE row labels; day names are columns.
    for (let r = dayRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      let s = null;
      for (let c = 0; c < Math.min(row.length, 3); c++) {
        s = slotOf(String(row[c] ?? ""));
        if (s) break;
      }
      if (!s) continue;
      for (const [day, col] of Object.entries(dayColMap)) {
        const val = clean(row[col]);
        if (val && !slotOf(val)) template[day][s] = val;
      }
    }
  }

  // Clean whitespace
  DAY_NAMES.forEach((d) => {
    ["am","pm","eve"].forEach((s) => {
      template[d][s] = (template[d][s] || "").replace(/\s+/g, " ").trim();
    });
  });

  const filled = DAY_NAMES.reduce(
    (n, d) => n + ["am","pm","eve"].filter((s) => template[d][s]).length, 0
  );

  if (filled === 0) {
    return {
      ok: false,
      error: "Found day headers but no activities could be extracted. Check the spreadsheet preview to see the layout.",
    };
  }

  return { ok: true, template, debug: `${filled} cells filled` };
}

export async function parseProgrammeExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb     = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const ws     = wb.Sheets[wb.SheetNames[0]];
  const rows   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Strip fully-empty rows for the preview, keep raw for parsing
  const nonEmpty = rows.filter((r) => r.some((c) => c !== "" && c != null));

  const result = extractTemplate(nonEmpty);
  return { ...result, rows: nonEmpty };
}
