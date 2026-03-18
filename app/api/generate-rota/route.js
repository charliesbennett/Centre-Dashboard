import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

export const maxDuration = 300;

const INTEL_DOC = readFileSync(join(process.cwd(), "lib/rotaIntel.md"), "utf-8");

function genDates(start, end) {
  const dates = [];
  const s = new Date(start), e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
  return dates;
}
function dayKey(d) { return d.toISOString().split("T")[0]; }
function dayName(d) { return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]; }
function inRange(ds, arr, dep) { return !!(arr && dep && ds >= arr && ds <= dep); }
function getGroupLessonSlot(g, ds) {
  if (!g.arr || !g.lessonSlot) return g.lessonSlot || "AM";
  const daysSince = Math.floor((new Date(ds) - new Date(g.arr)) / 86400000);
  return Math.floor(daysSince / 7) % 2 === 0 ? g.lessonSlot : (g.lessonSlot === "AM" ? "PM" : "AM");
}

const SESSION_TARGET = (role) => {
  if (["CM","CD","EAM","SWC"].includes(role)) return 0;
  if (["TAL","FTT","5FTT","HP"].includes(role)) return 22;
  return 24; // SAI, AL, SC, AC, FOOTBALL, DRAMA, DANCE, LAL, LAC
};

const NO_COUNT = new Set(["Day Off","Induction","Setup","Office","Airport"]);
const TEACHING_ROLES = ["FTT","5FTT","TAL","CD"];
const ACTIVITY_ROLES = ["SAI","AL","EAL","SC","AC","EAC","LAL","LAC","FOOTBALL","DRAMA","DANCE","HP"];

function buildDayProfiles(dates, groups, progGrid) {
  const allArrivalDates = new Set((groups || []).map((g) => g.arr).filter(Boolean));
  const firstArrival = [...allArrivalDates].sort()[0] || null;
  const arrStu = {};
  (groups || []).forEach((g) => {
    if (g.arr) arrStu[g.arr] = (arrStu[g.arr] || 0) + (g.stu || 0) + (g.gl || 0);
  });

  return dates.map((d) => {
    const ds = dayKey(d);
    const dow = dayName(d);
    let totalStu = 0;
    (groups || []).forEach((g) => { if (inRange(ds, g.arr, g.dep)) totalStu += (g.stu || 0) + (g.gl || 0); });

    const slotInfo = {};
    ["AM", "PM"].forEach((slot) => {
      let lessonStu = 0, testStu = 0;
      const excDests = {};
      (groups || []).forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (ds === g.arr || ds === g.dep) return;
        const val = String(progGrid?.[g.id + "-" + ds + "-" + slot] || "").trim();
        const pax = (g.stu || 0) + (g.gl || 0);
        if (val && /english\s*test|placement\s*test/i.test(val)) { testStu += pax; return; }
        if (getGroupLessonSlot(g, ds) === slot) { lessonStu += pax; return; }
        if (val && !/arriv|depart/i.test(val)) excDests[val] = (excDests[val] || 0) + pax;
      });
      const sortedDests = Object.keys(excDests).sort((a, b) => excDests[b] - excDests[a]);
      slotInfo[slot] = {
        lessonStu, testStu,
        isTesting: testStu > 0,
        hasExc: sortedDests.length > 0,
        topDest: sortedDests[0] || null,
        teachersNeeded: Math.ceil((lessonStu + testStu) / 16),
        excSummary: sortedDests.length > 0
          ? sortedDests.map((dest) => `${dest}(${excDests[dest]}stu)`).join(", ")
          : null,
      };
    });

    const isFDE = slotInfo.AM.hasExc && slotInfo.PM.hasExc
      && slotInfo.AM.lessonStu === 0 && slotInfo.PM.lessonStu === 0
      && slotInfo.AM.testStu === 0 && slotInfo.PM.testStu === 0;
    const isTestingDay = slotInfo.AM.isTesting || slotInfo.PM.isTesting;

    return {
      ds, dow,
      isFirstArrival: ds === firstArrival,
      isArrival: allArrivalDates.has(ds),
      isTestingDay, isFDE,
      fdeLabel: isFDE ? (slotInfo.AM.topDest || slotInfo.PM.topDest || "Excursion") : null,
      isHDE: !isFDE && (slotInfo.AM.hasExc || slotInfo.PM.hasExc),
      totalStu, arrivingStu: arrStu[ds] || 0,
      AM: slotInfo.AM, PM: slotInfo.PM,
    };
  });
}

