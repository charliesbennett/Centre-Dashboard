"use client";
import { useState, useRef, useEffect } from "react";
import { useB } from "@/lib/theme";
import { uid, inRange } from "@/lib/constants";
import { parseExcursionsExcel, findMatchingBookings, coachRowToCoach } from "@/lib/parseExcursionsExcel";

const OS = "'Open Sans', sans-serif";
const RW = "'Raleway', sans-serif";

export default function ExcursionsImportModal({ groups = [], centreName = "", existingBookings = [], onClose, onImported }) {
  const B = useB();
  const fileRef = useRef(null);
  const [stage, setStage] = useState("upload"); // upload | preview
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null); // { bookings, unmatchedCoachRows }
  const [overrides, setOverrides] = useState({}); // bookingRowIndex -> groupIds[]
  const [coachTargets, setCoachTargets] = useState({}); // coachRowIndex -> existing booking id ("" = skip)
  const [fileName, setFileName] = useState(null);

  // Pre-fill group links from the parser's fuzzy match; user can correct.
  // Pre-fill coach-row targets from a date+attraction match against bookings already on record.
  useEffect(() => {
    if (!parsed) return;
    const init = {};
    (parsed.bookings || []).forEach((b, i) => { init[i] = b.groupIds || []; });
    setOverrides(init);

    const targets = {};
    (parsed.unmatchedCoachRows || []).forEach((row, i) => {
      const matches = findMatchingBookings(row, existingBookings);
      targets[i] = matches[0]?.id || "";
    });
    setCoachTargets(targets);
  }, [parsed]);

  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const card = { background: B.card, borderRadius: 14, width: "100%", maxWidth: 820, maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" };
  const header = { background: B.navy, padding: "16px 20px", borderRadius: "14px 14px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" };
  const btnBase = { padding: "7px 16px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "none" };

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true); setError(null);
    setFileName(file.name);
    try {
      const result = await parseExcursionsExcel(file, { groups, centreName });
      if (!result.ok) { setError(result.error); setLoading(false); return; }
      setParsed(result);
      setStage("preview");
    } catch (e) {
      setError("Failed to read file: " + e.message);
    }
    setLoading(false);
  };

  const toggleGroup = (rowIdx, groupId) => {
    setOverrides((p) => {
      const cur = p[rowIdx] || [];
      const next = cur.includes(groupId) ? cur.filter((g) => g !== groupId) : [...cur, groupId];
      return { ...p, [rowIdx]: next };
    });
  };

  const handleConfirm = () => {
    const bookings = (parsed.bookings || []).map((b, i) => ({
      id: uid(),
      date: b.date,
      groupIds: overrides[i] || [],
      attraction: b.attraction,
      dayPart: b.dayPart,
      transportMethod: b.transportMethod,
      manualStudentCount: b.studentNo || 0,
      manualLeaderCount: b.leaderNo || 0,
      staffCount: b.staffCount || 0,
      bookingRef: b.bookingRef,
      emailContact: b.emailContact,
      bookingLink: b.bookingLink,
      notes: b.notes,
      coaches: b.coaches || [],
    }));

    const coachAttachments = (parsed.unmatchedCoachRows || [])
      .map((row, i) => ({ bookingId: coachTargets[i], coach: coachRowToCoach(row) }))
      .filter((a) => a.bookingId);

    onImported({ bookings, coachAttachments });
  };

  const coachRows = parsed?.unmatchedCoachRows || [];
  const bookingsWithCoaches = (parsed?.bookings || []).filter((b) => (b.coaches || []).length > 0).length;
  const attachableCount = Object.values(coachTargets).filter(Boolean).length;
  const totalToImport = (parsed?.bookings?.length || 0) + attachableCount;

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <div style={header}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: RW, color: "#fff" }}>Import Excursion Bookings</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontFamily: OS, marginTop: 2 }}>Upload a bookings and/or coaches spreadsheet to populate this centre's Excursions tab</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {error && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 6, fontSize: 11, fontFamily: OS, marginBottom: 12 }}>{error}</div>}

          {stage === "upload" && (
            <div style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: RW, color: B.text, marginBottom: 6 }}>Select excursion spreadsheet</div>
              <div style={{ fontSize: 11, fontFamily: OS, color: B.textMuted, marginBottom: 20 }}>
                Upload a workbook with an "Excursion bookings" sheet, an "Excursion coaches" sheet, or both — a sheet
                is treated as coach info if its name contains "coach", otherwise as bookings. Coach rows are matched
                to bookings by date + attraction; unmatched ones can be attached to an existing booking on the next screen.
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files?.[0])} />
              <button style={{ ...btnBase, background: B.navy, color: "#fff", padding: "10px 24px" }}
                onClick={() => fileRef.current?.click()} disabled={loading}>
                {loading ? "Reading file…" : "Choose File"}
              </button>
            </div>
          )}

          {stage === "preview" && parsed && (
            <>
              {fileName && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 12px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 11, fontFamily: OS }}>
                  <span style={{ fontSize: 13 }}>📄</span>
                  <span style={{ color: "#166534", fontWeight: 600 }}>File loaded: {fileName}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", background: B.bg, borderRadius: 8, fontSize: 11, fontFamily: OS }}>
                <span><strong style={{ color: B.success }}>{parsed.bookings.length}</strong> booking{parsed.bookings.length !== 1 ? "s" : ""} found</span>
                {bookingsWithCoaches > 0 && <span>·&nbsp;<strong style={{ color: B.link }}>{bookingsWithCoaches}</strong> with matching coach info in the same file</span>}
                {coachRows.length > 0 && <span>·&nbsp;<strong style={{ color: B.warning }}>{coachRows.length}</strong> coach row{coachRows.length !== 1 ? "s" : ""} to attach to existing bookings</span>}
              </div>

              {parsed.bookings.length > 0 && (
                <div style={{ maxHeight: coachRows.length > 0 ? 240 : 420, overflow: "auto", marginBottom: coachRows.length > 0 ? 16 : 0 }}>
                  {parsed.bookings.map((b, i) => {
                    const selected = overrides[i] || [];
                    const candidateGroups = groups.filter((g) => inRange(b.date, g.arr, g.dep));
                    const pickList = candidateGroups.length > 0 ? candidateGroups : groups;
                    return (
                      <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${B.border}` }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, fontFamily: OS, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, minWidth: 80 }}>{b.date}</span>
                          <span style={{ background: B.cyanBg, color: B.link, padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700 }}>{b.dayPart}</span>
                          <span style={{ flex: 1, fontWeight: 600 }}>{b.attraction}</span>
                          {b.cohortLabel && <span style={{ fontSize: 9, color: B.textMuted }}>({b.cohortLabel})</span>}
                          {(b.coaches || []).length > 0 && <span style={{ background: B.successBg, color: B.success, padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700 }}>+{b.coaches.length} coach{b.coaches.length !== 1 ? "es" : ""}</span>}
                        </div>
                        {pickList.length > 0 ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                            {pickList.map((g) => (
                              <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontFamily: OS, background: selected.includes(g.id) ? "#f0fdf4" : B.card, border: "1px solid " + (selected.includes(g.id) ? "#16a34a" : B.border), borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}>
                                <input type="checkbox" checked={selected.includes(g.id)} onChange={() => toggleGroup(i, g.id)} />
                                {g.group}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: B.textLight, marginTop: 4, fontFamily: OS }}>No groups to match — will import with the sheet's own counts.</div>
                        )}
                        {selected.length === 0 && (
                          <div style={{ fontSize: 9, color: B.warning, marginTop: 2, fontFamily: OS }}>
                            No group linked — will use sheet counts ({b.studentNo} stu / {b.leaderNo} GL / {b.staffCount} staff)
                          </div>
                        )}
                        {selected.length > 1 && (
                          <div style={{ fontSize: 9, color: B.warning, marginTop: 2, fontFamily: OS }}>{selected.length} groups selected — verify this is correct</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {coachRows.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, fontFamily: RW, color: B.warning, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 0", borderBottom: `1px solid ${B.border}`, marginBottom: 6 }}>
                    Coach info — attach to an existing booking
                  </div>
                  <div style={{ maxHeight: 220, overflow: "auto" }}>
                    {coachRows.map((row, i) => {
                      const attractionMatches = findMatchingBookings(row, existingBookings);
                      const candidates = attractionMatches.length > 0 ? attractionMatches : existingBookings.filter((b) => b.date === row.date);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${B.border}`, fontSize: 11, fontFamily: OS, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, minWidth: 80 }}>{row.date}</span>
                          <span style={{ flex: 1, minWidth: 160 }}>{row.attraction}</span>
                          <select value={coachTargets[i] || ""} onChange={(e) => setCoachTargets((p) => ({ ...p, [i]: e.target.value }))}
                            style={{ padding: "3px 6px", fontSize: 10, fontFamily: "inherit", borderRadius: 4, border: `1px solid ${coachTargets[i] ? "#16a34a" : B.border}`, background: coachTargets[i] ? "#f0fdf4" : B.bg, minWidth: 180 }}>
                            <option value="">— Skip —</option>
                            {candidates.map((c) => <option key={c.id} value={c.id}>{c.attraction} ({c.dayPart})</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button style={{ ...btnBase, background: B.bg, color: B.text, border: `1px solid ${B.border}` }} onClick={() => setStage("upload")}>Back</button>
                <button style={{ ...btnBase, background: B.navy, color: "#fff" }} onClick={handleConfirm} disabled={totalToImport === 0}>
                  Import {parsed.bookings.length > 0 ? `${parsed.bookings.length} Booking${parsed.bookings.length !== 1 ? "s" : ""}` : ""}
                  {parsed.bookings.length > 0 && attachableCount > 0 ? " + " : ""}
                  {attachableCount > 0 ? `${attachableCount} Coach${attachableCount !== 1 ? "es" : ""}` : ""}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
