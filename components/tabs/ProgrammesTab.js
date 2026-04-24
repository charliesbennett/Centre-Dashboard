"use client";
import { useState, useMemo } from "react";
import { ACTIVITY_TYPES, LONDON_CENTRES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { useB } from "@/lib/theme";
import { Fld, TableWrap, IcWand, thStyle, tdStyle, btnPrimary, inputStyle } from "@/components/ui";
import { getProgrammesForCentre } from "@/lib/programmeData";
import ProgrammeTemplateModal from "@/components/ProgrammeTemplateModal";
import MasterImportModal from "@/components/MasterImportModal";
import ProgrammeTemplateLibraryModal from "@/components/ProgrammeTemplateLibraryModal";
import BulkTemplateApplyModal from "@/components/BulkTemplateApplyModal";
import GroupProgrammeImportModal from "@/components/GroupProgrammeImportModal";
import GroupsBulkImportModal from "@/components/GroupsBulkImportModal";

// Which lesson slot does this group have on this date?
function getGroupLessonSlot(g, ds) {
  if (!g.arr || !g.lessonSlot) return g.lessonSlot || "AM";
  const arrDate = new Date(g.arr);
  const curDate = new Date(ds);
  const daysSince = Math.floor((curDate - arrDate) / 86400000);
  const weekNum = Math.floor(daysSince / 7);
  return weekNum % 2 === 0 ? g.lessonSlot : (g.lessonSlot === "AM" ? "PM" : "AM");
}

export default function ProgrammesTab({ groups, progStart, progEnd, centre, excDays, setExcDays, excursions = [], progGrid, setProgGrid, settings, saveSetting, readOnly = false, isHeadOffice = false, centres = [] }) {
  const B = useB();
  const dates = useMemo(() => genDates(progStart, progEnd), [progStart, progEnd]);
  const isLondon = LONDON_CENTRES.includes(centre);
  const isMinistay = /mini[\s-]?stay/i.test(centre || "");
  // Look up excursion destination for a date string ("Full Exc" / "Half Exc" fallback)
  const excDest = (dateStr, type) => {
    const dest = excursions.find(e => e.date === dateStr)?.destination;
    return dest || (type === "Full" ? "Full Exc" : "Half Exc");
  };
  const slots = ["AM", "PM", "Eve"];
  const [viewMode, setViewMode] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const grid = progGrid || {};
  const setGrid = setProgGrid || (() => {});
  const centreProgs = useMemo(() => getProgrammesForCentre(centre), [centre]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const activeTemplate = selectedTemplate !== null ? centreProgs[selectedTemplate] : null;

  // Per-group templates stored in settings.group_templates as { [groupId]: config }
  // config: { type: "builtin", templateIndex: number } | { type: "custom", template: object }
  const groupTemplates = useMemo(() => {
    try { return JSON.parse(settings?.group_templates || "{}"); } catch { return {}; }
  }, [settings?.group_templates]);
  const saveGroupTemplate = (groupId, config) => {
    const updated = { ...groupTemplates };
    if (config === null) delete updated[groupId]; else updated[groupId] = config;
    if (saveSetting) saveSetting("group_templates", JSON.stringify(updated));
  };
  const [groupTemplateTarget, setGroupTemplateTarget] = useState(null); // groupId being edited

  // Normalise template to {weeks:[...]} format
  const normaliseTmpl = (t) => t?.weeks ? t
    : { weeks: [{ week: 1, days: Object.entries(t || {}).map(([day, v]) => ({ day, ...v })) }] };

  // Write a template into ng for the given groups.
  // - Arrival day → PM = ARRIVAL, AM blank
  // - Departure day → AM = DEPARTURE, PM blank
  // - All other in-range days: template data, skipping any "depart"/"arriv" placeholder values
  //   from the template (so DEPARTURE baked into week 2 Sunday never stamps mid-stay groups)
  // - weekIdx relative to each group's arrival; swaps AM/PM when group's lesson slot differs
  // Generic placeholder values — treated as "empty" so re-running auto-populate replaces them
  const isPlaceholder = (v) => !v || /^(full.?day excursion|half.?day excursion|full exc|half exc|evening activity|departure|arrival)$/i.test(v.trim());

  const applyTmplInto = (tmpl, targetGroups, ng, skipExisting = false) => {
    if (!tmpl?.weeks?.length) return;
    const weekMaps = tmpl.weeks.map(wk => { const m = {}; wk.days.forEach(d => { m[d.day] = d; }); return m; });
    const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    // skipExisting: preserve real custom values but overwrite generic placeholders
    const set = (key, val) => { if (val && (!skipExisting || isPlaceholder(ng[key]))) ng[key] = val; };
    const isTeachingSlot = (v) => /lesson|english test|placement test/i.test(v || "");
    targetGroups.forEach(g => {
      const arrDs = g.arr ? String(g.arr).slice(0, 10) : null;
      const depDs = g.dep ? String(g.dep).slice(0, 10) : null;
      const gArrMs = arrDs ? new Date(arrDs + "T12:00:00").getTime() : (dates[0]?.getTime() || 0);
      dates.forEach(d => {
        const s = dayKey(d);
        if (!inRange(s, g.arr, g.dep)) return;
        if (arrDs && s === arrDs) { set(g.id+"-"+s+"-PM", "ARRIVAL"); set(g.id+"-"+s+"-Eve", "Evening Activity"); return; }
        if (depDs && s === depDs) { set(g.id+"-"+s+"-AM", "DEPARTURE"); return; }
        const daysSince = Math.floor((d.getTime() - gArrMs) / 86400000);
        const weekIdx = Math.floor(daysSince / 7) % weekMaps.length;
        const dayData = weekMaps[weekIdx]?.[DOW[d.getDay()]];
        set(g.id+"-"+s+"-Eve", "Evening Activity");
        if (!dayData) return;
        const tmplSlot = isTeachingSlot(dayData.am) ? "AM" : isTeachingSlot(dayData.pm) ? "PM" : null;
        const grpSlot = getGroupLessonSlot(g, s);
        const swap = tmplSlot && grpSlot !== tmplSlot;
        let amV = (swap ? dayData.pm : dayData.am) || "";
        let pmV = (swap ? dayData.am : dayData.pm) || "";
        // If one slot has a non-lesson value and the other is empty, mirror it (full-day excursion)
        if (amV && !pmV && !isTeachingSlot(amV)) pmV = amV;
        if (pmV && !amV && !isTeachingSlot(pmV)) amV = pmV;
        if (!/depart|arriv/i.test(amV)) set(g.id+"-"+s+"-AM", amV);
        if (!/depart|arriv/i.test(pmV)) set(g.id+"-"+s+"-PM", pmV);
      });
    });
  };

  // Default logic (no template) for a single group into ng
  const defaultPopGroup = (g, ng, skipExisting = false) => {
    const set = (key, val) => { if (val && (!skipExisting || isPlaceholder(ng[key]))) ng[key] = val; };
    dates.forEach(d => {
      const s = dayKey(d), day = d.getDay(), we = isWeekend(d);
      if (!inRange(s, g.arr, g.dep)) return;
      if (g.arr && s === dayKey(new Date(g.arr))) { set(g.id+"-"+s+"-PM", "ARRIVAL"); set(g.id+"-"+s+"-Eve", "Evening Activity"); return; }
      if (g.dep && s === dayKey(new Date(g.dep))) { set(g.id+"-"+s+"-AM", "DEPARTURE"); return; }
      if (excDays[s] === "Full") { const d2 = excDest(s, "Full"); set(g.id+"-"+s+"-AM", d2); set(g.id+"-"+s+"-PM", d2); set(g.id+"-"+s+"-Eve", "Evening Activity"); return; }
      if (we) { const d2 = excDest(s, "Full"); set(g.id+"-"+s+"-AM", d2); set(g.id+"-"+s+"-PM", d2); set(g.id+"-"+s+"-Eve", "Evening Activity"); return; }
      const ls = getGroupLessonSlot(g, s);
      const spec = g.prog === "Multi-Activity" ? "Multi-Activity" : g.prog === "Intensive English" ? "English+" : g.prog === "Performing Arts" ? "Perf Arts" : g.prog || "Multi-Activity";
      if (excDays[s] === "Half") {
        const d2 = excDest(s, "Half");
        if (ls === "AM") { set(g.id+"-"+s+"-AM", "Lessons"); set(g.id+"-"+s+"-PM", d2); }
        else { set(g.id+"-"+s+"-AM", d2); set(g.id+"-"+s+"-PM", "Lessons"); }
        set(g.id+"-"+s+"-Eve", "Evening Activity"); return;
      }
      if (isLondon && (day === 1 || day === 3 || day === 5)) {
        const d2 = excDest(s, "Half");
        if (ls === "AM") { set(g.id+"-"+s+"-AM", "Lessons"); set(g.id+"-"+s+"-PM", d2); }
        else { set(g.id+"-"+s+"-AM", d2); set(g.id+"-"+s+"-PM", "Lessons"); }
      } else {
        if (ls === "AM") { set(g.id+"-"+s+"-AM", "Lessons"); set(g.id+"-"+s+"-PM", spec); }
        else { set(g.id+"-"+s+"-AM", spec); set(g.id+"-"+s+"-PM", "Lessons"); }
      }
      set(g.id+"-"+s+"-Eve", "Evening Activity");
    });
  };

  // Explicit "Apply to all/specific group" from template view or by-group toolbar
  const autoPopFromTemplate = (tmpl, targetGroup = null) => {
    const targetGroups = targetGroup ? [targetGroup] : groups;
    const ng = { ...grid }; // always start from existing — never wipe
    applyTmplInto(normaliseTmpl(tmpl), targetGroups, ng, true);
    setGrid(ng);
  };

  const applyCustomTemplate = (tmplObjOrWeeks, targetGroup = null) => {
    autoPopFromTemplate(normaliseTmpl(tmplObjOrWeeks), targetGroup);
  };

  const applyGroupTemplate = (g) => {
    const config = groupTemplates[g.id];
    if (!config) return;
    if (config.type === "builtin") {
      const tmpl = centreProgs[config.templateIndex];
      if (tmpl) autoPopFromTemplate(tmpl, g);
    } else if (config.type === "custom" && config.template) {
      autoPopFromTemplate(normaliseTmpl(config.template), g);
    }
  };

  // Auto-Populate: fills empty cells only by default (skipExisting=true).
  // Pass skipExisting=false to overwrite everything (used by "Reset & Fill" if ever needed).
  const autoPop = (skipExisting = true) => {
    if (isMinistay) {
      let template = null;
      if (settings?.ministay_template) { try { template = JSON.parse(settings.ministay_template); } catch {} }
      if (!template) { setShowTemplateModal(true); return; }
      const isRelative = Object.keys(template).some((k) => /^\d+$/.test(k));
      // Start from existing grid so populated cells are preserved
      const ng = skipExisting ? { ...grid } : {};
      const newExcDays = skipExisting ? { ...excDays } : {};
      const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      groups.forEach((g) => {
        const arrTime = g.arr ? new Date(g.arr + "T00:00:00").getTime() : null;
        dates.forEach((d) => {
          const s = dayKey(d);
          if (!inRange(s, g.arr, g.dep)) return;
          if (g.arr && s === dayKey(new Date(g.arr))) {
            if (!skipExisting || !ng[g.id+"-"+s+"-PM"]) ng[g.id+"-"+s+"-PM"] = "ARRIVAL";
            return;
          }
          if (g.dep && s === dayKey(new Date(g.dep))) {
            if (!skipExisting || !ng[g.id+"-"+s+"-AM"]) ng[g.id+"-"+s+"-AM"] = "DEPARTURE";
            return;
          }
          const dayNum = isRelative && arrTime ? Math.round((d.getTime() - arrTime) / 86400000) + 1 : null;
          const day = dayNum ? template[String(dayNum)] : template[DOW[d.getDay()]];
          if (day) {
            if (day.am  && (!skipExisting || !ng[g.id+"-"+s+"-AM"]))  ng[g.id+"-"+s+"-AM"]  = day.am;
            if (day.pm  && (!skipExisting || !ng[g.id+"-"+s+"-PM"]))  ng[g.id+"-"+s+"-PM"]  = day.pm;
            if (day.eve && (!skipExisting || !ng[g.id+"-"+s+"-Eve"])) ng[g.id+"-"+s+"-Eve"] = day.eve;
            if (day.exc === "Full") newExcDays[s] = "Full";
            else if (day.exc === "Half" && !newExcDays[s]) newExcDays[s] = "Half";
          }
        });
      });
      setExcDays(newExcDays);
      setGrid(ng);
      return;
    }
    // Non-ministay: start from existing grid, only fill empty cells
    let defaultTmpl = null;
    if (settings?.programme_template) { try { defaultTmpl = normaliseTmpl(JSON.parse(settings.programme_template)); } catch {} }
    const ng = skipExisting ? { ...grid } : {};
    // Pick the best-matching centre template for a group by stay length
    const bestCentreTmpl = (g) => {
      if (!centreProgs.length) return null;
      if (centreProgs.length === 1) return centreProgs[0];
      const stayNights = (g.arr && g.dep)
        ? Math.round((new Date(g.dep) - new Date(g.arr)) / 86400000)
        : null;
      if (stayNights === null) return centreProgs[0];
      return centreProgs.reduce((best, t) => {
        const tLen = typeof t.length === "number" ? t.length : parseInt(t.length) || 0;
        const bLen = typeof best.length === "number" ? best.length : parseInt(best.length) || 0;
        return Math.abs(tLen - stayNights) < Math.abs(bLen - stayNights) ? t : best;
      });
    };
    groups.forEach((g) => {
      const config = groupTemplates[g.id];
      if (config?.type === "builtin") {
        const tmpl = centreProgs[config.templateIndex];
        if (tmpl) { applyTmplInto(normaliseTmpl(tmpl), [g], ng, skipExisting); return; }
      } else if (config?.type === "custom" && config.template) {
        applyTmplInto(normaliseTmpl(config.template), [g], ng, skipExisting); return;
      }
      const centreTmpl = bestCentreTmpl(g);
      if (centreTmpl) { applyTmplInto(normaliseTmpl(centreTmpl), [g], ng, skipExisting); }
      else if (defaultTmpl) { applyTmplInto(defaultTmpl, [g], ng, skipExisting); }
      else { defaultPopGroup(g, ng, skipExisting); }
    });
    // Ensure Evening Activity for all on-site days (not departure) — fill empty or placeholders
    groups.forEach(g => {
      dates.forEach(d => {
        const s = dayKey(d);
        if (!inRange(s, g.arr, g.dep) || s === g.dep) return;
        if (isPlaceholder(ng[g.id+"-"+s+"-Eve"])) ng[g.id+"-"+s+"-Eve"] = "Evening Activity";
      });
    });
    setGrid(ng);
  };

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showBulkApply, setShowBulkApply] = useState(false);
  const [showGroupsImport, setShowGroupsImport] = useState(false);
  const [groupImportTarget, setGroupImportTarget] = useState(null); // group being imported

  // Named template library stored as "programme_templates" in settings (JSON array)
  const namedTemplates = useMemo(() => {
    try { return JSON.parse(settings?.programme_templates || "[]"); } catch { return []; }
  }, [settings?.programme_templates]);

  const handleMasterImport = (payload) => {
    const ng = { ...grid };
    payload.forEach(({ excelGroup, dashboardGroupId, updateMeta }) => {
      if (!dashboardGroupId) return;
      const dashGroup = groups.find((g) => g.id === dashboardGroupId);
      if (!dashGroup) return;
      const effectiveArr = (updateMeta && excelGroup.arr) ? excelGroup.arr : dashGroup.arr;
      const effectiveDep = (updateMeta && excelGroup.dep) ? excelGroup.dep : dashGroup.dep;
      Object.entries(excelGroup.cells).forEach(([slotKey, value]) => {
        // slotKey = "2025-07-04-AM" — split on last hyphen-segment for slot
        const parts = slotKey.split("-");
        const slot = parts.pop();                    // "AM" or "PM"
        const dateStr = parts.join("-");             // "2025-07-04"
        if (!inRange(dateStr, effectiveArr, effectiveDep)) return;
        ng[`${dashboardGroupId}-${dateStr}-${slot}`] = value;
      });
    });
    setGrid(ng);
  };
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [quickPickCell, setQuickPickCell] = useState(null); const [qpPos, setQpPos] = useState({top:0,left:0});
  const startEdit = (key, val) => { setQuickPickCell(null); setEditingCell(key); setEditValue(val || ""); };
  const commitEdit = () => { if (editingCell) { setGrid(p => ({...p, [editingCell]: editValue || undefined})); setEditingCell(null); } };
  const toggleExc = (dStr) => { setExcDays(p => { const c = p[dStr]; if (!c) return {...p,[dStr]:"Full"}; if (c==="Full") return {...p,[dStr]:"Half"}; const n={...p}; delete n[dStr]; return n; }); };
  const quickPick = (key, val) => { setGrid(p => ({...p, [key]: val})); setQuickPickCell(null); };
  const handleCellClick = (key, sl, on, e) => {
    if (readOnly || !on) return; const rect = e.currentTarget.getBoundingClientRect(); setQpPos({top: rect.bottom, left: rect.left});
    if (editingCell === key) return;
    setQuickPickCell(quickPickCell === key ? null : key);
  };
  const QUICK_AM_PM = ["English Lessons", "English Test", "Orientation Tour", "Sports & Games", "Arts & Crafts", "Paparazzi Challenge", "Half Day Excursion", "Full Day Excursion", "ARRIVAL", "DEPARTURE"];
  const QUICK_EVE = ["Evening Activity", "EE", "Welcome Talk", "Speed Dating", "Paparazzi", "Trashion Show", "Movie Night", "Quiz Night", "Disco", "Drop the Egg", "Attractions"];

  const classify = (text) => {
    if (!text) return { color: B.textLight, bg: "transparent" };
    const t = text.toLowerCase();
    if (t.includes("arrival")) return { color: B.success, bg: B.ice };
    if (t.includes("depart")) return { color: B.danger, bg: B.pink };
    if (t.includes("english test")) return { color: B.cyan, bg: B.ice };
    if (t.includes("lesson")) return { color: B.link, bg: B.ice };
    if (t.includes("multi-activity") || t.includes("chosen programme")) return { color: B.purple, bg: B.ice };
    if (t.includes("activity")) return { color: B.purple, bg: B.ice };
    if (t.includes("free time") || t.includes("optional")) return { color: B.textMuted, bg: B.bg };
    if (t.includes("orientation") || t.includes("welcome")) return { color: B.success, bg: B.ice };
    if (t.includes("exc")) return { color: B.red, bg: B.pink };
    if (t.includes("ee") || t.includes("evening") || t.includes("disco") || t.includes("quiz") || t.includes("movie") || t.includes("trashion") || t.includes("speed dating") || (t.includes("paparazzi") && t.length < 20)) return { color: B.purple, bg: B.ice };
    if (t.includes("sports") || t.includes("games")) return { color: B.success, bg: B.ice };
    return { color: B.link, bg: B.ice };
  };

  const selGroup = groups.find(g => g.id === selectedGroupId);

  return (<div>
    {showTemplateModal && (
      <ProgrammeTemplateModal
        mode={isMinistay ? "ministay" : "summer"}
        currentJson={isMinistay ? (settings?.ministay_template || null) : (settings?.programme_template || null)}
        onSave={(json) => { if (saveSetting) saveSetting(isMinistay ? "ministay_template" : "programme_template", json); setShowTemplateModal(false); }}
        onClose={() => setShowTemplateModal(false)}
      />
    )}
    {showMasterModal && (
      <MasterImportModal
        groups={groups}
        progGrid={grid}
        onClose={() => setShowMasterModal(false)}
        onImport={(payload) => { handleMasterImport(payload); setShowMasterModal(false); }}
      />
    )}
    {showTemplateLibrary && (
      <ProgrammeTemplateLibraryModal
        currentJson={settings?.programme_templates || "[]"}
        centreName={centre}
        onSave={(json) => { if (saveSetting) saveSetting("programme_templates", json); }}
        onClose={() => setShowTemplateLibrary(false)}
      />
    )}
    {showBulkApply && (
      <BulkTemplateApplyModal
        groups={groups}
        templates={namedTemplates}
        onApply={(cells) => { setGrid((p) => ({ ...p, ...cells })); setShowBulkApply(false); }}
        onClose={() => setShowBulkApply(false)}
      />
    )}
    {showGroupsImport && (
      <GroupsBulkImportModal
        centres={centres}
        onClose={() => setShowGroupsImport(false)}
        onImported={() => window.location.reload()}
      />
    )}
    {groupImportTarget && (
      <GroupProgrammeImportModal
        group={groupImportTarget}
        onApply={(cells) => { setGrid((p) => ({ ...p, ...cells })); setGroupImportTarget(null); }}
        onClose={() => setGroupImportTarget(null)}
      />
    )}
    {groupTemplateTarget && (
      <ProgrammeTemplateModal
        mode={isMinistay ? "ministay" : "summer"}
        currentJson={groupTemplates[groupTemplateTarget]?.type === "custom" ? JSON.stringify(groupTemplates[groupTemplateTarget].template) : null}
        onSave={(json) => { try { saveGroupTemplate(groupTemplateTarget, { type: "custom", template: JSON.parse(json) }); } catch {} setGroupTemplateTarget(null); }}
        onClose={() => setGroupTemplateTarget(null)}
      />
    )}
    <div style={{background:B.navy,borderBottom:"1px solid "+B.border,padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.85)"}}>{dates.length} days {"\u00b7"} {groups.length} groups</span>
        {isLondon && <span style={{background:"#e6eef3",color:B.navy,padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:700}}>London</span>}
        {isMinistay && <span style={{background:"#f0f279",color:B.navy,padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:700}}>Ministay</span>}
      </div>
      <div style={{display:"flex",gap:4}}>
        {["all","group"].map(m=><button key={m} onClick={()=>setViewMode(m)} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"1px solid "+(viewMode===m?"transparent":"rgba(255,255,255,0.3)"),background:viewMode===m?"#e6eef3":"transparent",color:viewMode===m?B.navy:"rgba(255,255,255,0.8)"}}>
          {m==="all"?"\ud83d\udc65 All Groups":"\ud83d\udc64 By Group"}</button>)}
        {/* Set Up Template kept for ministay only — non-ministay uses named template library */}
        {!readOnly && isMinistay && <button onClick={()=>setShowTemplateModal(true)} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none",background:settings?.ministay_template?"#e6eef3":"rgba(255,255,255,0.15)",color:settings?.ministay_template?B.navy:"rgba(255,255,255,0.6)",marginLeft:4}}>
          {"\ud83d\udcc4"} {settings?.ministay_template ? "Edit Template" : "Set Up Template"}</button>}
        {isHeadOffice && <button onClick={() => setShowGroupsImport(true)} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none",background:"#dbeafe",color:B.navy,marginLeft:4}}>
          ⬆ Import Groups</button>}
        {isHeadOffice && <button onClick={() => setShowTemplateLibrary(true)} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none",background:"#ede9fe",color:B.navy,marginLeft:4}}>
          📁 Templates {namedTemplates.length > 0 ? `(${namedTemplates.length})` : ""}</button>}
        {isHeadOffice && namedTemplates.length > 0 && groups.length > 0 && <button onClick={() => setShowBulkApply(true)} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none",background:"#dcfce7",color:B.navy,marginLeft:4}}>
          ⚡ Apply Templates</button>}
        {!readOnly && <button onClick={() => autoPop(true)}
          style={{...btnPrimary,background:B.red,border:"none",marginLeft:4}}
          title="Fills empty cells only — existing programme data is kept">
          <IcWand/> Auto-Populate</button>}
      </div>
    </div>

    {/* Lesson slot summary + custom template status */}
    {groups.length > 0 && !isMinistay && (
      <div style={{padding:"6px 20px",background:B.cyanBg,borderBottom:"1px solid "+B.border,fontSize:10,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontWeight:700,color:B.cyan}}>{"\ud83d\udcda"} Lesson slots:</span>
        {groups.map(g => <span key={g.id}><strong>{g.group}</strong>: Wk1 {g.lessonSlot || "AM"} / Wk2 {(g.lessonSlot||"AM")==="AM"?"PM":"AM"}</span>)}
        <span style={{color:"#64748b"}}>{"\u00b7"} Toggle in Students tab</span>
        {namedTemplates.length > 0
          ? <span style={{color:"#16a34a",fontWeight:600,marginLeft:8}}>{"\u2713"} {namedTemplates.length} template{namedTemplates.length!==1?"s":""} ready {"\u00b7"} Use <strong>Apply Templates</strong> to populate groups</span>
          : <span style={{color:"#92400e",fontWeight:600,marginLeft:8}}>No templates yet {"\u00b7"} Use <strong>Templates</strong> to upload a programme Excel</span>}
      </div>
    )}
    {groups.length > 0 && isMinistay && (
      <div style={{padding:"6px 20px",background:B.warningBg,borderBottom:"1px solid "+B.border,fontSize:10,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontWeight:700,color:B.warning}}>{"\ud83d\udcc5"} Ministay programme:</span>
        {settings?.ministay_template
          ? <span style={{color:"#16a34a",fontWeight:600}}>{"\u2713"} Template saved {"\u00b7"} Click Auto-Populate to apply</span>
          : <span style={{color:"#92400e"}}>No template yet {"\u00b7"} Click <strong>Set Up Template</strong> to define the weekly programme, then Auto-Populate</span>}
      </div>
    )}

    {viewMode==="all" && <div style={{padding:"0 4px 16px",overflowX:"auto"}}>
      <TableWrap><table style={{minWidth:1200,width:"100%",borderCollapse:"collapse",fontSize:10}}>
        <thead>
          <tr>
            <th style={{...thStyle,width:100,maxWidth:100,overflow:"hidden",whiteSpace:"nowrap",position:"sticky",left:0,zIndex:2,background:B.bg,color:B.textMuted,backgroundImage:"none"}}>Agent</th>
            <th style={{...thStyle,width:90,maxWidth:90,overflow:"hidden",whiteSpace:"nowrap",position:"sticky",left:100,zIndex:2,background:B.bg,color:B.textMuted,backgroundImage:"none"}}>Group</th>
            <th style={{...thStyle,width:44,textAlign:"center"}}>Pax</th>
            <th style={{...thStyle,width:44,textAlign:"center",fontSize:8}}>Wk1</th>
            {dates.map(d=>{const s=dayKey(d),exc=excDays[s],we=isWeekend(d);return<th key={s} colSpan={slots.length} onClick={()=>toggleExc(s)} style={{...thStyle,textAlign:"center",borderLeft:"2px solid "+B.border,padding:"3px 2px",minWidth:192,cursor:"pointer",background:exc?B.pink:we?B.dangerBg:B.ice}}>
              <div style={{fontSize:7,color:B.textMuted}}>{fmtDate(d)}</div>
              <div style={{fontWeight:800,fontSize:9,color:we?B.red:B.text}}>{dayName(d)}</div>
              {exc&&<div style={{fontSize:6,color:B.red,fontWeight:800}}>{exc==="Full"?"FD EXC":"HD EXC"}</div>}
            </th>;})}
          </tr>
          <tr>
            <th style={{...thStyle,position:"sticky",left:0,zIndex:2,background:B.bg,backgroundImage:"none"}}></th>
            <th style={{...thStyle,position:"sticky",left:100,zIndex:2,background:B.bg,backgroundImage:"none"}}></th>
            <th style={thStyle}></th>
            <th style={thStyle}></th>
            {dates.map(d=>slots.map(sl=><th key={dayKey(d)+"-"+sl} style={{...thStyle,textAlign:"center",fontSize:8,padding:"3px 1px",borderLeft:sl==="AM"?"2px solid "+B.border:"1px solid "+B.borderLight,minWidth:isMinistay?64:64}}>{sl}</th>))}
          </tr>
        </thead>
        <tbody>
          {groups.length===0?<tr><td colSpan={100} style={{textAlign:"center",padding:36,color:B.textLight}}>Import groups in Students tab</td></tr>:
          groups.map(g=><tr key={g.id} style={{borderBottom:"1px solid "+B.borderLight}}>
            <td style={{...tdStyle,fontWeight:600,fontSize:9,position:"sticky",left:0,background:B.card,zIndex:1,maxWidth:100,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{g.agent}</td>
            <td style={{...tdStyle,fontWeight:700,color:B.text,fontSize:10,position:"sticky",left:100,background:B.card,zIndex:1,maxWidth:90,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{g.group}</td>
            <td style={{...tdStyle,fontWeight:800,textAlign:"center",fontSize:10}}>{(g.stu||0)+(g.gl||0)}</td>
            <td style={{...tdStyle,textAlign:"center"}}><span style={{background:g.lessonSlot==="PM"?B.pink:B.ice,color:g.lessonSlot==="PM"?B.red:B.link,padding:"2px 6px",borderRadius:3,fontSize:8,fontWeight:800}}>{g.lessonSlot||"AM"}</span></td>
            {dates.map(d=>slots.map(sl=>{const s=dayKey(d),key=g.id+"-"+s+"-"+sl,val=grid[key],on=inRange(s,g.arr,g.dep),cls=classify(val),isEd=editingCell===key,isQP=quickPickCell===key;
              return<td key={key} onClick={(e)=>handleCellClick(key,sl,on,e)} onDoubleClick={()=>!readOnly&&on&&startEdit(key,val)} style={{padding:"2px 3px",borderLeft:sl==="AM"?"2px solid "+B.border:"1px solid "+B.borderLight,verticalAlign:"middle",minWidth:64,maxWidth:100,background:!on?B.bg:cls.bg,cursor:on?"pointer":"default",position:"relative"}}>
                {isEd?<input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>e.key==="Enter"&&commitEdit()} style={{width:"100%",fontSize:9,padding:"3px",border:"1px solid "+B.border,borderRadius:2,fontFamily:"inherit",background:B.card,color:B.text}}/>:
                val?<div style={{color:cls.color,fontSize:9,fontWeight:600,padding:"3px 4px",borderRadius:2,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:96}} title={val}>{val}</div>:
                on?<div style={{height:18}}/>:<div style={{height:18}}/>}
                {isQP&&<div style={{position:"fixed",top:qpPos.top,left:qpPos.left,zIndex:9999,background:B.card,border:"1px solid "+B.border,borderRadius:6,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",padding:"4px 0",minWidth:140,maxHeight:200,overflowY:"auto"}}>
                  {(sl==="EVE"?QUICK_EVE:QUICK_AM_PM).map(opt=><div key={opt} onClick={(e)=>{e.stopPropagation();quickPick(key,opt);}} style={{padding:"4px 10px",fontSize:9,fontWeight:600,cursor:"pointer",color:classify(opt).color,whiteSpace:"nowrap"}} onMouseEnter={e=>e.target.style.background=B.ice} onMouseLeave={e=>e.target.style.background="transparent"}>{opt}</div>)}
                  <div style={{borderTop:"1px solid "+B.border,marginTop:2,paddingTop:2}}>
                    <div onClick={(e)=>{e.stopPropagation();quickPick(key,undefined);}} style={{padding:"4px 10px",fontSize:9,fontWeight:600,cursor:"pointer",color:B.textMuted}} onMouseEnter={e=>e.target.style.background=B.ice} onMouseLeave={e=>e.target.style.background="transparent"}>{"\u2717"} Clear</div>
                    <div onClick={(e)=>{e.stopPropagation();setQuickPickCell(null);startEdit(key,val);}} style={{padding:"4px 10px",fontSize:9,fontWeight:600,cursor:"pointer",color:B.text}} onMouseEnter={e=>e.target.style.background=B.ice} onMouseLeave={e=>e.target.style.background="transparent"}>{"\u270f\ufe0f"} Custom text...</div>
                  </div>
                </div>}
              </td>;}))}
          </tr>)}
        </tbody>
        {!isMinistay && (() => {
          const split = {};
          dates.forEach(d => {
            const ds = dayKey(d);
            let am = 0, pm = 0;
            groups.forEach(g => {
              if (!inRange(ds, g.arr, g.dep) || ds === g.arr || ds === g.dep) return;
              const slot = getGroupLessonSlot(g, ds);
              const pax = (g.stu || 0) + (g.gl || 0);
              if (slot === "AM") am += pax; else pm += pax;
            });
            split[ds] = { am, pm };
          });
          const hasAny = dates.some(d => { const s = split[dayKey(d)]; return s && (s.am > 0 || s.pm > 0); });
          if (!hasAny) return null;
          return <tfoot>{["AM","PM"].map(slot => (
            <tr key={slot} style={{borderTop: slot === "AM" ? "2px solid " + B.navy : "none"}}>
              <td colSpan={4} style={{...tdStyle, position:"sticky", left:0, zIndex:1, background: slot==="AM"?B.cyanBg:B.successBg, fontWeight:800, fontSize:9, color: slot==="AM"?B.link:B.success, padding:"4px 8px", textAlign:"right", minWidth:250}}>{slot} Lessons</td>
              {dates.map(d => {
                const ds = dayKey(d); const we = isWeekend(d); const val = split[ds]?.[slot.toLowerCase()] || 0;
                return <td key={ds} colSpan={slots.length} style={{textAlign:"center", padding:"4px 2px", borderLeft:"2px solid "+B.border, background: we?B.dangerBg:slot==="AM"?B.cyanBg:B.successBg}}>
                  {val > 0 ? <span style={{fontWeight:800, color: slot==="AM"?B.link:B.success, fontSize:10}}>{val}</span>
                    : <span style={{color:B.textLight, fontSize:9}}>—</span>}
                </td>;
              })}
            </tr>
          ))}</tfoot>;
        })()}
      </table></TableWrap>
      <div style={{padding:"6px 12px",fontSize:9,color:B.textMuted}}>{isMinistay ? "Click cell for quick-pick \u00b7 Double-click for custom text \u00b7 Click date headers for exc days" : "Double-click to edit \u00b7 Click date headers for exc days \u00b7 Lessons follow Wk1 slot, flip each week"}</div>
    </div>}

    {viewMode==="group" && <div>
      <div style={{padding:"10px 20px",background:B.card,borderBottom:"1px solid "+B.border,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:10,fontWeight:700,color:B.textMuted}}>Select group:</span>
        {groups.map(g=><button key={g.id} onClick={()=>setSelectedGroupId(g.id)} style={{padding:"4px 10px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:selectedGroupId===g.id?"2px solid "+B.navy:"1px solid "+B.border,background:selectedGroupId===g.id?B.navy:B.white,color:selectedGroupId===g.id?B.white:B.navy}}>
          {g.group} <span style={{opacity:0.6}}>({(g.stu||0)+(g.gl||0)})</span></button>)}
      </div>
      {selGroup && <div style={{padding:"0 8px 16px",overflowX:"auto"}}>
        <div style={{padding:"8px 12px",display:"flex",gap:16,fontSize:10,color:B.textMuted,flexWrap:"wrap",alignItems:"center"}}>
          <span><strong style={{color:B.text}}>Agent:</strong> {selGroup.agent}</span>
          <span><strong style={{color:B.text}}>Pax:</strong> {(selGroup.stu||0)+(selGroup.gl||0)}</span>
          <span><strong style={{color:B.text}}>Wk1 Lessons:</strong> {selGroup.lessonSlot||"AM"}</span>
          <span><strong style={{color:B.text}}>Arr:</strong> {fmtDate(selGroup.arr)}</span>
          <span><strong style={{color:B.text}}>Dep:</strong> {fmtDate(selGroup.dep)}</span>
        </div>
        {/* Per-group template toolbar */}
        {!readOnly && <div style={{padding:"6px 12px 8px",background:B.bg,borderBottom:"1px solid "+B.border,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:9,fontWeight:800,color:B.textMuted,textTransform:"uppercase",letterSpacing:0.5}}>Template:</span>
          {centreProgs.map((p,i)=>{const sel=groupTemplates[selGroup.id]?.type==="builtin"&&groupTemplates[selGroup.id]?.templateIndex===i;return<button key={i} onClick={()=>saveGroupTemplate(selGroup.id,{type:"builtin",templateIndex:i})} style={{padding:"3px 10px",borderRadius:4,fontSize:9,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:sel?"2px solid "+B.navy:"1px solid "+B.border,background:sel?B.navy:B.card,color:sel?B.white:B.text}}>{p.nights||p.length}</button>;})}
          {(()=>{const isCustom=groupTemplates[selGroup.id]?.type==="custom";return<button onClick={()=>setGroupTemplateTarget(selGroup.id)} style={{padding:"3px 10px",borderRadius:4,fontSize:9,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:isCustom?"2px solid "+B.purple:"1px solid "+B.border,background:isCustom?B.purple:B.card,color:isCustom?B.white:B.textMuted}}>{isCustom?"\u270f\ufe0f Edit Custom":"\u2795 Custom Template"}</button>;})()}
          {groupTemplates[selGroup.id] && <button onClick={()=>saveGroupTemplate(selGroup.id,null)} style={{padding:"3px 8px",borderRadius:4,fontSize:9,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"1px solid "+B.border,background:B.card,color:B.textMuted}}>Clear</button>}
          {groupTemplates[selGroup.id]
            ? <button onClick={()=>{if(Object.keys(grid).some(k=>k.startsWith(selGroup.id)&&grid[k])&&!window.confirm("This will overwrite "+selGroup.group+"'s existing programme. Continue?"))return;applyGroupTemplate(selGroup);}} style={{...btnPrimary,background:B.navy,fontSize:9,marginLeft:4}}><IcWand/> Apply to {selGroup.group}</button>
            : <span style={{fontSize:9,color:B.textMuted,fontStyle:"italic"}}>Select a template above, then apply</span>}
          {isHeadOffice && <button onClick={()=>setGroupImportTarget(selGroup)} style={{padding:"3px 10px",borderRadius:4,fontSize:9,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"1px solid "+B.border,background:"#ede9fe",color:B.navy,marginLeft:8}}>⬆ Import Programme Excel</button>}
        </div>}
        <TableWrap><table style={{minWidth:1200,width:"100%",borderCollapse:"collapse",fontSize:10}}>
          <thead><tr><th style={{...thStyle,width:30}}></th>
            {dates.filter(d=>inRange(dayKey(d),selGroup.arr,selGroup.dep)).map(d=>{const s=dayKey(d),we=isWeekend(d),exc=excDays[s];return<th key={s} style={{...thStyle,textAlign:"center",minWidth:80,background:exc?B.pink:we?B.dangerBg:B.ice}}>
              <div style={{fontSize:7,color:B.textMuted}}>{fmtDate(d)}</div>
              <div style={{fontWeight:800,fontSize:9,color:we?B.red:B.text}}>{dayName(d)}</div></th>;})}
          </tr></thead>
          <tbody>{slots.map(sl=><tr key={sl} style={{borderBottom:"1px solid "+B.borderLight}}>
            <td style={{...tdStyle,fontWeight:800,fontSize:8,color:sl==="EVE"?B.warning:B.textMuted,textAlign:"center"}}>{sl}</td>
            {dates.filter(d=>inRange(dayKey(d),selGroup.arr,selGroup.dep)).map(d=>{const key=selGroup.id+"-"+dayKey(d)+"-"+sl,val=grid[key],cls=classify(val),isEd=editingCell===key,isQP=quickPickCell===key;
              return<td key={key} onClick={(e)=>handleCellClick(key,sl,true,e)} onDoubleClick={()=>!readOnly&&startEdit(key,val)} style={{padding:"4px 6px",borderLeft:"1px solid "+B.borderLight,verticalAlign:"top",cursor:"pointer",position:"relative"}}>
                {isEd?<input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>e.key==="Enter"&&commitEdit()} style={{width:"100%",fontSize:9,padding:"4px",border:"1px solid "+B.border,borderRadius:3,fontFamily:"inherit",background:B.card,color:B.text}}/>:
                <div style={{background:cls.bg,color:cls.color,padding:"4px 6px",borderRadius:4,fontSize:9,fontWeight:600,minHeight:32,display:"flex",alignItems:"center"}}>{val||"\u2014"}</div>}
                {isQP&&<div style={{position:"fixed",top:qpPos.top,left:qpPos.left,zIndex:9999,background:B.card,border:"1px solid "+B.border,borderRadius:6,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",padding:"4px 0",minWidth:160,maxHeight:220,overflowY:"auto"}}>
                  {(sl==="EVE"?QUICK_EVE:QUICK_AM_PM).map(opt=><div key={opt} onClick={(e)=>{e.stopPropagation();quickPick(key,opt);}} style={{padding:"5px 12px",fontSize:10,fontWeight:600,cursor:"pointer",color:classify(opt).color,whiteSpace:"nowrap"}} onMouseEnter={e=>e.target.style.background=B.ice} onMouseLeave={e=>e.target.style.background="transparent"}>{opt}</div>)}
                  <div style={{borderTop:"1px solid "+B.border,marginTop:2,paddingTop:2}}>
                    <div onClick={(e)=>{e.stopPropagation();quickPick(key,undefined);}} style={{padding:"5px 12px",fontSize:10,fontWeight:600,cursor:"pointer",color:B.textMuted}} onMouseEnter={e=>e.target.style.background=B.ice} onMouseLeave={e=>e.target.style.background="transparent"}>{"\u2717"} Clear</div>
                    <div onClick={(e)=>{e.stopPropagation();setQuickPickCell(null);startEdit(key,val);}} style={{padding:"5px 12px",fontSize:10,fontWeight:600,cursor:"pointer",color:B.text}} onMouseEnter={e=>e.target.style.background=B.ice} onMouseLeave={e=>e.target.style.background="transparent"}>{"\u270f\ufe0f"} Custom text...</div>
                  </div>
                </div>}
              </td>;})}
          </tr>)}</tbody>
        </table></TableWrap>
      </div>}
    </div>}

    {viewMode==="template" && <div>
      <div style={{padding:"10px 20px",background:B.card,borderBottom:"1px solid "+B.border}}>
        {centre?(centreProgs.length>0?<div>
          <div style={{fontSize:10,fontWeight:700,color:B.textMuted,marginBottom:6,textTransform:"uppercase"}}>Programme templates for {centre}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {centreProgs.map((p,i)=><button key={i} onClick={()=>setSelectedTemplate(selectedTemplate===i?null:i)} style={{padding:"6px 14px",borderRadius:6,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:selectedTemplate===i?"2px solid "+B.navy:"1px solid "+B.border,background:selectedTemplate===i?B.navy:B.card,color:selectedTemplate===i?B.white:B.text}}>
              {p.nights} {p.period?("\u00b7 "+p.period.split("-")[0].trim()):""}</button>)}
          </div></div>:<div style={{fontSize:11,color:B.textMuted,display:"flex",alignItems:"center",gap:10}}>No pre-built templates for this centre {!readOnly && <button onClick={()=>setShowTemplateModal(true)} style={{padding:"4px 12px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"1px solid "+B.navy,background:B.navy,color:B.white}}>Set Up Custom Template</button>}</div>
        ):<div style={{fontSize:11,color:B.warning,fontWeight:600}}>Select a centre in the header to see templates</div>}
      </div>
      {activeTemplate && <div style={{padding:"0 12px 16px"}}>
        <div style={{padding:"8px 8px 4px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:10,color:B.textMuted}}>{activeTemplate.centre} {"\u00b7"} {activeTemplate.nights} {"\u00b7"} {activeTemplate.period}</span>
          {!readOnly && groups.length > 0 && <button onClick={()=> autoPopFromTemplate(activeTemplate)}
            style={{...btnPrimary,background:B.navy,fontSize:10}}
            title="Fills empty cells only — existing programme data is kept">
            <IcWand/> Apply to All Groups</button>}
        </div>
        {activeTemplate.weeks.map(wk=><div key={wk.week} style={{marginBottom:12}}>
          <div style={{padding:"6px 8px",fontWeight:800,fontSize:11,color:B.text}}>Week {wk.week}</div>
          <TableWrap><table style={{minWidth:1200,width:"100%",borderCollapse:"collapse",fontSize:10}}>
            <thead><tr><th style={{...thStyle,width:30}}></th>
              {wk.days.map((d,i)=><th key={i} style={{...thStyle,textAlign:"center",minWidth:100}}><div style={{fontWeight:800,fontSize:10,color:(d.day==="Saturday"||d.day==="Sunday")?B.red:B.text}}>{d.day}</div></th>)}
            </tr></thead>
            <tbody>{(isMinistay ? ["am","pm","eve"] : ["am","pm"]).map(sl=><tr key={sl} style={{borderBottom:"1px solid "+B.borderLight}}>
              <td style={{...tdStyle,fontWeight:800,fontSize:8,color:B.textMuted,textAlign:"center"}}>{sl.toUpperCase()}</td>
              {wk.days.map((d,i)=>{const cls=classify(d[sl]);return<td key={i} style={{padding:"4px 6px",borderLeft:"1px solid "+B.borderLight,verticalAlign:"top"}}>
                <div style={{background:cls.bg,color:cls.color,padding:"4px 6px",borderRadius:4,fontSize:9,fontWeight:600,minHeight:32,display:"flex",alignItems:"center"}}>{d[sl]||"\u2014"}</div></td>;})}
            </tr>)}</tbody>
          </table></TableWrap>
        </div>)}
      </div>}
    </div>}
  </div>);
}
