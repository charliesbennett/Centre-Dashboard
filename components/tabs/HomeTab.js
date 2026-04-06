"use client";
import { useState, useMemo, useEffect } from "react";
import { dayKey, dayName, fmtDate, ACTIVITY_TYPES, SESSION_TYPES, ROLES, calcLessonSplit, uid } from "@/lib/constants";
import { useB } from "@/lib/theme";
import { StatCard, IcPlaneUp, IcPlaneDn, IcCake, IcBus, IcMountain, IcSparkles, IcBook, IcGradCap, IcUserCog, IcUsersTab, IcStar, IconBtn, IcTrash, btnPrimary, inputStyle } from "@/components/ui";

// ── Helpers ────────────────────────────────────────────────
// inBed: is someone staying the night? (arr <= date < dep — excludes dep day)
function inBed(dateStr, arrDate, depDate) {
  if (!arrDate || !depDate) return false;
  return new Date(dateStr) >= new Date(arrDate) && new Date(dateStr) < new Date(depDate);
}
// isOnsiteOn: is someone on-site during this day? (arr <= date <= dep — includes dep day)
function isOnsiteOn(dateStr, arrDate, depDate) {
  if (!arrDate || !depDate) return false;
  return new Date(dateStr) >= new Date(arrDate) && new Date(dateStr) <= new Date(depDate);
}

const GROUP_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ea580c", "#16a34a",
  "#0891b2", "#d97706", "#dc2626", "#7c3aed", "#0369a1",
];

const ROLE_ORDER = ["CM", "CD", "EAM", "SWC", "TAL", "FTT", "SC", "EAC", "SAI", "EAL", "DRAMA", "DANCE"];

