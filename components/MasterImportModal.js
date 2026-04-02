"use client";
import { useState, useRef, useMemo } from "react";
import { useB } from "@/lib/theme";
import { parseMasterExcel } from "@/lib/parseMasterExcel";

// Fuzzy group-name match: 0–1 score based on word overlap + agent bonus
function matchScore(excelGroup, dashGroup) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const words = (s) => norm(s).split(" ").filter((w) => w.length > 1);

  const exWords = words(excelGroup.group);
  const daWords = words(dashGroup.group);
  if (!exWords.length || !daWords.length) return 0;

  const matching = exWords.filter((w) => daWords.includes(w)).length;
  const score = matching / Math.max(exWords.length, daWords.length);

  // Agent name bonus
  const exAgent = norm(excelGroup.agent), daAgent = norm(dashGroup.agent);
  const agentBonus = exAgent && daAgent && (exAgent.includes(daAgent.split(" ")[0]) || daAgent.includes(exAgent.split(" ")[0])) ? 0.15 : 0;

  return Math.min(1, score + agentBonus);
}

function autoMatch(excelGroups, dashGroups) {
  return excelGroups.map((eg) => {
    let best = null, bestScore = 0;
    dashGroups.forEach((dg) => {
      const s = matchScore(eg, dg);
      if (s > bestScore) { bestScore = s; best = dg; }
    });
    return { dashId: bestScore >= 0.5 ? best?.id || "SKIP" : "SKIP", score: bestScore, bestGroup: best };
  });
}

const labelStyle = { fontSize: 9, fontWeight: 800, color: "#5c7084", textTransform: "uppercase", letterSpacing: 0.3, display: "block", marginBottom: 2 };

