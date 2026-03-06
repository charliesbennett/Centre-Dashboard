/**
 * PDF programme parser for UKLC Ministay sample programmes.
 *
 * Strategy:
 *  1. Extract all positioned text items from the PDF.
 *  2. Group items into horizontal lines (same approximate y).
 *  3. Find the line that contains ≥3 day names — this is the column header.
 *  4. Note the x-centre of each day column in that header line.
 *  5. Build midpoint-based column boundaries (not nearest-distance guessing).
 *  6. Below the header, look for slot labels (AM / PM / EVE / Morning / Afternoon / Evening)
 *     that appear in the LEFT MARGIN (i.e. to the left of all day columns).
 *  7. Use the y-positions of those slot rows to define strict y-ranges per slot.
 *  8. For each slot y-range × each day column x-range → that cell's activity text.
 */

const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_ABBR  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Extract positioned text from every page
// ─────────────────────────────────────────────────────────────────────────────
async function extractItems(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc   = await page.getTextContent();
    const vp   = page.getViewport({ scale: 1 });
    tc.items.forEach((it) => {
      const txt = (it.str || "").trim();
      if (!txt) return;
      out.push({
        text: txt,
        x: it.transform[4],
        // flip y so 0 = top of page
        y: vp.height - it.transform[5],
        page: p,
      });
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Group items into lines (within tol pts of each other vertically)
// ─────────────────────────────────────────────────────────────────────────────
function groupLines(items, tol = 5) {
  const lines = [];
  for (const it of items) {
    const l = lines.find((ln) => Math.abs(ln.y - it.y) <= tol);
    if (l) l.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
  lines.sort((a, b) => a.y - b.y);          // top → bottom
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Find the day-header line (contains ≥ 3 day names)
// ─────────────────────────────────────────────────────────────────────────────
function findHeaderLine(lines) {
  for (const line of lines) {
    const joined = line.items.map((i) => i.text).join(" ");
    let hits = 0;
    for (let i = 0; i < DAY_NAMES.length; i++) {
      if (
        joined.toLowerCase().includes(DAY_NAMES[i].toLowerCase()) ||
        joined.toLowerCase().includes(DAY_ABBR[i].toLowerCase())
      ) hits++;
    }
    if (hits >= 3) return line;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Build day → x-centre map from the header line
// ─────────────────────────────────────────────────────────────────────────────
function buildDayXMap(headerLine) {
  const map = {};
  for (let i = 0; i < DAY_NAMES.length; i++) {
    const it = headerLine.items.find(
      (item) =>
        item.text.toLowerCase().includes(DAY_NAMES[i].toLowerCase()) ||
        item.text.toLowerCase().includes(DAY_ABBR[i].toLowerCase())
    );
    if (it) map[DAY_NAMES[i]] = it.x;
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Build midpoint-based column boundaries
//    Each day's column spans from the midpoint with its left neighbour
//    to the midpoint with its right neighbour.
// ─────────────────────────────────────────────────────────────────────────────
function buildColBounds(dayXMap) {
  const sorted = Object.entries(dayXMap).sort((a, b) => a[1] - b[1]);
  const colWidth = sorted.length > 1
    ? (sorted[sorted.length - 1][1] - sorted[0][1]) / (sorted.length - 1)
    : 80;

  return sorted.map(([day, x], i) => {
    const prevX = i > 0 ? sorted[i - 1][1] : x - colWidth;
    const nextX = i < sorted.length - 1 ? sorted[i + 1][1] : x + colWidth;
    return {
      day,
      centerX: x,
      left:  (x + prevX) / 2,
      right: (x + nextX) / 2,
    };
  });
}

function colForX(x, bounds) {
  const c = bounds.find((b) => x >= b.left && x < b.right);
  return c ? c.day : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Detect slot label text
// ─────────────────────────────────────────────────────────────────────────────
function slotOf(text) {
  const t = text.toLowerCase().trim();
  if (/^(am|a\.m\.?|morning)$/.test(t)) return "am";
  if (/^(pm|p\.m\.?|afternoon)$/.test(t)) return "pm";
  if (/^(eve\.?|evening|evening ents?|eve ents?)$/.test(t)) return "eve";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Find slot-label lines — the label must be in the LEFT MARGIN
//    (i.e. to the left of the leftmost day column)
// ─────────────────────────────────────────────────────────────────────────────
function findSlotLines(contentLines, leftmostX) {
  const found = {};
  for (const line of contentLines) {
    // Only look at items that are clearly in the row-label area
    const leftItems = line.items.filter((it) => it.x < leftmostX - 5);
    for (const it of leftItems) {
      const s = slotOf(it.text);
      if (s && !found[s]) {
        found[s] = { slot: s, y: line.y };
      }
    }
  }
  return Object.values(found).sort((a, b) => a.y - b.y);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export async function parseProgrammePdf(file) {
  const items = await extractItems(file);
  const lines = groupLines(items);

  // ── Header line ───────────────────────────────────────────
  const headerLine = findHeaderLine(lines);
  if (!headerLine) {
    return { ok: false, error: "Could not find a row with day names (Mon–Sun). The PDF layout may not be supported." };
  }

  const dayXMap = buildDayXMap(headerLine);
  const foundDays = Object.keys(dayXMap).length;
  if (foundDays < 3) {
    return { ok: false, error: `Only found ${foundDays} day columns — need at least 3. Check the PDF has Mon–Sun headers.` };
  }

  const colBounds  = buildColBounds(dayXMap);
  const sortedX    = Object.values(dayXMap).sort((a, b) => a - b);
  const leftmostX  = sortedX[0];
  const rightmostX = sortedX[sortedX.length - 1];

  // Lines below the header
  const contentLines = lines.filter((l) => l.y > headerLine.y + 3);

  // ── Slot rows ─────────────────────────────────────────────
  const slotLines = findSlotLines(contentLines, leftmostX);

  const template = {};
  DAY_NAMES.forEach((d) => { template[d] = { am: "", pm: "", eve: "" }; });

  if (slotLines.length >= 2) {
    // ── Structured parse: use y-ranges derived from slot row positions ──

    // Estimate a single row-height from the spacing between slot rows
    const spacings = slotLines.slice(1).map((sl, i) => sl.y - slotLines[i].y);
    const avgSpacing = spacings.reduce((s, v) => s + v, 0) / spacings.length;

    slotLines.forEach((sl, si) => {
      const yTop    = sl.y - 3;
      // Bottom of this slot's row = midpoint to next slot (or avgSpacing below last)
      const yBottom = si < slotLines.length - 1
        ? (sl.y + slotLines[si + 1].y) / 2
        : sl.y + avgSpacing * 0.9;

      // Collect text in this slot's y-band and within the table x-range
      for (const line of contentLines) {
        if (line.y < yTop || line.y > yBottom) continue;
        for (const item of line.items) {
          // Skip row-label area
          if (item.x < leftmostX - 5) continue;
          // Skip text well to the right of the table
          if (item.x > rightmostX + colBounds[colBounds.length - 1].right - colBounds[colBounds.length - 1].centerX + 20) continue;

          const day = colForX(item.x, colBounds);
          if (!day) continue;

          const prev = template[day][sl.slot];
          template[day][sl.slot] = prev ? prev + " " + item.text : item.text;
        }
      }
    });

  } else {
    // ── Fallback: linear scan, detect slot from leftmost item on each line ──
    let currentSlot = null;
    for (const line of contentLines) {
      // Only look for slot label in the left-margin items
      for (const it of line.items) {
        if (it.x >= leftmostX) break; // past the margin
        const s = slotOf(it.text);
        if (s) { currentSlot = s; break; }
      }
      if (!currentSlot) continue;

      for (const it of line.items) {
        if (it.x < leftmostX - 5) continue;             // skip margin
        if (it.x > rightmostX + 100) continue;          // skip far right
        if (slotOf(it.text)) continue;                   // skip slot labels

        const day = colForX(it.x, colBounds);
        if (!day) continue;

        const prev = template[day][currentSlot];
        template[day][currentSlot] = prev ? prev + " " + it.text : it.text;
      }
    }
  }

  // Clean up whitespace
  DAY_NAMES.forEach((d) => {
    ["am","pm","eve"].forEach((s) => {
      template[d][s] = (template[d][s] || "").replace(/\s+/g, " ").trim();
    });
  });

  const anyData = DAY_NAMES.some((d) => ["am","pm","eve"].some((s) => template[d][s]));
  if (!anyData) {
    return {
      ok: false,
      error: "No activities could be extracted. The PDF may use compressed text streams or an unusual layout.",
      rawLines: lines.slice(0, 40).map((l) => l.items.map((i) => i.text).join("  ")),
    };
  }

  return { ok: true, template };
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw text extraction (for display in the modal — helps user spot issues)
// ─────────────────────────────────────────────────────────────────────────────
export async function extractRawLines(file) {
  const items = await extractItems(file);
  const lines = groupLines(items);
  return lines.map((l) => l.items.map((i) => i.text).join("   "));
}
