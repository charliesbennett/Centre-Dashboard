"use client";
import { useState, useMemo, useEffect } from "react";
import { fmtDate, genDates, dayKey, dayName } from "@/lib/constants";
import { useB } from "@/lib/theme";
import { btnPrimary, btnNavy, thStyle, tdStyle, TableWrap, IcCheck, IcWand } from "@/components/ui";
import { getFortnights, getTodayFortnight } from "@/lib/fortnights";

// ── Step definitions ──────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Programme" },
  { id: 2, label: "Generate" },
  { id: 3, label: "Review" },
];

// ── Constraint checklist (HC-007/HC-008 removed) ─────────────────────────
const CONSTRAINTS = [
  { id: "HC-001", label: "Each staff member works at most 1 session per slot per day" },
  { id: "HC-002", label: "Every staff member gets at least 1 full day off per week" },
  { id: "HC-003", label: "TAL/FTT session limits respected (max 22 sessions per fortnight)" },
  { id: "HC-004", label: "Safeguarding ratios met for all activity sessions" },
  { id: "HC-005", label: "Role rules enforced (FTTs not on excursion days; 5FTTs not on weekends)" },
  { id: "HC-006", label: "Evening entertainment covered by eligible staff each session night" },
];

const RW = "'Raleway', sans-serif";
const OS = "'Open Sans', sans-serif";

// ── Build draft rota grid for display ────────────────────────────────────
// Returns: { [staffId]: { [dateKey]: { AM, PM, Eve } } }
export function buildDraftRotaGrid(draftRota, staff) {
  if (!draftRota?.grid || !staff?.length) return {};
  const result = {};
  staff.forEach((s) => {
    result[s.id] = {};
  });
  for (const [key, val] of Object.entries(draftRota.grid)) {
    // key format: staffId-YYYY-MM-DD-slot  (staffId may contain hyphens)
    // slot is always AM, PM, or Eve
    const slotMatch = key.match(/-(AM|PM|Eve)$/);
    if (!slotMatch) continue;
    const slot = slotMatch[1];
    const withoutSlot = key.slice(0, key.length - slot.length - 1);
    // find which staff member this belongs to
    const staffMember = staff.find((s) => withoutSlot.startsWith(s.id));
    if (!staffMember) continue;
    const dateKey = withoutSlot.slice(staffMember.id.length + 1);
    if (!result[staffMember.id]) result[staffMember.id] = {};
    if (!result[staffMember.id][dateKey]) result[staffMember.id][dateKey] = {};
    result[staffMember.id][dateKey][slot] = val;
  }
  return result;
}

// ── Cell colour for rota values ───────────────────────────────────────────
function cellBg(val, B) {
  if (!val) return "transparent";
  if (val === "Day Off") return B.ice;
  if (/^(lessons?|testing|english test|int english)$/i.test(val)) return B.pink;
  if (val === "Induction" || val === "Setup" || val === "Office") return "#f0f4f8";
  if (/welcome|pickup|dinner/i.test(val)) return "#f0f4f8";
  return "#f0fdf4";
}

// ── Step indicator ────────────────────────────────────────────────────────
function StepIndicator({ step, currentStep }) {
  const B = useB();
  const isCompleted = currentStep > step.id;
  const isActive = currentStep === step.id;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: RW, fontWeight: 800, fontSize: 13, flexShrink: 0,
        background: isCompleted ? B.red : isActive ? B.navy : B.ice,
        color: isCompleted ? B.white : isActive ? B.yellow : B.textMuted,
      }}>
        {isCompleted ? <IcCheck /> : step.id}
      </div>
      <div style={{
        fontSize: 11, fontWeight: isActive ? 800 : 600, fontFamily: RW, marginTop: 4,
        color: isActive ? B.navy : isCompleted ? B.red : B.textMuted,
      }}>{step.label}</div>
    </div>
  );
}

