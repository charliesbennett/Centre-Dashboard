"use client";
import { useState, useRef } from "react";
import { useB } from "@/lib/theme";
import { parseProgrammeExcel } from "@/lib/parseProgrammeExcel";
import { applyTemplateToGroup, selectWeeks, groupDurationNights } from "@/lib/applyProgrammeTemplate";
import { dayName, genDates, dayKey } from "@/lib/constants";

const OS = "'Open Sans', sans-serif";
const RW = "'Raleway', sans-serif";

export default function GroupProgrammeImportModal({ group, onApply, onClose }) {
  const B = useB();
  const fileRef = useRef(null);
  const [stage, setStage] = useState("upload"); // upload | preview | done
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [cells, setCells]   = useState(null);  // flat cells object
  const [stats, setStats]   = useState(null);  // { populated, total, weeks }

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const card    = { background:B.card,borderRadius:14,width:"100%",maxWidth:640,maxHeight:"88vh",overflow:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.25)" };
  const btnBase = { padding:"7px 16px",borderRadius:6,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none" };

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const result = await parseProgrammeExcel(file);
      if (!result.ok) { setError(result.error); setLoading(false); return; }
      if (!result.weekTemplates?.length) {
        setError("This file doesn't look like a UKLC sample programme. Please check the file and try again.");
        setLoading(false); return;
      }

      const nights      = groupDurationNights(group);
      const weekMaps    = result.weekTemplates;
      const weeksToApply = selectWeeks(nights, weekMaps.length);
      const mapped       = applyTemplateToGroup(group, weekMaps, weeksToApply);

      // Count populated days
      const dates = group.arr && group.dep ? genDates(group.arr, group.dep) : [];
      const populated = dates.filter((d) => {
        const dk = dayKey(d);
        return mapped[`${group.id}-${dk}-AM`] || mapped[`${group.id}-${dk}-PM`];
      }).length;

      setCells(mapped);
      setStats({ populated, total: dates.length, weeks: weeksToApply.length });
      setStage("preview");
    } catch (e) {
      setError("Could not read file: " + e.message);
    }
    setLoading(false);
  };

  const handleApply = () => {
    onApply(cells);
    setStage("done");
  };

  // Build preview rows
  const previewRows = [];
  if (cells && group.arr && group.dep) {
    const dates = genDates(group.arr, group.dep);
    dates.forEach((d) => {
      const dk = dayKey(d);
      const am = cells[`${group.id}-${dk}-AM`] || "";
      const pm = cells[`${group.id}-${dk}-PM`] || "";
      previewRows.push({ dk, label: `${dayName(d)} ${d.getDate()}/${d.getMonth()+1}`, am, pm });
    });
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <div style={{ background:B.navy,padding:"16px 20px",borderRadius:"14px 14px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ fontSize:14,fontWeight:800,fontFamily:RW,color:"#fff" }}>Import Programme</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:OS,marginTop:2 }}>{group.group}</div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ padding:20 }}>
          {error && <div style={{ background:"#fee2e2",color:"#991b1b",padding:"8px 12px",borderRadius:6,fontSize:11,fontFamily:OS,marginBottom:12 }}>{error}</div>}

          {/* ── Upload ── */}
          {stage === "upload" && (
            <div style={{ textAlign:"center",padding:"32px 20px" }}>
              <div style={{ fontSize:11,fontFamily:OS,color:B.textMuted,marginBottom:20 }}>
                Upload the bespoke sample programme Excel for <strong>{group.group}</strong>.<br/>
                Dates will be mapped automatically from their arrival date ({group.arr}).
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }}
                onChange={(e) => handleFile(e.target.files?.[0])} />
              <button style={{ ...btnBase,background:B.navy,color:"#fff",padding:"10px 24px" }}
                onClick={() => fileRef.current?.click()} disabled={loading}>
                {loading ? "Reading file…" : "Choose Excel file"}
              </button>
            </div>
          )}

          {/* ── Preview ── */}
          {stage === "preview" && stats && (
            <>
              <div style={{ padding:"8px 12px",background:B.bg,borderRadius:6,fontSize:11,fontFamily:OS,marginBottom:14 }}>
                <strong>{stats.populated}</strong> of <strong>{stats.total}</strong> programme days populated from this file.
                {stats.populated < stats.total && <span style={{ color:B.warning }}> Remaining days will stay blank.</span>}
              </div>

              <div style={{ maxHeight:360,overflow:"auto",border:`1px solid ${B.border}`,borderRadius:6,marginBottom:16 }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:10,fontFamily:OS }}>
                  <thead>
                    <tr style={{ background:B.navy,color:"#fff" }}>
                      <th style={{ padding:"6px 10px",textAlign:"left",fontWeight:700,position:"sticky",top:0,background:B.navy }}>Date</th>
                      <th style={{ padding:"6px 10px",textAlign:"left",fontWeight:700,position:"sticky",top:0,background:B.navy }}>AM</th>
                      <th style={{ padding:"6px 10px",textAlign:"left",fontWeight:700,position:"sticky",top:0,background:B.navy }}>PM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.dk} style={{ borderBottom:`1px solid ${B.border}` }}>
                        <td style={{ padding:"4px 10px",color:B.textMuted,whiteSpace:"nowrap" }}>{row.label}</td>
                        <td style={{ padding:"4px 10px",color: row.am==="ARRIVAL"||row.am==="DEPARTURE"?B.red:B.text }}>{row.am || <span style={{ color:B.textMuted }}>—</span>}</td>
                        <td style={{ padding:"4px 10px",color: row.pm==="ARRIVAL"||row.pm==="DEPARTURE"?B.red:B.text }}>{row.pm || <span style={{ color:B.textMuted }}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
                <button style={{ ...btnBase,background:B.bg,color:B.text,border:`1px solid ${B.border}` }} onClick={() => setStage("upload")}>Back</button>
                <button style={{ ...btnBase,background:B.navy,color:"#fff" }} onClick={handleApply}>
                  Apply to {group.group}
                </button>
              </div>
            </>
          )}

          {/* ── Done ── */}
          {stage === "done" && (
            <div style={{ textAlign:"center",padding:"32px 20px" }}>
              <div style={{ fontSize:28,marginBottom:10 }}>✅</div>
              <div style={{ fontSize:13,fontWeight:700,fontFamily:RW,color:B.text,marginBottom:6 }}>Programme applied</div>
              <div style={{ fontSize:11,fontFamily:OS,color:B.textMuted,marginBottom:20 }}>
                The programme grid for <strong>{group.group}</strong> has been updated. Review and edit individual cells in the grid as needed.
              </div>
              <button style={{ ...btnBase,background:B.navy,color:"#fff" }} onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
