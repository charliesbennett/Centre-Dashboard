import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

export const maxDuration = 300;

// Load the UKLC rota intelligence document once at module init
const INTEL_DOC = readFileSync(join(process.cwd(), "lib/rotaIntel.md"), "utf-8");

// Minimal helpers (avoids importing client-side constants module)
function genDates(start, end) {
  const dates = [];
  const s = new Date(start), e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
  return dates;
}
function dayKey(d) { return d.toISOString().split("T")[0]; }
function dayName(d) { return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]; }
function inRange(ds, arr, dep) {
  if (!arr || !dep) return false;
  return ds >= arr && ds <= dep;
}
function getGroupLessonSlot(g, ds) {
  if (!g.arr || !g.lessonSlot) return g.lessonSlot || "AM";
  const daysSince = Math.floor((new Date(ds) - new Date(g.arr)) / 86400000);
  return Math.floor(daysSince / 7) % 2 === 0 ? g.lessonSlot : (g.lessonSlot === "AM" ? "PM" : "AM");
}

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

    (groups || []).forEach((g) => {
      if (inRange(ds, g.arr, g.dep)) totalStu += (g.stu || 0) + (g.gl || 0);
    });

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
      const topDest = Object.keys(excDests).sort((a, b) => excDests[b] - excDests[a])[0] || null;
      slotInfo[slot] = {
        lessonStu, testStu,
        isTesting: testStu > 0,
        hasExc: Object.keys(excDests).length > 0,
        topDest,
        teachersNeeded: Math.ceil((lessonStu + testStu) / 16),
        excBreakdown: Object.keys(excDests).length > 0
          ? Object.entries(excDests).map(([dest, n]) => `${dest}(${n}stu)`).join(", ")
          : null,
      };
    });

    const isFDE = slotInfo.AM.hasExc && slotInfo.PM.hasExc
      && slotInfo.AM.lessonStu === 0 && slotInfo.PM.lessonStu === 0
      && slotInfo.AM.testStu === 0 && slotInfo.PM.testStu === 0;
    const isTestingDay = slotInfo.AM.isTesting || slotInfo.PM.isTesting;
    const fdeLabel = isFDE ? (slotInfo.AM.topDest || slotInfo.PM.topDest || "Excursion") : null;

    return {
      ds, dow,
      isFirstArrival: ds === firstArrival,
      isArrival: allArrivalDates.has(ds),
      isTestingDay,
      isFDE,
      fdeLabel,
      isHDE: !isFDE && (slotInfo.AM.hasExc || slotInfo.PM.hasExc),
      totalStu,
      arrivingStu: arrStu[ds] || 0,
      AM: slotInfo.AM,
      PM: slotInfo.PM,
    };
  });
}

