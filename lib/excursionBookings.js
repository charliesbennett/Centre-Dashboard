import { uid } from "@/lib/constants";

export const emptyBooking = (date) => ({
  id: uid(), date, groupIds: [], attraction: "", dayPart: "Full",
  transportMethod: "Coach", manualStudentCount: 0, manualLeaderCount: 0, staffCount: 0,
  bookingRef: "", emailContact: "", bookingLink: "", notes: "", coaches: [],
});

// Headcounts for a booking: derived from linked groups, or manual counts if none linked
export function bookingCounts(booking, groups) {
  const linked = (groups || []).filter((g) => (booking.groupIds || []).includes(g.id));
  const stu = linked.length > 0 ? linked.reduce((s, g) => s + (g.stu || 0), 0) : (booking.manualStudentCount || 0);
  const gl = linked.length > 0 ? linked.reduce((s, g) => s + (g.gl || 0), 0) : (booking.manualLeaderCount || 0);
  const staff = booking.staffCount || 0;
  return { stu, gl, staff, total: stu + gl + staff, linked };
}

// Merge freshly-scanned bookings (from Auto from Programme) into the existing list.
// Matches against attractions already on record (case/whitespace-insensitive), ignoring
// day part — existing entries may predate day-part tracking or use different casing than
// a fresh scan, so an exact-string match would miss them and create a duplicate booking
// instead of linking groups into the one that already exists.
export function mergeBookingUpserts(existing, bookingUpserts) {
  const groupMerges = {};
  const additions = [];
  bookingUpserts.forEach(({ date, attraction, dayPart, groupIds }) => {
    const norm = attraction.trim().toLowerCase();
    const match = existing.find((e) => e.date === date && (e.attraction || "").trim().toLowerCase() === norm);
    if (match) {
      if (!groupMerges[match.id]) groupMerges[match.id] = new Set(match.groupIds || []);
      groupIds.forEach((gid) => groupMerges[match.id].add(gid));
    } else {
      additions.push({ ...emptyBooking(date), attraction, dayPart, groupIds });
    }
  });
  const updated = existing.map((e) => groupMerges[e.id] ? { ...e, groupIds: [...groupMerges[e.id]] } : e);
  return [...updated, ...additions];
}
