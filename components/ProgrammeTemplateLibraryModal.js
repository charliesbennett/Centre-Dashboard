"use client";
import { useState, useRef } from "react";
import { useB } from "@/lib/theme";
import { parseProgrammeExcel } from "@/lib/parseProgrammeExcel";
import { uid } from "@/lib/constants";

const OS = "'Open Sans', sans-serif";
const RW = "'Raleway', sans-serif";

const MAX_TEMPLATES = 10;

function parseDuration(rows) {
  for (const row of (rows || [])) {
    for (const cell of row) {
      const m = String(cell || "").match(/length of programme[:\s]+(\d+)\s*nights?/i);
      if (m) return parseInt(m[1]);
    }
  }
  return null;
}

export default function ProgrammeTemplateLibraryModal({ currentJson, centreName, onSave, onClose }) {
  const B = useB();
  const fileRef = useRef(null);

  // Parse existing templates from JSON setting
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(currentJson || "[]"); } catch { return []; }
  });

  const [stage, setStage] = useState("list"); // list | adding
  const [parsed, setParsed] = useState(null);  // result from parseProgrammeExcel
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // template id pending delete

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const card    = { background:B.card,borderRadius:14,width:"100%",maxWidth:640,maxHeight:"85vh",overflow:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.25)" };
  const header  = { background:B.navy,padding:"16px 20px",borderRadius:"14px 14px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center" };
  const btnBase = { padding:"7px 16px",borderRadius:6,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none" };
  const inp     = { padding:"6px 10px",border:`1px solid ${B.border}`,borderRadius:6,fontSize:11,fontFamily:"inherit",background:B.card,color:B.text,width:"100%" };

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const result = await parseProgrammeExcel(file);
      if (!result.ok) { setError(result.error); setLoading(false); return; }
      const autoName = centreName ? `${centreName} ${result.numWeeks === 1 ? "7N" : "14N"}` : "";
      const autoDur  = parseDuration(result.rows) || (result.numWeeks === 1 ? 7 : 14);
      setName(autoName);
      setDuration(String(autoDur));
      setParsed(result);
    } catch (e) {
      setError("Could not read file: " + e.message);
    }
    setLoading(false);
  };

  const handleSave = () => {
    if (!name.trim()) { setError("Template name is required."); return; }
    if (!parsed) return;

    const newTemplate = {
      id: uid(),
      name: name.trim(),
      durationNights: parseInt(duration) || parsed.numWeeks * 7,
      createdAt: new Date().toISOString(),
      weeks: parsed.weekTemplates.map((dayMap, i) => ({ week: i + 1, days: dayMap })),
    };

    const updated = [...templates, newTemplate];
    setTemplates(updated);
    onSave(JSON.stringify(updated));
    setStage("list");
    setParsed(null); setName(""); setDuration(""); setError(null);
  };

  const handleDelete = (id) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    onSave(JSON.stringify(updated));
    setDeleteConfirm(null);
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <div style={header}>
          <div>
            <div style={{ fontSize:14,fontWeight:800,fontFamily:RW,color:"#fff" }}>Programme Templates</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:OS,marginTop:2 }}>{centreName || "This centre"}</div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:18,cursor:"pointer",lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:20 }}>
          {error && <div style={{ background:"#fee2e2",color:"#991b1b",padding:"8px 12px",borderRadius:6,fontSize:11,fontFamily:OS,marginBottom:12 }}>{error}</div>}

          {/* ── Stage: List ── */}
          {stage === "list" && (
            <>
              {templates.length === 0 ? (
                <div style={{ textAlign:"center",padding:"32px 20px",color:B.textMuted,fontFamily:OS,fontSize:12 }}>
                  No templates yet — upload one to get started.
                </div>
              ) : (
                <div style={{ marginBottom:16 }}>
                  {templates.map((t) => (
                    <div key={t.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderBottom:`1px solid ${B.border}`,fontFamily:OS }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12,fontWeight:700,color:B.text }}>{t.name}</div>
                        <div style={{ fontSize:10,color:B.textMuted,marginTop:1 }}>
                          {t.durationNights} nights · {t.weeks?.length || 1} week{(t.weeks?.length || 1) !== 1 ? "s" : ""} · Added {t.createdAt?.slice(0,10)}
                        </div>
                      </div>
                      {deleteConfirm === t.id ? (
                        <div style={{ display:"flex",gap:4,alignItems:"center",fontSize:10,fontFamily:OS }}>
                          <span style={{ color:B.red }}>Delete?</span>
                          <button style={{ ...btnBase,padding:"3px 8px",background:B.red,color:"#fff",fontSize:10 }} onClick={() => handleDelete(t.id)}>Yes</button>
                          <button style={{ ...btnBase,padding:"3px 8px",background:B.bg,color:B.text,border:`1px solid ${B.border}`,fontSize:10 }} onClick={() => setDeleteConfirm(null)}>No</button>
                        </div>
                      ) : (
                        <button style={{ background:"none",border:"none",cursor:"pointer",color:B.textMuted,fontSize:14,padding:"2px 4px" }}
                          onClick={() => setDeleteConfirm(t.id)} title="Delete template">🗑</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display:"flex",justifyContent:"flex-end" }}>
                {templates.length >= MAX_TEMPLATES ? (
                  <span style={{ fontSize:11,fontFamily:OS,color:B.textMuted }}>Maximum {MAX_TEMPLATES} templates per centre.</span>
                ) : (
                  <button style={{ ...btnBase,background:B.navy,color:"#fff" }} onClick={() => { setStage("adding"); setError(null); }}>
                    + Add Template
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Stage: Adding ── */}
          {stage === "adding" && (
            <>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:10,fontWeight:700,color:B.textMuted,textTransform:"uppercase",display:"block",marginBottom:4 }}>
                  Upload Sample Programme Excel
                </label>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }}
                  onChange={(e) => handleFile(e.target.files?.[0])} />
                <button style={{ ...btnBase,background:B.bg,color:B.text,border:`1px solid ${B.border}` }}
                  onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading ? "Reading…" : parsed ? "✓ File loaded — choose another" : "Choose Excel file"}
                </button>
                {parsed && (
                  <div style={{ fontSize:10,fontFamily:OS,color:B.success,marginTop:4 }}>
                    {parsed.numWeeks} week{parsed.numWeeks !== 1 ? "s" : ""} detected · {parsed.debug}
                  </div>
                )}
              </div>

              {parsed && (
                <>
                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:10,fontWeight:700,color:B.textMuted,textTransform:"uppercase",display:"block",marginBottom:4 }}>
                      Template Name *
                    </label>
                    <input style={inp} value={name} onChange={(e) => setName(e.target.value)}
                      placeholder='e.g. "Standard 14N" or "City Explorer 14N"' />
                  </div>
                  <div style={{ marginBottom:20 }}>
                    <label style={{ fontSize:10,fontWeight:700,color:B.textMuted,textTransform:"uppercase",display:"block",marginBottom:4 }}>
                      Duration (nights)
                    </label>
                    <input style={{ ...inp,width:80 }} type="number" min="1" max="60"
                      value={duration} onChange={(e) => setDuration(e.target.value)} />
                  </div>

                  {/* Week preview */}
                  {parsed.weekTemplates.map((wk, wi) => (
                    <div key={wi} style={{ marginBottom:12,fontSize:10,fontFamily:OS }}>
                      <div style={{ fontWeight:700,color:B.navy,marginBottom:4 }}>Week {wi + 1}</div>
                      <table style={{ borderCollapse:"collapse",width:"100%" }}>
                        <thead>
                          <tr>{Object.keys(wk).map((d) => <th key={d} style={{ padding:"2px 6px",background:B.navy,color:"#fff",fontWeight:700,fontSize:9,textAlign:"left" }}>{d.slice(0,3)}</th>)}</tr>
                        </thead>
                        <tbody>
                          {["am","pm"].map((slot) => (
                            <tr key={slot}>
                              {Object.values(wk).map((d, ci) => (
                                <td key={ci} style={{ padding:"2px 6px",fontSize:8,border:`1px solid ${B.border}`,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}
                                  title={d[slot]}>
                                  {d[slot] || <span style={{ color:B.textMuted }}>—</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </>
              )}

              <div style={{ display:"flex",gap:8,justifyContent:"flex-end",marginTop:8 }}>
                <button style={{ ...btnBase,background:B.bg,color:B.text,border:`1px solid ${B.border}` }}
                  onClick={() => { setStage("list"); setParsed(null); setError(null); }}>Cancel</button>
                <button style={{ ...btnBase,background:B.navy,color:"#fff" }}
                  onClick={handleSave} disabled={!parsed || !name.trim()}>
                  Save Template
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
