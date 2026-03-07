"use client";
import { useState, useMemo } from "react";
import { B, ACTIVITY_TYPES, LONDON_CENTRES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { Fld, TableWrap, IcWand, thStyle, tdStyle, btnPrimary, inputStyle } from "@/components/ui";
import { getProgrammesForCentre } from "@/lib/programmeData";
import ProgrammeTemplateModal from "@/components/ProgrammeTemplateModal";

// Which lesson slot does this group have on this date?
function getGroupLessonSlot(g, ds) {
  if (!g.arr || !g.lessonSlot) return g.lessonSlot || "AM";
  const arrDate = new Date(g.arr);
  const curDate = new Date(ds);
  const daysSince = Math.floor((curDate - arrDate) / 86400000);
  const weekNum = Math.floor(daysSince / 7);
  return weekNum % 2 === 0 ? g.lessonSlot : (g.lessonSlot === "AM" ? "PM" : "AM");
}

export default function ProgrammesTab({ groups, progStart, progEnd, centre, excDays, setExcDays, progGrid, setProgGrid, settings, saveSetting }) {
  const dates = useMemo(() => genDates(progStart, progEnd), [progStart, progEnd]);
  const isLondon = LONDON_CENTRES.includes(centre);
  const isMinistay = (centre || "").toLowerCase().includes("ministay");
  const slots = isMinistay ? ["AM", "PM", "EVE"] : ["AM", "PM"];
  const [viewMode, setViewMode] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const grid = progGrid || {};
  const setGrid = setProgGrid || (() => {});
  const centreProgs = useMemo(() => getProgrammesForCentre(centre), [centre]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const activeTemplate = selectedTemplate !== null ? centreProgs[selectedTemplate] : null;

  // Auto-populate: summer uses weekly flip logic, ministay uses saved template
  const autoPop = () => {
    if (isMinistay) {
      let template = null;
      if (settings?.ministay_template) {
        try { template = JSON.parse(settings.ministay_template); } catch {}
      }
      if (!template) {
        setShowTemplateModal(true);
        return;
      }
      // Detect format: numeric keys ("1","2"…) = relative-day; day names = legacy
      const isRelative = Object.keys(template).some((k) => /^\d+$/.test(k));
      const ng = {};
      groups.forEach((g) => {
        const arrTime = g.arr ? new Date(g.arr + "T00:00:00").getTime() : null;
        dates.forEach((d) => {
          const s = dayKey(d);
          if (!inRange(s, g.arr, g.dep)) return;
          if (g.arr && s === dayKey(new Date(g.arr))) { ng[g.id+"-"+s+"-PM"] = "ARRIVAL"; return; }
          if (g.dep && s === dayKey(new Date(g.dep))) { ng[g.id+"-"+s+"-AM"] = "DEPARTURE"; return; }
          let day;
          if (isRelative && arrTime) {
            const dayNum = Math.round((d.getTime() - arrTime) / 86400000) + 1;
            day = template[String(dayNum)];
          } else {
            const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
            day = template[DOW[d.getDay()]];
          }
          if (day) {
            if (day.am) ng[g.id+"-"+s+"-AM"] = day.am;
            if (day.pm) ng[g.id+"-"+s+"-PM"] = day.pm;
            if (day.eve) ng[g.id+"-"+s+"-EVE"] = day.eve;
          }
        });
      });
      setGrid(ng);
      return;
    }
    const ng = {};
    groups.forEach((g) => {
      dates.forEach((d) => {
        const s = dayKey(d);
        if (!inRange(s, g.arr, g.dep)) return;
        const we = isWeekend(d);
        const day = d.getDay();

        if (g.arr && s === dayKey(new Date(g.arr))) { ng[g.id+"-"+s+"-PM"] = "ARRIVAL"; return; }
        if (g.dep && s === dayKey(new Date(g.dep))) { ng[g.id+"-"+s+"-AM"] = "DEPARTURE"; return; }
        if (excDays[s] === "Full") { ng[g.id+"-"+s+"-AM"] = "Full Exc"; ng[g.id+"-"+s+"-PM"] = "Full Exc"; return; }
        if (we) { ng[g.id+"-"+s+"-AM"] = "Full Exc"; ng[g.id+"-"+s+"-PM"] = "Full Exc"; return; }
        if (excDays[s] === "Half") {
          const ls = getGroupLessonSlot(g, s);
          if (ls === "AM") { ng[g.id+"-"+s+"-AM"] = "Lessons"; ng[g.id+"-"+s+"-PM"] = "Half Exc"; }
          else { ng[g.id+"-"+s+"-AM"] = "Half Exc"; ng[g.id+"-"+s+"-PM"] = "Lessons"; }
          return;
        }

        // Normal weekday: use lessonSlot
        const ls = getGroupLessonSlot(g, s);
        const spec = g.prog === "Multi-Activity" ? "Multi-Activity"
          : g.prog === "Intensive English" ? "English+"
          : g.prog === "Performing Arts" ? "Perf Arts"
          : g.prog || "Multi-Activity";

        if (isLondon && (day === 1 || day === 3 || day === 5)) {
          if (ls === "AM") { ng[g.id+"-"+s+"-AM"] = "Lessons"; ng[g.id+"-"+s+"-PM"] = "Half Exc"; }
          else { ng[g.id+"-"+s+"-AM"] = "Half Exc"; ng[g.id+"-"+s+"-PM"] = "Lessons"; }
        } else {
          if (ls === "AM") { ng[g.id+"-"+s+"-AM"] = "Lessons"; ng[g.id+"-"+s+"-PM"] = spec; }
          else { ng[g.id+"-"+s+"-AM"] = spec; ng[g.id+"-"+s+"-PM"] = "Lessons"; }
        }
      });
    });
    setGrid(ng);
  };

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [quickPickCell, setQuickPickCell] = useState(null); const [qpPos, setQpPos] = useState({top:0,left:0});
  const startEdit = (key, val) => { setQuickPickCell(null); setEditingCell(key); setEditValue(val || ""); };
  const commitEdit = () => { if (editingCell) { setGrid(p => ({...p, [editingCell]: editValue || undefined})); setEditingCell(null); } };
  const toggleExc = (dStr) => { setExcDays(p => { const c = p[dStr]; if (!c) return {...p,[dStr]:"Full"}; if (c==="Full") return {...p,[dStr]:"Half"}; const n={...p}; delete n[dStr]; return n; }); };
  const quickPick = (key, val) => { setGrid(p => ({...p, [key]: val})); setQuickPickCell(null); };
  const handleCellClick = (key, sl, on, e) => {
    if (!on || !isMinistay) return; const rect = e.currentTarget.getBoundingClientRect(); setQpPos({top: rect.bottom, left: rect.left});
    if (editingCell === key) return;
    setQuickPickCell(quickPickCell === key ? null : key);
  };
  const QUICK_AM_PM = ["English Lessons", "English Test", "Orientation Tour", "Sports & Games", "Arts & Crafts", "Paparazzi Challenge", "Half Day Excursion", "Full Day Excursion", "ARRIVAL", "DEPARTURE"];
  const QUICK_EVE = ["Evening Activity", "EE", "Welcome Talk", "Speed Dating", "Paparazzi", "Trashion Show", "Movie Night", "Quiz Night", "Disco", "Drop the Egg", "Attractions"];

  const classify = (text) => {
    if (!text) return { color: B.textLight, bg: "transparent" };
    const t = text.toLowerCase();
    if (t.includes("arrival")) return { color: "#16a34a", bg: "#dcfce7" };
    if (t.includes("depart")) return { color: B.danger, bg: B.dangerBg };
    if (t.includes("english test")) return { color: "#0891b2", bg: "#0891b220" };
    if (t.includes("lesson")) return { color: "#3b82f6", bg: "#3b82f620" };
    if (t.includes("multi-activity") || t.includes("chosen programme")) return { color: "#8b5cf6", bg: "#8b5cf620" };
    if (t.includes("activity")) return { color: "#8b5cf6", bg: "#8b5cf620" };
    if (t.includes("free time") || t.includes("optional")) return { color: B.textMuted, bg: "#f1f5f9" };
    if (t.includes("orientation") || t.includes("welcome")) return { color: "#16a34a", bg: "#16a34a20" };
    if (t.includes("ee") || t.includes("evening") || t.includes("disco") || t.includes("quiz") || t.includes("movie") || t.includes("trashion") || t.includes("speed dating") || t.includes("paparazzi") && t.length < 20) return { color: "#7c3aed", bg: "#7c3aed15" };
    if (t.includes("sports") || t.includes("games")) return { color: "#0d9488", bg: "#0d948815" };
    return { color: "#ea580c", bg: "#ea580c15" };
  };

  const selGroup = groups.find(g => g.id === selectedGroupId);

  return (<div>
    {showTemplateModal && (
      <ProgrammeTemplateModal
        currentJson={settings?.ministay_template || null}
        onSave={(json) => { if (saveSetting) saveSetting("ministay_template", json); setShowTemplateModal(false); }}
        onClose={() => setShowTemplateModal(false)}
      />
    )}
    <div style={{background:B.white,borderBottom:"1px solid "+B.border,padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontSize:11,fontWeight:700,color:B.navy}}>{dates.length} days {"\u00b7"} {groups.length} groups</span>
        {isLondon && <span style={{background:"#e0f2fe",color:"#0369a1",padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:700}}>London</span>}
        {isMinistay && <span style={{background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:700}}>Ministay</span>}
      </div>
      <div style={{display:"flex",gap:4}}>
        {["all","group","template"].map(m=><button key={m} onClick={()=>setViewMode(m)} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"1px solid "+(viewMode===m?B.navy:B.border),background:viewMode===m?B.navy:B.white,color:viewMode===m?B.white:B.textMuted}}>
          {m==="all"?"\ud83d\udc65 All Groups":m==="group"?"\ud83d\udc64 By Group":"\ud83d\udcc4 Templates"}</button>)}
        {isMinistay && <button onClick={()=>setShowTemplateModal(true)} style={{padding:"5px 12px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"1px solid "+B.border,background:settings?.ministay_template?"#dcfce7":B.white,color:settings?.ministay_template?B.success:B.textMuted,marginLeft:4}}>
          {"\ud83d\udcc4"} {settings?.ministay_template ? "Edit Template" : "Set Up Template"}</button>}
        <button onClick={autoPop} style={{...btnPrimary,background:B.navy,marginLeft:4}}><IcWand/> Auto-Populate</button>
      </div>
    </div>

    {/* Lesson slot summary */}
    {groups.length > 0 && !isMinistay && (
      <div style={{padding:"6px 20px",background:"#f0f9ff",borderBottom:"1px solid "+B.border,fontSize:10,display:"flex",gap:12,flexWrap:"wrap"}}>
        <span style={{fontWeight:700,color:"#0369a1"}}>{"\ud83d\udcda"} Lesson slots:</span>
        {groups.map(g => <span key={g.id}><strong>{g.group}</strong>: Wk1 {g.lessonSlot || "AM"} / Wk2 {(g.lessonSlot||"AM")==="AM"?"PM":"AM"}</span>)}
        <span style={{color:"#64748b"}}>{"\u00b7"} Toggle in Students tab</span>
      </div>
    )}
    {groups.length > 0 && isMinistay && (
      <div style={{padding:"6px 20px",background:"#fffbeb",borderBottom:"1px solid "+B.border,fontSize:10,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontWeight:700,color:"#92400e"}}>{"\ud83d\udcc5"} Ministay programme:</span>
        {settings?.ministay_template
          ? <span style={{color:"#16a34a",fontWeight:600}}>{"\u2713"} Template saved {"\u00b7"} Click Auto-Populate to apply</span>
          : <span style={{color:"#92400e"}}>No template yet {"\u00b7"} Click <strong>Set Up Template</strong> to define the weekly programme, then Auto-Populate</span>}
      </div>
    )}

    {viewMode==="all" && <div style={{padding:"0 4px 16px",overflowX:"auto"}}>
      <TableWrap><table style={{minWidth:1200,borderCollapse:"collapse",fontSize:10}}>
        <thead>
          <tr>
            <th style={{...thStyle,width:100,position:"sticky",left:0,zIndex:2,background:"#f8fafc"}}>Agent</th>
            <th style={{...thStyle,width:90,position:"sticky",left:100,zIndex:2,background:"#f8fafc"}}>Group</th>
            <th style={{...thStyle,width:30,textAlign:"center"}}>Pax</th>
            <th style={{...thStyle,width:30,textAlign:"center",fontSize:8}}>Wk1</th>
            {dates.map(d=>{const s=dayKey(d),exc=excDays[s],we=isWeekend(d);return<th key={s} colSpan={slots.length} onClick={()=>toggleExc(s)} style={{...thStyle,textAlign:"center",borderLeft:"2px solid "+B.border,padding:"3px 2px",minWidth:isMinistay?192:128,cursor:"pointer",background:exc?"#fff7ed":we?"#fef2f2":"#f8fafc"}}>
              <div style={{fontSize:7,color:B.textMuted}}>{fmtDate(d)}</div>
              <div style={{fontWeight:800,fontSize:9,color:we?B.red:B.navy}}>{dayName(d)}</div>
              {exc&&<div style={{fontSize:6,color:"#ea580c",fontWeight:800}}>{exc==="Full"?"FD EXC":"HD EXC"}</div>}
            </th>;})}
          </tr>
          <tr>
            <th style={{...thStyle,position:"sticky",left:0,zIndex:2,background:"#f8fafc"}}></th>
            <th style={{...thStyle,position:"sticky",left:100,zIndex:2,background:"#f8fafc"}}></th>
            <th style={thStyle}></th>
            <th style={thStyle}></th>
            {dates.map(d=>slots.map(sl=><th key={dayKey(d)+"-"+sl} style={{...thStyle,textAlign:"center",fontSize:8,padding:"3px 1px",borderLeft:sl==="AM"?"2px solid "+B.border:"1px solid "+B.borderLight,minWidth:isMinistay?64:64}}>{sl}</th>))}
          </tr>
        </thead>
        <tbody>
          {groups.length===0?<tr><td colSpan={100} style={{textAlign:"center",padding:36,color:B.textLight}}>Import groups in Students tab</td></tr>:
          groups.map(g=><tr key={g.id} style={{borderBottom:"1px solid "+B.borderLight}}>
            <td style={{...tdStyle,fontWeight:600,fontSize:9,position:"sticky",left:0,background:B.white,zIndex:1}}>{g.agent}</td>
            <td style={{...tdStyle,fontWeight:700,color:B.navy,fontSize:10,position:"sticky",left:100,background:B.white,zIndex:1}}>{g.group}</td>
            <td style={{...tdStyle,fontWeight:800,textAlign:"center",fontSize:10}}>{(g.stu||0)+(g.gl||0)}</td>
            <td style={{...tdStyle,textAlign:"center"}}><span style={{background:g.lessonSlot==="PM"?"#fae8ff":"#dbeafe",color:g.lessonSlot==="PM"?"#9333ea":"#1e40af",padding:"2px 6px",borderRadius:3,fontSize:8,fontWeight:800}}>{g.lessonSlot||"AM"}</span></td>
            {dates.map(d=>slots.map(sl=>{const s=dayKey(d),key=g.id+"-"+s+"-"+sl,val=grid[key],on=inRange(s,g.arr,g.dep),cls=classify(val),isEd=editingCell===key,isQP=quickPickCell===key;
              return<td key={key} onClick={(e)=>handleCellClick(key,sl,on,e)} onDoubleClick={()=>on&&startEdit(key,val)} style={{padding:"2px 3px",borderLeft:sl==="AM"?"2px solid "+B.border:"1px solid "+B.borderLight,verticalAlign:"middle",minWidth:64,maxWidth:100,background:!on?"#f5f5f5":cls.bg,cursor:on?"pointer":"default",position:"relative"}}>
                {isEd?<input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>e.key==="Enter"&&commitEdit()} style={{width:"100%",fontSize:9,padding:"3px",border:"1px solid "+B.navy,borderRadius:2,fontFamily:"inherit"}}/>:
                val?<div style={{color:cls.color,fontSize:9,fontWeight:600,padding:"3px 4px",borderRadius:2,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:96}} title={val}>{val}</div>:
                on?<div style={{height:18}}/>:<div style={{height:18}}/>}
                {isQP&&<div style={{position:"fixed",top:qpPos.top,left:qpPos.left,zIndex:9999,background:B.white,border:"1px solid "+B.border,borderRadius:6,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",padding:"4px 0",minWidth:140,maxHeight:200,overflowY:"auto"}}>
                  {(sl==="EVE"?QUICK_EVE:QUICK_AM_PM).map(opt=><div key={opt} onClick={(e)=>{e.stopPropagation();quickPick(key,opt);}} style={{padding:"4px 10px",fontSize:9,fontWeight:600,cursor:"pointer",color:classify(opt).color,whiteSpace:"nowrap"}} onMouseEnter={e=>e.target.style.background="#f1f5f9"} onMouseLeave={e=>e.target.style.background="transparent"}>{opt}</div>)}
                  <div style={{borderTop:"1px solid "+B.border,marginTop:2,paddingTop:2}}>
                    <div onClick={(e)=>{e.stopPropagation();quickPick(key,undefined);}} style={{padding:"4px 10px",fontSize:9,fontWeight:600,cursor:"pointer",color:B.textMuted}} onMouseEnter={e=>e.target.style.background="#f1f5f9"} onMouseLeave={e=>e.target.style.background="transparent"}>{"\u2717"} Clear</div>
                    <div onClick={(e)=>{e.stopPropagation();setQuickPickCell(null);startEdit(key,val);}} style={{padding:"4px 10px",fontSize:9,fontWeight:600,cursor:"pointer",color:B.navy}} onMouseEnter={e=>e.target.style.background="#f1f5f9"} onMouseLeave={e=>e.target.style.background="transparent"}>{"\u270f\ufe0f"} Custom text...</div>
                  </div>
                </div>}
              </td>;}))}
          </tr>)}
        </tbody>
      </table></TableWrap>
      <div style={{padding:"6px 12px",fontSize:9,color:B.textMuted}}>{isMinistay ? "Click cell for quick-pick \u00b7 Double-click for custom text \u00b7 Click date headers for exc days" : "Double-click to edit \u00b7 Click date headers for exc days \u00b7 Lessons follow Wk1 slot, flip each week"}</div>
    </div>}

    {viewMode==="group" && <div>
      <div style={{padding:"10px 20px",background:B.white,borderBottom:"1px solid "+B.border,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:10,fontWeight:700,color:B.textMuted}}>Select group:</span>
        {groups.map(g=><button key={g.id} onClick={()=>setSelectedGroupId(g.id)} style={{padding:"4px 10px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:selectedGroupId===g.id?"2px solid "+B.navy:"1px solid "+B.border,background:selectedGroupId===g.id?B.navy:B.white,color:selectedGroupId===g.id?B.white:B.navy}}>
          {g.group} <span style={{opacity:0.6}}>({(g.stu||0)+(g.gl||0)})</span></button>)}
      </div>
      {selGroup && <div style={{padding:"0 8px 16px",overflowX:"auto"}}>
        <div style={{padding:"8px 12px",display:"flex",gap:16,fontSize:10,color:B.textMuted}}>
          <span><strong style={{color:B.navy}}>Agent:</strong> {selGroup.agent}</span>
          <span><strong style={{color:B.navy}}>Pax:</strong> {(selGroup.stu||0)+(selGroup.gl||0)}</span>
          <span><strong style={{color:B.navy}}>Wk1 Lessons:</strong> {selGroup.lessonSlot||"AM"}</span>
          <span><strong style={{color:B.navy}}>Arr:</strong> {fmtDate(selGroup.arr)}</span>
          <span><strong style={{color:B.navy}}>Dep:</strong> {fmtDate(selGroup.dep)}</span>
        </div>
        <TableWrap><table style={{minWidth:1200,borderCollapse:"collapse",fontSize:10}}>
          <thead><tr><th style={{...thStyle,width:30}}></th>
            {dates.filter(d=>inRange(dayKey(d),selGroup.arr,selGroup.dep)).map(d=>{const s=dayKey(d),we=isWeekend(d),exc=excDays[s];return<th key={s} style={{...thStyle,textAlign:"center",minWidth:80,background:exc?"#fff7ed":we?"#fef2f2":"#f8fafc"}}>
              <div style={{fontSize:7,color:B.textMuted}}>{fmtDate(d)}</div>
              <div style={{fontWeight:800,fontSize:9,color:we?B.red:B.navy}}>{dayName(d)}</div></th>;})}
          </tr></thead>
          <tbody>{slots.map(sl=><tr key={sl} style={{borderBottom:"1px solid "+B.borderLight}}>
            <td style={{...tdStyle,fontWeight:800,fontSize:8,color:sl==="EVE"?"#92400e":B.textMuted,textAlign:"center"}}>{sl}</td>
            {dates.filter(d=>inRange(dayKey(d),selGroup.arr,selGroup.dep)).map(d=>{const key=selGroup.id+"-"+dayKey(d)+"-"+sl,val=grid[key],cls=classify(val),isEd=editingCell===key,isQP=quickPickCell===key;
              return<td key={key} onClick={(e)=>handleCellClick(key,sl,true,e)} onDoubleClick={()=>startEdit(key,val)} style={{padding:"4px 6px",borderLeft:"1px solid "+B.borderLight,verticalAlign:"top",cursor:"pointer",position:"relative"}}>
                {isEd?<input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>e.key==="Enter"&&commitEdit()} style={{width:"100%",fontSize:9,padding:"4px",border:"1px solid "+B.navy,borderRadius:3,fontFamily:"inherit"}}/>:
                <div style={{background:cls.bg,color:cls.color,padding:"4px 6px",borderRadius:4,fontSize:9,fontWeight:600,minHeight:32,display:"flex",alignItems:"center"}}>{val||"\u2014"}</div>}
                {isQP&&<div style={{position:"fixed",top:qpPos.top,left:qpPos.left,zIndex:9999,background:B.white,border:"1px solid "+B.border,borderRadius:6,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",padding:"4px 0",minWidth:160,maxHeight:220,overflowY:"auto"}}>
                  {(sl==="EVE"?QUICK_EVE:QUICK_AM_PM).map(opt=><div key={opt} onClick={(e)=>{e.stopPropagation();quickPick(key,opt);}} style={{padding:"5px 12px",fontSize:10,fontWeight:600,cursor:"pointer",color:classify(opt).color,whiteSpace:"nowrap"}} onMouseEnter={e=>e.target.style.background="#f1f5f9"} onMouseLeave={e=>e.target.style.background="transparent"}>{opt}</div>)}
                  <div style={{borderTop:"1px solid "+B.border,marginTop:2,paddingTop:2}}>
                    <div onClick={(e)=>{e.stopPropagation();quickPick(key,undefined);}} style={{padding:"5px 12px",fontSize:10,fontWeight:600,cursor:"pointer",color:B.textMuted}} onMouseEnter={e=>e.target.style.background="#f1f5f9"} onMouseLeave={e=>e.target.style.background="transparent"}>{"\u2717"} Clear</div>
                    <div onClick={(e)=>{e.stopPropagation();setQuickPickCell(null);startEdit(key,val);}} style={{padding:"5px 12px",fontSize:10,fontWeight:600,cursor:"pointer",color:B.navy}} onMouseEnter={e=>e.target.style.background="#f1f5f9"} onMouseLeave={e=>e.target.style.background="transparent"}>{"\u270f\ufe0f"} Custom text...</div>
                  </div>
                </div>}
              </td>;})}
          </tr>)}</tbody>
        </table></TableWrap>
      </div>}
    </div>}

    {viewMode==="template" && <div>
      <div style={{padding:"10px 20px",background:B.white,borderBottom:"1px solid "+B.border}}>
        {centre?(centreProgs.length>0?<div>
          <div style={{fontSize:10,fontWeight:700,color:B.textMuted,marginBottom:6,textTransform:"uppercase"}}>Programme templates for {centre}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {centreProgs.map((p,i)=><button key={i} onClick={()=>setSelectedTemplate(selectedTemplate===i?null:i)} style={{padding:"6px 14px",borderRadius:6,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:selectedTemplate===i?"2px solid "+B.navy:"1px solid "+B.border,background:selectedTemplate===i?B.navy:B.white,color:selectedTemplate===i?B.white:B.navy}}>
              {p.nights} {p.period?("\u00b7 "+p.period.split("-")[0].trim()):""}</button>)}
          </div></div>:<div style={{fontSize:11,color:B.textMuted}}>No templates for this centre</div>
        ):<div style={{fontSize:11,color:B.warning,fontWeight:600}}>Select a centre in the header to see templates</div>}
      </div>
      {activeTemplate && <div style={{padding:"0 12px 16px"}}>
        <div style={{padding:"8px 8px 4px",fontSize:10,color:B.textMuted}}>{activeTemplate.centre} {"\u00b7"} {activeTemplate.nights} {"\u00b7"} {activeTemplate.period}</div>
        {activeTemplate.weeks.map(wk=><div key={wk.week} style={{marginBottom:12}}>
          <div style={{padding:"6px 8px",fontWeight:800,fontSize:11,color:B.navy}}>Week {wk.week}</div>
          <TableWrap><table style={{minWidth:1200,borderCollapse:"collapse",fontSize:10}}>
            <thead><tr><th style={{...thStyle,width:30}}></th>
              {wk.days.map((d,i)=><th key={i} style={{...thStyle,textAlign:"center",minWidth:100}}><div style={{fontWeight:800,fontSize:10,color:(d.day==="Saturday"||d.day==="Sunday")?B.red:B.navy}}>{d.day}</div></th>)}
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
