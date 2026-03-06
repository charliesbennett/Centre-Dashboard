"use client";
import { useState } from "react";
import { B } from "@/lib/constants";
import { parseProgrammePdf, extractRawLines } from "@/lib/parseProgrammePdf";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SLOT_OPTS = {
  am:  ["English Lessons","English Test","Orientation Tour","Sports & Games","Arts & Crafts","Half Day Excursion","Full Day Excursion","Free Time","ARRIVAL","DEPARTURE"],
  pm:  ["English Lessons","Multi-Activity","Half Day Excursion","Full Day Excursion","Sports & Games","Arts & Crafts","Paparazzi Challenge","Free Time","ARRIVAL","DEPARTURE"],
  eve: ["Evening Activity","EE","Welcome Talk","Speed Dating","Paparazzi","Trashion Show","Movie Night","Quiz Night","Disco","Drop the Egg","Attractions","BBQ","Talent Show","Karaoke"],
};
const SLOT_COLORS = { am: "#1e40af", pm: "#166534", eve: "#6d28d9" };

function empty() {
  const t = {};
  DAYS.forEach((d) => { t[d] = { am:"", pm:"", eve:"" }; });
  return t;
}
function load(json) {
  if (!json) return empty();
  try {
    const p = JSON.parse(json);
    const t = empty();
    DAYS.forEach((d) => { if (p[d]) t[d] = { am:"", pm:"", eve:"", ...p[d] }; });
    return t;
  } catch { return empty(); }
}