// Pre-calculate staffing gaps so both the prompt and UI can use them
function calcStaffingGaps(staffIndex, dayProfiles) {
  const gaps = [];
  dayProfiles.forEach((p, di) => {
    if (p.isFirstArrival || p.isFDE || p.isArrival) return;
    ["AM", "PM"].forEach((slot) => {
      const needed = p[slot].teachersNeeded;
      if (!needed) return;
      // Count teachers available on this day in this slot (on site, not assumed off)
      const avail = staffIndex.filter((s) => {
        if (!TEACHING_ROLES.includes(s.role)) return false;
        if (!inRange(p.ds, s.arr, s.dep)) return false;
        if (s.role === "5FTT" && (new Date(p.ds).getDay() === 0 || new Date(p.ds).getDay() === 6)) return false;
        return true;
      }).length;
      // In ZZ/mixed: each teacher covers ONE slot. Max teachers per slot = avail (pessimistic).
      // We flag if available teachers < needed assuming worst case half have days off.
      const conservativeAvail = Math.floor(avail * 0.8); // ~1 in 7 days off = ~14%
      if (conservativeAvail < needed) {
        gaps.push({ di, ds: p.ds, dow: p.dow, slot, needed, available: avail, shortfall: needed - conservativeAvail });
      }
    });
  });
  return gaps;
}