const QUOTES = [
  { text: "To have another language is to possess a second soul.", author: "Charlemagne" },
  { text: "The limits of my language mean the limits of my world.", author: "Ludwig Wittgenstein" },
  { text: "A different language is a different vision of life.", author: "Federico Fellini" },
  { text: "One language sets you in a corridor for life. Two languages open every door along the way.", author: "Frank Smith" },
  { text: "The world is a book and those who do not travel read only one page.", author: "Saint Augustine" },
  { text: "Learning another language is not only learning different words for the same things, but learning another way to think about things.", author: "Flora Lewis" },
  { text: "You can never understand one language until you understand at least two.", author: "Geoffrey Willans" },
  { text: "Language is the road map of a culture. It tells you where its people come from and where they are going.", author: "Rita Mae Brown" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "Tell me and I forget, teach me and I may remember, involve me and I learn.", author: "Benjamin Franklin" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", author: "B.B. King" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "Learning is a treasure that will follow its owner everywhere.", author: "Chinese Proverb" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
  { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "W.B. Yeats" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "What we learn with pleasure, we never forget.", author: "Alfred Mercier" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Curiosity is the engine of achievement.", author: "Ken Robinson" },
  { text: "Every child is an artist. The problem is how to remain an artist once we grow up.", author: "Pablo Picasso" },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
  { text: "Adventure is worthwhile in itself.", author: "Amelia Earhart" },
  { text: "Travel makes one modest. You see what a tiny place you occupy in the world.", author: "Gustave Flaubert" },
  { text: "Life is either a daring adventure or nothing at all.", author: "Helen Keller" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Work hard. Be kind. Amazing things will happen.", author: "Conan O'Brien" },
  { text: "Twenty years from now you will be more disappointed by the things you didn't do.", author: "Mark Twain" },
  { text: "It is not that I'm so smart. But I stay with the questions much longer.", author: "Albert Einstein" },
  { text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", author: "Emerson" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "A room without books is like a body without a soul.", author: "Marcus Tullius Cicero" },
  { text: "The greatest adventure is what lies ahead.", author: "J.R.R. Tolkien" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Language is not a genetic gift, it is a social gift. Learning a new language is becoming a member of the club.", author: "Frank Smith" },
];

function ActivityBadge({ value }) {
  const B = useB();
  if (!value) return <span style={{ color: B.textLight, fontSize: 9 }}>—</span>;
  const color = ACTIVITY_TYPES[value] || SESSION_TYPES[value] || B.textMuted;
  return (
    <span style={{ background: color + "18", color, padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
      {value}
    </span>
  );
}

// ── Pure functions (exported for testing) ─────────────────

export function assembleBriefingData({ centreName, today, groups, staff, excursions, rotaGrid }) {
  const dateStr = new Date(today).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const activeGroups = (groups || []).filter((g) => !g.archived);

  const onSiteCount = activeGroups
    .filter((g) => g.arr && g.dep && new Date(today) >= new Date(g.arr) && new Date(today) < new Date(g.dep))
    .reduce((s, g) => s + (g.stu || 0), 0);

  const arriving = activeGroups
    .filter((g) => g.arr === today)
    .map((g) => ({ groupName: g.group || g.name || "", stu: g.stu || 0 }));

  const departing = activeGroups
    .filter((g) => g.dep === today)
    .map((g) => ({ groupName: g.group || g.name || "", stu: g.stu || 0 }));

  const excursionsToday = (excursions || [])
    .filter((e) => e.exc_date === today)
    .map((e) => ({ destination: e.destination || "", coaches: e.coaches || [] }));

  const slots = ["AM", "PM", "Eve"];
  const rotaBySlot = { AM: [], PM: [], Eve: [] };
  Object.entries(rotaGrid || {}).forEach(([key, val]) => {
    if (!val) return;
    for (const slot of slots) {
      const suffix = `-${today}-${slot}`;
      if (key.endsWith(suffix)) {
        const staffId = key.slice(0, key.length - suffix.length);
        const member = (staff || []).find((s) => s.id === staffId);
        const staffName = member
          ? [member.firstName, member.surname].filter(Boolean).join(" ").trim()
          : staffId;
        rotaBySlot[slot].push({ staffName, assignment: val });
        break;
      }
    }
  });

  return { centreName: centreName || "", dateStr, onSiteCount, arriving, departing, excursionsToday, rotaBySlot };
}

export function generateBriefingHtml(data) {
  const { centreName, dateStr, onSiteCount, arriving, departing, excursionsToday, rotaBySlot } = data;

  const list = (items) =>
    items.length === 0
      ? "<p>None</p>"
      : `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

  const arrivingItems = arriving.map((g) => `${g.groupName} — ${g.stu} student${g.stu !== 1 ? "s" : ""}`);
  const departingItems = departing.map((g) => `${g.groupName} — ${g.stu} student${g.stu !== 1 ? "s" : ""}`);
  const excItems = excursionsToday.map((e) =>
    `${e.destination}${e.coaches && e.coaches.length ? " (coaches: " + e.coaches.join(", ") + ")" : ""}`
  );

  const slotRows = ["AM", "PM", "Eve"].map((slot) => {
    const entries = rotaBySlot[slot] || [];
    const items = entries.map((e) => `${e.staffName} — ${e.assignment}`);
    return `<h3>${slot}</h3>${list(items)}`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${centreName} — Daily Briefing — ${dateStr}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 0; }
  h1 { font-size: 16pt; margin: 0 0 2px; }
  h2 { font-size: 13pt; margin: 0 0 12px; font-weight: normal; color: #333; }
  h3 { font-size: 11pt; margin: 10px 0 4px; }
  ul { margin: 0 0 8px; padding-left: 20px; }
  li { margin-bottom: 3px; }
  p { margin: 0 0 8px; }
  .stat { font-size: 13pt; font-weight: bold; margin-bottom: 12px; }
  section { margin-bottom: 10px; }
  hr { border: none; border-top: 1px solid #000; margin: 10px 0; }
  @media print { body { margin: 0; } }
  @page { size: A4; margin: 15mm; }
</style>
</head>
<body>
<h1>${centreName}</h1>
<h2>${dateStr}</h2>
<hr>
<section>
  <h3>Students on Site</h3>
  <p class="stat">${onSiteCount}</p>
</section>
<hr>
<section>
  <h3>Arriving Today</h3>
  ${list(arrivingItems)}
</section>
<hr>
<section>
  <h3>Departing Today</h3>
  ${list(departingItems)}
</section>
<hr>
<section>
  <h3>Excursions Today</h3>
  ${list(excItems)}
</section>
<hr>
<section>
  <h3>Rota</h3>
  ${slotRows}
</section>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

export function addNotice(notices, { title, body, urgency, createdBy }) {
  const notice = {
    id: uid(),
    title,
    body,
    urgency: urgency || "Normal",
    createdAt: new Date().toISOString(),
    createdBy: createdBy || "",
  };
  return [notice, ...(notices || [])];
}

export function deleteNotice(notices, id) {
  return (notices || []).filter((n) => n.id !== id);
}

export function openBriefingSheet(data) {
  const html = generateBriefingHtml(data);
  const newWin = window.open("", "_blank");
  if (!newWin) return;
  newWin.document.write(html);
  newWin.document.close();
}

// ──────────────────────────────────────────────────────────
export default function HomeTab({ groups = [], staff = [], excDays = {}, progGrid = {}, rotaGrid = {}, progStart, progEnd, excursions = [], userRole = "", userName = "", centreName = "", settings = {}, saveSetting }) {
  const B = useB();
  const today = useMemo(() => dayKey(new Date()), []);
  const todayDate = useMemo(() => new Date(today), [today]);
  const activeGroups = useMemo(() => groups.filter((g) => !g.archived), [groups]);

  // ── On-site numbers ────────────────────────────────────
  // onSiteGroups: groups present during today (includes departure day)
  const onSiteGroups = useMemo(() =>
    activeGroups.filter((g) => isOnsiteOn(today, g.arr, g.dep)), [activeGroups, today]);

  // onsiteTonightGroups: groups staying overnight (excludes departure day)
  const onsiteTonightGroups = useMemo(() =>
    activeGroups.filter((g) => inBed(today, g.arr, g.dep)), [activeGroups, today]);

  const onSiteStudents = useMemo(() =>
    onSiteGroups.reduce((s, g) => s + (g.stu || 0), 0), [onSiteGroups]);

  const onSiteGLs = useMemo(() =>
    onSiteGroups.reduce((s, g) => s + (g.gl || 0), 0), [onSiteGroups]);

  const onSiteStaff = useMemo(() =>
    staff.filter((s) => isOnsiteOn(today, s.arr, s.dep)), [staff, today]);

  const totalOnSite = onSiteStudents + onSiteGLs + onSiteStaff.length;

  // ── Arrivals & departures ──────────────────────────────
  const arrivingToday = useMemo(() =>
    activeGroups.filter((g) => g.arr === today), [activeGroups, today]);

  const departingToday = useMemo(() =>
    activeGroups.filter((g) => g.dep === today), [activeGroups, today]);

  const [arrOpen, setArrOpen] = useState(true);
  const [depOpen, setDepOpen] = useState(true);

  // ── Notice board ───────────────────────────────────────
  const canManageNotices = ["head_office", "centre_manager"].includes(userRole);
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    try { setNotices(JSON.parse(settings?.notice_board || "[]")); } catch { setNotices([]); }
  }, [settings?.notice_board]);
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [nUrgency, setNUrgency] = useState("Normal");

  function handleAddNotice(e) {
    e.preventDefault();
    if (!nTitle.trim() || !nBody.trim()) return;
    const updated = addNotice(notices, { title: nTitle.trim(), body: nBody.trim(), urgency: nUrgency, createdBy: userRole });
    setNotices(updated);
    saveSetting?.("notice_board", JSON.stringify(updated));
    setNTitle("");
    setNBody("");
    setNUrgency("Normal");
  }

  function handleDeleteNotice(id) {
    const updated = deleteNotice(notices, id);
    setNotices(updated);
    saveSetting?.("notice_board", JSON.stringify(updated));
  }

  // ── Excursion today ────────────────────────────────────
  const excToday = excDays[today];

  // ── Today's programme ──────────────────────────────────
  const todayProg = useMemo(() =>
    onSiteGroups.map((g) => ({
      ...g,
      am: progGrid[g.id + "-" + today + "-AM"] || "",
      pm: progGrid[g.id + "-" + today + "-PM"] || "",
    })), [onSiteGroups, progGrid, today]);

  // ── Evening activity: check progGrid EVE first, then rotaGrid Eve ─
  const eveActivity = useMemo(() => {
    // Check progGrid EVE slots (Ministay centres)
    const progCounts = {};
    Object.entries(progGrid).forEach(([key, val]) => {
      if (!val) return;
      const m = key.match(/^(.+)-(\d{4}-\d{2}-\d{2})-(EVE)$/);
      if (m && m[2] === today) progCounts[val] = (progCounts[val] || 0) + 1;
    });
    const progSorted = Object.entries(progCounts).sort((a, b) => b[1] - a[1]);
    if (progSorted.length > 0) return progSorted[0][0];

    // Fall back to rotaGrid Eve (summer centres)
    const rotaCounts = {};
    Object.entries(rotaGrid).forEach(([key, val]) => {
      if (!val) return;
      const m = key.match(/^(.+)-(\d{4}-\d{2}-\d{2})-(Eve)$/);
      if (m && m[2] === today) rotaCounts[val] = (rotaCounts[val] || 0) + 1;
    });
    const rotaSorted = Object.entries(rotaCounts).sort((a, b) => b[1] - a[1]);
    return rotaSorted.length > 0 ? rotaSorted[0][0] : null;
  }, [progGrid, rotaGrid, today]);

  // ── Upcoming birthdays (next 14 days) ─────────────────
  const upcomingBirthdays = useMemo(() => {
    const people = [];
    const thisYear = todayDate.getFullYear();
    activeGroups.forEach((g, gi) => {
      [...(g.students || []), ...(g.leaders || [])].forEach((s) => {
        if (!s.dob) return;
        const dob = new Date(s.dob);
        if (isNaN(dob)) return;
        let bday = new Date(thisYear, dob.getMonth(), dob.getDate());
        if (bday < todayDate) bday = new Date(thisYear + 1, dob.getMonth(), dob.getDate());
        const daysUntil = Math.round((bday - todayDate) / 86400000);
        if (daysUntil > 14) return;
        const turningAge = thisYear + (bday.getFullYear() > thisYear ? 1 : 0) - dob.getFullYear();
        people.push({
          name: ((s.firstName || "") + " " + (s.surname || "")).trim(),
          group: g.group,
          color: GROUP_COLORS[gi % GROUP_COLORS.length],
          daysUntil,
          age: turningAge > 0 && turningAge < 100 ? turningAge : null,
          isGL: s.type === "gl",
        });
      });
    });
    return people.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [activeGroups, todayDate]);

  // ── Next 7 days outlook ────────────────────────────────
  const next7Days = useMemo(() => {
    const days = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() + i);
      const ds = dayKey(d);
      const arrivals = activeGroups.filter((g) => g.arr === ds);
      const departures = activeGroups.filter((g) => g.dep === ds);
      const excursion = excDays[ds] || null;
      // Birthdays on this day
      const thisYear = d.getFullYear();
      const bdays = [];
      activeGroups.forEach((g) => {
        [...(g.students || []), ...(g.leaders || [])].forEach((s) => {
          if (!s.dob) return;
          const dob = new Date(s.dob);
          if (isNaN(dob)) return;
          const bday = new Date(thisYear, dob.getMonth(), dob.getDate());
          if (dayKey(bday) === ds) {
            bdays.push(((s.firstName || "") + " " + (s.surname || "")).trim());
          }
        });
      });
      if (arrivals.length || departures.length || excursion || bdays.length) {
        days.push({ date: ds, d, arrivals, departures, excursion, bdays });
      }
    }
    return days;
  }, [activeGroups, excDays, todayDate]);

  // ── Programme day/week number ──────────────────────────
  const { dayNum, weekNum, beforeProg, afterProg, daysToStart } = useMemo(() => {
    if (!progStart || !progEnd) return {};
    const diff = Math.floor((todayDate - new Date(progStart)) / 86400000);
    const before = today < progStart;
    const after = today > progEnd;
    return {
      dayNum: !before && !after ? diff + 1 : null,
      weekNum: !before && !after ? Math.ceil((diff + 1) / 7) : null,
      beforeProg: before,
      afterProg: after,
      daysToStart: before ? Math.ceil((new Date(progStart) - todayDate) / 86400000) : null,
    };
  }, [today, progStart, progEnd, todayDate]);

  // ── AM/PM lesson split for today ──────────────────────
  const { amToday, pmToday } = useMemo(() => {
    const split = calcLessonSplit(activeGroups, [today]);
    return { amToday: split[today]?.am || 0, pmToday: split[today]?.pm || 0 };
  }, [activeGroups, today]);

  // ── Quote of the day ───────────────────────────────────
  const dayOfYear = Math.floor((todayDate - new Date(todayDate.getFullYear(), 0, 0)) / 86400000);
  const quote = QUOTES[dayOfYear % QUOTES.length];

  const todayStr = todayDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ── Greeting ──────────────────────────────────────────
  const hour = new Date().getHours();
  const greetingWord = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (userName || "").split(" ")[0] || "";

  // ── Render ─────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ── Hero banner ──────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg, #1c3048 0%, #1e3a5f 50%, #162840 100%)", padding: "20px 24px 18px", position: "relative", overflow: "hidden" }}>
        {/* Subtle brand graphic */}
        <svg aria-hidden="true" style={{ position: "absolute", right: 0, top: 0, opacity: 0.06, pointerEvents: "none" }} width="260" height="90" viewBox="0 0 260 90">
          <rect x="100" y="0" width="60" height="90" fill="white" />
          <rect x="0" y="30" width="260" height="30" fill="white" />
          <path d="M0 0L65 90M195 0L260 90M260 0L195 90M65 0L0 90" stroke="white" strokeWidth="22" />
        </svg>
        {/* Radial glow */}
        <div style={{ position: "absolute", top: -40, right: "20%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,39,59,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        {/* Yellow accent line at bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: B.yellow, opacity: 0.6 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <div>
            {firstName && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 700, marginBottom: 6, fontFamily: "'Raleway', sans-serif" }}>
                {greetingWord}, {firstName} 👋
              </div>
            )}
            <div style={{ fontSize: 10, color: B.yellow, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, fontFamily: "'Raleway', sans-serif" }}>
              Today
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: B.white, lineHeight: 1.2, fontFamily: "'Raleway', sans-serif" }}>
              {todayStr}
            </div>
            {dayNum && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 5, fontWeight: 600 }}>
                Day {dayNum} of programme &nbsp;·&nbsp; Week {weekNum}
              </div>
            )}
            {beforeProg && daysToStart != null && (
              <div style={{ fontSize: 10, color: B.yellow, marginTop: 5, fontWeight: 700 }}>
                Programme starts in {daysToStart} day{daysToStart !== 1 ? "s" : ""} &nbsp;·&nbsp; {fmtDate(progStart)}
              </div>
            )}
            {afterProg && (
              <div style={{ fontSize: 10, color: B.pink, marginTop: 5, fontWeight: 700 }}>
                Programme complete
              </div>
            )}
          </div>

          {/* Quote */}
          <div style={{ maxWidth: 380, textAlign: "right", flex: "1 1 220px" }}>
            <div style={{ fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
              &ldquo;{quote.text}&rdquo;
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 5, fontWeight: 700, letterSpacing: 0.5 }}>
              &mdash; {quote.author}
            </div>
          </div>
        </div>
      </div>

      {/* ── Print Briefing button (HO / CM only) ─────────── */}
      {["head_office", "centre_manager"].includes(userRole) && (
        <div style={{ padding: "14px 20px 0", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => openBriefingSheet(assembleBriefingData({ centreName, today, groups, staff, excursions, rotaGrid }))}
            style={{ background: B.navy, color: B.white, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Raleway', sans-serif", boxShadow: "0 2px 8px rgba(28,48,72,0.2)" }}
          >
            🖨 Print Briefing
          </button>
        </div>
      )}

      {/* ── Stat grid ─────────────────────────────────────── */}
      <div style={{ padding: "14px 20px 8px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 12 }}>
        <StatCard hero label="On-Site Today" value={totalOnSite} color={B.navy} icon={<IcUsersTab />} sub={`${onSiteGroups.length} group${onSiteGroups.length !== 1 ? "s" : ""}`} />
        <StatCard label="Students" value={onSiteStudents} color={B.red} icon={<IcGradCap />} />
        <StatCard label="Group Leaders" value={onSiteGLs} color="#7c3aed" icon={<IcStar />} />
        <StatCard label="UKLC Staff" value={onSiteStaff.length} color="#0891b2" icon={<IcUserCog />} />
        {amToday > 0 && <StatCard label="AM Lessons" value={amToday} color="#1e40af" icon={<IcBook />} />}
        {pmToday > 0 && <StatCard label="PM Lessons" value={pmToday} color="#166534" icon={<IcBook />} />}
        {arrivingToday.length > 0 && <StatCard label="Arriving" value={arrivingToday.length} color={B.success} icon={<IcPlaneUp />} sub={arrivingToday.length === 1 ? "group" : "groups"} />}
        {departingToday.length > 0 && <StatCard label="Departing" value={departingToday.length} color={B.warning} icon={<IcPlaneDn />} sub={departingToday.length === 1 ? "group" : "groups"} />}
        {excToday && <StatCard label="Excursion Today" value={excToday === "Full" ? "Full Day" : "Half Day"} color="#ea580c" icon={<IcBus />} />}
      </div>

      {/* ── Arrivals & departures panels ─────────────────── */}
      {(arrivingToday.length > 0 || departingToday.length > 0) && (
        <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { key: "arr", label: "Arriving Today", groups: arrivingToday, open: arrOpen, setOpen: setArrOpen, accent: B.success, empty: "No arrivals today" },
            { key: "dep", label: "Departing Today", groups: departingToday, open: depOpen, setOpen: setDepOpen, accent: B.warning, empty: "No departures today" },
          ].map(({ key, label, groups: gs, open, setOpen, accent, empty }) => (
            <div key={key} style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div
                onClick={() => setOpen(!open)}
                style={{ background: B.navy, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderRadius: open ? "10px 10px 0 0" : 10 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, display: "inline-block" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: B.white, fontFamily: "'Raleway', sans-serif" }}>{label}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{gs.length} group{gs.length !== 1 ? "s" : ""}</span>
                </div>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>{open ? "▼" : "▶"}</span>
              </div>
              {open && (
                <div style={{ padding: "4px 0" }}>
                  {gs.length === 0 ? (
                    <div style={{ padding: "14px", textAlign: "center", color: B.textLight, fontSize: 10 }}>{empty}</div>
                  ) : gs.map((g, i) => (
                    <div key={g.id} style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: i < gs.length - 1 ? `1px solid ${B.borderLight}` : "none" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: GROUP_COLORS[i % GROUP_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, color: B.text, fontSize: 12, flex: 1 }}>{g.group}</span>
                      <span style={{ fontSize: 10, color: B.textMuted, background: B.ice, border: `1px solid ${B.border}`, borderRadius: 4, padding: "2px 8px" }}>
                        {g.stu || 0} students{g.gl ? `, ${g.gl} GLs` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Main 3-column grid ────────────────────────────── */}
      <div style={{ padding: "8px 12px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>

        {/* ── TODAY'S PROGRAMME ────────────────────────── */}
        <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: "#3b82f6", flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 12, color: B.text, fontFamily: "'Raleway', sans-serif" }}>Today&rsquo;s Programme</span>
            </div>
            <span style={{ fontSize: 10, color: B.textMuted }}>
              {dayName(todayDate)}, {todayDate.getDate()}/{todayDate.getMonth() + 1}
            </span>
          </div>

          {excToday && (
            <div style={{ padding: "6px 14px", background: B.warningBg, borderBottom: "1px solid " + B.borderLight, fontSize: 10, fontWeight: 800, color: B.warning, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{excToday === "Full" ? <IcBus /> : <IcMountain />}</span>
              {excToday === "Full" ? "Full Day Excursion — groups off-site" : "Half Day Excursion"}
            </div>
          )}

          <div style={{ padding: "6px 0" }}>
            {todayProg.length === 0 ? (
              <div style={{ padding: "20px 14px", textAlign: "center", color: B.textLight, fontSize: 10 }}>
                No groups on-site today
              </div>
            ) : todayProg.map((g, i) => (
              <div key={g.id} style={{ padding: "6px 14px", borderBottom: i < todayProg.length - 1 ? "1px solid " + B.borderLight : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: GROUP_COLORS[i % GROUP_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 10, color: B.text }}>{g.group}</span>
                  <span style={{ fontSize: 8, color: B.textLight, background: B.ice, padding: "1px 5px", borderRadius: 3 }}>
                    {(g.stu || 0) + (g.gl || 0)} pax
                  </span>
                  {today !== g.arr && today !== g.dep && (
                    <span style={{ fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 3, background: g.lessonSlot === "PM" ? B.pink : B.ice, color: g.lessonSlot === "PM" ? B.red : B.link }}>
                      {(() => { const slot = calcLessonSplit([g], [today])[today]; return slot?.am > 0 ? "AM Lessons" : slot?.pm > 0 ? "PM Lessons" : ""; })()}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, paddingLeft: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: B.textMuted, minWidth: 16 }}>AM</span>
                    <ActivityBadge value={g.am} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: B.textMuted, minWidth: 16 }}>PM</span>
                    <ActivityBadge value={g.pm} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Evening */}
          <div style={{ borderTop: "1px solid " + B.border, padding: "7px 14px", background: B.bg, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted }}>EVENING</span>
            {eveActivity ? (
              <ActivityBadge value={eveActivity} />
            ) : (
              <span style={{ fontSize: 9, color: B.textLight }}>Not scheduled</span>
            )}
          </div>
        </div>

        {/* ── ARRIVALS, DEPARTURES & STAFF ─────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Arrivals & Departures */}
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden", flex: "0 0 auto" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${B.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: "#0f766e", flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 12, color: B.text, fontFamily: "'Raleway', sans-serif" }}>Arrivals &amp; Departures</span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {arrivingToday.length === 0 && departingToday.length === 0 ? (
                <div style={{ padding: "14px 14px", fontSize: 10, color: B.textLight, textAlign: "center" }}>No arrivals or departures today</div>
              ) : (
                <>
                  {arrivingToday.map((g) => (
                    <div key={g.id} style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid " + B.borderLight }}>
                      <span style={{ color: B.success }}><IcPlaneUp /></span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 10, color: B.text }}>{g.group}</div>
                        <div style={{ fontSize: 9, color: B.success, fontWeight: 600 }}>Arriving — {(g.stu || 0) + (g.gl || 0)} pax</div>
                        {g.arrFlight && <div style={{ fontSize: 8, color: B.textMuted }}>{g.arrAirport} · {g.arrFlight}{g.arrTime ? " at " + g.arrTime : ""}</div>}
                      </div>
                    </div>
                  ))}
                  {departingToday.map((g) => (
                    <div key={g.id} style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid " + B.borderLight }}>
                      <span style={{ color: B.warning }}><IcPlaneDn /></span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 10, color: B.text }}>{g.group}</div>
                        <div style={{ fontSize: 9, color: B.warning, fontWeight: 600 }}>Departing — {(g.stu || 0) + (g.gl || 0)} pax</div>
                        {g.depFlight && <div style={{ fontSize: 8, color: B.textMuted }}>{g.depAirport} · {g.depFlight}{g.depTime ? " at " + g.depTime : ""}</div>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Staff on duty */}
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden", flex: 1 }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, background: "#1e40af", flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 12, color: B.text, fontFamily: "'Raleway', sans-serif" }}>Staff on Duty</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: B.textMuted }}>{onSiteStaff.length}</span>
            </div>
            <div style={{ padding: "8px 14px" }}>
              {onSiteStaff.length === 0 ? (
                <div style={{ fontSize: 10, color: B.textLight, textAlign: "center", padding: "10px 0" }}>No staff on-site today</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {[...onSiteStaff]
                    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
                    .map((s) => (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, background: B.cyanBg, border: `1px solid ${B.cyan}40`, borderRadius: 5, padding: "3px 7px" }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: B.cyan }}>{s.role}</span>
                        <span style={{ fontSize: 9, color: B.text, fontWeight: 600 }}>{s.name.split(" ")[0]}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BIRTHDAYS ─────────────────────────────────── */}
        <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: "#be185d", flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 12, color: B.text, fontFamily: "'Raleway', sans-serif", display: "flex", alignItems: "center", gap: 6 }}><IcCake /> Upcoming Birthdays</span>
            </div>
            <span style={{ fontSize: 9, color: B.textMuted }}>Today &amp; next 14 days</span>
          </div>
          <div style={{ padding: "4px 0", maxHeight: 280, overflowY: "auto" }}>
            {upcomingBirthdays.length === 0 ? (
              <div style={{ padding: "20px 14px", textAlign: "center", color: B.textLight, fontSize: 10 }}>
                No birthdays in the next 14 days
              </div>
            ) : upcomingBirthdays.map((b, i) => {
              const isToday = b.daysUntil === 0;
              const isTomorrow = b.daysUntil === 1;
              return (
                <div key={i} style={{
                  padding: "7px 14px",
                  borderBottom: i < upcomingBirthdays.length - 1 ? "1px solid " + B.borderLight : "none",
                  background: isToday ? B.pink : "transparent",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 10, color: B.text }}>{b.name}</span>
                        {b.age && <span style={{ fontSize: 8, color: B.textMuted }}>turns {b.age}</span>}
                        {b.isGL && <span style={{ fontSize: 8, color: "#7c3aed", fontWeight: 700 }}>GL</span>}
                      </div>
                      <div style={{ fontSize: 8, color: b.color, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.group}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {isToday ? (
                        <span style={{ background: "#fce7f3", color: "#be185d", padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}><IcSparkles /> Today!</span>
                      ) : isTomorrow ? (
                        <span style={{ background: B.warningBg, color: B.warning, padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>Tomorrow</span>
                      ) : (
                        <span style={{ color: B.textMuted, fontSize: 9 }}>in {b.daysUntil} days</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Groups on-site mini-grid ─────────────────────── */}
      {onsiteTonightGroups.length > 0 && (
        <div style={{ padding: "10px 12px 0" }}>
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid " + B.border, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: B.navy, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: B.text, fontFamily: "'Raleway', sans-serif" }}>Groups On-Site Tonight</span>
              <span style={{ fontSize: 9, color: B.textMuted, marginLeft: 2 }}>{onsiteTonightGroups.length} group{onsiteTonightGroups.length !== 1 ? "s" : ""} &middot; {onsiteTonightGroups.reduce((s, g) => s + (g.stu || 0), 0)} students &middot; {onsiteTonightGroups.reduce((s, g) => s + (g.gl || 0), 0)} GLs</span>
            </div>
            <div style={{ padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {onsiteTonightGroups.map((g, i) => (
                <div key={g.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: GROUP_COLORS[i % GROUP_COLORS.length] + "12",
                  border: "1px solid " + GROUP_COLORS[i % GROUP_COLORS.length] + "40",
                  borderRadius: 6, padding: "5px 10px",
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                  <span style={{ fontWeight: 700, fontSize: 10, color: B.text }}>{g.group}</span>
                  <span style={{ fontSize: 9, color: B.textMuted }}>{(g.stu || 0) + (g.gl || 0)} pax</span>
                  <span style={{ fontSize: 8, color: B.textLight, background: B.ice, padding: "1px 4px", borderRadius: 3 }}>{g.nat}</span>
                  <span style={{ fontSize: 8, color: B.textLight }}>until {fmtDate(g.dep)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 7-day outlook ─────────────────────────────── */}
      {next7Days.length > 0 && (
        <div style={{ padding: "10px 12px 16px" }}>
          <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid " + B.border, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: B.navy, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: B.text, fontFamily: "'Raleway', sans-serif" }}>Coming Up — Next 7 Days</span>
            </div>
            <div style={{ display: "flex", overflowX: "auto", padding: "8px 10px", gap: 8 }}>
              {next7Days.map(({ date, d, arrivals, departures, excursion, bdays }) => (
                <div key={date} style={{
                  flexShrink: 0, width: 160, background: B.bg, border: "1px solid " + B.border,
                  borderRadius: 8, padding: "8px 10px", fontSize: 10,
                }}>
                  <div style={{ fontWeight: 800, color: B.text, marginBottom: 6 }}>
                    {dayName(d)} <span style={{ color: B.textMuted, fontWeight: 400 }}>{d.getDate()}/{d.getMonth() + 1}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {arrivals.map((g) => (
                      <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <IcPlaneUp />
                        <span style={{ color: B.success, fontWeight: 600, fontSize: 9 }}>{g.group} <span style={{ color: B.textMuted, fontWeight: 400 }}>({(g.stu || 0) + (g.gl || 0)})</span></span>
                      </div>
                    ))}
                    {departures.map((g) => (
                      <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <IcPlaneDn />
                        <span style={{ color: B.danger, fontWeight: 600, fontSize: 9 }}>{g.group} <span style={{ color: B.textMuted, fontWeight: 400 }}>({(g.stu || 0) + (g.gl || 0)})</span></span>
                      </div>
                    ))}
                    {excursion && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <IcBus />
                        <span style={{ color: "#7c3aed", fontWeight: 600, fontSize: 9 }}>{excursion} Day Exc</span>
                      </div>
                    )}
                    {bdays.map((name, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <IcCake />
                        <span style={{ color: "#db2777", fontWeight: 600, fontSize: 9 }}>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Notice Board ──────────────────────────────────── */}
      <div style={{ padding: "10px 12px 24px" }}>
        <div style={{ background: B.card, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: B.navy, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 12, color: B.text, fontFamily: "'Raleway', sans-serif" }}>📋 Notice Board</span>
            </div>
            <span style={{ fontSize: 9, color: B.textMuted }}>{notices.length} notice{notices.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Add form — authorised roles only */}
          {canManageNotices && (
            <form onSubmit={handleAddNotice} style={{ padding: "12px 14px", borderBottom: "1px solid " + B.border, background: B.bg }}>
              <div style={{ marginBottom: 8 }}>
                <input
                  value={nTitle}
                  onChange={(e) => setNTitle(e.target.value)}
                  placeholder="Notice title…"
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <textarea
                  value={nBody}
                  onChange={(e) => setNBody(e.target.value)}
                  placeholder="Notice body…"
                  rows={3}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box", minHeight: 60, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {["Normal", "Urgent"].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setNUrgency(u)}
                      style={{
                        padding: "4px 12px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: nUrgency === u ? (u === "Urgent" ? B.red : B.navy) : B.border,
                        color: nUrgency === u ? B.white : B.textMuted,
                      }}
                    >{u}</button>
                  ))}
                </div>
                <button type="submit" style={{ ...btnPrimary, marginLeft: "auto" }}>Post Notice</button>
              </div>
            </form>
          )}

          {/* Notice list */}
          <div style={{ padding: notices.length === 0 ? "20px 14px" : "8px 14px" }}>
            {notices.length === 0 ? (
              <div style={{ textAlign: "center", color: B.textLight, fontSize: 10 }}>No notices posted yet</div>
            ) : notices.map((n) => (
              <div key={n.id} style={{
                background: B.card,
                border: "1px solid " + B.border,
                borderLeft: "4px solid " + (n.urgency === "Urgent" ? B.red : B.border),
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 6,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {n.urgency === "Urgent" && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: B.red, background: B.red + "18", padding: "1px 6px", borderRadius: 4, textTransform: "uppercase" }}>Urgent</span>
                      )}
                      <span style={{ fontWeight: 700, fontSize: 12, color: B.text }}>{n.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: B.text, lineHeight: 1.5, marginBottom: 4 }}>{n.body}</div>
                    <div style={{ fontSize: 9, color: B.textMuted }}>
                      Posted by {n.createdBy} &middot; {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  {canManageNotices && (
                    <IconBtn title="Delete notice" onClick={() => handleDeleteNotice(n.id)}><IcTrash /></IconBtn>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
