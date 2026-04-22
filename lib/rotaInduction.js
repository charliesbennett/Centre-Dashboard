// Per-centre induction dates. QMU runs two cohorts back-to-back, so staff get
// the first induction on/after their arrival (else the last one).
// Centre names here are matched case-insensitively as substrings against the
// selected centreName — so "QMU Summer Centre 1" still matches "QMU".

const INDUCTION_DATES = {
  "QMU": ["2026-06-12", "2026-06-27"],
  "Crewe": ["2026-06-28"],
  "Reaseheath": ["2026-06-30"],
  "Queen Anne": ["2026-07-04"],
  "Bootham": ["2026-07-03"],
  "Queenswood": ["2026-07-04"],
  "Manchester": ["2026-07-04"],
  "KCL": ["2026-07-05"],
  "Wycombe": ["2026-07-03"],
  "Clifton": ["2026-07-05"],
  "Dean Close": ["2026-07-05"],
  "Kingston": ["2026-07-06"],
  "Swithun": ["2026-07-10"],
};

function matchCentre(centreName) {
  if (!centreName) return null;
  const n = centreName.toLowerCase();
  for (const key of Object.keys(INDUCTION_DATES)) {
    if (n.includes(key.toLowerCase())) return key;
  }
  return null;
}

export function getInductionDate(centreName, staffArrivalDate) {
  const key = matchCentre(centreName);
  if (!key) return null;
  const candidates = INDUCTION_DATES[key];
  if (!staffArrivalDate) return candidates[0];
  return candidates.find((d) => d >= staffArrivalDate) || candidates[candidates.length - 1];
}

export function getAllInductionDates(centreName) {
  const key = matchCentre(centreName);
  return key ? [...INDUCTION_DATES[key]] : [];
}