function buildPrompt(centreName, progStart, progEnd, staffIndex, groups, dayProfiles, staffingGaps) {
  const lines = [];
  const isZZ = (groups || []).some((g) => g.lessonSlot === "PM");

  lines.push(`Generate a complete rota for ${centreName || "UKLC centre"} (${progStart} to ${progEnd}).`);
  lines.push(`Programme type: ${isZZ ? "ZIG-ZAG (ZZ) — lessons and activities run simultaneously in both AM and PM; each teacher covers ONE slot per day (not both)" : "NON-ZIG-ZAG (NZZ) — lessons AM, activities PM"}`);
  lines.push("");

  // ── Staff table ──
  lines.push("## STAFF");
  lines.push("Format: index | Name | Role | On-site | TimeOff | SessionTarget");
  staffIndex.forEach((s) => {
    const tgt = SESSION_TARGET(s.role);
    const tgtStr = tgt === 0 ? "salaried" : `${tgt}/fortnight`;
    lines.push(`${s.i} | ${s.name} | ${s.role} | ${s.arr || "?"} to ${s.dep || "?"} | ${s.to || "none"} | ${tgtStr}`);
  });

  // ── Groups ──
  lines.push("");
  lines.push("## GROUPS");
  (groups || []).forEach((g) => {
    lines.push(`- ${g.group || "Group"}: arr=${g.arr} dep=${g.dep} students=${g.stu || 0} groupLeaders=${g.gl || 0} week1LessonSlot=${g.lessonSlot || "AM"}`);
  });

  // ── Day profiles ──
  lines.push("");
  lines.push("## DAY PROFILES");
  lines.push("index | date | day | type | detail");
  dayProfiles.forEach((p, i) => {
    let detail;
    if (p.isFirstArrival) {
      detail = `FIRST ARRIVAL — ${p.arrivingStu} students arriving. NO lessons. FTTs have day off. Activity staff + TALs: airport pickup, welcome, setup, dinner.`;
    } else if (p.isArrival) {
      const amExc = p.AM.hasExc ? ` AM excursion for existing groups: ${p.AM.topDest}.` : "";
      const pmExc = p.PM.hasExc ? ` PM excursion for existing groups: ${p.PM.topDest}.` : "";
      const amLess = !p.AM.hasExc && p.AM.lessonStu > 0 ? ` AM: ${p.AM.lessonStu}stu lessons (${p.AM.teachersNeeded} teachers).` : "";
      const pmLess = !p.PM.hasExc && p.PM.lessonStu > 0 ? ` PM: ${p.PM.lessonStu}stu lessons (${p.PM.teachersNeeded} teachers).` : "";
      detail = `ARRIVAL — ${p.arrivingStu} new students arriving (small pickup team needed).${amExc}${pmExc}${amLess}${pmLess} Existing groups continue their programme.`;
    } else if (p.isTestingDay) {
      const am = p.AM.isTesting ? `TESTING ${p.AM.testStu}stu→${p.AM.teachersNeeded}teachers` : `Lessons ${p.AM.lessonStu}stu→${p.AM.teachersNeeded}teachers`;
      const pm = p.PM.isTesting ? `TESTING ${p.PM.testStu}stu→${p.PM.teachersNeeded}teachers` : `Lessons ${p.PM.lessonStu}stu→${p.PM.teachersNeeded}teachers`;
      detail = `TESTING DAY — AM:${am} | PM:${pm} | Activity staff run activities both slots.`;
    } else if (p.isFDE) {
      detail = `FDE: ${p.fdeLabel} — ${p.totalStu} students on full-day excursion (AM+PM). ALL activity staff + all available TALs go. FTTs take day off.`;
    } else if (p.isHDE) {
      const am = p.AM.hasExc ? `Excursion:${p.AM.topDest}(${p.AM.excSummary})` : `Lessons:${p.AM.lessonStu}stu→${p.AM.teachersNeeded}teachers`;
      const pm = p.PM.hasExc ? `Excursion:${p.PM.topDest}(${p.PM.excSummary})` : `Lessons:${p.PM.lessonStu}stu→${p.PM.teachersNeeded}teachers`;
      detail = `HDE — AM:${am} | PM:${pm} | Total ${p.totalStu} students on site.`;
    } else if (p.totalStu === 0) {
      detail = "No students on site.";
    } else {
      const am = `Lessons:${p.AM.lessonStu}stu→NEED ${p.AM.teachersNeeded} TEACHERS`;
      const pm = `Lessons:${p.PM.lessonStu}stu→NEED ${p.PM.teachersNeeded} TEACHERS`;
      detail = `TEACHING DAY — AM:${am} | PM:${pm} | Total ${p.totalStu} students.`;
    }
    lines.push(`${i} | ${p.ds} | ${p.dow} | ${detail}`);
  });

  // ── Session targets & rules ──
  lines.push("");
  lines.push("## STRICT RULES — YOU MUST FOLLOW THESE EXACTLY");
  lines.push("");
  lines.push("### 1. Session counting");
  lines.push("Count every non-blank cell EXCEPT: Day Off, Induction, Setup, Office, Airport.");
  lines.push("Each staff member's total counted cells MUST NOT exceed their session target.");
  lines.push("FTT/TAL/HP target = 22. SAI/AL/SC/LAL/LAC/FOOTBALL/DRAMA/DANCE = 24. Management = salaried (unlimited).");
  lines.push("");
  lines.push("### 2. Teaching label — ALWAYS use 'Lessons' for regular teaching");
  lines.push("'Lessons' is the ONLY label for regular English teaching sessions.");
  lines.push("'English Lessons' must NOT be used for regular teaching (it's reserved for Intensive English Plus programme).");
  lines.push("'Testing' is used on the day after arrival for placement tests.");
  lines.push("");
  lines.push("### 3. Day off rules for TEACHING staff (FTT, TAL)");
  lines.push("Teaching staff MUST NOT take days off on regular teaching days — this breaks class continuity.");
  lines.push("Teachers' days off should fall on: FDE days (no lessons), weekends, or arrival days.");
  lines.push("If no FDE/weekend is available, give teachers days off on the day with the LOWEST lesson demand.");
  lines.push("");
  lines.push("### 4. ZZ programme — ONE teacher, ONE slot per day");
  if (isZZ) {
    lines.push("This is a ZZ centre. Teachers teach EITHER AM OR PM on any given day, NOT BOTH.");
    lines.push("Each teaching day slot (AM or PM) needs the specified number of teachers simultaneously in that slot.");
    lines.push("A TAL teaching AM lessons cannot also teach PM lessons on the same day — they do an activity or excursion in their other slot.");
  }
  lines.push("");
  lines.push("### 5. Exact teacher counts");
  lines.push("On each teaching day, assign EXACTLY the number of teachers specified in the day profile to EACH slot.");
  lines.push("If you cannot meet the required teacher count (insufficient staff), still assign as many as possible and note the gap.");
  lines.push("");
  lines.push("### 6. Day offs — stagger, never too many on same day");
  lines.push("Each non-management staff member gets 1 full day off per week (3 AM+PM+Eve cells all = 'Day Off').");
  lines.push("Stagger days off — never more than 2 activity staff off on the same day.");
  lines.push("Never give activity staff days off on FDE days or first arrival day.");

  // ── Staffing gaps warning ──
  if (staffingGaps.length > 0) {
    lines.push("");
    lines.push("## ⚠️ STAFFING ADEQUACY WARNING");
    lines.push("The following days may have insufficient teaching staff. Assign as many teachers as possible and fill remaining slots with the best available. The API response will flag these gaps separately.");
    staffingGaps.forEach((g) => {
      lines.push(`- Day ${g.di} (${g.ds} ${g.dow}) ${g.slot}: need ${g.needed} teachers but only ~${g.available} on site. Short by ${g.shortfall}.`);
    });
  }

  // ── Output format ──
  lines.push("");
  lines.push("## OUTPUT FORMAT");
  lines.push("Return ONLY a valid JSON object — no markdown, no explanation, no code blocks.");
  lines.push('Keys: "staffIndex-dayIndex-slot" where slot is AM, PM, or Eve.');
  lines.push("Omit blank cells entirely. 'Day Off' cells for full days off MUST be included (all 3 slots: AM, PM, Eve).");
  lines.push("");
  lines.push("Allowed session values:");
  lines.push("  Teaching: Lessons | Testing | Int English");
  lines.push("  Activities: Activities | Football | Drama | Dance | Vlogging");
  lines.push("  Excursions: [destination name e.g. Liverpool, Chester, Stratford]");
  lines.push("  Arrival day: pickup | welcome | setup | dinner");
  lines.push("  Management: Office");
  lines.push("  Special: Day Off | Induction | Airport");
  lines.push("  Evenings: Eve Ents | Disco | Karaoke | Quiz | Film Night | Talent Show | Scavenger Hunt | Flag Ceremony | Awards");
  lines.push("");
  lines.push('Output the JSON now (starting with "{"):');

  return lines.join("\n");
}

