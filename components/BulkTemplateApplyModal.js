"use client";
import { useState, useMemo } from "react";
import { useB } from "@/lib/theme";
import { applyTemplateToGroup, autoMatchTemplate, selectWeeks, groupDurationNights } from "@/lib/applyProgrammeTemplate";
import { fmtDate } from "@/lib/constants";

const OS = "'Open Sans', sans-serif";
const RW = "'Raleway', sans-serif";

export default function BulkTemplateApplyModal({ groups = [], templates = [], onApply, onClose }) {
  const B = useB();
  const btnBase = { padding:"7px 16px",borderRadius:6,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none" };
  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const card    = { background:B.card,borderRadius:14,width:"100%",maxWidth:720,maxHeight:"88vh",overflow:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.25)" };

  // Per-group config: { [groupId]: { templateId: string | "SKIP" } }
  const [config, setConfig] = useState(() => {
    const init = {};
    groups.forEach((g) => {
      const best = autoMatchTemplate(g, templates);
      const hasNotes = !!(g.programmeNotes || g.notes && (() => { try { return JSON.parse(g.notes).programmeNotes; } catch { return ""; } })());
      init[g.id] = { templateId: hasNotes ? "SKIP" : (best?.id || "SKIP") };
    });
    return init;
  });

  const [stage, setStage] = useState("review"); // review | done
  const [result, setResult] = useState(null);

  const setTemplateFor = (groupId, templateId) =>
    setConfig((p) => ({ ...p, [groupId]: { templateId } }));

  const applyCount = useMemo(() =>
    Object.values(config).filter((c) => c.templateId !== "SKIP").length,
  [config]);

  const handleApply = () => {
    let allCells = {};
    let applied = 0, skipped = 0, noMatch = 0;

    groups.forEach((g) => {
      const { templateId } = config[g.id] || {};
      if (!templateId || templateId === "SKIP") { skipped++; return; }

      const tmpl = templates.find((t) => t.id === templateId);
      if (!tmpl?.weeks?.length) { noMatch++; return; }

      const nights = groupDurationNights(g);
      const weekMaps = tmpl.weeks.map((w) => w.days);
      const weeksToApply = selectWeeks(nights, weekMaps.length);
      const cells = applyTemplateToGroup(g, weekMaps, weeksToApply);
      allCells = { ...allCells, ...cells };
      applied++;
    });

    onApply(allCells);
    setResult({ applied, skipped, noMatch });
    setStage("done");
  };

  const getProgrammeNotes = (g) => {
    if (g.programmeNotes) return g.programmeNotes;
    try { return JSON.parse(g.notes || "{}").programmeNotes || ""; } catch { return ""; }
  };

  if (!templates.length) {
    return (
      <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={{ ...card,maxWidth:400,padding:32,textAlign:"center" }}>
          <div style={{ fontSize:13,fontFamily:OS,color:B.textMuted }}>
            No templates found for this centre. Upload at least one template using <strong>Manage Templates</strong> first.
          </div>
          <button style={{ ...btnBase,background:B.navy,color:"#fff",marginTop:20 }} onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        {/* Header */}
        <div style={{ background:B.navy,padding:"16px 20px",borderRadius:"14px 14px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ fontSize:14,fontWeight:800,fontFamily:RW,color:"#fff" }}>Apply Templates to Groups</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:OS,marginTop:2 }}>
              Review auto-matches, then apply. Groups with custom notes are skipped by default.
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"rgba(255,255,255,0.7)",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ padding:20 }}>
          {stage === "review" && (
            <>
              {groups.length === 0 ? (
                <div style={{ textAlign:"center",padding:32,fontFamily:OS,color:B.textMuted }}>
                  No groups at this centre yet. Import groups first.
                </div>
              ) : (
                <>
                  {groups.map((g) => {
                    const nights = groupDurationNights(g);
                    const { templateId } = config[g.id] || {};
                    const notes = getProgrammeNotes(g);
                    const chosenTmpl = templates.find((t) => t.id === templateId);
                    const weeksLabel = chosenTmpl
                      ? selectWeeks(nights, chosenTmpl.weeks?.length || 1).map((i) => `Wk${i+1}`).join("+")
                      : null;

                    return (
                      <div key={g.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${B.border}`,fontFamily:OS }}>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:11,fontWeight:700,color:B.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{g.group}</div>
                          <div style={{ fontSize:9,color:B.textMuted }}>{nights}N · {g.arr} → {g.dep}</div>
                          {notes && <div style={{ fontSize:9,color:B.warning,marginTop:1 }} title={notes}>⚠ {notes.slice(0,60)}{notes.length > 60 ? "…" : ""}</div>}
                        </div>
                        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                          {weeksLabel && templateId !== "SKIP" && (
                            <span style={{ fontSize:9,color:B.textMuted,whiteSpace:"nowrap" }}>{weeksLabel}</span>
                          )}
                          <select value={templateId || "SKIP"}
                            onChange={(e) => setTemplateFor(g.id, e.target.value)}
                            style={{ padding:"4px 6px",fontSize:10,fontFamily:"inherit",borderRadius:4,border:`1px solid ${B.border}`,background:templateId==="SKIP"?B.bg:B.card }}>
                            <option value="SKIP">— Skip —</option>
                            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ display:"flex",gap:8,justifyContent:"flex-end",marginTop:16 }}>
                    <button style={{ ...btnBase,background:B.bg,color:B.text,border:`1px solid ${B.border}` }} onClick={onClose}>Cancel</button>
                    <button style={{ ...btnBase,background:B.navy,color:"#fff" }}
                      onClick={handleApply} disabled={applyCount === 0}>
                      Apply to {applyCount} Group{applyCount !== 1 ? "s" : ""}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {stage === "done" && result && (
            <div style={{ textAlign:"center",padding:"32px 20px" }}>
              <div style={{ fontSize:28,marginBottom:10 }}>✅</div>
              <div style={{ fontSize:14,fontWeight:700,fontFamily:RW,color:B.text,marginBottom:6 }}>Templates applied</div>
              <div style={{ fontSize:11,fontFamily:OS,color:B.textMuted,marginBottom:24 }}>
                {result.applied} group{result.applied !== 1 ? "s" : ""} applied · {result.skipped} skipped · {result.noMatch > 0 ? `${result.noMatch} no template match` : ""}
              </div>
              <button style={{ ...btnBase,background:B.navy,color:"#fff" }} onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
