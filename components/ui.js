"use client";
import { B } from "@/lib/constants";

export function Fld({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 14px", minWidth: 70, borderTop: `3px solid ${accent}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 9, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: B.navy, marginTop: 1 }}>{value}</div>
    </div>
  );
}

export function StatusBadge({ status, map }) {
  const st = (map || {})[status] || { color: B.warning, bg: B.warningBg };
  return (
    <span style={{ background: st.bg, color: st.color, padding: "2px 8px", borderRadius: 16, fontSize: 9, fontWeight: 700 }}>
      {status}
    </span>
  );
}

export function IconBtn({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", color: danger ? B.danger : B.textMuted, cursor: "pointer", padding: 3, borderRadius: 4, display: "flex" }}>
      {children}
    </button>
  );
}

export function TableWrap({ children }) {
  return (
    <div style={{ background: B.white, borderRadius: 10, border: `1px solid ${B.border}`, overflow: "visible", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      {children}
    </div>
  );
}

// Shared styles as objects
export const inputStyle = {
  background: B.white, border: `1px solid ${B.border}`, color: B.text,
  padding: "6px 9px", borderRadius: 5, fontSize: 12, fontFamily: "inherit", minWidth: 90,
};

export const thStyle = {
  padding: "6px 6px", fontSize: 9, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: 0.4, color: B.textMuted, borderBottom: `2px solid ${B.border}`,
  background: "#f8fafc", whiteSpace: "nowrap", textAlign: "left",
};

export const tdStyle = { padding: "5px 6px", verticalAlign: "middle", fontSize: 11 };

export const btnPrimary = {
  display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
  background: B.red, border: "none", color: B.white, borderRadius: 6,
  cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
};

export const btnNavy = { ...btnPrimary, background: B.navy };

// Icons
export function IcPlus() { return <Ic d="M12 5v14M5 12h14" />; }
export function IcTrash() { return <Ic d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" s={14} />; }
export function IcSearch() { return <Ic d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" s={14} />; }
export function IcX() { return <Ic d="M18 6L6 18M6 6l12 12" s={12} />; }
export function IcWand() { return <Ic d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M12.2 11.8l-1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4M12 21l3-7h4l-7 3z" />; }
export function IcEdit() { return <Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" s={14} />; }
export function IcCheck() { return <Ic d="M20 6L9 17l-5-5" s={14} />; }

function Ic({ d, s = 16, c = "currentColor" }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