export default function ProgrammeTemplateModal({ currentJson, onSave, onClose }) {
  const [template, setTemplate] = useState(() => load(currentJson));
  const [parsing,  setParsing]  = useState(false);
  const [msg,      setMsg]      = useState(null);   // { ok, text }
  const [pdfUrl,   setPdfUrl]   = useState(null);
  const [pdfName,  setPdfName]  = useState("");
  const [rawLines, setRawLines] = useState(null);   // string[] | null
  const [showRaw,  setShowRaw]  = useState(false);

  const update = (day, slot, val) =>
    setTemplate((p) => ({ ...p, [day]: { ...p[day], [slot]: val } }));

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(URL.createObjectURL(file));
    setPdfName(file.name);
    setParsing(true);
    setMsg(null);
    setRawLines(null);
    setShowRaw(false);

    try {
      // Run extraction and raw-line fetch in parallel
      const [result, raw] = await Promise.all([
        parseProgrammePdf(file),
        extractRawLines(file),
      ]);
      setRawLines(raw);

      if (result.ok) {
        setTemplate(result.template);
        setMsg({ ok: true, text: "Programme extracted — review the grid and correct anything that looks wrong, then save." });
      } else {
        setMsg({ ok: false, text: result.error + " Review the raw text below and fill in the grid manually." });
        setShowRaw(true);
      }
    } catch (err) {
      setMsg({ ok: false, text: "Extraction failed: " + err.message });
      setShowRaw(true);
    }
    setParsing(false);
  };

  const isWeekend = (d) => d === "Saturday" || d === "Sunday";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:10000, display:"flex", flexDirection:"column", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ background:B.navy, padding:"10px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ fontWeight:800, fontSize:13, color:B.white, flex:1 }}>Ministay Programme Template</div>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)" }}>Upload the PDF → auto-extracted → review → save</div>
        <button onClick={() => onSave(JSON.stringify(template))}
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

        {/* Left: PDF viewer */}
        <div style={{ width:"55%", display:"flex", flexDirection:"column", borderRight:"2px solid #2a3f52" }}>
          <div style={{ padding:"8px 14px", background:"#162534", borderBottom:"1px solid #2a3f52", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <label style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", background:B.white, borderRadius:5, cursor:parsing?"not-allowed":"pointer", fontSize:10, fontWeight:700, color:B.navy, opacity:parsing?0.6:1 }}>
              {parsing ? "⏳ Extracting…" : "📄 Upload Sample Programme PDF"}
              <input type="file" accept=".pdf" onChange={handleUpload} disabled={parsing} style={{ display:"none" }} />
            </label>
            {pdfName && <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pdfName}</span>}
            {rawLines && (
              <button onClick={() => setShowRaw((v) => !v)}
                style={{ marginLeft:"auto", fontSize:9, fontWeight:700, padding:"4px 10px", background:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.7)", border:"none", borderRadius:4, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                {showRaw ? "📄 Show PDF" : "📝 Show Raw Text"}
              </button>
            )}
          </div>

          <div style={{ flex:1, background:"#111", minHeight:0, overflow:"hidden" }}>
            {showRaw && rawLines ? (
              <div style={{ height:"100%", overflow:"auto", padding:"12px 16px" }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", marginBottom:8, fontWeight:700 }}>RAW EXTRACTED TEXT — use this to verify / manually correct the template</div>
                {rawLines.map((line, i) => (
                  <div key={i} style={{ fontSize:9, color: line.trim() ? "rgba(255,255,255,0.8)" : "transparent", fontFamily:"monospace", lineHeight:1.8, borderBottom:"1px solid rgba(255,255,255,0.04)", padding:"1px 0" }}>
                    {line || "·"}
                  </div>
                ))}
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} style={{ width:"100%", height:"100%", border:"none" }} title="Programme PDF" />
            ) : (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:10, color:"rgba(255,255,255,0.2)" }}>
                <div style={{ fontSize:44 }}>📄</div>
                <div style={{ fontSize:12, fontWeight:700 }}>Upload the sample programme PDF</div>
                <div style={{ fontSize:10 }}>Activities will be automatically extracted into the grid</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: template editor */}
        <div style={{ width:"45%", background:B.bg, display:"flex", flexDirection:"column", minHeight:0 }}>
          <div style={{ padding:"8px 14px", background:B.white, borderBottom:"1px solid "+B.border, flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:700, color:B.navy }}>Weekly Programme Template</div>
            <div style={{ fontSize:9, color:B.textMuted, marginTop:1 }}>Auto-filled from PDF. Edit anything that looks wrong.</div>
          </div>

          {msg && (
            <div style={{ padding:"7px 14px", background:msg.ok?"#dcfce7":"#fef3c7", borderBottom:"1px solid "+(msg.ok?"#86efac":"#fde68a"), fontSize:9, color:msg.ok?"#166534":"#92400e", fontWeight:600, flexShrink:0 }}>
              {msg.ok ? "✓ " : "⚠ "}{msg.text}
            </div>
          )}
          {parsing && (
            <div style={{ padding:"7px 14px", background:"#eff6ff", borderBottom:"1px solid #bfdbfe", fontSize:9, color:"#1e40af", fontWeight:600, flexShrink:0 }}>
              ⏳ Extracting programme from PDF…
            </div>
          )}

          <div style={{ flex:1, overflow:"auto", padding:"8px 12px" }}>
            <div style={{ display:"flex", gap:16, fontSize:9, marginBottom:8 }}>
              {["am","pm","eve"].map((s) => (
                <span key={s} style={{ color:SLOT_COLORS[s], fontWeight:800 }}>■ {s.toUpperCase()}</span>
              ))}
            </div>

            {DAYS.map((day) => (
              <div key={day} style={{ marginBottom:5, background:B.white, borderRadius:6, border:"1px solid "+(isWeekend(day)?"#fecaca":B.border), overflow:"hidden" }}>
                <div style={{ padding:"5px 10px", background:isWeekend(day)?"#fef2f2":"#f8fafc", borderBottom:"1px solid "+(isWeekend(day)?"#fecaca":B.borderLight), fontWeight:800, fontSize:10, color:isWeekend(day)?B.red:B.navy }}>
                  {day}
                </div>
                <div style={{ display:"flex" }}>
                  {["am","pm","eve"].map((slot, si) => (
                    <div key={slot} style={{ flex:1, padding:"5px 6px", borderRight:si<2?"1px solid "+B.borderLight:"none" }}>
                      <div style={{ fontSize:7, fontWeight:800, color:SLOT_COLORS[slot], marginBottom:2, textTransform:"uppercase" }}>{slot}</div>
                      <input
                        value={template[day]?.[slot] || ""}
                        onChange={(e) => update(day, slot, e.target.value)}
                        list={`tmpl-${slot}-opts`}
                        placeholder="—"
                        style={{ width:"100%", padding:"3px 5px", fontSize:9, fontFamily:"inherit", border:"1px solid "+B.border, borderRadius:3, color:SLOT_COLORS[slot], fontWeight:template[day]?.[slot]?700:400, background:template[day]?.[slot]?SLOT_COLORS[slot]+"10":B.white, boxSizing:"border-box" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {["am","pm","eve"].map((slot) => (
              <datalist key={slot} id={`tmpl-${slot}-opts`}>
                {SLOT_OPTS[slot].map((o) => <option key={o} value={o} />)}
              </datalist>
            ))}

            <div style={{ marginTop:8, padding:"7px 10px", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:5, fontSize:9, color:"#92400e" }}>
              <strong>Tip:</strong> Arrival and departure days are set automatically. Leave EVE blank if no evening activity. Use <em>Show Raw Text</em> to see exactly what was read from the PDF.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
