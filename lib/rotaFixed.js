// Pre-programme fixed-cell builder. Pure — no React, safe to unit test.
// Produces Induction / Setup / Airport / Day-Off entries for each staff member.

import { dayKey, inRange } from "./constants";
import { getAllInductionDates } from "./rotaInduction";

const SLOTS = ["AM", "PM", "Eve"];

export function onSiteDateStrs(s, allDateStrs) {
  const depDs = s.dep ? String(s.dep).slice(0, 10) : null;
  const arrDs = s.arr ? String(s.arr).slice(0, 10) : null;
  return allDateStrs.filter((ds) => inRange(ds, arrDs, s.dep) && ds !== depDs);
}

export function applyFixedForStaff(fixed, s, allDateStrs, groupArrivalDate, tos, isFullDayOff, inductionDates) {
  const arrDs = s.arr ? String(s.arr).slice(0, 10) : null;
  const onSite = onSiteDateStrs(s, allDateStrs);

  // True late joiners arrive after the programme has started. For them, fall back to
  // their first on-site day as an informal induction. Staff who arrive after the
  // induction date but before the programme starts just go straight into Setup.
  const isLateJoiner = !!(groupArrivalDate && arrDs && arrDs > groupArrivalDate);

  // Induction dates this staff member can attend (on or after arrival).
  const attendable = (inductionDates || []).filter((ds) => !arrDs || ds >= arrDs);
  const inRange_ = attendable.filter((ds) => allDateStrs.includes(ds));

  let inductSet;
  if (inRange_.length > 0) {
    inductSet = new Set(inRange_);
  } else if ((inductionDates || []).length === 0 || isLateJoiner) {
    inductSet = new Set(onSite[0] ? [onSite[0]] : []);
  } else {
    // Staff arrives after induction dates but is not a late joiner (before/on group arrival).
    // They attend induction pre-contract — show Induction on any configured dates in this fortnight.
    const preContract = (inductionDates || []).filter((ds) => allDateStrs.includes(ds));
    inductSet = new Set(preContract);
  }

  inductSet.forEach((ds) => {
    fixed[`${s.id}-${ds}-AM`] = "Induction";
    fixed[`${s.id}-${ds}-PM`] = "Induction";
  });

  const SPECIALIST_ROLES = new Set(["PA", "FOOTBALL", "Drama", "DRAMA"]);
  if (!SPECIALIST_ROLES.has(s.role)) {
    // Setup range starts after the LAST CONFIGURED induction date (or fallback if unknown centre).
    const lastConfiguredInductDs = (inductionDates || []).length > 0
      ? inductionDates[inductionDates.length - 1]
      : null;
    const lastInductDs = lastConfiguredInductDs || ([...inductSet].sort().pop() || null);

    // Setup for pre-contract days between last induction and contracted arrival.
    allDateStrs.forEach((ds) => {
      if (!lastInductDs || ds <= lastInductDs) return;
      if (!arrDs || ds >= arrDs) return;
      fixed[`${s.id}-${ds}-AM`] = "Setup";
      fixed[`${s.id}-${ds}-PM`] = "Setup";
    });

    // Setup for contracted days from arrival up to group arrival.
    onSite.forEach((ds) => {
      if (inductSet.has(ds)) return;
      if (groupArrivalDate && ds >= groupArrivalDate) return;
      if (!fixed[`${s.id}-${ds}-AM`]) fixed[`${s.id}-${ds}-AM`] = "Setup";
      if (!fixed[`${s.id}-${ds}-PM`]) fixed[`${s.id}-${ds}-PM`] = "Setup";
    });
  }

  // Airport on departure day.
  if (s.dep) {
    const depDs = String(s.dep).slice(0, 10);
    if (!fixed[`${s.id}-${depDs}-AM`]) fixed[`${s.id}-${depDs}-AM`] = "Airport";
  }

  // Time-off: full-day overrides.
  onSite.forEach((ds) => {
    if (isFullDayOff(tos, ds)) SLOTS.forEach((sl) => { fixed[`${s.id}-${ds}-${sl}`] = "Day Off"; });
  });
}

// parseTimeOff: converts "DD/MM - DD/MM, DD/MM am, ..." to structured list.
export function parseTimeOff(toStr, progYear) {
  if (!toStr || !progYear) return [];
  return toStr.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
    const rm = p.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
    if (rm) return {
      start: `${progYear}-${rm[2].padStart(2, "0")}-${rm[1].padStart(2, "0")}`,
      end:   `${progYear}-${rm[4].padStart(2, "0")}-${rm[3].padStart(2, "0")}`,
    };
    const sm = p.match(/(\d{1,2})\/(\d{1,2})\s*(am|pm|eve)?/i);
    if (sm) return {
      date: `${progYear}-${sm[2].padStart(2, "0")}-${sm[1].padStart(2, "0")}`,
      slot: sm[3] || null,
    };
    return null;
  }).filter(Boolean);
}

export function isFullDayOff(tos, ds) {
  for (const to of tos) {
    if (to.start && to.end && ds >= to.start && ds <= to.end) return true;
    if (to.date === ds && !to.slot) return true;
  }
  return false;
}

export function buildFixedGrid(staff, allDateStrs, groupArrivalDate, progYear, centreName) {
  const fixed = {};
  const inductionDates = getAllInductionDates(centreName);
  staff.forEach((s) => {
    const tos = parseTimeOff(s.to, progYear);
    applyFixedForStaff(fixed, s, allDateStrs, groupArrivalDate, tos, isFullDayOff, inductionDates);
  });
  return fixed;
}
