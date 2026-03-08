"use client";
import { useMemo } from "react";
import { B, dayKey, dayName, fmtDate, ACTIVITY_TYPES, SESSION_TYPES, ROLES } from "@/lib/constants";
import { StatCard, IcPlaneUp, IcPlaneDn, IcCake, IcBus, IcMountain, IcSparkles } from "@/components/ui";

// ── Helpers ────────────────────────────────────────────────
function inBed(dateStr, arrDate, depDate) {
  if (!arrDate || !depDate) return false;
  return new Date(dateStr) >= new Date(arrDate) && new Date(dateStr) < new Date(depDate);
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
  if (!value) return <span style={{ color: B.textLight, fontSize: 9 }}>—</span>;
  const color = ACTIVITY_TYPES[value] || SESSION_TYPES[value] || B.textMuted;
  return (
    <span style={{ background: color + "18", color, padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
      {value}
    </span>
  );
}

// ──────────────────────────────────────────────────────────
export default function HomeTab({ groups = [], staff = [], excDays = {}, progGrid = {}, rotaGrid = {}, progStart, progEnd }) {
  const today = useMemo(() => dayKey(new Date()), []);
  const todayDate = useMemo(() => new Date(today), [today]);
  const activeGroups = useMemo(() => groups.filter((g) => !g.archived), [groups]);

  // ── On-site numbers ────────────────────────────────────
  const onSiteGroups = useMemo(() =>
    activeGroups.filter((g) => inBed(today, g.arr, g.dep)), [activeGroups, today]);

  const onSiteStudents = useMemo(() =>
    onSiteGroups.reduce((s, g) => s + (g.stu || 0), 0), [onSiteGroups]);

  const onSiteGLs = useMemo(() =>
    onSiteGroups.reduce((s, g) => s + (g.gl || 0), 0), [onSiteGroups]);

  const onSiteStaff = useMemo(() =>
    staff.filter((s) => inBed(today, s.arr, s.dep)), [staff, today]);

  const totalOnSite = onSiteStudents + onSiteGLs + onSiteStaff.length;

  // ── Arrivals & departures ──────────────────────────────
  const arrivingToday = useMemo(() =>
    activeGroups.filter((g) => g.arr === today), [activeGroups, today]);

  const departingToday = useMemo(() =>
    activeGroups.filter((g) => g.dep === today), [activeGroups, today]);

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

  // ── Quote of the day ───────────────────────────────────
  const dayOfYear = Math.floor((todayDate - new Date(todayDate.getFullYear(), 0, 0)) / 86400000);
  const quote = QUOTES[dayOfYear % QUOTES.length];

  const todayStr = todayDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ── Render ─────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ── Hero banner ──────────────────────────────────── */}
      <div style={{ background: B.navy, padding: "20px 24px 18px", position: "relative", overflow: "hidden" }}>
        {/* Subtle brand graphic */}
        <svg aria-hidden="true" style={{ position: "absolute", right: 0, top: 0, opacity: 0.05, pointerEvents: "none" }} width="260" height="90" viewBox="0 0 260 90">
          <rect x="100" y="0" width="60" height="90" fill="white" />
          <rect x="0" y="30" width="260" height="30" fill="white" />
          <path d="M0 0L65 90M195 0L260 90M260 0L195 90M65 0L0 90" stroke="white" strokeWidth="22" />
        </svg>
        {/* Yellow accent line at bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: B.yellow, opacity: 0.6 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <div>
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

      {/* ── Stat row ─────────────────────────────────────── */}
      <div style={{ padding: "12px 20px 4px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatCard label="On-Site Today" value={totalOnSite} accent={B.navy} />
        <StatCard label="Students" value={onSiteStudents} accent={B.red} />
        <StatCard label="Group Leaders" value={onSiteGLs} accent="#7c3aed" />
        <StatCard label="UKLC Staff" value={onSiteStaff.length} accent="#0891b2" />
        {arrivingToday.length > 0 && (
          <StatCard label="Arriving" value={arrivingToday.length + (arrivingToday.length === 1 ? " group" : " groups")} accent={B.success} />
        )}
        {departingToday.length > 0 && (
          <StatCard label="Departing" value={departingToday.length + (departingToday.length === 1 ? " group" : " groups")} accent={B.warning} />
        )}
        {excToday && (
          <div style={{ marginLeft: 4, background: excToday === "Full" ? "#fff7ed" : B.yellow + "30", border: "2px solid " + (excToday === "Full" ? "#fb923c" : B.yellow), borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: excToday === "Full" ? "#ea580c" : "#92400e" }}>{excToday === "Full" ? <IcBus /> : <IcMountain />}</span>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: excToday === "Full" ? "#c2410c" : "#92400e", textTransform: "uppercase", letterSpacing: 0.5 }}>Excursion Today</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: excToday === "Full" ? "#ea580c" : "#d97706" }}>
                {excToday === "Full" ? "Full Day" : "Half Day"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main 3-column grid ────────────────────────────── */}
      <div style={{ padding: "8px 12px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>

        {/* ── TODAY'S PROGRAMME ────────────────────────── */}
        <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", background: B.navy, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 10px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 11, color: B.white }}>Today&rsquo;s Programme</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
              {dayName(todayDate)}, {todayDate.getDate()}/{todayDate.getMonth() + 1}
            </span>
          </div>

          {excToday && (
            <div style={{ padding: "6px 14px", background: excToday === "Full" ? "#fff7ed" : B.yellow + "25", borderBottom: "1px solid " + B.borderLight, fontSize: 10, fontWeight: 800, color: excToday === "Full" ? "#ea580c" : "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
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
                  <span style={{ fontWeight: 700, fontSize: 10, color: B.navy }}>{g.group}</span>
                  <span style={{ fontSize: 8, color: B.textLight, background: "#f1f5f9", padding: "1px 5px", borderRadius: 3 }}>
                    {(g.stu || 0) + (g.gl || 0)} pax
                  </span>
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
          <div style={{ borderTop: "1px solid " + B.border, padding: "7px 14px", background: "#f8fafc", display: "flex", alignItems: "center", gap: 6 }}>
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
          <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden", flex: "0 0 auto" }}>
            <div style={{ padding: "8px 14px", background: "#0f766e", backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 11, color: B.white }}>Arrivals &amp; Departures</span>
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
                        <div style={{ fontWeight: 700, fontSize: 10, color: B.navy }}>{g.group}</div>
                        <div style={{ fontSize: 9, color: B.success, fontWeight: 600 }}>Arriving — {(g.stu || 0) + (g.gl || 0)} pax</div>
                        {g.arrFlight && <div style={{ fontSize: 8, color: B.textMuted }}>{g.arrAirport} · {g.arrFlight}{g.arrTime ? " at " + g.arrTime : ""}</div>}
                      </div>
                    </div>
                  ))}
                  {departingToday.map((g) => (
                    <div key={g.id} style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid " + B.borderLight }}>
                      <span style={{ color: B.warning }}><IcPlaneDn /></span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 10, color: B.navy }}>{g.group}</div>
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
          <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden", flex: 1 }}>
            <div style={{ padding: "8px 14px", background: "#1e40af", backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: 11, color: B.white }}>Staff on Duty</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>{onSiteStaff.length}</span>
            </div>
            <div style={{ padding: "8px 14px" }}>
              {onSiteStaff.length === 0 ? (
                <div style={{ fontSize: 10, color: B.textLight, textAlign: "center", padding: "10px 0" }}>No staff on-site today</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {[...onSiteStaff]
                    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
                    .map((s) => (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 5, padding: "3px 7px" }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: "#0369a1" }}>{s.role}</span>
                        <span style={{ fontSize: 9, color: B.navy, fontWeight: 600 }}>{s.name.split(" ")[0]}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BIRTHDAYS ─────────────────────────────────── */}
        <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", background: "#be185d", backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 11, color: B.white, display: "flex", alignItems: "center", gap: 6 }}><IcCake /> Upcoming Birthdays</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>Next 14 days</span>
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
                        <span style={{ fontWeight: 700, fontSize: 10, color: B.navy }}>{b.name}</span>
                        {b.age && <span style={{ fontSize: 8, color: B.textMuted }}>turns {b.age}</span>}
                        {b.isGL && <span style={{ fontSize: 8, color: "#7c3aed", fontWeight: 700 }}>GL</span>}
                      </div>
                      <div style={{ fontSize: 8, color: b.color, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.group}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {isToday ? (
                        <span style={{ background: "#fce7f3", color: "#be185d", padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}><IcSparkles /> Today!</span>
                      ) : isTomorrow ? (
                        <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>Tomorrow</span>
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
      {onSiteGroups.length > 0 && (
        <div style={{ padding: "10px 12px 0" }}>
          <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "6px 14px", background: "#f8fafc", borderBottom: "1px solid " + B.border, fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Groups On-Site Tonight &mdash; {onSiteGroups.length} group{onSiteGroups.length !== 1 ? "s" : ""} &middot; {onSiteStudents} students &middot; {onSiteGLs} GLs
            </div>
            <div style={{ padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {onSiteGroups.map((g, i) => (
                <div key={g.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: GROUP_COLORS[i % GROUP_COLORS.length] + "12",
                  border: "1px solid " + GROUP_COLORS[i % GROUP_COLORS.length] + "40",
                  borderRadius: 6, padding: "5px 10px",
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                  <span style={{ fontWeight: 700, fontSize: 10, color: B.navy }}>{g.group}</span>
                  <span style={{ fontSize: 9, color: B.textMuted }}>{(g.stu || 0) + (g.gl || 0)} pax</span>
                  <span style={{ fontSize: 8, color: B.textLight, background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>{g.nat}</span>
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
          <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "6px 14px", background: "#f8fafc", borderBottom: "1px solid " + B.border, fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Coming Up — Next 7 Days
            </div>
            <div style={{ display: "flex", overflowX: "auto", padding: "8px 10px", gap: 8 }}>
              {next7Days.map(({ date, d, arrivals, departures, excursion, bdays }) => (
                <div key={date} style={{
                  flexShrink: 0, width: 160, background: "#f8fafc", border: "1px solid " + B.border,
                  borderRadius: 8, padding: "8px 10px", fontSize: 10,
                }}>
                  <div style={{ fontWeight: 800, color: B.navy, marginBottom: 6 }}>
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

    </div>
  );
}
