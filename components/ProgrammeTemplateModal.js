"use client";
import { useState } from "react";
import { useB } from "@/lib/theme";
import { parseProgrammeExcel } from "@/lib/parseProgrammeExcel";

// Ministay: Day 1-7 relative to arrival
const MINISTAY_DAYS = ["1","2","3","4","5","6","7"];
const MINISTAY_LABELS = {
  "1": "Day 1 — Arrival",
  "2": "Day 2", "3": "Day 3", "4": "Day 4", "5": "Day 5", "6": "Day 6",
  "7": "Day 7 — Departure",
};

// Summer: Mon-Sun weekly pattern (repeats each week)
const SUMMER_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SUMMER_WEEKEND = ["Saturday","Sunday"];

const SLOT_OPTS = {
  am:  ["English Lessons","English Test","Orientation Tour","Sports & Games","Arts & Crafts","Half Day Excursion","Full Day Excursion","Free Time","ARRIVAL","DEPARTURE"],
  pm:  ["English Lessons","Multi-Activity","Half Day Excursion","Full Day Excursion","Sports & Games","Arts & Crafts","Paparazzi Challenge","Free Time","ARRIVAL","DEPARTURE"],
  eve: ["Evening Activity","EE","Welcome Talk","Speed Dating","Paparazzi","Trashion Show","Movie Night","Quiz Night","Disco","Drop the Egg","Attractions","BBQ","Talent Show","Karaoke"],
};
const SLOT_COLORS = { am: "#1e40af", pm: "#166534", eve: "#6d28d9" };
const EXC_OPTS = [
  { value: "", label: "— No excursion" },
  { value: "Full", label: "Full Day Excursion" },
  { value: "Half", label: "Half Day Excursion" },
];
const EXC_COLORS = { "": "#94a3b8", Full: "#ea580c", Half: "#0369a1" };

function emptyMinistay() {
  const t = {};
  MINISTAY_DAYS.forEach((d) => { t[d] = { am:"", pm:"", eve:"", exc:"" }; });
  return t;
}
function emptySummer() {
  const t = {};
  SUMMER_DAYS.forEach((d) => { t[d] = { am:"", pm:"", exc:"" }; });
  return t;
}

function loadMinistay(json) {
  if (!json) return emptyMinistay();
  try {
    const p = JSON.parse(json);
    const isNumeric = Object.keys(p).some((k) => /^\d+$/.test(k));
    if (isNumeric) {
      const t = emptyMinistay();
      MINISTAY_DAYS.forEach((d) => { if (p[d]) t[d] = { am:"", pm:"", eve:"", exc:"", ...p[d] }; });
      return t;
    }
    const legacyOrder = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const t = emptyMinistay();
    legacyOrder.forEach((day, i) => {
      const key = String(i + 1);
      if (p[day]) t[key] = { am:"", pm:"", eve:"", exc:"", ...p[key] };
    });
    return t;
  } catch { return emptyMinistay(); }
}

// Summer weeks: array of day-name maps [{Monday:{am,pm,exc},...}, ...]
function loadSummerWeeks(json) {
  if (!json) return [emptySummer()];
  try {
    const p = JSON.parse(json);
    // New format: {weeks:[{week:N, days:[{day,am,pm,...},...]},...]}
    if (p.weeks && Array.isArray(p.weeks)) {
      return p.weeks.map((wk) => {
        const map = emptySummer();
        wk.days.forEach((d) => { if (map[d.day] !== undefined) map[d.day] = { am: d.am || "", pm: d.pm || "", exc: d.exc || "" }; });
        return map;
      });
    }
    // Old flat format: {Monday:{am,pm,exc},...}
    const t = emptySummer();
    SUMMER_DAYS.forEach((d) => { if (p[d]) t[d] = { am:"", pm:"", exc:"", ...p[d] }; });
    return [t];
  } catch { return [emptySummer()]; }
}

function summerWeeksToJson(weeks) {
  return JSON.stringify({
    weeks: weeks.map((wk, i) => ({
      week: i + 1,
      days: SUMMER_DAYS.map((day) => ({ day, ...(wk[day] || { am:"", pm:"", exc:"" }) })),
    })),
  });
}

