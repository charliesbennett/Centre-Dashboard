/**
 * PDF programme parser — two complementary strategies:
 *
 * Strategy A (slot-label scan):
 *   Find lines containing AM/PM/EVE/Morning/Afternoon/Evening labels.
 *   Use those to set the current slot, then assign every other item on the
 *   same line (and subsequent lines until the next slot label) to the
 *   appropriate day column using midpoint-based column boundaries.
 *
 * Strategy B (y-cluster fallback):
 *   No slot labels needed. Collect every text item that falls inside a day
 *   column. Find the two biggest vertical gaps in those items — that splits
 *   the table into three bands: AM (top), PM (middle), EVE (bottom).
 *
 * Both strategies use midpoint column boundaries, so an item must actually
 * fall *within* a column's x-range to be assigned there.
 */

const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_ABBR  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ── 1. Extract all positioned text items ──────────────────────────────────
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
        y: vp.height - it.transform[5], // flip: 0 = top of page
        page: p,
      });
    });
  }
  return out;
}

// ── 2. Group items into horizontal lines ──────────────────────────────────
function groupLines(items, tol = 6) {
  const lines = [];
  for (const it of items) {
    const l = lines.find((ln) => Math.abs(ln.y - it.y) <= tol);
    if (l) l.items.push(it);
    else   lines.push({ y: it.y, items: [it] });
  }
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
  lines.sort((a, b) => a.y - b.y);   // top → bottom
  return lines;
}

// ── 3. Find the line that contains ≥ 3 day names ─────────────────────────
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

// ── 4. Build day → x-centre map from the header line ─────────────────────
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

// ── 5. Midpoint-based column boundaries ───────────────────────────────────
function buildColBounds(dayXMap) {
  const sorted = Object.entries(dayXMap).sort((a, b) => a[1] - b[1]);
  const colWidth = sorted.length > 1
    ? (sorted[sorted.length - 1][1] - sorted[0][1]) / (sorted.length - 1)
    : 80;

  return sorted.map(([day, x], i) => {
    const prevX = i > 0 ? sorted[i - 1][1] : x - colWidth;
    const nextX = i < sorted.length - 1 ? sorted[i + 1][1] : x + colWidth;
    return { day, centerX: x, left: (x + prevX) / 2, right: (x + nextX) / 2 };
  });
}

function colForX(x, bounds) {
  const c = bounds.find((b) => x >= b.left && x < b.right);
  return c ? c.day : null;
}

// ── 6. Detect slot label — checked anywhere on a line ────────────────────
function slotOf(text) {
  const t = text.toLowerCase().trim();
  if (/^(am|a\.m\.?|morning|morn\.?)$/.test(t))                 return "am";
  if (/^(pm|p\.m\.?|afternoon|aft\.?|aftn\.?)$/.test(t))        return "pm";
  if (/^(eve\.?|evening|evening ents?|eve ents?|night)$/.test(t)) return "eve";
  return null;
}

function emptyTemplate() {
  const t = {};
  DAY_NAMES.forEach((d) => { t[d] = { am: "", pm: "", eve: "" }; });
  return t;
}

function cleanTemplate(template) {
  DAY_NAMES.forEach((d) => {
    ["am","pm","eve"].forEach((s) => {
      template[d][s] = (template[d][s] || "").replace(/\s+/g, " ").trim();
    });
  });
  return template;
}

function countCells(template) {
  return DAY_NAMES.reduce((n, d) =>
    n + ["am","pm","eve"].filter((s) => template[d][s]).length, 0);
}

// ── Strategy A: slot-label scan ───────────────────────────────────────────
function strategyA(contentLines, colBounds) {
  const template = emptyTemplate();
  let currentSlot = null;

  for (const line of contentLines) {
    // Detect slot label — check every item on the line (no left-margin restriction)
    for (const it of line.items) {
      const s = slotOf(it.text);
      if (s) { currentSlot = s; break; }
    }
    if (!currentSlot) continue;

    // Assign non-label items to day columns
    for (const it of line.items) {
      if (slotOf(it.text)) continue;          // skip slot labels themselves
      const day = colForX(it.x, colBounds);
      if (!day) continue;
      const prev = template[day][currentSlot];
      template[day][currentSlot] = prev ? prev + " " + it.text : it.text;
    }
  }
  return cleanTemplate(template);
}

// ── Strategy B: y-cluster (no slot labels needed) ────────────────────────
function strategyB(contentLines, colBounds) {
  // Gather lines that contain at least one item inside a column
  const tableLines = contentLines
    .map((l) => ({
      y: l.y,
      items: l.items.filter((it) => colForX(it.x, colBounds) && !slotOf(it.text)),
    }))
    .filter((l) => l.items.length > 0);

  if (tableLines.length < 3) return emptyTemplate();

  // Find the two biggest vertical gaps → split into 3 bands (AM / PM / EVE)
  const gaps = [];
  for (let i = 1; i < tableLines.length; i++) {
    gaps.push({ gap: tableLines[i].y - tableLines[i - 1].y, splitAfter: i - 1 });
  }
  gaps.sort((a, b) => b.gap - a.gap);
  const [s1, s2] = gaps.slice(0, 2).map((g) => g.splitAfter).sort((a, b) => a - b);

  const bands = [
    tableLines.slice(0, s1 + 1),
    tableLines.slice(s1 + 1, s2 + 1),
    tableLines.slice(s2 + 1),
  ];

  const slots    = ["am", "pm", "eve"];
  const template = emptyTemplate();

  bands.forEach((band, si) => {
    const slot = slots[si];
    for (const line of band) {
      for (const it of line.items) {
        const day = colForX(it.x, colBounds);
        if (!day) continue;
        const prev = template[day][slot];
        template[day][slot] = prev ? prev + " " + it.text : it.text;
      }
    }
  });
  return cleanTemplate(template);
}

// ── Main export ───────────────────────────────────────────────────────────
export async function parseProgrammePdf(file) {
  const items = await extractItems(file);
  const lines = groupLines(items);

  const headerLine = findHeaderLine(lines);
  if (!headerLine) {
    return {
      ok: false,
      error: "Could not find a row with day names (Mon–Sun). The PDF may not be a weekly programme table.",
    };
  }

  const dayXMap = buildDayXMap(headerLine);
  if (Object.keys(dayXMap).length < 3) {
    return { ok: false, error: `Only found ${Object.keys(dayXMap).length} day columns — need at least 3.` };
  }

  const colBounds    = buildColBounds(dayXMap);
  const contentLines = lines.filter((l) => l.y > headerLine.y + 3);

  // Run both strategies and pick whichever finds more cells
  const tA = strategyA(contentLines, colBounds);
  const tB = strategyB(contentLines, colBounds);

  const scoreA = countCells(tA);
  const scoreB = countCells(tB);

  const best = scoreA >= scoreB ? tA : tB;
  const usedStrategy = scoreA >= scoreB ? "A (slot labels)" : "B (row clusters)";

  if (countCells(best) === 0) {
    return {
      ok: false,
      error: "No activities could be extracted. Try 'Show Raw Text' to see what the PDF contains.",
    };
  }

  return { ok: true, template: best, debug: `Used strategy ${usedStrategy}: ${countCells(best)} cells filled` };
}

// ── Raw text extraction for the debug panel ───────────────────────────────
export async function extractRawLines(file) {
  const items = await extractItems(file);
  const lines = groupLines(items);
  return lines.map((l) => l.items.map((i) => i.text).join("   "));
}
