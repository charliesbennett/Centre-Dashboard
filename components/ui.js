"use client";
import { B } from "@/lib/constants";

const RW = "'Raleway', sans-serif";

// ── Field label wrapper ───────────────────────────────────────────────────
export function Fld({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontFamily: RW }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────
export function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: B.white, borderRadius: 10, padding: "12px 16px", minWidth: 80,
      border: `1px solid ${B.border}`,
      borderLeft: `4px solid ${accent || B.navy}`,
      boxShadow: "0 2px 10px rgba(28,48,72,0.07)",
    }}>
      <div style={{ fontSize: 9, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, fontFamily: RW }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: B.navy, marginTop: 3, fontFamily: RW, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────
export function StatusBadge({ status, map }) {
  const st = (map || {})[status] || { color: B.warning, bg: B.warningBg };
  return (
    <span style={{ background: st.bg, color: st.color, padding: "3px 9px", borderRadius: 20, fontSize: 9, fontWeight: 700, fontFamily: RW, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

// ── Icon button ───────────────────────────────────────────────────────────
export function IconBtn({ children, onClick, danger, title }) {
  return (
    <button onClick={onClick} title={title} className="btn-ghost" style={{
      background: "none", border: "none",
      color: danger ? B.danger : B.textMuted,
      cursor: "pointer", padding: "4px 5px", borderRadius: 5,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {children}
    </button>
  );
}

// ── Table wrapper ─────────────────────────────────────────────────────────
export function TableWrap({ children }) {
  return (
    <div style={{
      background: B.white, borderRadius: 12,
      border: `1px solid ${B.border}`,
      overflowX: "auto",
      boxShadow: "0 2px 12px rgba(28,48,72,0.07)",
    }}>
      {children}
    </div>
  );
}

// ── Shared style objects ──────────────────────────────────────────────────
export const inputStyle = {
  background: B.white, border: `1px solid ${B.border}`, color: B.text,
  padding: "7px 10px", borderRadius: 7, fontSize: 12,
  fontFamily: "'Open Sans', sans-serif", minWidth: 90,
};

export const thStyle = {
  padding: "9px 10px", fontSize: 10, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: 0.6,
  color: B.white, background: B.navy,
  whiteSpace: "nowrap", textAlign: "left",
  fontFamily: RW, borderBottom: "none",
};

export const tdStyle = {
  padding: "7px 10px", verticalAlign: "middle", fontSize: 12,
  borderBottom: `1px solid ${B.borderLight}`,
};

export const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", background: B.red, border: "none",
  color: B.white, borderRadius: 8, cursor: "pointer",
  fontSize: 12, fontWeight: 700, fontFamily: RW, letterSpacing: 0.2,
  boxShadow: "0 2px 8px rgba(236,39,59,0.25)",
  whiteSpace: "nowrap",
};

export const btnNavy = {
  ...btnPrimary, background: B.navy,
  boxShadow: "0 2px 8px rgba(28,48,72,0.2)",
};

// ── SVG icon helpers ──────────────────────────────────────────────────────
export function IcPlus()   { return <Ic d="M12 5v14M5 12h14" />; }
export function IcTrash()  { return <Ic d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" s={14} />; }
export function IcSearch() { return <Ic d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" s={14} />; }
export function IcX()      { return <Ic d="M18 6L6 18M6 6l12 12" s={12} />; }
export function IcWand()   { return <Ic d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M12.2 11.8l-1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4M12 21l3-7h4l-7 3z" />; }
export function IcEdit()   { return <Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" s={14} />; }
export function IcCheck()  { return <Ic d="M20 6L9 17l-5-5" s={14} />; }

function Ic({ d, s = 16, c = "currentColor" }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