function StepConnector({ completed }) {
  const B = useB();
  return (
    <div style={{
      flex: 1, height: 2, marginTop: 14, marginBottom: 20,
      background: completed ? B.red : B.border,
      transition: "background 0.2s",
    }} />
  );
}

function Stepper({ currentStep }) {
  return (
    <div data-testid="stepper" style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 24 }}>
      {STEPS.map((step, i) => (
        <span key={step.id} style={{ display: "contents" }}>
          <StepIndicator step={step} currentStep={currentStep} />
          {i < STEPS.length - 1 && <StepConnector completed={currentStep > step.id} />}
        </span>
      ))}
    </div>
  );
}

// ── Step 1: Programme ─────────────────────────────────────────────────────
function ProgrammeStep({ progStart, progEnd, groups, staff, fortnights, fortIdx, setFortIdx, onNext }) {
  const B = useB();
  const selectedFortnight = fortnights[fortIdx] || { start: progStart, end: progEnd };
  const fortnightStaffCount = staff?.filter((s) =>
    s.arr <= selectedFortnight.end && s.dep >= selectedFortnight.start
  ).length ?? 0;
  const hasData = selectedFortnight.start && selectedFortnight.end && fortnightStaffCount > 0;
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: RW, color: B.navy, marginBottom: 12 }}>Programme Summary</h3>
      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderLeft: `4px solid ${B.navy}`, borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {[
            { label: "Fortnight Start", val: selectedFortnight.start ? fmtDate(selectedFortnight.start) : "—" },
            { label: "Fortnight End",   val: selectedFortnight.end   ? fmtDate(selectedFortnight.end)   : "—" },
            { label: "Groups",          val: groups?.length ?? 0 },
            { label: "Staff on site",   val: fortnightStaffCount },
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize: 9, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: RW }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: RW, color: B.navy, marginTop: 2 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
      {fortnights.length > 1 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
          {fortnights.map((fn, i) => (
            <button
              key={fn.label}
              onClick={() => setFortIdx(i)}
              style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                fontFamily: "inherit", cursor: "pointer",
                border: `1px solid ${i === fortIdx ? B.navy : B.border}`,
                background: i === fortIdx ? B.navy : B.white,
                color: i === fortIdx ? B.white : B.textMuted,
              }}
            >
              {fn.label}
            </button>
          ))}
        </div>
      )}
      {!hasData && (
        <div style={{ color: B.warning, fontFamily: OS, fontSize: 12, marginBottom: 16, padding: "8px 12px", background: B.warningBg, borderRadius: 6 }}>
          {staff?.length === 0 ? "Set a programme start/end date and add staff before generating a rota." : "No staff on site during this fortnight."}
        </div>
      )}
      <button style={{ ...btnPrimary, opacity: hasData ? 1 : 0.5, cursor: hasData ? "pointer" : "not-allowed" }} disabled={!hasData} onClick={onNext}>
        Continue to Generate
      </button>
    </div>
  );
}

// ── Step 2: Generate ──────────────────────────────────────────────────────
function GenerateStep({ generating, genStep, onGenerate, onBack }) {
  const B = useB();
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: RW, color: B.navy, marginBottom: 12 }}>Constraint Checklist</h3>
      <div style={{ marginBottom: 20 }}>
        {CONSTRAINTS.map((c) => (
          <div key={c.id} data-testid={`constraint-${c.id}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${B.borderLight}` }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: B.navy, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              <IcCheck />
            </span>
            <div>
              <span style={{ fontSize: 9, fontWeight: 700, fontFamily: RW, color: B.red, marginRight: 6 }}>{c.id}</span>
              <span style={{ fontSize: 12, fontFamily: OS, color: B.text }}>{c.label}</span>
            </div>
          </div>
        ))}
      </div>
      {generating ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: B.textMuted, fontSize: 12, fontFamily: OS }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${B.border}`, borderTop: `2px solid ${B.navy}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            {genStep || "Claude is generating your rota…"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnNavy} onClick={onBack}>Back</button>
          <button style={btnPrimary} onClick={onGenerate}><IcWand /> Generate Rota</button>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Review ────────────────────────────────────────────────────────
