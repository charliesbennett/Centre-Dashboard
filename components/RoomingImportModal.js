"use client";
import { useState, useRef } from "react";
import { uid } from "@/lib/constants";
import { useB } from "@/lib/theme";
import { parseRoomingExcel } from "@/lib/parseRoomingExcel";

const TYPE_COLORS = {
  M: { bg: "#dbeafe", color: "#1d4ed8" },
  F: { bg: "#fce7f3", color: "#be185d" },
  GL: { bg: "#dcfce7", color: "#15803d" },
  UKLC: { bg: "#fef3c7", color: "#b45309" },
};
const typeStyle = (t) => {
  const s = TYPE_COLORS[t?.toUpperCase?.()] || { bg: "#f1f5f9", color: "#475569" };
  return { background: s.bg, color: s.color, padding: "1px 5px", borderRadius: 3, fontSize: 8, fontWeight: 700 };
};

export default function RoomingImportModal({
  onClose,
  existingHouses = [],
  existingRooms = [],
  activeGroups = [],
  centreId,
  onImport,
}) {
  const B = useB();
  const [stage, setStage] = useState("upload"); // upload | preview | done
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null); // { houses, totalRooms, totalBeds, namedBeds }
  const [parseError, setParseError] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(activeGroups[0]?.id || "");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const inputRef = useRef(null);

  // ── Parse ──────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setParseError("");
    setParseResult(null);
    const buf = await file.arrayBuffer();
    const result = parseRoomingExcel(new Uint8Array(buf));
    setParsing(false);
    if (result.error) { setParseError(result.error); return; }
    setParseResult(result);
    setStage("preview");
  };

  // ── Diff helpers ───────────────────────────────────────
  const findExistingHouse = (name) =>
    existingHouses.find((h) => h.name.toLowerCase() === name.toLowerCase());

  const findExistingRoom = (houseId, roomName) =>
    existingRooms.find(
      (r) => r.houseId === houseId && r.roomName.toLowerCase() === roomName.toLowerCase()
    );

  // ── Import ─────────────────────────────────────────────
  const handleImport = () => {
    if (!parseResult) return;
    setImporting(true);

    const newHouses = [];
    const newRooms = [];
    const newAssignments = [];
    let skippedRooms = 0;
    let createdRooms = 0;
    let createdAssignments = 0;

    parseResult.houses.forEach((h) => {
      let houseId;
      const existing = findExistingHouse(h.name);
      if (existing) {
        houseId = existing.id;
      } else {
        houseId = uid();
        newHouses.push({
          id: houseId,
          name: h.name,
          sortOrder: existingHouses.length + newHouses.length,
        });
      }

      h.rooms.forEach((r) => {
        let roomId;
        const existingRoom = findExistingRoom(houseId, r.roomName);
        if (existingRoom) {
          roomId = existingRoom.id;
          skippedRooms++;
        } else {
          roomId = uid();
          newRooms.push({
            id: roomId,
            houseId,
            floorLabel: r.floor,
            roomName: r.roomName,
            capacity: r.beds.length,
            sortOrder:
              existingRooms.filter((x) => x.houseId === houseId).length +
              newRooms.filter((x) => x.houseId === houseId).length,
          });
          createdRooms++;
        }

        // Import named occupants if any
        if (selectedGroup) {
          r.beds.forEach((bed, slotIdx) => {
            if (!bed.firstName && !bed.lastName) return;
            const occupantName = [bed.firstName, bed.lastName].filter(Boolean).join(" ");
            newAssignments.push({
              id: uid(),
              roomId,
              slotIndex: slotIdx,
              occupantName,
              groupId: selectedGroup,
              occupantType: bed.occType?.toUpperCase() === "GL" ? "gl" : "student",
              notes: "",
            });
            createdAssignments++;
          });
        }
      });
    });

    setImporting(false);
    setImportResult({ createdHouses: newHouses.length, createdRooms, skippedRooms, createdAssignments });
    onImport({ newHouses, newRooms, newAssignments });
    setStage("done");
  };

  // ── Diff preview ───────────────────────────────────────
  const getDiff = () => {
    if (!parseResult) return { newHousesCount: 0, newRoomsCount: 0, skippedRoomsCount: 0 };
    let newHousesCount = 0, newRoomsCount = 0, skippedRoomsCount = 0;
    parseResult.houses.forEach((h) => {
      const existingH = findExistingHouse(h.name);
      const houseId = existingH?.id;
      if (!existingH) newHousesCount++;
      h.rooms.forEach((r) => {
        if (houseId && findExistingRoom(houseId, r.roomName)) skippedRoomsCount++;
        else newRoomsCount++;
      });
    });
    return { newHousesCount, newRoomsCount, skippedRoomsCount };
  };

  const diff = getDiff();

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: B.card, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: B.navy, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: B.white }}>Import Rooming List Excel</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
              Creates houses and rooms from your template spreadsheet
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: B.white, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>

          {/* ── UPLOAD ── */}
          {stage === "upload" && (
            <div>
              <div
                onClick={() => inputRef.current?.click()}
                style={{
                  border: "2px dashed " + B.border, borderRadius: 12, padding: "36px 24px",
                  textAlign: "center", cursor: "pointer", background: B.bg,
                  transition: "border-color 0.15s",
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              >
                {parsing ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: B.text }}>Parsing spreadsheet…</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: B.text, marginBottom: 4 }}>Upload Rooming List Excel</div>
                    <div style={{ fontSize: 11, color: B.textMuted }}>
                      Drag & drop or click to select<br />
                      <span style={{ fontSize: 10, color: B.textLight }}>Supports .xlsx, .xlsm, .xls</span>
                    </div>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files[0])} />
              </div>

              {parseError && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 11, color: "#dc2626" }}>
                  ⚠ {parseError}
                </div>
              )}

              <div style={{ marginTop: 14, padding: "10px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 10, color: "#0369a1", lineHeight: 1.6 }}>
                <strong>Expected columns (in order):</strong><br />
                Floor label &nbsp;·&nbsp; Building/House name &nbsp;·&nbsp; Room number &nbsp;·&nbsp; Type (M/F/GL/UKLC) &nbsp;·&nbsp; First name &nbsp;·&nbsp; Last name<br />
                <span style={{ color: "#64748b" }}>Column letters are auto-detected — A–F and B–G layouts both work.</span>
              </div>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {stage === "preview" && parseResult && (
            <div>
              {/* Summary bar */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {[
                  { label: "Houses", value: parseResult.houses.length, color: B.text },
                  { label: "Rooms", value: parseResult.totalRooms, color: "#7c3aed" },
                  { label: "Beds", value: parseResult.totalBeds, color: "#0891b2" },
                  { label: "Names", value: parseResult.namedBeds, color: parseResult.namedBeds ? "#16a34a" : B.textLight },
                ].map((s) => (
                  <div key={s.label} style={{ background: B.bg, border: "1px solid " + B.border, borderRadius: 8, padding: "6px 12px", textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 8, fontWeight: 700, color: B.textMuted, textTransform: "uppercase" }}>{s.label}</div>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: B.textMuted, display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                  📄 {fileName}
                </div>
              </div>

              {/* House/room tree */}
              {parseResult.houses.map((h) => {
                const existingH = findExistingHouse(h.name);
                // Group rooms by floor
                const floors = {};
                h.rooms.forEach((r) => {
                  const fl = r.floor || "Main";
                  if (!floors[fl]) floors[fl] = [];
                  floors[fl].push(r);
                });
                return (
                  <div key={h.name} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: B.navy, borderRadius: "8px 8px 0 0" }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: B.white }}>{h.name}</span>
                      {existingH ? (
                        <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>already exists</span>
                      ) : (
                        <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "#4ade8030", color: "#4ade80", fontWeight: 700 }}>+ new house</span>
                      )}
                    </div>
                    <div style={{ border: "1px solid " + B.border, borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                      {Object.entries(floors).map(([floorLabel, fRooms], fi) => (
                        <div key={floorLabel}>
                          {Object.keys(floors).length > 1 && (
                            <div style={{ padding: "4px 10px", fontSize: 8, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, background: "#f8fafc", borderBottom: "1px solid " + B.borderLight }}>
                              {floorLabel}
                            </div>
                          )}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px" }}>
                            {fRooms.map((r) => {
                              const existingRoomEntry = existingH ? findExistingRoom(existingH.id, r.roomName) : null;
                              const hasNames = r.beds.some((b) => b.firstName || b.lastName);
                              return (
                                <div key={r.roomName} style={{
                                  border: "1px solid " + (existingRoomEntry ? "#fde68a" : "#bbf7d0"),
                                  borderRadius: 6, padding: "5px 8px", minWidth: 100, background: existingRoomEntry ? "#fffbeb" : "#f0fdf4",
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                                    <span style={{ fontWeight: 700, fontSize: 10, color: B.text }}>{r.roomName}</span>
                                    <span style={{ fontSize: 8, color: B.textMuted }}>{r.beds.length} bed{r.beds.length !== 1 ? "s" : ""}</span>
                                    {existingRoomEntry ? (
                                      <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 3, background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>exists</span>
                                    ) : (
                                      <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 3, background: "#dcfce7", color: "#15803d", fontWeight: 700 }}>new</span>
                                    )}
                                  </div>
                                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                    {r.beds.map((bed, bi) => (
                                      <span key={bi} style={typeStyle(bed.occType)}>
                                        {bed.firstName || bed.occType || "?"}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* What will happen */}
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 10, color: "#0369a1", lineHeight: 1.8 }}>
                <strong>What will be imported:</strong><br />
                {diff.newHousesCount > 0 && <span>✓ Create {diff.newHousesCount} new house{diff.newHousesCount > 1 ? "s" : ""}<br /></span>}
                {diff.newRoomsCount > 0 && <span>✓ Create {diff.newRoomsCount} new room{diff.newRoomsCount > 1 ? "s" : ""}<br /></span>}
                {diff.skippedRoomsCount > 0 && <span style={{ color: "#b45309" }}>⚠ Skip {diff.skippedRoomsCount} room{diff.skippedRoomsCount > 1 ? "s" : ""} (already exist)<br /></span>}
                {parseResult.namedBeds > 0 && <span>✓ Import {parseResult.namedBeds} named occupant{parseResult.namedBeds > 1 ? "s" : ""} as assignments<br /></span>}
                {parseResult.namedBeds === 0 && <span style={{ color: B.textMuted }}>ℹ No names in file — room structure only (GL fills names via link)<br /></span>}
              </div>

              {/* Group selector (only shown if there are names) */}
              {parseResult.namedBeds > 0 && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: B.text, display: "block", marginBottom: 4 }}>Assign named occupants to group:</label>
                  <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}
                    style={{ padding: "7px 10px", border: "1px solid " + B.border, borderRadius: 7, fontSize: 11, fontFamily: "inherit", width: "100%", color: B.text, background: B.card }}>
                    <option value="">— Don't assign to a group</option>
                    {activeGroups.map((g) => <option key={g.id} value={g.id}>{g.group}</option>)}
                  </select>
                </div>
              )}

              <button onClick={() => { setStage("upload"); setParseResult(null); setFileName(""); }}
                style={{ marginTop: 10, background: "none", border: "none", color: B.textMuted, fontSize: 10, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                ← Upload a different file
              </button>
            </div>
          )}

          {/* ── DONE ── */}
          {stage === "done" && importResult && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#dcfce7", border: "3px solid #4ade80", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#15803d", marginBottom: 8 }}>Import Complete</div>
              <div style={{ fontSize: 12, color: B.textMuted, lineHeight: 1.8 }}>
                {importResult.createdHouses > 0 && <div>{importResult.createdHouses} house{importResult.createdHouses > 1 ? "s" : ""} created</div>}
                {importResult.createdRooms > 0 && <div>{importResult.createdRooms} room{importResult.createdRooms > 1 ? "s" : ""} created</div>}
                {importResult.skippedRooms > 0 && <div>{importResult.skippedRooms} room{importResult.skippedRooms > 1 ? "s" : ""} skipped (already existed)</div>}
                {importResult.createdAssignments > 0 && <div>{importResult.createdAssignments} assignment{importResult.createdAssignments > 1 ? "s" : ""} created</div>}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: B.textMuted }}>
                Go to <strong>Houses → Assign Students</strong> to generate group leader links.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid " + B.border, display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0, background: B.bg }}>
          {stage === "done" ? (
            <button onClick={onClose} style={{ padding: "8px 20px", background: B.navy, border: "none", color: B.white, borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Close
            </button>
          ) : stage === "preview" ? (
            <>
              <button onClick={onClose} style={{ padding: "8px 16px", background: B.card, border: "1px solid " + B.border, color: B.textMuted, borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing || (diff.newHousesCount === 0 && diff.newRoomsCount === 0 && parseResult?.namedBeds === 0)}
                style={{
                  padding: "8px 20px", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  background: importing ? B.textLight : B.red,
                  color: B.white,
                }}>
                {importing ? "Importing…" : `Import ${diff.newRoomsCount > 0 ? diff.newRoomsCount + " Rooms" : "Assignments"}`}
              </button>
            </>
          ) : (
            <button onClick={onClose} style={{ padding: "8px 16px", background: B.card, border: "1px solid " + B.border, color: B.textMuted, borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
