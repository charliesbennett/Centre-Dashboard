"use client";
import { useState } from "react";
import { B, CENTRES, TABS } from "@/lib/constants";
import StudentsTab from "@/components/tabs/StudentsTab";
import RotaTab from "@/components/tabs/RotaTab";
import ProgrammesTab from "@/components/tabs/ProgrammesTab";
import CateringTab from "@/components/tabs/CateringTab";
import TransfersTab from "@/components/tabs/TransfersTab";
import TeamTab from "@/components/tabs/TeamTab";
import ExcursionsTab from "@/components/tabs/ExcursionsTab";
import PettyCashTab from "@/components/tabs/PettyCashTab";
import ContactsTab from "@/components/tabs/ContactsTab";

export default function Dashboard() {
  const [tab, setTab] = useState("students");
  const [centre, setCentre] = useState("");
  const [progStart, setProgStart] = useState("2026-07-04");
  const [progEnd, setProgEnd] = useState("2026-08-05");

  const [groups, setGroups] = useState([]);
  const [staff, setStaff] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [excDays, setExcDays] = useState({});

  // Auto-adjust date range when groups are imported
  const handleDatesImported = (arrDate, depDate) => {
    if (!arrDate || !depDate) return;
    setProgStart((prev) => arrDate < prev ? arrDate : prev);
    setProgEnd((prev) => depDate > prev ? depDate : prev);
  };

  const renderTab = () => {
    switch (tab) {
      case "students": return <StudentsTab groups={groups} setGroups={setGroups} onDatesImported={handleDatesImported} />;
      case "rota": return <RotaTab staff={staff} progStart={progStart} />;
      case "programmes": return <ProgrammesTab groups={groups} progStart={progStart} progEnd={progEnd} centre={centre} excDays={excDays} setExcDays={setExcDays} />;
      case "catering": return <CateringTab groups={groups} staff={staff} progStart={progStart} progEnd={progEnd} excDays={excDays} />;
      case "transfers": return <TransfersTab groups={groups} transfers={transfers} setTransfers={setTransfers} />;
      case "team": return <TeamTab staff={staff} setStaff={setStaff} />;
      case "excursions": return <ExcursionsTab excDays={excDays} />;
      case "pettycash": return <PettyCashTab />;
      case "contacts": return <ContactsTab />;
      default: return null;
    }
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: B.bg, color: B.text, minHeight: "100vh", fontSize: 13 }}>
      <header style={{ background: B.navy, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: B.red, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: B.white }}>UK</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: B.white }}>UKLC Centre Dashboard</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={centre} onChange={(e) => setCentre(e.target.value)}
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "6px 10px", borderRadius: 5, fontSize: 11, fontFamily: "inherit", maxWidth: 220 }}>
            <option value="" style={{ color: "#333" }}>Select Centre...</option>
            {CENTRES.map((c) => <option key={c} value={c} style={{ color: "#333" }}>{c}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>DATES</span>
            <input type="date" value={progStart} onChange={(e) => setProgStart(e.target.value)}
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontFamily: "inherit" }} />
            <span style={{ color: "rgba(255,255,255,0.3)" }}>{"\u2192"}</span>
            <input type="date" value={progEnd} onChange={(e) => setProgEnd(e.target.value)}
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontFamily: "inherit" }} />
          </div>
        </div>
      </header>

      <nav style={{ background: B.white, borderBottom: "2px solid " + B.border, padding: "0 12px", display: "flex", overflowX: "auto", gap: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "10px 14px",
            border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
            fontFamily: "inherit", whiteSpace: "nowrap",
            borderBottom: tab === t.id ? "3px solid " + B.red : "3px solid transparent",
            background: "transparent", color: tab === t.id ? B.navy : B.textMuted,
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <div style={{ minHeight: "calc(100vh - 100px)" }}>{renderTab()}</div>
    </div>
  );
}
