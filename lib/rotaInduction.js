// Per-centre induction dates (Sports & Academic + Company Induction days).
// Source: Summer 2026 Centre Induction Plan Excel, verified April 2026.
// QMU runs two cohorts back-to-back; all staff get the first induction on/after arrival.

const CENTRES = [
  { aliases: ["qmu", "queen margaret"], dates: ["2026-06-12", "2026-06-27"] },
  { aliases: ["portsmouth"], dates: ["2026-06-28", "2026-06-29"] },
  { aliases: ["crewe"], dates: ["2026-06-28", "2026-06-29"] },
  { aliases: ["reaseheath"], dates: ["2026-06-30", "2026-07-01"] },
  { aliases: ["bootham"], dates: ["2026-07-03", "2026-07-04"] },
  { aliases: ["wycombe"], dates: ["2026-07-03"] },
  { aliases: ["queen anne"], dates: ["2026-07-04"] },
  { aliases: ["queenswood"], dates: ["2026-07-04"] },
  { aliases: ["manchester"], dates: ["2026-07-04"] },
  { aliases: ["kcl", "king's college", "kings college"], dates: ["2026-07-05"] },
  { aliases: ["clifton"], dates: ["2026-07-05", "2026-07-06"] },
  { aliases: ["dean close"], dates: ["2026-07-03", "2026-07-04"] },
  { aliases: ["kingston"], dates: ["2026-07-06", "2026-07-07"] },
  { aliases: ["swithun"], dates: ["2026-07-10", "2026-07-11"] },
];

function matchCentre(centreName) {
  if (!centreName) return null;
  const n = centreName.toLowerCase();
  return CENTRES.find((c) => c.aliases.some((a) => n.includes(a))) || null;
}

export function getInductionDate(centreName, staffArrivalDate, groupArrivalDate) {
  const centre = matchCentre(centreName);
  if (!centre) return null;
  const { dates } = centre;
  if (!staffArrivalDate) return dates[0];
  const arrDs = String(staffArrivalDate).slice(0, 10);
  const groupDs = groupArrivalDate ? String(groupArrivalDate).slice(0, 10) : null;
  if (groupDs && arrDs > groupDs) return null;
  return dates.find((d) => d >= arrDs) || dates[dates.length - 1];
}

export function getAllInductionDates(centreName) {
  const centre = matchCentre(centreName);
  return centre ? [...centre.dates] : [];
}

export function getMatchedCentreName(centreName) {
  const centre = matchCentre(centreName);
  return centre ? centre.aliases[0] : null;
}
