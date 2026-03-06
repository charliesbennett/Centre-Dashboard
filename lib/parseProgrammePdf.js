// PDF programme parser for UKLC Ministay sample programmes
// Uses pdfjs-dist to extract positioned text, then maps to a weekly day×slot template.

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ABBR  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Extract positioned text items from every page ──────────────────────────
async function extractItems(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const items = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page   = await pdf.getPage(p);
    const tc     = await page.getTextContent();
    const vp     = page.getViewport({ scale: 1 });
    tc.items.forEach((it) => {
      const txt = (it.str || "").trim();
      if (!txt) return;
      // PDF y-axis is bottom-up; flip so 0 = top of page
      items.push({ text: txt, x: it.transform[4], y: vp.height - it.transform[5], page: p });
    });
  }
  return items;
}

// ── Group items into lines (same approximate y) ────────────────────────────
function groupLines(items, tol = 6) {
  const lines = [];
  items.forEach((it) => {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tol);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  });
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
  lines.sort((a, b) => a.y - b.y); // top to bottom
  return lines;
}

// ── Detect slot label ──────────────────────────────────────────────────────
function detectSlot(text) {
  const t = text.toLowerCase().trim();
  if (/^(morning|a\.?m\.?)$/.test(t) || t === "am") return "am";
  if (/^(afternoon|p\.?m\.?)$/.test(t) || t === "pm") return "pm";
  if (/^(evening|eve\.?|eve ents?)$/i.test(t) || t === "eve") return "eve";
  return null;
}

// ── Find which line contains the day-name header ───────────────────────────
function findDayHeaderLine(lines) {
  for (const line of lines) {
    const fullText = line.items.map((i) => i.text).join(" ");
    let hits = 0;
    for (let i = 0; i < DAY_NAMES.length; i++) {
      if (
        fullText.toLowerCase().includes(DAY_NAMES[i].toLowerCase()) ||
        fullText.toLowerCase().includes(DAY_ABBR[i].toLowerCase())
      ) hits++;
    }
    if (hits >= 3) return line;
  }
  return null;
}

// ── Build day → x-centre map from the header line ─────────────────────────
function buildDayXMap(headerLine) {
  const map = {}; // DAY_NAMES[i] → x
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

// ── Assign an item to the nearest day column ───────────────────────────────
function nearestDay(itemX, dayXMap, threshold = 80) {
  let best = null, bestDist = Infinity;
  for (const [day, dx] of Object.entries(dayXMap)) {
    const d = Math.abs(itemX - dx);
    if (d < bestDist) { bestDist = d; best = day; }
  }
  return bestDist <= threshold ? best : null;
}

// ── Main: parse PDF → weekly template ─────────────────────────────────────
export async function parseProgrammePdf(file) {
  const items = await extractItems(file);
  const lines = groupLines(items);

  const headerLine = findDayHeaderLine(lines);
  if (!headerLine) return { ok: false, error: "Could not find day-name header row in the PDF." };

  const dayXMap = buildDayXMap(headerLine);
  if (Object.keys(dayXMap).length < 3) {
    return { ok: false, error: "Found fewer than 3 day columns — the PDF layout may not be supported." };
  }

  // Build empty template
  const template = {};
  DAY_NAMES.forEach((d) => { template[d] = { am: "", pm: "", eve: "" }; });

  // Process lines below the header
  const contentLines = lines.filter((l) => l.y > headerLine.y + 4);
  let currentSlot = null;

  for (const line of contentLines) {
    // Try to detect a slot label in this line
    for (const it of line.items) {
      const s = detectSlot(it.text);
      if (s) { currentSlot = s; break; }
    }
    if (!currentSlot) continue;

    // Assign activity text to day columns
    for (const it of line.items) {
      if (detectSlot(it.text)) continue; // skip slot label itself
      if (it.text.length < 2) continue;

      const day = nearestDay(it.x, dayXMap);
      if (!day) continue;

      // Append to existing value (multi-word activity spanning adjacent items)
      const existing = template[day][currentSlot];
      template[day][currentSlot] = existing ? existing + " " + it.text : it.text;
    }
  }

  // Clean up extra whitespace
  DAY_NAMES.forEach((d) => {
    ["am", "pm", "eve"].forEach((s) => {
      template[d][s] = template[d][s].replace(/\s+/g, " ").trim();
    });
  });

  // Check if we got any data
  const anyData = DAY_NAMES.some((d) =>
    ["am", "pm", "eve"].some((s) => template[d][s])
  );
  if (!anyData) {
    return { ok: false, error: "No activities could be extracted. The PDF may use non-standard formatting or compressed text." };
  }

  return { ok: true, template };
}
