"use client";
import { useState, useRef, useEffect } from "react";
import { useB } from "@/lib/theme";
import { parseTeamExcel } from "@/lib/parseTeamExcel";

const OS = "'Open Sans', sans-serif";
const RW = "'Raleway', sans-serif";

const pill = (color, bg) => ({
  display: "inline-block", fontSize: 9, fontWeight: 700, fontFamily: OS,
  padding: "2px 7px", borderRadius: 10, background: bg, color: color,
  whiteSpace: "nowrap",
});

export default function TeamBulkImportModal({ centres = [], onClose, onImported }) {
  const B = useB();
  const fileRef = useRef(null);
  const [stage, setStage] = useState("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [result, setResult] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [fileName, setFileName] = useState(null);

  useEffect(() => {
    if (!parsed?.unmatched) return;
    const init = {};
    parsed.unmatched.forEach((s, i) => {
      if (s.bestGuessId && s.bestGuessScore >= 0.5) init[i] = s.bestGuessId;
    });
    setOverrides(init);
  }, [parsed]);

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const card    = { background:B.card,borderRadius:14,width:"100%",maxWidth:760,maxHeight:"85vh",overflow:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.25)" };
  const header  = { background:B.navy,padding:"16px 20px",borderRadius:"14px 14px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center" };
  const btnBase = { padding:"7px 16px",borderRadius:6,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none" };

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true); setError(null); setFileName(file.name);
    try {
      const res = await parseTeamExcel(file, centres);
      if (!res.ok) { setError(res.error); setLoading(false); return; }
      setParsed(res);
      setStage("preview");
    } catch (e) {
      setError("Failed to read file: " + e.message);
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    setStage("importing");
    const toImport = [
      ...(parsed.staff || []),
      ...(parsed.unmatched || []).filter((_, i) => overrides[i]).map((s, i) => ({
        ...s,
        centreId:   overrides[i],
        centreName: centres.find((c) => c.id === overrides[i])?.name || "",
      })),
    ];
    try {
      const res = await fetch("/api/db/staff/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff: toImport }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResult({ imported: json.imported });
      setStage("done");
      if (onImported) onImported();
    } catch (e) {
      setError(e.message);
      setStage("preview");
    }
  };

  // Group matched staff by centre
  const byCentre = {};
  (parsed?.staff || []).forEach((s) => {
    const key = s.centreName || s.excelCentre;
    if (!byCentre[key]) byCentre[key] = [];
    byCentre[key].push(s);
  });

  const totalToImport = (parsed?.staff?.length || 0) +
    (parsed?.unmatched || []).filter((_, i) => overrides[i]).length;

  const handleClose = () => {
    if (result) { window.location.reload(); return; }
    onClose();
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div style={card}>
        <div style={header}>
          <div>
            <div style={{ fontSize:14,fontWeight:800,fontFamily:RW,color:"#fff" }}>Import Team</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:OS,marginTop:2 }}>Upload Team Allocations.xlsx to populate all centres</div>
          </div>
          <button onClick={handleClose} style={{ background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:18,cursor:"pointer",lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:20 }}>
          {error && <div style={{ background:"#fee2e2",color:"#991b1b",padding:"8px 12px",borderRadius:6,fontSize:11,fontFamily:OS,marginBottom:12 }}>{error}</div>}

          {stage === "upload" && (
            <div style={{ textAlign:"center",padding:"32px 20px" }}>
              <div style={{ fontSize:32,marginBottom:12 }}>👥</div>
              <div style={{ fontSize:13,fontWeight:700,fontFamily:RW,color:B.text,marginBottom:6 }}>Select Team Allocations.xlsx</div>
              <div style={{ fontSize:11,fontFamily:OS,color:B.textMuted,marginBottom:20 }}>Upload the master team allocations file. All staff from the MASTER I Allocations sheet will be imported across all centres.</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }}
                onChange={(e) => handleFile(e.target.files?.[0])} />
              <button style={{ ...btnBase,background:B.navy,color:"#fff",padding:"10px 24px" }}
                onClick={() => fileRef.current?.click()} disabled={loading}>
                {loading ? "Reading file…" : "Choose File"}
              </button>
            </div>
          )}

          {stage === "preview" && parsed && (
            <>
              {fileName && (
                <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10,padding:"6px 12px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:6,fontSize:11,fontFamily:OS }}>
                  <span style={{ fontSize:13 }}>📄</span>
                  <span style={{ color:"#166534",fontWeight:600 }}>File loaded: {fileName}</span>
                </div>
              )}
              <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,padding:"10px 14px",background:B.bg,borderRadius:8,fontSize:11,fontFamily:OS }}>
                <span><strong style={{ color:B.success }}>{parsed.staff.length}</strong> staff matched</span>
                {parsed.unmatched.length > 0 && <span>·&nbsp;<strong style={{ color:B.warning }}>{parsed.unmatched.length}</strong> unmatched centre</span>}
              </div>

              {Object.entries(byCentre).map(([centreName, members]) => (
                <div key={centreName} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10,fontWeight:800,fontFamily:RW,color:B.navy,textTransform:"uppercase",letterSpacing:0.5,padding:"4px 0",borderBottom:`1px solid ${B.border}`,marginBottom:6 }}>
                    {centreName} <span style={{ fontWeight:400,color:B.textMuted }}>({members.length})</span>
                  </div>
                  {members.map((s, i) => (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:11,fontFamily:OS,borderBottom:`1px solid ${B.border}` }}>
                      <span style={{ flex:1,fontWeight:600 }}>{s.name}</span>
                      <span style={pill("#1e40af","#dbeafe")}>{s.role}</span>
                      <span style={pill(s.acc==="Residential"?"#166534":"#92400e", s.acc==="Residential"?"#dcfce7":"#fef3c7")}>{s.acc}</span>
                      <span style={{ color:B.textMuted,minWidth:140,textAlign:"right",fontSize:10 }}>{s.arr} → {s.dep}</span>
                    </div>
                  ))}
                </div>
              ))}

              {parsed.unmatched.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10,fontWeight:800,fontFamily:RW,color:B.warning,textTransform:"uppercase",letterSpacing:0.5,padding:"4px 0",borderBottom:`1px solid ${B.border}`,marginBottom:4 }}>
                    ⚠ Unmatched centres — assign or skip
                  </div>
                  <div style={{ fontSize:10,fontFamily:OS,color:B.textMuted,marginBottom:8 }}>
                    These staff couldn't be matched to a centre automatically. Assign them or set to Skip.
                  </div>
                  {parsed.unmatched.map((s, i) => {
                    const assigned = overrides[i];
                    const isPreFilled = assigned && assigned === s.bestGuessId;
                    return (
                      <div key={i} style={{ padding:"6px 0",borderBottom:`1px solid ${B.border}` }}>
                        <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:11,fontFamily:OS }}>
                          <div style={{ flex:1,minWidth:0 }}>
                            <span style={{ fontWeight:600 }}>{s.name}</span>
                            <span style={{ ...pill("#1e40af","#dbeafe"),marginLeft:6 }}>{s.role}</span>
                            <div style={{ fontSize:9,color:B.textMuted,marginTop:1 }}>Excel: {s.excelCentre} · {s.arr} → {s.dep}</div>
                          </div>
                          <select value={assigned || ""}
                            onChange={(e) => setOverrides((p) => ({ ...p, [i]: e.target.value || undefined }))}
                            style={{ padding:"3px 6px",fontSize:10,fontFamily:"inherit",borderRadius:4,
                              border:`1px solid ${assigned ? (isPreFilled ? "#f59e0b" : "#16a34a") : B.border}`,
                              background: assigned ? (isPreFilled ? "#fffbeb" : "#f0fdf4") : B.bg }}>
                            <option value="">— Skip —</option>
                            {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        {isPreFilled && (
                          <div style={{ fontSize:9,color:"#92400e",marginTop:2,textAlign:"right" }}>
                            Best guess ({Math.round(s.bestGuessScore * 100)}% match) — please verify
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display:"flex",gap:8,justifyContent:"flex-end",marginTop:8 }}>
                <button style={{ ...btnBase,background:B.bg,color:B.text,border:`1px solid ${B.border}` }} onClick={() => setStage("upload")}>Back</button>
                <button style={{ ...btnBase,background:B.navy,color:"#fff" }} onClick={handleConfirm} disabled={totalToImport === 0}>
                  Import {totalToImport} Staff Member{totalToImport !== 1 ? "s" : ""}
                </button>
              </div>
            </>
          )}

          {stage === "importing" && (
            <div style={{ textAlign:"center",padding:"40px 20px",fontFamily:OS,color:B.textMuted }}>
              Importing staff…
            </div>
          )}

          {stage === "done" && result && (
            <div style={{ textAlign:"center",padding:"32px 20px" }}>
              <div style={{ fontSize:28,marginBottom:10 }}>✅</div>
              <div style={{ fontSize:14,fontWeight:700,fontFamily:RW,color:B.text,marginBottom:6 }}>
                {result.imported} staff member{result.imported !== 1 ? "s" : ""} imported
              </div>
              <div style={{ fontSize:11,fontFamily:OS,color:B.textMuted,marginBottom:24 }}>
                Staff have been added or updated across all centres.
              </div>
              <button style={{ ...btnBase,background:B.navy,color:"#fff" }} onClick={() => window.location.reload()}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