export default function ProgrammeTemplateModal({ currentJson, onSave, onClose, mode = "ministay" }) {
  const B = useB();
  const isSummer = mode === "summer";
  const DAYS = isSummer ? SUMMER_DAYS : MINISTAY_DAYS;
  // Summer: array of week day-maps; ministay: single day-map
  const [weeks,    setWeeks]    = useState(() => isSummer ? loadSummerWeeks(currentJson) : null);
  const [template, setTemplate] = useState(() => isSummer ? null : loadMinistay(currentJson));
  const [activeWeek, setActiveWeek] = useState(0);
  const [parsing,  setParsing]  = useState(false);
  const [msg,      setMsg]      = useState(null);
  const [fileName, setFileName] = useState("");
  const [rows,     setRows]     = useState([]);

  const update = (day, slot, val) => {
    if (isSummer) {
      setWeeks((p) => p.map((w, i) => i === activeWeek ? { ...w, [day]: { ...w[day], [slot]: val } } : w));
    } else {
      setTemplate((p) => ({ ...p, [day]: { ...p[day], [slot]: val } }));
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setMsg(null);
    setRows([]);

    try {
      const result = await parseProgrammeExcel(file);
      if (result.rows) setRows(result.rows);
      if (result.ok) {
        if (isSummer && result.weekTemplates) {
          // Convert all extracted weeks to summer day-name format
          const loadedWeeks = result.weekTemplates.map((wt) => {
            const w = emptySummer();
            SUMMER_DAYS.forEach((d) => {
              if (wt[d]) w[d] = { am: wt[d].am || "", pm: wt[d].pm || "", exc: wt[d].exc || "" };
            });
            return w;
          });
          setWeeks(loadedWeeks);
          setActiveWeek(0);
        } else {
          setTemplate(result.template);
        }
        setMsg({ ok: true, text: "Programme extracted — review the grid and correct anything that looks wrong, then save." + (result.debug ? " (" + result.debug + ")" : "") });
      } else {
        setMsg({ ok: false, text: result.error + " Review the spreadsheet preview and fill in the grid manually." });
      }
    } catch (err) {
      setMsg({ ok: false, text: "Failed to read file: " + err.message });
    }
    setParsing(false);
  };

  const maxCols = rows.length ? Math.max(...rows.map((r) => r.length)) : 0;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:10000, display:"flex", flexDirection:"column", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ background:B.navy, padding:"10px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ fontWeight:800, fontSize:13, color:B.white, flex:1 }}>{isSummer ? "Summer Programme Template" : "Ministay Programme Template"}</div>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)" }}>{isSummer ? "Define a Mon–Sun weekly pattern — repeats every week for all groups" : "Upload the Excel spreadsheet → auto-extracted → review → save"}</div>
        <button onClick={() => onSave(isSummer ? summerWeeksToJson(weeks) : JSON.stringify(template))}
          style={{ padding:"7px 18px", background:B.red, color:B.white, border:"none", borderRadius:6, fontWeight:800, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
          ✓ Save Template
        </button>
        <button onClick={onClose}
          style={{ padding:"7px 12px", background:"rgba(255,255,255,0.12)", color:B.white, border:"none", borderRadius:6, fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
          ✕
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* Left: spreadsheet preview */}
        <div style={{ width:"55%", display:"flex", flexDirection:"column", borderRight:"2px solid #2a3f52" }}>
          <div style={{ padding:"8px 14px", background:"#162534", borderBottom:"1px solid #2a3f52", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <label style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", background:B.white, borderRadius:5, cursor:parsing?"not-allowed":"pointer", fontSize:10, fontWeight:700, color:B.navy, opacity:parsing?0.6:1 }}>
              {parsing ? "⏳ Extracting…" : "📊 Upload Sample Programme Excel"}
              <input type="file" accept=".xlsx,.xls" onChange={handleUpload} disabled={parsing} style={{ display:"none" }} />
            </label>
            {fileName && <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fileName}</span>}
          </div>

          <div style={{ flex:1, background:"#111", minHeight:0, overflow:"auto" }}>
            {rows.length > 0 ? (
              <div style={{ padding:"12px 16px" }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", marginBottom:8, fontWeight:700 }}>
                  SPREADSHEET PREVIEW — {rows.length} rows × {maxCols} columns
                </div>
                <table style={{ borderCollapse:"collapse", fontSize:9, fontFamily:"monospace" }}>
                  <tbody>
                    {rows.map((row, r) => (
                      <tr key={r}>
                        {Array.from({ length: maxCols }, (_, c) => {
                          const cell = row[c];
                          const val  = cell != null && cell !== "" ? String(cell) : "";
                          return (
                            <td key={c} style={{
                              padding:"2px 10px", border:"1px solid rgba(255,255,255,0.07)",
                              color: val ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.12)",
                              fontWeight: val ? 600 : 400, whiteSpace:"nowrap",
                              maxWidth:160, overflow:"hidden", textOverflow:"ellipsis",
                            }}>
                              {val || "·"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:10, color:"rgba(255,255,255,0.2)" }}>
                <div style={{ fontSize:44 }}>📊</div>
                <div style={{ fontSize:12, fontWeight:700 }}>Upload the sample programme spreadsheet</div>
                <div style={{ fontSize:10 }}>Activities will be automatically extracted into the grid</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: template editor */}
        <div style={{ width:"45%", background:B.bg, display:"flex", flexDirection:"column", minHeight:0 }}>
          <div style={{ padding:"8px 14px", background:B.card, borderBottom:"1px solid "+B.border, flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:700, color:B.navy }}>{isSummer ? "Programme Template" : "Weekly Programme Template"}</div>
            <div style={{ fontSize:9, color:B.textMuted, marginTop:1 }}>{isSummer ? "Each week has its own Mon–Sun pattern. Arrival/departure days are set automatically." : "Relative to arrival — Day 1 = arrival, Day 7 = departure (6 nights). Auto-populate adjusts for any start day."}</div>
          </div>
          {/* Week tabs (summer only) */}
          {isSummer && (
            <div style={{ padding:"6px 12px", background:B.card, borderBottom:"1px solid "+B.border, display:"flex", gap:4, alignItems:"center", flexShrink:0 }}>
              {weeks.map((_, i) => (
                <button key={i} onClick={() => setActiveWeek(i)} style={{ padding:"3px 12px", borderRadius:4, fontSize:10, fontWeight:700, fontFamily:"inherit", cursor:"pointer", border: activeWeek===i ? "2px solid "+B.navy : "1px solid "+B.border, background: activeWeek===i ? B.navy : B.white, color: activeWeek===i ? B.white : B.navy }}>Week {i+1}</button>
              ))}
              <button onClick={() => { setWeeks((p) => [...p, emptySummer()]); setActiveWeek(weeks.length); }} style={{ padding:"3px 10px", borderRadius:4, fontSize:10, fontWeight:700, fontFamily:"inherit", cursor:"pointer", border:"1px dashed "+B.border, background:B.white, color:B.textMuted }}>+ Add Week</button>
              {weeks.length > 1 && <button onClick={() => { setWeeks((p) => p.filter((_,i) => i !== activeWeek)); setActiveWeek(Math.max(0, activeWeek-1)); }} style={{ padding:"3px 8px", borderRadius:4, fontSize:9, fontWeight:700, fontFamily:"inherit", cursor:"pointer", border:"1px solid #fecaca", background:"#fff1f2", color:B.red }}>Remove</button>}
            </div>
          )}

          {msg && (
            <div style={{ padding:"7px 14px", background:msg.ok?"#dcfce7":"#fef3c7", borderBottom:"1px solid "+(msg.ok?"#86efac":"#fde68a"), fontSize:9, color:msg.ok?"#166534":"#92400e", fontWeight:600, flexShrink:0 }}>
              {msg.ok ? "✓ " : "⚠ "}{msg.text}
            </div>
          )}
          {parsing && (
            <div style={{ padding:"7px 14px", background:"#eff6ff", borderBottom:"1px solid #bfdbfe", fontSize:9, color:"#1e40af", fontWeight:600, flexShrink:0 }}>
              ⏳ Extracting programme from spreadsheet…
            </div>
          )}

          <div style={{ flex:1, overflow:"auto", padding:"8px 12px" }}>
            <div style={{ display:"flex", gap:16, fontSize:9, marginBottom:8 }}>
              {(isSummer ? ["am","pm"] : ["am","pm","eve"]).map((s) => (
                <span key={s} style={{ color:SLOT_COLORS[s], fontWeight:800 }}>■ {s.toUpperCase()}</span>
              ))}
            </div>

            {DAYS.map((day) => {
              const isWeekend = isSummer && SUMMER_WEEKEND.includes(day);
              const isFirst = !isSummer && day === "1";
              const isLast  = !isSummer && day === "7";
              const accent  = isFirst ? "#1e40af" : isLast ? B.red : isWeekend ? B.red : B.navy;
              const bg      = isFirst ? "#eff6ff" : isLast ? "#fef2f2" : isWeekend ? "#fff1f2" : "#f8fafc";
              const border  = isFirst ? "#bfdbfe" : isLast ? "#fecaca" : isWeekend ? "#fecaca" : B.borderLight;
              const label   = isSummer ? day : MINISTAY_LABELS[day];
              const slots   = isSummer ? ["am","pm"] : ["am","pm","eve"];
              // Read from correct source: summer uses weeks[activeWeek], ministay uses template
              const dayData = isSummer ? (weeks[activeWeek]?.[day] || {}) : (template[day] || {});
              return (
                <div key={day} style={{ marginBottom:5, background:B.card, borderRadius:6, border:"1px solid "+(isFirst?"#bfdbfe":isLast||isWeekend?"#fecaca":B.border), overflow:"hidden" }}>
                  <div style={{ padding:"5px 10px", background:bg, borderBottom:"1px solid "+border, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontWeight:800, fontSize:10, color:accent, flex:1 }}>{label}</span>
                    <select value={dayData.exc || ""} onChange={(e) => update(day, "exc", e.target.value)}
                      style={{ fontSize:8, padding:"2px 5px", borderRadius:3, border:"1px solid "+B.border, background: dayData.exc ? EXC_COLORS[dayData.exc]+"20" : B.white, color: EXC_COLORS[dayData.exc || ""], fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                      {EXC_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display:"flex" }}>
                    {slots.map((slot, si) => (
                      <div key={slot} style={{ flex:1, padding:"5px 6px", borderRight:si<slots.length-1?"1px solid "+B.borderLight:"none" }}>
                        <div style={{ fontSize:7, fontWeight:800, color:SLOT_COLORS[slot], marginBottom:2, textTransform:"uppercase" }}>{slot}</div>
                        <input
                          value={dayData[slot] || ""}
                          onChange={(e) => update(day, slot, e.target.value)}
                          list={`tmpl-${slot}-opts`}
                          placeholder="—"
                          style={{ width:"100%", padding:"3px 5px", fontSize:9, fontFamily:"inherit", border:"1px solid "+B.border, borderRadius:3, color:SLOT_COLORS[slot], fontWeight:dayData[slot]?700:400, background:dayData[slot]?SLOT_COLORS[slot]+"10":B.white, boxSizing:"border-box" }}
                        />
                      </div>
                    ))}
                  </div>
                  {dayData.exc && (
                    <div style={{ padding:"4px 8px 6px", borderTop:"1px solid "+B.borderLight, background:EXC_COLORS[dayData.exc]+"10" }}>
                      <div style={{ fontSize:7, fontWeight:800, color:EXC_COLORS[dayData.exc], marginBottom:2 }}>EXCURSION DESTINATION</div>
                      <input
                        value={dayData.exc_dest || ""}
                        onChange={(e) => update(day, "exc_dest", e.target.value)}
                        placeholder="e.g. Oxford with walking tour"
                        style={{ width:"100%", padding:"3px 5px", fontSize:9, fontFamily:"inherit", border:"1px solid "+B.border, borderRadius:3, color:EXC_COLORS[dayData.exc], fontWeight:700, background:B.white, boxSizing:"border-box" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {["am","pm","eve"].map((slot) => (
              <datalist key={slot} id={`tmpl-${slot}-opts`}>
                {SLOT_OPTS[slot].map((o) => <option key={o} value={o} />)}
              </datalist>
            ))}

            <div style={{ marginTop:8, padding:"7px 10px", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:5, fontSize:9, color:"#92400e" }}>
              {isSummer
                ? <><strong>Tip:</strong> Define a typical Mon–Sun week. Arrival/departure days are filled automatically. Weekends are highlighted in red as they are typically excursion days.</>
                : <><strong>Tip:</strong> Arrival and departure are set automatically regardless of what's in Day 1/Day 7. Leave EVE blank if no evening activity. This template works for any group arriving on any day of the week.</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
