/**
 * getFortnights(progStart, progEnd)
 * Returns an array of 14-day blocks covering progStart to progEnd.
 * Each block: { label: "Week N–M", start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 * The final block is clamped to progEnd.
 */
export function getFortnights(progStart, progEnd) {
  if (!progStart || !progEnd) return [];
  const end = new Date(progEnd);
  const fortnights = [];
  let current = new Date(progStart);
  let weekNum = 1;

  while (current <= end) {
    const fnStart = new Date(current);
    const fnEnd = new Date(current);
    fnEnd.setDate(fnEnd.getDate() + 13); // 14 days inclusive
    if (fnEnd > end) fnEnd.setTime(end.getTime()); // clamp to progEnd

    fortnights.push({
      label: `Week ${weekNum}–${weekNum + 1}`,
      start: fnStart.toISOString().split("T")[0],
      end: fnEnd.toISOString().split("T")[0],
    });

    current.setDate(current.getDate() + 14);
    weekNum += 2;
  }

  return fortnights;
}

/**
 * getTodayFortnight(fortnights, today)
 * Returns the index of the fortnight containing today (YYYY-MM-DD string).
 * Returns 0 if today is outside all fortnights.
 */
export function getTodayFortnight(fortnights, today) {
  const idx = fortnights.findIndex((fn) => today >= fn.start && today <= fn.end);
  return idx >= 0 ? idx : 0;
}
