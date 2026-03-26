"use client";
import { useState } from "react";
import { B, fmtDate } from "@/lib/constants";
import { btnPrimary, btnNavy, IcCheck, IcWand } from "@/components/ui";

// ── Step definitions (3 steps — Programme → Generate → Review) ────────────
const STEPS = [
  { id: 1, label: "Programme" },
  { id: 2, label: "Generate" },
  { id: 3, label: "Review" },
];

// ── Constraint checklist (HC-007 and HC-008 removed) ─────────────────────
const CONSTRAINTS = [
  { id: "HC-001", label: "Each staff member works at most 1 session per slot per day" },
  { id: "HC-002", label: "Every staff member gets at least 1 full day off per week" },
  { id: "HC-003", label: "TAL/FTT session limits respected (max 4 Lessons per day)" },
  { id: "HC-004", label: "Safeguarding ratios met for all activity sessions" },
  { id: "HC-005", label: "Role rules enforced (CM/CD not assigned student-facing slots without reason)" },
  { id: "HC-006", label: "Evening entertainment covered by eligible staff each session night" },
];

// ── Shared font constants ─────────────────────────────────────────────────
const RW = "'Raleway', sans-serif";
const OS = "'Open Sans', sans-serif";

// ── Stepper step indicator ────────────────────────────────────────────────
function StepIndicator({ step, currentStep }) {
  const isCompleted = currentStep > step.id;
  const isActive = currentStep === step.id;

  const circleStyle = {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: RW,
    fontWeight: 800,
    fontSize: 13,
    flexShrink: 0,
    background: isCompleted ? B.red : isActive ? B.navy : B.ice,
    color: isCompleted ? B.white : isActive ? B.yellow : B.textMuted,
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: isActive ? 800 : 600,
    fontFamily: RW,
    color: isActive ? B.navy : isCompleted ? B.red : B.textMuted,
    marginTop: 4,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <div style={circleStyle}>
        {isCompleted ? <IcCheck /> : step.id}
      </div>
      <div style={labelStyle}>{step.label}</div>
    </div>
  );
}

// ── Connector line between steps ──────────────────────────────────────────
function StepConnector({ completed }) {
  return (
    <div style={{
      flex: 1,
      height: 2,
      background: completed ? B.red : B.border,
      marginTop: 14,
      marginBottom: 20,
      transition: "background 0.2s",
    }} />
  );
}

// ── Stepper row ───────────────────────────────────────────────────────────
function Stepper({ currentStep }) {
  return (
    <div
      data-testid="stepper"
      style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 24 }}
    >
      {STEPS.map((step, i) => (
        <span key={step.id} style={{ display: "contents" }}>
          <StepIndicator step={step} currentStep={currentStep} />
          {i < STEPS.length - 1 && (
            <StepConnector completed={currentStep > step.id} />
          )}
        </span>
      ))}
    </div>
  );
}

// ── Step 1: Programme ─────────────────────────────────────────────────────
function ProgrammeStep({ progStart, progEnd, groups, staff, onNext }) {
  const groupCount = groups ? groups.length : 0;
  const staffCount = staff ? staff.length : 0;
  const hasData = progStart && progEnd && staffCount > 0;

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: RW, color: B.navy, marginBottom: 12 }}>
        Programme Summary
      </h3>
      <div style={{
        background: B.white,
        border: `1px solid ${B.border}`,
        borderLeft: `4px solid ${B.navy}`,
        borderRadius: 8,
        padding: "16px 20px",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: RW }}>Programme Start</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: RW, color: B.navy, marginTop: 2 }}>{progStart ? fmtDate(progStart) : "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: RW }}>Programme End</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: RW, color: B.navy, marginTop: 2 }}>{progEnd ? fmtDate(progEnd) : "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: RW }}>Groups</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: RW, color: B.navy, marginTop: 2 }}>{groupCount}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: RW }}>Staff</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: RW, color: B.navy, marginTop: 2 }}>{staffCount}</div>
          </div>
        </div>
      </div>
      {!hasData && (
        <div style={{ color: B.warning, fontFamily: OS, fontSize: 12, marginBottom: 16, padding: "8px 12px", background: B.warningBg, borderRadius: 6 }}>
          Set a programme start/end date and add staff before generating a rota.
        </div>
      )}
      <button
        style={{ ...btnPrimary, opacity: hasData ? 1 : 0.5, cursor: hasData ? "pointer" : "not-allowed" }}
        disabled={!hasData}
        onClick={onNext}
      >
        Continue to Generate
      </button>
    </div>
  );
}