function ReviewStep({ draftRota, staff, progStart, progEnd, fortnightLabel, onPublish, onStartOver }) {
  const B = useB();
  const grid = buildDraftRotaGrid(draftRota, staff);
  const dates = progStart && progEnd ? genDates(progStart, progEnd) : [];

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ background: B.yellow, color: B.navy, fontFamily: RW, fontWeight: 700, fontSize: 11, padding: "5px 14px", borderRadius: 20 }}>
          Draft Rota — not yet published
        </span>
        {fortnightLabel && (
          <span style={{ background: B.ice, color: B.navy, fontFamily: RW, fontWeight: 700, fontSize: 11, padding: "5px 14px", borderRadius: 20, border: `1px solid ${B.border}` }}>
            {fortnightLabel}
          </span>
        )}
        {draftRota?.corrections > 0 && (
          <span style={{ fontSize: 11, fontFamily: OS, color: B.textMuted }}>
            {draftRota.corrections} constraint correction{draftRota.corrections !== 1 ? "s" : ""} applied
          </span>
        )}
      </div>

      {draftRota?.grid ? (
        <TableWrap>
          <table style={{ borderCollapse: "collapse", fontSize: 9, fontFamily: OS, minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, position: "sticky", left: 0, zIndex: 2, minWidth: 90, fontSize: 9 }}>Staff</th>
                {dates.map((d) => (
                  <th key={dayKey(d)} style={{ ...thStyle, textAlign: "center", minWidth: 44, padding: "4px 2px", fontSize: 9 }}>
                    <div>{dayName(d)}</div>
                    <div style={{ fontWeight: 400, opacity: 0.7, fontSize: 9 }}>{d.getDate()}/{d.getMonth() + 1}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(staff || []).map((s) => (
                <tr key={s.id}>
                  <td style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 1, background: B.card, fontWeight: 600, whiteSpace: "nowrap", fontSize: 9, minWidth: 90 }}>
                    <div>{s.name}</div>
                    <div style={{ fontSize: 8, color: B.textMuted }}>{s.role}</div>
                  </td>
                  {dates.map((d) => {
                    const dk = dayKey(d);
                    const cell = grid[s.id]?.[dk] || {};
                    return (
                      <td key={dk} style={{ ...tdStyle, padding: "2px 2px", verticalAlign: "top" }}>
                        {["AM", "PM", "Eve"].map((slot) => cell[slot] ? (
                          <div key={slot} style={{ fontSize: 8, padding: "1px 2px", borderRadius: 3, marginBottom: 1, background: cellBg(cell[slot], B), color: B.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 40 }} title={`${slot}: ${cell[slot]}`}>
                            <span style={{ color: B.textMuted, marginRight: 2 }}>{slot[0]}</span>{cell[slot]}
                          </div>
                        ) : null)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <div style={{ background: B.ice, borderRadius: 8, padding: 20, color: B.textMuted, fontFamily: OS, fontSize: 13, marginBottom: 20, textAlign: "center" }}>
          No draft rota — go back and generate one first.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button style={btnNavy} onClick={onStartOver}>Start Over</button>
        <button
          data-testid="publish-btn"
          style={{ ...btnPrimary, opacity: draftRota ? 1 : 0.5, cursor: draftRota ? "pointer" : "not-allowed" }}
          disabled={!draftRota}
          onClick={onPublish}
        >
          Publish Rota
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function AiRotaTab({ staff = [], progStart, progEnd, groups = [], progGrid = {}, setRotaGrid, centreName = "" }) {
  const B = useB();
  const [currentStep, setCurrentStep] = useState(1);
  const [draftRota, setDraftRota] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(null);
  const [genError, setGenError] = useState(null);
  const [published, setPublished] = useState(false);

  const fortnights = useMemo(() => getFortnights(progStart, progEnd), [progStart, progEnd]);
  const [fortIdx, setFortIdx] = useState(0);
  useEffect(() => {
    setFortIdx(getTodayFortnight(fortnights, dayKey(new Date())));
  }, [fortnights]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    setGenStep("Starting generation…");
    try {
      const res = await fetch("/api/generate-rota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff: staff.filter((s) => {
            const fn = fortnights[fortIdx] || { start: progStart, end: progEnd };
            return s.arr <= fn.end && s.dep >= fn.start;
          }),
          progStart: (fortnights[fortIdx] || { start: progStart }).start,
          progEnd: (fortnights[fortIdx] || { end: progEnd }).end,
          groups, progGrid, centreName,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.step && parsed.message) setGenStep(parsed.message);
            if (parsed.grid) finalData = parsed;
          } catch (e) {
            if (e.message.includes("JSON")) continue;
            throw e;
          }
        }
      }

      if (!finalData?.grid) throw new Error("No rota data returned. Please try again.");
      setDraftRota(finalData);
      setCurrentStep(3);
    } catch (err) {
      setGenError(err.message || "Generation failed. Please try again.");
    } finally {
      setGenerating(false);
      setGenStep(null);
    }
  };

  const handlePublish = () => {
    if (!draftRota?.grid) return;
    if (setRotaGrid) setRotaGrid(draftRota.grid);
    setPublished(true);
  };

  const handleStartOver = () => {
    setCurrentStep(1);
    setDraftRota(null);
    setGenError(null);
    setPublished(false);
  };

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Header */}
      <div data-testid="ai-rota-header" style={{
        background: B.navy, borderRadius: 12, padding: "20px 24px", marginBottom: 20,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "16px 16px", borderBottom: `3px solid ${B.yellow}`,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: RW, color: B.white, lineHeight: 1.2 }}>AI Rota Generator</div>
        <div style={{ fontSize: 11, fontFamily: OS, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>Powered by Claude AI</div>
      </div>

      <Stepper currentStep={currentStep} />

      {/* Published success state */}
      {published && (
        <div style={{
          background: B.navy, borderRadius: 12, padding: 24, color: B.white, fontFamily: RW, fontWeight: 700, fontSize: 15, textAlign: "center",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "16px 16px", borderBottom: `3px solid ${B.yellow}`, marginBottom: 16,
        }}>
          <div style={{ color: B.yellow, fontSize: 22, marginBottom: 8 }}>Rota Published</div>
          <div style={{ fontFamily: OS, fontWeight: 400, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
            The generated rota is now live. Switch to the Rota tab to view and adjust it.
          </div>
          <button style={{ ...btnNavy, marginTop: 16, background: "rgba(255,255,255,0.15)" }} onClick={handleStartOver}>
            Generate Another
          </button>
        </div>
      )}

      {/* Step content */}
      {!published && (
        <>
          {currentStep === 1 && (
            <ProgrammeStep progStart={progStart} progEnd={progEnd} groups={groups} staff={staff} fortnights={fortnights} fortIdx={fortIdx} setFortIdx={setFortIdx} onNext={() => setCurrentStep(2)} />
          )}
          {currentStep === 2 && (
            <GenerateStep generating={generating} genStep={genStep} onGenerate={handleGenerate} onBack={() => setCurrentStep(1)} />
          )}
          {currentStep === 3 && (
            <ReviewStep draftRota={draftRota} staff={staff} progStart={(fortnights[fortIdx] || { start: progStart }).start} progEnd={(fortnights[fortIdx] || { end: progEnd }).end} fortnightLabel={fortnights[fortIdx]?.label} onPublish={handlePublish} onStartOver={handleStartOver} />
          )}
          {genError && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: B.dangerBg, color: B.danger, borderRadius: 6, fontFamily: OS, fontSize: 12 }}>
              {genError}
            </div>
          )}
        </>
      )}
    </div>
  );
}
