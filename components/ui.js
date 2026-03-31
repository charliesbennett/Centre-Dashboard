"use client";
import { B as STATIC_B } from "@/lib/constants";
import { useB } from "@/lib/theme";

const RW = "'Raleway', sans-serif";

// ── Field label wrapper ───────────────────────────────────────────────────
export function Fld({ label, children }) {
  const B = useB();
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
  const B = useB();
  return (
    <div style={{
      background: B.card, borderRadius: 10, padding: "12px 16px", minWidth: 80,
      border: `1px solid ${B.border}`,
      borderLeft: `4px solid ${accent || B.navy}`,
      boxShadow: "0 2px 10px rgba(28,48,72,0.07)",
    }}>
      <div style={{ fontSize: 9, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, fontFamily: RW }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: B.text, marginTop: 3, fontFamily: RW, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────
export function StatusBadge({ status, map }) {
  const B = useB();
  const st = (map || {})[status] || { color: B.warning, bg: B.warningBg };
  return (
    <span style={{ background: st.bg, color: st.color, padding: "3px 9px", borderRadius: 20, fontSize: 9, fontWeight: 700, fontFamily: RW, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

// ── Icon button ───────────────────────────────────────────────────────────
export function IconBtn({ children, onClick, danger, title }) {
  const B = useB();
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
  const B = useB();
  return (
    <div style={{
      background: B.card, borderRadius: 12,
      border: `1px solid ${B.border}`,
      overflowX: "auto",
      boxShadow: "0 2px 12px rgba(28,48,72,0.07)",
    }}>
      {children}
    </div>
  );
}

// ── Shared style objects (static — brand colours, fine in both modes) ──────
export const inputStyle = {
  background: STATIC_B.card, border: `1px solid ${STATIC_B.border}`, color: STATIC_B.text,
  padding: "7px 10px", borderRadius: 7, fontSize: 12,
  fontFamily: "'Open Sans', sans-serif", minWidth: 90,
};

export const thStyle = {
  padding: "9px 10px", fontSize: 10, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: 0.6,
  color: "#ffffff", background: STATIC_B.navy,
  whiteSpace: "nowrap", textAlign: "left",
  fontFamily: RW, borderBottom: "none",
  backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 10px)",
};

export const tdStyle = {
  padding: "7px 10px", verticalAlign: "middle", fontSize: 12,
  borderBottom: `1px solid ${STATIC_B.borderLight}`,
};

export const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", background: STATIC_B.red, border: "none",
  color: "#ffffff", borderRadius: 8, cursor: "pointer",
  fontSize: 12, fontWeight: 700, fontFamily: RW, letterSpacing: 0.2,
  boxShadow: "0 2px 8px rgba(236,39,59,0.25)",
  whiteSpace: "nowrap",
};

export const btnNavy = {
  ...btnPrimary, background: STATIC_B.navy,
  boxShadow: "0 2px 8px rgba(28,48,72,0.2)",
};

export const btnYellow = {
  ...btnPrimary, background: "#f6c90e", color: STATIC_B.navy,
  boxShadow: "0 2px 8px rgba(246,201,14,0.3)",
};

// ── Base SVG icon ─────────────────────────────────────────────────────────
function Ic({ d, s = 16, c = "currentColor", sw = 1.8 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ── General purpose icons ─────────────────────────────────────────────────
export function IcPlus()    { return <Ic d="M12 5v14M5 12h14" />; }
export function IcCopy()    { return <Ic d="M8 8H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2M16 2h-6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6l-4-4z" s={14} />; }
export function IcTrash()   { return <Ic d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" s={14} />; }
export function IcSearch()  { return <Ic d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" s={14} />; }
export function IcX()       { return <Ic d="M18 6L6 18M6 6l12 12" s={12} />; }
export function IcWand()    { return <Ic d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M12.2 11.8l-1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4M12 21l3-7h4l-7 3z" />; }
export function IcEdit()    { return <Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" s={14} />; }
export function IcCheck()   { return <Ic d="M20 6L9 17l-5-5" s={14} />; }
export function IcChat()    { return <Ic d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" s={20} />; }

// ── Tab navigation icons ──────────────────────────────────────────────────
export function IcHome()     { return <Ic s={15} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10" />; }
export function IcGradCap()  { return <Ic s={15} d="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5" />; }
export function IcCalGrid()  { return <Ic s={15} d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM16 1v4M8 1v4M3 9h18M3 14h18M8 9v9M16 9v9" />; }
export function IcClipboard(){ return <Ic s={15} d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2M9 14l2 2 4-4" />; }
export function IcFork()     { return <Ic s={15} d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7" />; }
export function IcPlane()    { return <Ic s={15} d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 21 4s-2 0-3.5 1.5L14 9 5.8 7.2l-1.7 1.7 7 3.1-2.3 2.3-3 .5-2.2 2.2 6.5 1 1 6.5 2.2-2.2.5-3 2.3-2.3 3.1 7z" />; }
export function IcUsersTab() { return <Ic s={15} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />; }
export function IcMapPin()   { return <Ic s={15} d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />; }
export function IcKey()      { return <Ic s={15} d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />; }
export function IcCoins()    { return <Ic s={15} d="M9 14c0 1.657 2.686 3 6 3s6-1.343 6-3M9 14c0-1.657 2.686-3 6-3s6 1.343 6 3M9 14v4c0 1.657 2.686 3 6 3s6-1.343 6-3v-4M3 6c0 1.657 2.686 3 6 3s6-1.343 6-3M3 6c0-1.657 2.686-3 6-3s6 1.343 6 3M3 6v10c0 1.657 2.686 3 6 3a11.955 11.955 0 0 0 3-.354" />; }
export function IcPhone()    { return <Ic s={15} d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-5.19-5.19 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3.09a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />; }

// ── HomeTab icons ─────────────────────────────────────────────────────────
export function IcPlaneUp()   { return <Ic d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5m-4 9l3-3 3 3M22 17l-3 3" />; }
export function IcPlaneDn()   { return <Ic d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5m-4 9l3 3 3-3M22 20l-3-3" />; }
export function IcCake()      { return <Ic d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 1.5-1 2-1M2 21h20M7 8v2M12 8v2M17 8v2M12 4a2 2 0 0 0-2 2M12 4a2 2 0 0 0 2 2M12 4V2" />; }
export function IcBus()       { return <Ic d="M8 6v12M16 6v12M2 12h19.6M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM6 20v2M18 20v2" />; }
export function IcMountain()  { return <Ic d="M8 3l4 8 5-5 5 15H2L8 3z" />; }
export function IcBuilding()  { return <Ic d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />; }
export function IcStar()      { return <Ic d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />; }
export function IcSparkles()  { return <Ic d="M5 3l1.5 1.5M5 21l1.5-1.5M19 3l-1.5 1.5M19 21l-1.5-1.5M12 2v2M12 20v2M2 12h2M20 12h2M8.5 8.5l7 7M15.5 8.5l-7 7" sw={1.5} />; }
export function IcUserCog()  { return <Ic s={15} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 8v1M19 13v1M16.6 9.5l-.87.5M21.4 11l-.87.5M16.6 12.5l-.87-.5M21.4 9l-.87-.5" />; }
export function IcLogout()   { return <Ic s={15} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />; }