// ── Step 2: Generate ──────────────────────────────────────────────────────
function GenerateStep({ generating, onGenerate, onBack }) {
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: RW, color: B.navy, marginBottom: 12 }}>
        Constraint Checklist
      </h3>
      <div style={{ marginBottom: 20 }}>
        {CONSTRAINTS.map((c) => (
          <div
            key={c.id}
            data-testid={`constraint-${c.id}`}
            style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "8px 0", borderBottom: `1px solid ${B.borderLight}`,
            }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: "50%", background: B.navy,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 1,
            }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: B.textMuted, fontSize: 12, fontFamily: OS }}>
          <div style={{
            width: 16, height: 16, border: `2px solid ${B.border}`,
            borderTop: `2px solid ${B.navy}`, borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }} />
          Claude is generating your rota…
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnNavy} onClick={onBack}>Back</button>
          <button style={btnPrimary} onClick={onGenerate}>
            <IcWand /> Generate Rota
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Review ────────────────────────────────────────────────────────
function ReviewStep({ draftRota, onPublish, onStartOver }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{
          background: B.yellow, color: B.navy,
          fontFamily: RW, fontWeight: 700, fontSize: 11,
          padding: "5px 14px", borderRadius: 20,
        }}>
          Draft Rota — not yet published
        </span>
      </div>
      {draftRota ? (
        <div style={{
          background: B.white, border: `1px solid ${B.border}`,
          borderRadius: 8, padding: "16px 20px", marginBottom: 20,
          fontFamily: OS, fontSize: 12, color: B.text,
        }}>
          <p style={{ margin: 0, fontWeight: 600, color: B.navy }}>Rota generated successfully.</p>
          <p style={{ margin: "6px 0 0", color: B.textMuted }}>Review the assignments below, then publish to apply them to the rota.</p>
        </div>
      ) : (
        <div style={{
          background: B.ice, borderRadius: 8, padding: "20px",
          color: B.textMuted, fontFamily: OS, fontSize: 13,
          marginBottom: 20, textAlign: "center",
        }}>
          No draft rota — go back and generate one first.
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btnNavy} onClick={onStartOver}>Start Over</button>
        <button
          data-testid="publish-btn"
          style={{
            ...btnPrimary,
            opacity: draftRota ? 1 : 0.5,
            cursor: draftRota ? "pointer" : "not-allowed",
          }}
          disabled={!draftRota}
          onClick={onPublish}
        >
          Publish Rota
        </button>
      </div>
    </div>
  );
}

// ── Main AiRotaTab component ──────────────────────────────────────────────
export default function AiRotaTab({
  staff = [],
  progStart,
  progEnd,
  groups = [],
  rotaGrid,
  setRotaGrid,
  progGrid = {},
  centreName = "",
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [draftRota, setDraftRota] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [published, setPublished] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate-rota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff, progStart, progEnd, groups, progGrid, centreName }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setDraftRota(data);
      setCurrentStep(3);
    } catch (err) {
      setGenError(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = () => {
    if (!draftRota) return;
    if (setRotaGrid) setRotaGrid(draftRota);
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
      {/* ── AI Rota header (navy card with dots-grid texture) ── */}
      <div
        data-testid="ai-rota-header"
        style={{
          background: B.navy,
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 20,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          borderBottom: `3px solid ${B.yellow}`,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: RW, color: B.white, lineHeight: 1.2 }}>
          AI Rota Generator
        </div>
        <div style={{ fontSize: 11, fontFamily: OS, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
          Powered by Claude AI
        </div>
      </div>

      {/* ── Stepper ───────────────────────────────────────────── */}
      <Stepper currentStep={currentStep} />

      {/* ── Published success state ───────────────────────────── */}
      {published && (
        <div style={{
          background: B.navy,
          borderRadius: 12,
          padding: "24px",
          color: B.white,
          fontFamily: RW,
          fontWeight: 700,
          fontSize: 15,
          textAlign: "center",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          borderBottom: `3px solid ${B.yellow}`,
          marginBottom: 16,
        }}>
          <div style={{ color: B.yellow, fontSize: 22, marginBottom: 8 }}>Rota Published</div>
          <div style={{ fontFamily: OS, fontWeight: 400, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
            The generated rota is now live.
          </div>
          <button style={{ ...btnNavy, marginTop: 16, background: "rgba(255,255,255,0.15)" }} onClick={handleStartOver}>
            Generate Another
          </button>
        </div>
      )}

      {/* ── Step content ──────────────────────────────────────── */}
      {!published && (
        <>
          {currentStep === 1 && (
            <ProgrammeStep
              progStart={progStart}
              progEnd={progEnd}
              groups={groups}
              staff={staff}
              onNext={() => setCurrentStep(2)}
            />
          )}
          {currentStep === 2 && (
            <GenerateStep
              generating={generating}
              onGenerate={handleGenerate}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && (
            <ReviewStep
              draftRota={draftRota}
              onPublish={handlePublish}
              onStartOver={handleStartOver}
            />
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
