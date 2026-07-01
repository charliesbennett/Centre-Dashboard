import { describe, it, expect } from "vitest";
import { findMatchingBookings, coachRowToCoach } from "@/lib/parseExcursionsExcel";

describe("findMatchingBookings", () => {
  it("matches a single booking by date + attraction, case-insensitive", () => {
    const bookings = [{ id: "b1", date: "2026-07-05", attraction: "Manchester with Manchester City Etihad Stadium Tour", dayPart: "Full" }];
    const coachRow = { date: "2026-07-05", attraction: "MANCHESTER WITH MANCHESTER CITY ETIHAD STADIUM TOUR", dayPart: "Full" };
    expect(findMatchingBookings(coachRow, bookings)).toEqual([bookings[0]]);
  });

  it("prefers the day-part match when a date+attraction has an AM/PM split", () => {
    const bookings = [
      { id: "am", date: "2026-07-08", attraction: "Chester with Roman Tour", dayPart: "AM Half" },
      { id: "pm", date: "2026-07-08", attraction: "Chester with Roman Tour", dayPart: "PM Half" },
    ];
    const coachRow = { date: "2026-07-08", attraction: "Chester with Roman Tour", dayPart: "PM Half" };
    expect(findMatchingBookings(coachRow, bookings)).toEqual([bookings[1]]);
  });

  it("returns no matches for a different date or attraction", () => {
    const bookings = [{ id: "b1", date: "2026-07-05", attraction: "Oxford", dayPart: "Full" }];
    expect(findMatchingBookings({ date: "2026-07-06", attraction: "Oxford", dayPart: "Full" }, bookings)).toEqual([]);
    expect(findMatchingBookings({ date: "2026-07-05", attraction: "Bristol", dayPart: "Full" }, bookings)).toEqual([]);
  });
});

describe("coachRowToCoach", () => {
  it("maps a coach sheet row onto the booking's coach shape", () => {
    const row = { transportMethod: "Coach", bookingRef: "Booked for 10:30", notes: "Straffords, 248 PAX" };
    const coach = coachRowToCoach(row);
    expect(coach.vehicle).toBe("Coach");
    expect(coach.bookingRef).toBe("Booked for 10:30");
    expect(coach.notes).toBe("Straffords, 248 PAX");
    expect(coach.status).toBe("Pending");
    expect(coach.id).toBeTruthy();
  });
});
