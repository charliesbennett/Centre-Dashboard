"use client";
import { useState } from "react";
import { B } from "@/lib/constants";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const AM_OPTS = [
  "English Lessons", "English Test", "Orientation Tour", "Sports & Games", "Arts & Crafts",
  "Half Day Excursion", "Full Day Excursion", "Free Time", "ARRIVAL", "DEPARTURE",
];
const PM_OPTS = [
  "English Lessons", "Multi-Activity", "Half Day Excursion", "Full Day Excursion",
  "Sports & Games", "Arts & Crafts", "Paparazzi Challenge", "Free Time", "ARRIVAL", "DEPARTURE",
];
const EVE_OPTS = [
  "Evening Activity", "EE", "Welcome Talk", "Speed Dating", "Paparazzi", "Trashion Show",
  "Movie Night", "Quiz Night", "Disco", "Drop the Egg", "Attractions", "BBQ", "Talent Show",
  "Karaoke", "Photo Competition", "Cultural Evening",
];

const SLOT_OPTS = { am: AM_OPTS, pm: PM_OPTS, eve: EVE_OPTS };
const SLOT_COLORS = { am: "#1e40af", pm: "#166534", eve: "#6d28d9" };

function emptyTemplate() {
  const t = {};
  DAYS.forEach((d) => { t[d] = { am: "", pm: "", eve: "" }; });
  return t;
}

export default function ProgrammeTemplateModal({ currentJson, onSave, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [template, setTemplate] = useState(() => {
    if (currentJson) {
      try {
        const parsed = JSON.parse(currentJson);
        // Ensure all days present
        const t = emptyTemplate();
        DAYS.forEach((d) => { if (parsed[d]) t[d] = { am: "", pm: "", eve: "", ...parsed[d] }; });
        return t;
      } catch {}
    }
    return emptyTemplate();
  });

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(URL.createObjectURL(file));
    setPdfName(file.name);
  };

  const update = (day, slot, value) => {
    setTemplate((prev) => ({ ...prev, [day]: { ...prev[day], [slot]: value } }));
  };

  const handleSave = () => {
    onSave(JSON.stringify(template));
  };

  const isWeekend = (day) => day === "Saturday" || day === "Sunday";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 10000, display: "flex", flexDirection: "column", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ background: B.navy, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: B.white, flex: 1 }}>
          Ministay Programme Template
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", maxWidth: 300 }}>
          Define the default activity for each day. Auto-Populate will apply this to all dates.
        </div>
        <button
          onClick={handleSave}
          style={{ padding: "7px 18px", background: B.red, color: B.white, border: "none", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
        >
          ✓ Save Template
        </button>
        <button
          onClick={onClose}
          style={{ padding: "7px 12px", background: "rgba(255,255,255,0.12)", color: B.white, border: "none", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
        >
          ✕
        </button>
      </div>

      {/* Body: two-panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Left: PDF viewer */}
        <div style={{ width: "55%", display: "flex", flexDirection: "column", borderRight: "2px solid #2a3f52" }}>
          <div style={{ padding: "8px 14px", background: "#162534", borderBottom: "1px solid #2a3f52", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <label style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px",
              background: B.white, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 700, color: B.navy,
            }}>
              📄 Upload Sample Programme PDF
              <input type="file" accept=".pdf" onChange={handlePdfUpload} style={{ display: "none" }} />
            </label>
            {pdfName && (
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pdfName}
              </span>
            )}
          </div>
          <div style={{ flex: 1, background: "#111", minHeight: 0 }}>
            {pdfUrl ? (
              <iframe src={pdfUrl} style={{ width: "100%", height: "100%", border: "none" }} title="Sample Programme PDF" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "rgba(255,255,255,0.25)" }}>
                <div style={{ fontSize: 40 }}>📄</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Upload your sample programme PDF</div>
                <div style={{ fontSize: 10 }}>It will display here for reference as you fill in the template</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Template editor */}
        <div style={{ width: "45%", background: B.bg, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "10px 16px", background: B.white, borderBottom: "1px solid " + B.border, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 16, fontSize: 9 }}>
              <span style={{ color: SLOT_COLORS.am, fontWeight: 800 }}>■ AM</span>
              <span style={{ color: SLOT_COLORS.pm, fontWeight: 800 }}>■ PM</span>
              <span style={{ color: SLOT_COLORS.eve, fontWeight: 800 }}>■ EVE</span>
              <span style={{ color: B.textMuted, marginLeft: "auto" }}>Type or select from the dropdown</span>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "10px 14px" }}>
            {DAYS.map((day) => (
              <div key={day} style={{
                marginBottom: 8, background: B.white, borderRadius: 8,
                border: "1px solid " + (isWeekend(day) ? "#fecaca" : B.border),
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "6px 12px",
                  background: isWeekend(day) ? "#fef2f2" : "#f8fafc",
                  borderBottom: "1px solid " + (isWeekend(day) ? "#fecaca" : B.borderLight),
                  fontWeight: 800, fontSize: 11,
                  color: isWeekend(day) ? B.red : B.navy,
                }}>
                  {day}
                </div>
                <div style={{ display: "flex", gap: 0 }}>
                  {["am", "pm", "eve"].map((slot, si) => (
                    <div key={slot} style={{ flex: 1, padding: "6px 8px", borderRight: si < 2 ? "1px solid " + B.borderLight : "none" }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: SLOT_COLORS[slot], marginBottom: 3, textTransform: "uppercase" }}>{slot}</div>
                      <input
                        value={template[day]?.[slot] || ""}
                        onChange={(e) => update(day, slot, e.target.value)}
                        list={`tmpl-${slot}-opts`}
                        placeholder="—"
                        style={{
                          width: "100%", padding: "4px 6px", fontSize: 9, fontFamily: "inherit",
                          border: "1px solid " + B.border, borderRadius: 4,
                          color: SLOT_COLORS[slot], fontWeight: template[day]?.[slot] ? 700 : 400,
                          background: template[day]?.[slot] ? SLOT_COLORS[slot] + "10" : B.white,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Datalists for autocomplete */}
            {["am", "pm", "eve"].map((slot) => (
              <datalist key={slot} id={`tmpl-${slot}-opts`}>
                {SLOT_OPTS[slot].map((o) => <option key={o} value={o} />)}
              </datalist>
            ))}

            <div style={{ marginTop: 8, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 9, color: "#92400e" }}>
              <strong>Tip:</strong> Arrival and departure days are always set automatically regardless of this template. Leave EVE blank for days with no evening activity.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
