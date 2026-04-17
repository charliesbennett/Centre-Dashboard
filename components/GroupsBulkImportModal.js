"use client";
import { useState, useRef, useEffect } from "react";
import { useB } from "@/lib/theme";
import { parseGroupsExcel } from "@/lib/parseGroupsExcel";

const OS = "'Open Sans', sans-serif";
const RW = "'Raleway', sans-serif";

const pill = (color, bg, text) => ({
  display: "inline-block", fontSize: 9, fontWeight: 700, fontFamily: OS,
  padding: "2px 7px", borderRadius: 10, background: bg, color: color,
  whiteSpace: "nowrap",
});

export default function GroupsBulkImportModal({ centres = [], onClose, onImported }) {
  const B = useB();
  const fileRef = useRef(null);
  const [stage, setStage] = useState("upload"); // upload | preview | importing | done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null); // { groups, unmatched, cancelledCount }
  const [result, setResult] = useState(null); // { imported }
  // Centre assignments for unmatched groups: { groupCode: centreId }
  // Pre-filled from bestGuess when parsed; user can change or clear to skip
  const [overrides, setOverrides] = useState({});
  const [fileName, setFileName] = useState(null);

  // Pre-fill overrides from best guesses whenever parsed data arrives.
  // Only pre-fill when the score is high enough to be reliable (≥ 0.5).
  // A wrong pre-fill is worse than no pre-fill — the user might not spot it.
  useEffect(() => {
    if (!parsed?.unmatched) return;
    const init = {};
    parsed.unmatched.forEach((g) => {
      if (g.bestGuessId && g.bestGuessScore >= 0.5) init[g.code] = g.bestGuessId;
    });
    setOverrides(init);
  }, [parsed]);

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const card    = { background:B.card,borderRadius:14,width:"100%",maxWidth:720,maxHeight:"85vh",overflow:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.25)" };
  const header  = { background:B.navy,padding:"16px 20px",borderRadius:"14px 14px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center" };
  const btnBase = { padding:"7px 16px",borderRadius:6,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none" };

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true); setError(null);
    setFileName(file.name);
    try {
      const result = await parseGroupsExcel(file, centres);
      if (!result.ok) { setError(result.error); setLoading(false); return; }
      setParsed(result);
      setStage("preview");
    } catch (e) {
      setError("Failed to read file: " + e.message);
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    setStage("importing");
    // Build final group list: matched + manually-overridden unmatched
    const toImport = [
      ...(parsed.groups || []),
      ...(parsed.unmatched || []).filter((g) => overrides[g.code]).map((g) => ({
        ...g,
        centreId:   overrides[g.code],
        centreName: centres.find((c) => c.id === overrides[g.code])?.name || "",
      })),
    ];

    try {
      const res = await fetch("/api/db/groups/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: toImport }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResult({ imported: json.imported, removed: json.removed || 0, syncErrors: json.syncErrors });
      setStage("done");
      if (onImported) onImported(json.imported);
    } catch (e) {
      setError(e.message);
      setStage("preview");
    }
  };

  // Group preview rows by centre
  const byCentre = {};
  (parsed?.groups || []).forEach((g) => {
    const key = g.centreName || g.excelCentre;
    if (!byCentre[key]) byCentre[key] = [];
    byCentre[key].push(g);
  });

  const totalToImport = (parsed?.groups?.length || 0) +
    (parsed?.unmatched || []).filter((g) => overrides[g.code]).length;

  const handleClose = () => {
    if (result) { window.location.reload(); return; }
    onClose();
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div style={card}>
        {/* Header */}
        <div style={header}>
          <div>
            <div style={{ fontSize:14,fontWeight:800,fontFamily:RW,color:"#fff" }}>Import Groups</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:OS,marginTop:2 }}>Upload Groups.xlsx to populate all centres</div>
          </div>
          <button onClick={handleClose} style={{ background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:18,cursor:"pointer",lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:20 }}>
          {error && <div style={{ background:"#fee2e2",color:"#991b1b",padding:"8px 12px",borderRadius:6,fontSize:11,fontFamily:OS,marginBottom:12 }}>{error}</div>}

          {/* ── Stage: Upload ── */}
          {stage === "upload" && (
            <div style={{ textAlign:"center",padding:"32px 20px" }}>
              <div style={{ fontSize:32,marginBottom:12 }}>📊</div>
              <div style={{ fontSize:13,fontWeight:700,fontFamily:RW,color:B.text,marginBottom:6 }}>Select Groups.xlsx</div>
              <div style={{ fontSize:11,fontFamily:OS,color:B.textMuted,marginBottom:20 }}>Upload the master groups file. All non-cancelled groups will be imported across all centres.</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }}
                onChange={(e) => handleFile(e.target.files?.[0])} />
              <button style={{ ...btnBase,background:B.navy,color:"#fff",padding:"10px 24px" }}
                onClick={() => fileRef.current?.click()} disabled={loading}>
                {loading ? "Reading file…" : "Choose File"}
              </button>
            </div>
          )}

          {/* ── Stage: Preview ── */}
          {stage === "preview" && parsed && (
            <>
              {/* File name banner */}
              {fileName && (
                <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10,padding:"6px 12px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:6,fontSize:11,fontFamily:OS }}>
                  <span style={{ fontSize:13 }}>📄</span>
                  <span style={{ color:"#166534",fontWeight:600 }}>File loaded: {fileName}</span>
                </div>
              )}
              {/* Summary bar */}
              <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,padding:"10px 14px",background:B.bg,borderRadius:8,fontSize:11,fontFamily:OS }}>
                <span><strong style={{ color:B.success }}>{parsed.groups.length}</strong> groups matched</span>
                {parsed.unmatched.length > 0 && <span>·&nbsp;<strong style={{ color:B.warning }}>{parsed.unmatched.length}</strong> unmatched</span>}
                {parsed.cancelledCount > 0 && <span>·&nbsp;<strong style={{ color:B.textMuted }}>{parsed.cancelledCount}</strong> cancelled (excluded)</span>}
              </div>

              {/* Matched groups by centre */}
              {Object.entries(byCentre).map(([centreName, gs]) => (
                <div key={centreName} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10,fontWeight:800,fontFamily:RW,color:B.navy,textTransform:"uppercase",letterSpacing:0.5,padding:"4px 0",borderBottom:`1px solid ${B.border}`,marginBottom:6 }}>
                    {centreName} <span style={{ fontWeight:400,color:B.textMuted }}>({gs.length})</span>
                  </div>
                  {gs.map((g) => (
                    <div key={g.code} style={{ display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:11,fontFamily:OS,borderBottom:`1px solid ${B.border}` }}>
                      <span style={{ flex:1,fontWeight:600 }}>{g.group}</span>
                      <span style={pill(g.status==="Confirmed"?"#166534":"#92400e", g.status==="Confirmed"?"#dcfce7":"#fef3c7", g.status)}>{g.status}</span>
                      <span style={{ color:B.textMuted,minWidth:80,textAlign:"right" }}>{g.arr} → {g.dep}</span>
                      <span style={{ color:B.textMuted }}>{g.stu}s+{g.gl}gl</span>
                      {g.programmeNotes && <span title={g.programmeNotes} style={pill(B.warning,"#fef3c7","!")}>Custom</span>}
                    </div>
                  ))}
                </div>
              ))}

              {/* Unmatched groups — pre-filled with best guess, user can correct */}
              {parsed.unmatched.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10,fontWeight:800,fontFamily:RW,color:B.warning,textTransform:"uppercase",letterSpacing:0.5,padding:"4px 0",borderBottom:`1px solid ${B.border}`,marginBottom:4 }}>
                    ⚠ Review centre matches — correct any wrong ones
                  </div>
                  <div style={{ fontSize:10,fontFamily:OS,color:B.textMuted,marginBottom:8 }}>
                    Best guess pre-filled. Change the dropdown if wrong, or set to Skip to exclude.
                  </div>
                  {parsed.unmatched.map((g) => {
                    const assigned = overrides[g.code];
                    const isPreFilled = assigned && assigned === g.bestGuessId;
                    return (
                      <div key={g.code} style={{ padding:"6px 0",borderBottom:`1px solid ${B.border}` }}>
                        <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:11,fontFamily:OS }}>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{g.group}</div>
                            <div style={{ fontSize:9,color:B.textMuted,marginTop:1 }}>Excel: {g.excelCentre}</div>
                          </div>
                          <select value={assigned || ""}
                            onChange={(e) => setOverrides((p) => ({ ...p, [g.code]: e.target.value || undefined }))}
                            style={{ padding:"3px 6px",fontSize:10,fontFamily:"inherit",borderRadius:4,
                              border:`1px solid ${assigned ? (isPreFilled ? "#f59e0b" : "#16a34a") : B.border}`,
                              background: assigned ? (isPreFilled ? "#fffbeb" : "#f0fdf4") : B.bg }}>
                            <option value="">— Skip —</option>
                            {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        {isPreFilled && (
                          <div style={{ fontSize:9,color:"#92400e",marginTop:2,textAlign:"right" }}>
                            Best guess ({Math.round(g.bestGuessScore * 100)}% match) — please verify
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display:"flex",gap:8,justifyContent:"flex-end",marginTop:8 }}>
                <button style={{ ...btnBase,background:B.bg,color:B.text,border:`1px solid ${B.border}` }} onClick={() => setStage("upload")}>Back</button>
                <button style={{ ...btnBase,background:B.navy,color:"#fff" }} onClick={handleConfirm}
                  disabled={totalToImport === 0}>
                  Import {totalToImport} Group{totalToImport !== 1 ? "s" : ""}
                </button>
              </div>
            </>
          )}

          {/* ── Stage: Importing ── */}
          {stage === "importing" && (
            <div style={{ textAlign:"center",padding:"40px 20px",fontFamily:OS,color:B.textMuted }}>
              Importing groups…
            </div>
          )}

          {/* ── Stage: Done ── */}
          {stage === "done" && result && (
            <div style={{ textAlign:"center",padding:"32px 20px" }}>
              <div style={{ fontSize:28,marginBottom:10 }}>✅</div>
              <div style={{ fontSize:14,fontWeight:700,fontFamily:RW,color:B.text,marginBottom:6 }}>
                {result.imported} group{result.imported !== 1 ? "s" : ""} imported
              </div>
              <div style={{ fontSize:11,fontFamily:OS,color:B.textMuted,marginBottom:24 }}>
                {result.imported} group{result.imported !== 1 ? "s" : ""} added or updated.
                {result.removed > 0 && <span style={{ color:B.red }}> {result.removed} group{result.removed !== 1 ? "s" : ""} removed (no longer in file).</span>}
              </div>
              {result.syncErrors?.length > 0 && (
                <div style={{ background:"#fee2e2",color:"#991b1b",padding:"8px 12px",borderRadius:6,fontSize:10,fontFamily:OS,marginBottom:16,textAlign:"left" }}>
                  <strong>Sync errors (some groups may not have been removed):</strong>
                  {result.syncErrors.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              )}
              <button style={{ ...btnBase,background:B.navy,color:"#fff" }} onClick={() => window.location.reload()}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
