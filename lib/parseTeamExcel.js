import * as XLSX from "xlsx";
import { normaliseCentreName } from "@/lib/parseGroupsExcel";

// Convert Excel serial date → "YYYY-MM-DD"
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

// Map Excel full role names → app role codes
const ROLE_MAP = {
  "centre manager": "CM",
  "course director": "CD",
  "assistant course director": "CD",
  "deputy course director": "CD",
  "excursion & activity manager": "EAM",
  "excursion and activity manager": "EAM",
  "safeguarding and welfare coordinator": "SWC",
  "safeguarding & welfare coordinator": "SWC",
  "welfare coordinator": "SWC",
  "teacher & activity leader": "TAL",
  "teacher and activity leader": "TAL",
  "full time teacher": "FTT",
  "5-day full time teacher": "5FTT",
  "5 day full time teacher": "5FTT",
  "five-day full time teacher": "5FTT",
  "teacher only": "FTT",
  "efl teacher": "FTT",
  "activity leader": "EAL",
  "london activity leader": "LAL",
  "activity coordinator": "LAC",
  "london activity coordinator": "LAC",
  "sport and activity instructor": "SAI",
  "sport & activity instructor": "SAI",
  "football specialist": "FOOTBALL",
  "performing arts": "DRAMA",
  "house parent": "HP",
  "matron": "HP",
  "coding and gaming specialist": "SC",
  "sport, health and wellbeing specialist": "SAI",
};

function mapRole(raw) {
  if (!raw) return "TAL";
  const key = raw.toLowerCase().trim();
  return ROLE_MAP[key] || "TAL";
}

function mapAcc(raw) {
  const s = (raw || "").toLowerCase();
  if (s.includes("non-res") || s.includes("non res")) return "Non-residential";
  if (s.includes("res")) return "Residential";
  return "Residential";
}

// Section heading strings to skip (not staff rows)
const SKIP_NAMES = new Set([
  "name", "management team", "teaching team", "activity team", "pastoral team",
  "privates teaching team", "inps teaching team", "june only", "august only",
  "activity leaders", "sport & activity instructors", "sport and activity instructors",
]);

function isSkippable(name) {
  const n = name.toLowerCase().trim();
  return SKIP_NAMES.has(n) || /^(week|june|july|august|sept|october)/i.test(n);
}

// Known abbreviations → expanded name for matching
const CENTRE_ABBREV = {
  "qmu":  "queen mary university london",
  "kcl":  "king's college london",
  "qw":   "queenswood",
  "uop":  "portsmouth",
  "rqa":  "queen annes",
  "bcc":  "bootham",
  "dcs":  "dean close",
  "wasp": "wycombe abbey",
  "nrh":  "reaseheath",
  "chc":  "chetham",
  "mcs":  "manchester chetham",
};

// Match a centre name string against the known centres list
function matchCentre(raw, centres) {
  if (!raw) return null;
  // Expand known abbreviations before normalising
  const trimmed = raw.trim();
  const expanded = CENTRE_ABBREV[trimmed.toLowerCase()] || trimmed;
  const norm = normaliseCentreName(expanded);
  const words = norm.split(/\s+/).filter((w) => w.length > 3);
  let best = null;
  let bestScore = 0;
  for (const c of centres) {
    const cn = normaliseCentreName(c.name);
    const cnWords = cn.split(/\s+/).filter((w) => w.length > 3);
    const fwd = words.filter((w) => cn.includes(w)).length;
    const rev = cnWords.filter((w) => norm.includes(w)).length;
    // Score = proportion of words matched on both sides, so longer shared names beat incidental "queen" matches
    const total = Math.max(words.length + cnWords.length, 1);
    const score = (fwd + rev) / total;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore > 0 ? best : null;
}

export async function parseTeamExcel(file, centres) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // Use MASTER I Allocations sheet; fall back to first sheet
  const sheetName = wb.SheetNames.find((s) => /master.*alloc/i.test(s)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const staff = [];       // matched: { name, role, acc, arr, dep, centreId, centreName, notes }
  const unmatched = [];   // unmatched centre: same shape + excelCentre, bestGuessId, bestGuessScore

  let currentCentreName = "";  // from section header in col 0
  let currentCentreMatch = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const col0 = r[0]?.toString().trim();
    if (!col0) continue;

    // Centre section header: col 3 contains a date range like "DD/MM/YYYY - DD/MM/YYYY"
    // and the row has no role (col 13 empty) and no numeric dates in cols 9-10
    const col3 = r[3]?.toString().trim();
    const col13 = r[13]?.toString().trim();
    const col9IsDate = typeof r[9] === "number" && r[9] > 30000;
    const isCentreHeader = !col9IsDate && !col13 && col3 && /\d{2}\/\d{2}\/\d{4}/.test(col3);

    if (isCentreHeader) {
      currentCentreName = col0;
      currentCentreMatch = matchCentre(col0, centres);
      continue;
    }

    // Skip section sub-headings and the column header row
    if (isSkippable(col0)) continue;

    // Skip rows without valid start date (serial number in col 9)
    if (!col9IsDate) continue;

    const name = col0;
    const roleRaw = col13 || "";
    const role = mapRole(roleRaw);
    const acc = mapAcc(r[4]?.toString());
    const arr = toDateStr(r[9]);
    const dep = toDateStr(r[10]);
    const notes = r[8]?.toString().trim() || "";

    // Centre: use col 12 if present, else fall back to current section header
    const centreRaw = r[12]?.toString().trim() || currentCentreName;
    const centreMatch = r[12]?.toString().trim()
      ? matchCentre(r[12].toString().trim(), centres)
      : currentCentreMatch;

    const entry = { name, role, acc, arr, dep, notes, excelCentre: centreRaw };

    if (centreMatch) {
      staff.push({ ...entry, centreId: centreMatch.id, centreName: centreMatch.name });
    } else {
      // Try best guess
      const norm = normaliseCentreName(centreRaw);
      const words = norm.split(/\s+/).filter((w) => w.length > 3);
      let bestGuess = null, bestScore = 0;
      for (const c of centres) {
        const cn = normaliseCentreName(c.name);
        const cnWords = cn.split(/\s+/).filter((w) => w.length > 3);
        const m = words.filter((w) => cn.includes(w)).length + cnWords.filter((w) => norm.includes(w)).length;
        const total = Math.max(words.length + cnWords.length, 1);
        const score = m / total;
        if (score > bestScore) { bestScore = score; bestGuess = c; }
      }
      unmatched.push({
        ...entry,
        bestGuessId: bestGuess?.id || null,
        bestGuessScore: bestScore,
      });
    }
  }

  return { ok: true, staff, unmatched };
}