// Post-process: enforce session limits by trimming excess Eve/activity sessions
function enforceSessionLimits(grid, staffIndex) {
  const SLOTS = ["AM","PM","Eve"];
  const sessCount = {};
  staffIndex.forEach((s) => { sessCount[s.id] = 0; });

  // First pass: count all sessions
  for (const [key, val] of Object.entries(grid)) {
    if (!val || NO_COUNT.has(val)) continue;
    const [sid] = key.split("-");
    if (sessCount[sid] !== undefined) sessCount[sid]++;
  }

  // Second pass: trim excess — remove Eve entries first, then PM, working backwards by date
  const sortedKeys = Object.keys(grid).sort().reverse();
  for (const key of sortedKeys) {
    const val = grid[key];
    if (!val || NO_COUNT.has(val)) continue;
    const parts = key.split("-");
    // key format: uuid-YYYY-MM-DD-slot — uuid has no dashes issue, but our keys are staffId-date-slot
    // Split differently: last part is slot, second-to-last is the date's day portion
    const slot = parts[parts.length - 1];
    const sid = parts.slice(0, -2).join("-"); // staffId may have no dashes (UUID)
    // Actually our keys are `${staffEntry.id}-${ds}-${slot}` = UUID-YYYY-MM-DD-AM/PM/Eve
    // UUID = 36 chars with dashes. Better to reconstruct:
    const staffEntry = staffIndex.find((s) => key.startsWith(s.id + "-"));
    if (!staffEntry) continue;
    const target = SESSION_TARGET(staffEntry.role);
    if (target === 0) continue;
    if (sessCount[staffEntry.id] > target) {
      // Prefer removing Eve sessions, then PM, then AM
      if (slot === "Eve" || slot === "PM") {
        delete grid[key];
        sessCount[staffEntry.id]--;
      }
    }
  }
  return grid;
}

export async function POST(req) {
  try {
    const { staff, groups, progGrid, progStart, progEnd, centreName } = await req.json();

    if (!staff?.length) return Response.json({ error: "No staff provided" }, { status: 400 });
    if (!progStart || !progEnd) return Response.json({ error: "Date range required" }, { status: 400 });

    const dates = genDates(progStart, progEnd);
    const staffIndex = staff.map((s, i) => ({
      i, id: s.id, name: s.name || `Staff ${i}`,
      role: s.role || "SAI", arr: s.arr || progStart, dep: s.dep || progEnd, to: s.to || "",
    }));
    const dayProfiles = buildDayProfiles(dates, groups, progGrid);
    const staffingGaps = calcStaffingGaps(staffIndex, dayProfiles);

    const prompt = buildPrompt(centreName, progStart, progEnd, staffIndex, groups, dayProfiles, staffingGaps);

    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      system: INTEL_DOC,
      messages: [{ role: "user", content: prompt }],
    });

    const response = await stream.finalMessage();
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No text in Claude response");

    const text = textBlock.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response. Preview: ${text.slice(0, 300)}`);

    const indexed = JSON.parse(jsonMatch[0]);
    const dateStrings = dates.map(dayKey);

    // Convert indexed keys → staffId-date-slot
    const grid = {};
    for (const [key, val] of Object.entries(indexed)) {
      if (!val || val === "") continue;
      const parts = key.split("-");
      if (parts.length < 3) continue;
      const slot = parts[parts.length - 1];
      const di = parseInt(parts[parts.length - 2]);
      const si = parseInt(parts[parts.length - 3]);
      if (!["AM","PM","Eve"].includes(slot)) continue;
      const staffEntry = staffIndex[si];
      const ds = dateStrings[di];
      if (!staffEntry || !ds) continue;
      grid[`${staffEntry.id}-${ds}-${slot}`] = val;
    }

    // Enforce session limits
    enforceSessionLimits(grid, staffIndex);

    // Build staffing suggestions for the UI
    const suggestions = staffingGaps.map((g) => ({
      ds: g.ds, dow: g.dow, slot: g.slot, needed: g.needed, available: g.available, shortfall: g.shortfall,
    }));

    return Response.json({ grid, suggestions });
  } catch (e) {
    console.error("generate-rota error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
