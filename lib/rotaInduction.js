// Per-centre induction dates. QMU runs two cohorts back-to-back, so staff get
// the first induction on/after their arrival (else the last one).
// Each entry has a `dates` list and an `aliases` list — any alias match wins.

const CENTRES = [
  { aliases: ["qmu", "queen margaret"], dates: ["2026-06-12", "2026-06-27"] },
  { aliases: ["crewe"], dates: ["2026-06-28"] },
  { aliases: ["reaseheath"], dates: ["2026-06-30"] },
  { aliases: ["queen anne"], dates: ["2026-07-04"] },
  { aliases: ["bootham"], dates: ["2026-07-03"] },
  { aliases: ["queenswood"], dates: ["2026-07-04"] },
  { aliases: ["manchester"], dates: ["2026-07-04"] },
  { aliases: ["kcl", "king's college", "kings college"], dates: ["2026-07-05"] },
  { aliases: ["wycombe"], dates: ["2026-07-03"] },
  { aliases: ["clifton"], dates: ["2026-07-05"] },
  { aliases: ["dean close"], dates: ["2026-07-05"] },
  { aliases: ["kingston"], dates: ["2026-07-06"] },
  { aliases: ["swithun"], dates: ["2026-07-10"] },
];

function matchCentre(centreName) {
  if (!centreName) return null;
  const n = centreName.toLowerCase();
  return CENTRES.find((c) => c.aliases.some((a) => n.includes(a))) || null;
}

export function getInductionDate(centreName, staffArrivalDate) {
  const centre = matchCentre(centreName);
  if (!centre) return null;
  const { dates } = centre;
  if (!staffArrivalDate) return dates[0];
  const arrDs = String(staffArrivalDate).slice(0, 10);
  return dates.find((d) => d >= arrDs) || null;
}

export function getAllInductionDates(centreName) {
  const centre = matchCentre(centreName);
  return centre ? [...centre.dates] : [];
}

export function getMatchedCentreName(centreName) {
  const centre = matchCentre(centreName);
  return centre ? centre.aliases[0] : null;
}
