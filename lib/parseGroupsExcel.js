import * as XLSX from "xlsx";

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
  // BST correction: dates stored as UTC 23:xx are actually midnight next day
  if (d.getUTCHours() >= 20) d = new Date(d.getTime() + 3600000);
  const iso = d.toISOString().split("T")[0];
  return iso < "2020-01-01" ? "" : iso;
}

// Normalise a centre name for fuzzy matching
export function normaliseCentreName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Generic words that don't help distinguish centres — excluded from key-word matching
const GENERIC = new Set(["school","college","university","of","the","and","at","for"]);

function words(s) {
  return normaliseCentreName(s).split(" ").filter(Boolean);
}

// Stem a word minimally: strip trailing 's' so "marys"→"mary", "schools"→"school"
function stem(w) { return w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w; }

// Jaccard word-overlap score between two centre name strings (0–1).
// Uses stemming so "Mary's"/"Marys"/"Mary" all match, and boosts the score
// when the shorter name's distinctive words are all contained in the longer name.
export function centreMatchScore(a, b) {
  const wa = words(a).map(stem);
  const wb = words(b).map(stem);
  if (!wa.length || !wb.length) return 0;

  const sa = new Set(wa);
  const sb = new Set(wb);

  // Jaccard on stemmed words
  const intersection = [...sa].filter((w) => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;
  const jaccard = intersection / union;

  // Containment bonus: if all distinctive words of the shorter name appear in the longer
  const shorter = sa.size <= sb.size ? sa : sb;
  const longer  = sa.size <= sb.size ? sb : sa;
  const distinctive = [...shorter].filter((w) => !GENERIC.has(w));
  const contained = distinctive.length > 0 && distinctive.every((w) => longer.has(w));

  return contained ? Math.max(jaccard, 0.75) : jaccard;
}

// Find best matching dashboard centre for an Excel centre name.
// Returns { centreId, centreName, score, confident } or null if no centres provided.
// confident=true when score ≥ threshold (auto-matched); false = best guess shown for review.
export function matchCentre(excelName, centres, threshold = 0.4) {
  if (!centres?.length) return null;
  let best = null;
  let bestScore = 0;
  for (const c of centres) {
    const score = centreMatchScore(excelName, c.name);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (!best) return null;
  return {
    centreId:   best.id,
    centreName: best.name,
    score:      bestScore,
    confident:  bestScore >= threshold,
  };
}

// Parse Groups.xlsx → array of group objects
// centres: array of { id, name } from the dashboard
export async function parseGroupsExcel(file, centres = []) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });

  const wsName = wb.SheetNames[0];
  if (!wsName) return { ok: false, error: "No sheets found in file." };

  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Row 0: merged label, Row 1: headers, Row 2+: data
  if (rows.length < 3) return { ok: false, error: "File has too few rows." };

  const headers = rows[1].map((h) => String(h || "").trim());

  const col = (name) => {
    const idx = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return idx;
  };

  const codeCol       = col("Code");
  const statusCol     = col("Status");
  const groupCol      = col("Group");
  const agentCol      = col("Agent");
  const centreCol     = col("Centre");
  const stuCol        = headers.findIndex((h) => h === "Total:S");
  const glCol         = headers.findIndex((h) => h === "Total:GL");
  const arrCol        = col("Arr Date");
  const depCol        = col("Dep Date");
  const progNotesCol  = col("Programme Notes");

  if (groupCol === -1 || centreCol === -1) {
    return { ok: false, error: "Could not find 'Group' or 'Centre' columns. Check this is the correct file." };
  }

  const groups = [];
  const unmatched = [];
  let cancelledCount = 0;

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const code   = String(row[codeCol]  || "").trim();
    const status = String(row[statusCol] || "").trim();
    const group  = String(row[groupCol]  || "").trim();
    const centre = String(row[centreCol] || "").trim();

    if (!group || !code) continue;

    if (status === "Cancelled") { cancelledCount++; continue; }
    if (!["Confirmed", "Provisional"].includes(status)) continue;

    const arr = toDateStr(row[arrCol]);
    const dep = toDateStr(row[depCol]);
    const stu = parseInt(row[stuCol]) || 0;
    const gl  = parseInt(row[glCol])  || 0;
    const programmeNotes = String(row[progNotesCol] || "").trim();
    const agent = agentCol >= 0 ? String(row[agentCol] || "").trim() : "";

    const match = matchCentre(centre, centres);

    const groupObj = {
      code,
      status,
      group,
      agent,
      excelCentre: centre,
      stu,
      gl,
      arr,
      dep,
      programmeNotes,
      centreId:   match?.confident ? match.centreId   : null,
      centreName: match?.confident ? match.centreName : null,
      matchScore: match?.score || 0,
      // Best guess even when below confidence threshold — used to pre-fill the dropdown
      bestGuessId:     match?.centreId   || null,
      bestGuessCentre: match?.centreName || null,
      bestGuessScore:  match?.score      || 0,
    };

    if (!match?.confident) {
      unmatched.push(groupObj);
    } else {
      groups.push(groupObj);
    }
  }

  if (groups.length === 0 && unmatched.length === 0) {
    return { ok: false, error: "No group rows found. Check this is the UKLC Groups file." };
  }

  return { ok: true, groups, unmatched, cancelledCount };
}
