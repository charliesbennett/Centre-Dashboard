// Binds each TAL to a primary group so they teach the same class every
// teaching day. Need-weighted round-robin: groups with more students
// claim more TALs. Pure — no side effects.

import { STUDENTS_PER_TEACHER } from "./rotaDemand";

function teacherNeed(g) {
  const pax = (g.stu || 0) + (g.gl || 0);
  return Math.max(1, Math.ceil(pax / STUDENTS_PER_TEACHER));
}

function stableGroupOrder(groups) {
  return [...groups].sort((a, b) => {
    if (a.arr !== b.arr) return String(a.arr).localeCompare(String(b.arr));
    return String(a.id).localeCompare(String(b.id));
  });
}

function pickNeediestGroup(gs, needs, groupTals) {
  let best = gs[0].id;
  let bestGap = needs[best] - groupTals[best].length;
  for (let i = 1; i < gs.length; i++) {
    const gap = needs[gs[i].id] - groupTals[gs[i].id].length;
    if (gap > bestGap) { best = gs[i].id; bestGap = gap; }
  }
  return best;
}

export function bindTals({ staff, groups }) {
  const tals = (staff || []).filter((s) => s.role === "TAL");
  const gs = stableGroupOrder((groups || []).filter((g) => g.stu || g.gl));
  const talGroup = {};
  const groupTals = {};
  gs.forEach((g) => { groupTals[g.id] = []; });
  if (!tals.length || !gs.length) return { talGroup, groupTals };

  const needs = {};
  gs.forEach((g) => { needs[g.id] = teacherNeed(g); });
  tals.forEach((t) => {
    const gid = pickNeediestGroup(gs, needs, groupTals);
    talGroup[t.id] = gid;
    groupTals[gid].push(t.id);
  });
  return { talGroup, groupTals };
}
