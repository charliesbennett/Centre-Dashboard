/*
  ArchiveModal.js — Archive & Reset Programme

  Run in Supabase SQL editor before using:

  -- CREATE TABLE programme_archives (
  --   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  --   centre_id TEXT NOT NULL,
  --   programme_name TEXT NOT NULL,
  --   archived_at TIMESTAMPTZ DEFAULT NOW(),
  --   metadata JSONB,
  --   data JSONB NOT NULL
  -- );
  -- CREATE INDEX idx_programme_archives_centre ON programme_archives(centre_id, archived_at DESC);
*/
"use client";
import { useState, useEffect } from "react";
import { useB } from "@/lib/theme";

export default function ArchiveModal({ centreId, centreName, onArchive, onLoadArchives, onDeleteArchive, isHeadOffice, onClose }) {
  const B = useB();
  const today = new Date().toISOString().slice(0, 10);
  const defaultName = `${centreName} — ${today}`;

  const [view, setView] = useState("archive"); // "archive" | "browse"
  const [progName, setProgName] = useState(defaultName);
  const [confirmStep, setConfirmStep] = useState(0); // 0=idle 1=warned 2=done
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [archives, setArchives] = useState([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (view === "browse") fetchArchives();
  }, [view]);

  async function fetchArchives() {
    setLoadingArchives(true);
    try {
      const data = await onLoadArchives();
      setArchives(data || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingArchives(false);
    }
  }

  async function handleArchive() {
    if (confirmStep === 0) { setConfirmStep(1); return; }
    if (!progName.trim()) { setErr("Please enter a programme name."); return; }
    setBusy(true);
    setErr("");
    try {
      await onArchive(progName.trim());
      setConfirmStep(2);
    } catch (e) {
      setErr(e.message);
      setConfirmStep(0);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Permanently delete this archive? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await onDeleteArchive(id);
      setArchives((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setErr(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
    padding: 16,
  };
  const card = {
    background: B.card, borderRadius: 12, width: "100%", maxWidth: 560,
    boxShadow: "0 8px 40px rgba(0,0,0,0.28)", overflow: "hidden",
    display: "flex", flexDirection: "column",
  };
  const header = {
    background: B.navy, padding: "18px 24px", display: "flex",
    alignItems: "center", justifyContent: "space-between",
  };
  const body = { padding: "24px", flex: 1, overflowY: "auto", maxHeight: "70vh" };
  const label = { fontSize: 12, fontWeight: 700, color: B.textMuted, marginBottom: 4, display: "block" };
  const input = {
    width: "100%", boxSizing: "border-box",
    border: `1px solid ${B.border}`, borderRadius: 7, padding: "9px 12px",
    fontSize: 13, background: B.bg, color: B.text, fontFamily: "inherit",
    outline: "none",
  };
  const btnBase = {
    border: "none", borderRadius: 7, padding: "9px 18px", cursor: "pointer",
    fontSize: 12, fontWeight: 700, fontFamily: "inherit",
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📦</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: "'Raleway', sans-serif" }}>
              Archive & Reset Programme
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setView(view === "archive" ? "browse" : "archive"); setErr(""); }}
              style={{ ...btnBase, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 11 }}
            >
              {view === "archive" ? "📋 Past Archives" : "← Back"}
            </button>
            <button onClick={onClose} style={{ ...btnBase, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 16, padding: "4px 10px" }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={body}>
          {view === "archive" ? (
            confirmStep === 2 ? (
              /* Success */
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: B.success, marginBottom: 8 }}>Programme archived successfully.</div>
                <div style={{ fontSize: 13, color: B.textMuted, marginBottom: 24 }}>The centre is now ready for your next intake.</div>
                <button onClick={onClose} style={{ ...btnBase, background: B.navy, color: "#fff", padding: "10px 28px", fontSize: 13 }}>Close</button>
              </div>
            ) : busy ? (
              /* Spinner */
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 13, color: B.textMuted }}>Archiving programme data and resetting centre…</div>
              </div>
            ) : (
              /* Archive form */
              <>
                {/* Summary box */}
                <div style={{ background: B.warningBg, border: `1px solid ${B.warning}`, borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: B.warning, marginBottom: 6 }}>WHAT THIS DOES</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: B.text, lineHeight: 1.8 }}>
                    <li>Saves a full snapshot of this programme (groups, students, staff, rota, programme, rooming, excursions, transfers)</li>
                    <li>Permanently deletes all programme data from the live centre</li>
                    <li>Resets the centre to a blank state ready for the next intake</li>
                  </ul>
                </div>

                {/* Name input */}
                <div style={{ marginBottom: 20 }}>
                  <label style={label}>Programme Archive Name</label>
                  <input
                    style={input}
                    value={progName}
                    onChange={(e) => { setProgName(e.target.value); setConfirmStep(0); }}
                    placeholder="e.g. Oxford Summer 2026"
                  />
                </div>

                {/* Confirm warning (step 1) */}
                {confirmStep === 1 && (
                  <div style={{ background: B.dangerBg, border: `1px solid ${B.danger}`, borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: B.danger, marginBottom: 4 }}>⚠️ ARE YOU SURE?</div>
                    <div style={{ fontSize: 12, color: B.text }}>
                      All live programme data for <strong>{centreName}</strong> will be permanently wiped. This cannot be undone. The archive will be saved before deletion.
                    </div>
                  </div>
                )}

                {err && (
                  <div style={{ background: B.dangerBg, border: `1px solid ${B.danger}`, borderRadius: 7, padding: "9px 14px", marginBottom: 14, fontSize: 12, color: B.danger }}>
                    {err}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button onClick={onClose} style={{ ...btnBase, background: B.bg, color: B.textMuted, border: `1px solid ${B.border}` }}>Cancel</button>
                  <button
                    onClick={handleArchive}
                    style={{ ...btnBase, background: confirmStep === 1 ? B.danger : B.warning, color: "#fff", padding: "9px 22px" }}
                  >
                    {confirmStep === 0 ? "📦 Archive & Reset" : "⚠️ Yes, Archive & Wipe"}
                  </button>
                </div>
              </>
            )
          ) : (
            /* Browse view */
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: B.text, marginBottom: 14 }}>Past Archives — {centreName}</div>
              {loadingArchives && <div style={{ color: B.textMuted, fontSize: 12, textAlign: "center", padding: 24 }}>Loading…</div>}
              {!loadingArchives && archives.length === 0 && (
                <div style={{ color: B.textMuted, fontSize: 12, textAlign: "center", padding: 32 }}>No archives yet for this centre.</div>
              )}
              {err && (
                <div style={{ background: B.dangerBg, border: `1px solid ${B.danger}`, borderRadius: 7, padding: "9px 14px", marginBottom: 14, fontSize: 12, color: B.danger }}>
                  {err}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {archives.map((a) => {
                  const m = a.metadata || {};
                  const archivedDate = a.archived_at ? new Date(a.archived_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                  return (
                    <div key={a.id} style={{ border: `1px solid ${B.border}`, borderRadius: 9, padding: "12px 14px", background: B.bg, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: B.text, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.programme_name}</div>
                        <div style={{ fontSize: 11, color: B.textMuted, marginBottom: 6 }}>Archived {archivedDate}</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {[
                            ["👥", `${m.groupCount ?? "?"} groups`],
                            ["🎓", `${m.studentCount ?? "?"} students`],
                            ["🧑‍💼", `${m.staffCount ?? "?"} staff`],
                            m.progStart ? ["📅", `${m.progStart} → ${m.progEnd || "?"}`] : null,
                          ].filter(Boolean).map(([icon, text], i) => (
                            <span key={i} style={{ fontSize: 11, color: B.textMuted, background: B.card, border: `1px solid ${B.border}`, borderRadius: 5, padding: "2px 7px" }}>
                              {icon} {text}
                            </span>
                          ))}
                        </div>
                      </div>
                      {isHeadOffice && (
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={deletingId === a.id}
                          style={{ ...btnBase, background: B.dangerBg, color: B.danger, border: `1px solid ${B.danger}`, padding: "6px 12px", fontSize: 11, flexShrink: 0 }}
                        >
                          {deletingId === a.id ? "…" : "🗑 Delete"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