function buildPrompt(centreName, progStart, progEnd, staffIndex, groups, dayProfiles) {
  const lines = [];

  lines.push(`Generate a 2-week rota for ${centreName || "a UKLC centre"} (${progStart} to ${progEnd}).`);
  lines.push("");
  lines.push("## STAFF (index: Name, Role, On-site dates, Time-off)");
  staffIndex.forEach((s) => {
    const toNote = s.to ? ` [time off: ${s.to}]` : "";
    lines.push(`${s.i}: ${s.name} | ${s.role} | ${s.arr || "?"} to ${s.dep || "?"}${toNote}`);
  });

  lines.push("");
  lines.push("## GROUPS");
  (groups || []).forEach((g) => {
    lines.push(`- ${g.group || "Group"}: arr ${g.arr}, dep ${g.dep}, ${g.stu || 0} students, ${g.gl || 0} group leaders, lesson slot Week1: ${g.lessonSlot || "AM"} (flips weekly in ZZ)`);
  });

  lines.push("");
  lines.push("## DAY PROFILES");
  lines.push("(index: date | type | detail)");
  dayProfiles.forEach((p, i) => {
    let detail = "";
    if (p.isFirstArrival) {
      detail = `FIRST ARRIVAL. ${p.arrivingStu} students arriving. No lessons. Airport pickups, welcome, setup.`;
    } else if (p.isArrival) {
      detail = `ARRIVAL. ${p.arrivingStu} more students arriving. Small pickup team needed, lessons continue for existing groups.`;
    } else if (p.isTestingDay) {
      const amT = p.AM.isTesting ? `AM: ${p.AM.testStu} stu → ${p.AM.teachersNeeded} teachers for testing` : `AM: ${p.AM.lessonStu} stu → ${p.AM.teachersNeeded} teachers for lessons`;
      const pmT = p.PM.isTesting ? `PM: ${p.PM.testStu} stu → ${p.PM.teachersNeeded} teachers for testing` : `PM: ${p.PM.lessonStu} stu → ${p.PM.teachersNeeded} teachers for lessons`;
      detail = `TESTING DAY. ${amT}. ${pmT}. Activity staff run activities.`;
    } else if (p.isFDE) {
      detail = `FDE: ${p.fdeLabel}. ${p.totalStu} students on full-day excursion. All activity staff + TALs needed. FTTs have day off.`;
    } else if (p.isHDE) {
      const amPart = p.AM.hasExc ? `AM excursion: ${p.AM.topDest || "Excursion"} (${p.AM.excBreakdown || "?"})` : `AM: ${p.AM.lessonStu}stu lessons (${p.AM.teachersNeeded} teachers)`;
      const pmPart = p.PM.hasExc ? `PM excursion: ${p.PM.topDest || "Excursion"} (${p.PM.excBreakdown || "?"})` : `PM: ${p.PM.lessonStu}stu lessons (${p.PM.teachersNeeded} teachers)`;
      detail = `Normal day + half-day excursion. ${amPart}. ${pmPart}. Total ${p.totalStu} students on site.`;
    } else {
      const amPart = `AM: ${p.AM.lessonStu}stu lessons (need ${p.AM.teachersNeeded} teachers)`;
      const pmPart = `PM: ${p.PM.lessonStu}stu lessons (need ${p.PM.teachersNeeded} teachers)`;
      detail = `Normal teaching day. ${amPart}. ${pmPart}. Total ${p.totalStu} students.`;
    }
    lines.push(`${i}: ${p.ds} ${p.dow} | ${detail}`);
  });

  lines.push("");
  lines.push("## SESSION TARGETS");
  lines.push("FTT: 22/fortnight | TAL: 22/fortnight | SAI/AL/SC/AC/FOOTBALL/DRAMA/DANCE: 24/fortnight | HP: 22/fortnight | CM/CD/EAM/SWC: salaried (show Office for most slots)");

  lines.push("");
  lines.push("## OUTPUT FORMAT");
  lines.push("Return ONLY a JSON object. Keys are \"staffIndex-dayIndex-slot\" (slot = AM, PM, or Eve).");
  lines.push("Only include non-blank cells. Blank = day off or unassigned (do not output key for blank).");
  lines.push("Session value examples: Lessons, Testing, English Lessons, Activities, Excursion, " +
    "[destination name like Liverpool or Chester], Football, Drama, Dance, Vlogging, " +
    "Setup, Induction, Airport, pickup, welcome, dinner, Office, Day Off, Eve Ents, " +
    "[eve ent name like Disco or Karaoke or Quiz]");
  lines.push("");
  lines.push("Example output (not real data):");
  lines.push('{"0-0-AM":"pickup","0-0-PM":"welcome","0-0-Eve":"Eve Ents","1-0-AM":"Setup","1-1-AM":"Testing","1-1-PM":"Testing"}');
  lines.push("");
  lines.push("Generate the complete rota JSON now:");

  return lines.join("\n");
}

export async function POST(req) {
  try {
    const { staff, groups, progGrid, progStart, progEnd, centreName } = await req.json();

    if (!staff?.length) return Response.json({ error: "No staff provided" }, { status: 400 });
    if (!progStart || !progEnd) return Response.json({ error: "Date range required" }, { status: 400 });

    const dates = genDates(progStart, progEnd);
    const staffIndex = staff.map((s, i) => ({ i, id: s.id, name: s.name || `Staff ${i}`, role: s.role || "SAI", arr: s.arr || progStart, dep: s.dep || progEnd, to: s.to || "" }));
    const dayProfiles = buildDayProfiles(dates, groups, progGrid);

    const prompt = buildPrompt(centreName, progStart, progEnd, staffIndex, groups, dayProfiles);

    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      system: INTEL_DOC,
      messages: [{ role: "user", content: prompt }],
    });

    const response = await stream.finalMessage();

    // Extract JSON — handle possible markdown code blocks
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No text in Claude response");

    const text = textBlock.text;
    // Try to extract JSON object from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON found in response. Response starts: ${text.slice(0, 200)}`);

    const indexed = JSON.parse(jsonMatch[0]);

    // Convert indexed keys back to staffId-date-slot
    const dateStrings = dates.map(dayKey);
    const grid = {};
    for (const [key, val] of Object.entries(indexed)) {
      if (!val || val === "") continue;
      const parts = key.split("-");
      if (parts.length < 3) continue;
      const [si, di, slot] = parts;
      const staffEntry = staffIndex[parseInt(si)];
      const ds = dateStrings[parseInt(di)];
      if (!staffEntry || !ds || !["AM","PM","Eve"].includes(slot)) continue;
      grid[`${staffEntry.id}-${ds}-${slot}`] = val;
    }

    return Response.json({ grid });
  } catch (e) {
    console.error("generate-rota error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
