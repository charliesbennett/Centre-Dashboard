import { describe, it, expect } from "vitest";
import { mergeBookingUpserts } from "@/lib/excursionBookings";

describe("mergeBookingUpserts", () => {
  it("merges group links into an existing booking with different casing and no day part", () => {
    const existing = [
      { id: "b1", date: "2026-07-05", attraction: "Manchester with Manchester City Etihad Football Stadium", dayPart: "Full", groupIds: [] },
    ];
    const upserts = [
      { date: "2026-07-05", attraction: "MANCHESTER WITH MANCHESTER CITY ETIHAD FOOTBALL STADIUM", dayPart: "AM Half", groupIds: ["g1", "g2"] },
    ];
    const result = mergeBookingUpserts(existing, upserts);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b1");
    expect(result[0].groupIds).toEqual(["g1", "g2"]);
    expect(result[0].dayPart).toBe("Full");
  });

  it("does not create a duplicate when day part differs from the existing entry", () => {
    const existing = [
      { id: "b1", date: "2026-07-08", attraction: "Chester with Roman Tour", dayPart: "Full", groupIds: ["g1"] },
    ];
    const upserts = [
      { date: "2026-07-08", attraction: "Chester with Roman Tour", dayPart: "AM Half", groupIds: ["g2"] },
      { date: "2026-07-08", attraction: "Chester with Roman Tour", dayPart: "PM Half", groupIds: ["g3"] },
    ];
    const result = mergeBookingUpserts(existing, upserts);
    expect(result).toHaveLength(1);
    expect(result[0].groupIds.sort()).toEqual(["g1", "g2", "g3"]);
  });

  it("creates a new booking when no attraction match exists on that date", () => {
    const existing = [
      { id: "b1", date: "2026-07-05", attraction: "Oxford", dayPart: "Full", groupIds: [] },
    ];
    const upserts = [
      { date: "2026-07-05", attraction: "Alton Towers", dayPart: "Full", groupIds: ["g1"] },
    ];
    const result = mergeBookingUpserts(existing, upserts);
    expect(result).toHaveLength(2);
    expect(result.find((b) => b.attraction === "Alton Towers").groupIds).toEqual(["g1"]);
  });

  it("keeps distinct AM/PM bookings separate when neither matches an existing entry", () => {
    const upserts = [
      { date: "2026-07-08", attraction: "Chester with Roman Tour", dayPart: "AM Half", groupIds: ["g1"] },
      { date: "2026-07-08", attraction: "Chester with Roman Tour", dayPart: "PM Half", groupIds: ["g2"] },
    ];
    const result = mergeBookingUpserts([], upserts);
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.dayPart).sort()).toEqual(["AM Half", "PM Half"]);
  });
});