export default function MasterImportModal({ groups: dashGroups = [], onClose, onImport }) {
  const B = useB();
  const inputStyle = { padding: "5px 8px", border: "1px solid #dce4ec", borderRadius: 5, fontSize: 11, fontFamily: "inherit", background: B.card, color: B.text };
  const [stage, setStage] = useState("upload"); // upload | match | done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);          // { groups: [...], yearHint }
  const [matches, setMatches] = useState([]);           // [{ dashId, score }]
  const [updateMeta, setUpdateMeta] = useState(true);  // update stu/gl/arr/dep from Excel
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const result = await parseMasterExcel(file);
      if (!result.ok) { setError(result.error); setLoading(false); return; }
      const initial = autoMatch(result.groups, dashGroups);
      setParsed(result);
      setMatches(initial);
      setStage("match");
    } catch (e) {
      setError("Failed to parse file: " + e.message);
    }
    setLoading(false);
  };

  const setMatchFor = (i, dashId) => setMatches((prev) => prev.map((m, mi) => mi === i ? { ...m, dashId } : m));

  const importCount = useMemo(() => matches.filter((m) => m.dashId && m.dashId !== "SKIP").length, [matches]);

  const handleConfirm = () => {
    const payload = parsed.groups.map((eg, i) => ({
      excelGroup: eg,
      dashboardGroupId: matches[i]?.dashId !== "SKIP" ? matches[i]?.dashId : null,
      updateMeta,
    }));
    onImport(payload);
    setStage("done");
  };

  const scoreColor = (s) => s >= 0.7 ? B.success : s >= 0.4 ? B.warning : B.danger;
  const scoreLabel = (s) => s >= 0.7 ? "Auto-matched" : s >= 0.4 ? "Review match" : "No match";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: B.card, borderRadius: 14, width: "100%", maxWidth: stage === "match" ? 760 : 480, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: B.navy, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Import Master Programme</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {stage === "upload" && "Upload the centre's Master Excel to populate all group programmes"}
              {stage === "match" && `${parsed?.groups.length} groups found — match to dashboard groups`}
              {stage === "done" && "Import complete"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 20, lineHeight: 1, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Upload stage */}
        {stage === "upload" && (
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed " + B.border, borderRadius: 10, padding: "40px 32px", textAlign: "center", cursor: "pointer", background: B.bg, width: "100%", boxSizing: "border-box" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: B.text }}>Drop Master Excel here</div>
              <div style={{ fontSize: 11, color: B.textMuted, marginTop: 4 }}>or click to browse — must contain a <strong>Programmes</strong> sheet</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
            </div>
            {loading && <div style={{ fontSize: 12, color: B.textMuted }}>Parsing…</div>}
            {error && <div style={{ fontSize: 11, color: B.danger, background: B.dangerBg, padding: "8px 12px", borderRadius: 6, width: "100%", boxSizing: "border-box" }}>⚠ {error}</div>}
          </div>
        )}

        {/* Match stage */}
        {stage === "match" && parsed && (
          <>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {/* Options bar */}
              <div style={{ padding: "10px 20px", background: B.bg, borderBottom: "1px solid " + B.border, display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                  <input type="checkbox" checked={updateMeta} onChange={(e) => setUpdateMeta(e.target.checked)} />
                  Also update student counts & dates from Excel
                </label>
                <span style={{ fontSize: 10, color: B.textMuted, marginLeft: "auto" }}>
                  {importCount} of {parsed.groups.length} groups will be imported
                </span>
              </div>

              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 8, padding: "6px 20px 4px", background: B.bg, borderBottom: "1px solid " + B.border }}>
                <span style={labelStyle}>From Excel</span>
                <span style={labelStyle}>Match to Dashboard Group</span>
                <span style={labelStyle}>Confidence</span>
              </div>

              {/* Group rows */}
              {parsed.groups.map((eg, i) => {
                const m = matches[i];
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 8, padding: "8px 20px", borderBottom: "1px solid " + B.borderLight, alignItems: "center" }}>
                    {/* Excel group */}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 11, color: B.text }}>{eg.group}</div>
                      <div style={{ fontSize: 9, color: B.textMuted }}>{eg.agent} · {eg.nat} · {eg.stu}stu {eg.gl}GL</div>
                      <div style={{ fontSize: 9, color: B.textMuted }}>{eg.arr} → {eg.dep}</div>
                    </div>

                    {/* Match dropdown */}
                    <select
                      value={m?.dashId || "SKIP"}
                      onChange={(e) => setMatchFor(i, e.target.value)}
                      style={{ ...inputStyle, width: "100%" }}
                    >
                      <option value="SKIP">— Skip this group —</option>
                      {dashGroups.map((dg) => (
                        <option key={dg.id} value={dg.id}>{dg.group} ({dg.agent})</option>
                      ))}
                    </select>

                    {/* Confidence badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ background: scoreColor(m?.score || 0) + "20", color: scoreColor(m?.score || 0), padding: "2px 6px", borderRadius: 4, fontSize: 8, fontWeight: 800 }}>
                        {m?.dashId === "SKIP" ? "Skipped" : scoreLabel(m?.score || 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid " + B.border, display: "flex", gap: 8, flexShrink: 0, background: B.card }}>
              <button onClick={handleConfirm} disabled={importCount === 0} style={{ flex: 1, padding: "10px", background: importCount > 0 ? B.navy : "#94a3b8", border: "none", color: "#fff", borderRadius: 8, cursor: importCount > 0 ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                Import {importCount} Group{importCount !== 1 ? "s" : ""}
              </button>
              <button onClick={() => setStage("upload")} style={{ padding: "10px 16px", background: B.bg, border: "1px solid " + B.border, color: B.textMuted, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>Back</button>
            </div>
          </>
        )}

        {/* Done stage */}
        {stage === "done" && (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: B.text, marginBottom: 6 }}>Programme imported</div>
            <div style={{ fontSize: 12, color: B.textMuted, marginBottom: 20 }}>
              {importCount} group{importCount !== 1 ? "s" : ""} populated from Master Excel.
              {updateMeta && " Student counts and dates updated."}
            </div>
            <button onClick={onClose} style={{ padding: "10px 28px", background: B.navy, border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>Done</button>
          </div>
        )}

      </div>
    </div>
  );
}
