// UKLC Brand Colors
export const B = {
  navy: "#1c3048", red: "#ec273b", white: "#ffffff", yellow: "#f0f279",
  pink: "#fad7d8", ice: "#e6eef3",
  bg: "#f4f7fa", card: "#ffffff", border: "#dce4ec", borderLight: "#e8eef4",
  text: "#1c3048", textMuted: "#5c7084", textLight: "#8a9bb0",
  success: "#16a34a", successBg: "#dcfce7", warning: "#d97706", warningBg: "#fef3c7",
  danger: "#dc2626", dangerBg: "#fee2e2",
};

export const CENTRES = [
  "Bristol \u2014 Clifton College", "Cheltenham \u2014 Dean Close School", "Crewe \u2014 Cheshire Campus",
  "Hatfield \u2014 Queenswood School", "London \u2014 King's College", "London \u2014 Queen Mary University",
  "London \u2014 Kingston University", "Manchester \u2014 Chetham's School", "Nantwich \u2014 Reaseheath College",
  "Portsmouth \u2014 University of Portsmouth", "Reading \u2014 Queen Anne's School",
  "Winchester \u2014 St Swithun's School", "Wycombe Abbey", "York \u2014 Bootham School",
];

export const LONDON_CENTRES = [
  "London \u2014 King's College", "London \u2014 Queen Mary University", "London \u2014 Kingston University",
];

export const TABS = [
  { id: "students", label: "Students", icon: "\ud83d\udc68\u200d\ud83c\udf93" },
  { id: "rota", label: "Rota", icon: "\ud83d\udcc5" },
  { id: "programmes", label: "Programmes", icon: "\ud83d\udccb" },
  { id: "catering", label: "Catering", icon: "\ud83c\udf7d\ufe0f" },
  { id: "transfers", label: "Transfers", icon: "\u2708\ufe0f" },
  { id: "team", label: "Team", icon: "\ud83d\udc65" },
  { id: "excursions", label: "Excursions", icon: "\ud83c\udfaf" },
  { id: "pettycash", label: "Petty Cash", icon: "\ud83d\udcb7" },
  { id: "contacts", label: "Contacts", icon: "\ud83d\udcde" },
];

export const MEALS = ["Breakfast", "Packed Bkfst", "Lunch", "Packed Lunch", "Dinner", "Packed Dinner"];

export const MEAL_COLORS = {
  Breakfast: "#b45309", "Packed Bkfst": "#92400e",
  Lunch: "#15803d", "Packed Lunch": "#166534",
  Dinner: "#1e40af", "Packed Dinner": "#1e3a8a",
};

export const PROGRAMMES = [
  "Multi-Activity", "Intensive English", "Performing Arts",
  "Football", "Dance", "Drama", "Leadership",
];

export const ROLES = ["CM", "CD", "EAM", "SWC", "TAL", "FTT", "SC", "EAC", "SAI", "EAL", "DRAMA", "DANCE"];

export const SESSION_TYPES = {
  Lessons: "#3b82f6", Activities: "#8b5cf6", "English+": "#0891b2",
  Excursion: "#ea580c", "Half Exc": "#f97316", "Eve Ents": "#7c3aed",
  Airport: "#be185d", Floating: "#64748b", "Lesson Prep": "#0e7490",
  Reports: "#475569", Induction: "#0d9488", Setup: "#0891b2",
};

export const ACTIVITY_TYPES = {
  Lessons: "#3b82f6", "Multi-Act": "#8b5cf6", "English+": "#0891b2",
  "Full Exc": "#ea580c", "Half Exc": "#f59e0b", Arrival: "#16a34a",
  Departure: "#dc2626", "Perf Arts": "#db2777", Football: "#15803d",
  Dance: "#ec4899", Drama: "#9333ea", "Free-time": "#64748b",
};

// Utilities
export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtDate = (d) => {
  if (!d) return "\u2014";
  const dt = new Date(d);
  return isNaN(dt) ? "\u2014" : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

export const fmtMoney = (v) => `\u00a3${(v || 0).toFixed(2)}`;

export const dayKey = (d) => d.toISOString().split("T")[0];

const DAY_NAMES = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
export const dayName = (d) => DAY_NAMES[d.getDay()];

export const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

export const genDates = (start, end) => {
  const dates = [];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }
  return dates;
};

export const inRange = (dateStr, arrDate, depDate) => {
  if (!arrDate || !depDate) return false;
  const dt = new Date(dateStr);
  const a = new Date(arrDate);
  const b = new Date(depDate);
  return dt >= a && dt <= b;
};
