"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { B, CENTRES, TABS } from "@/lib/constants";
import { useSupabase } from "@/lib/useSupabase";
import { useAuth } from "@/lib/useAuth";
import LoginPage from "@/components/LoginPage";
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
  const auth = useAuth();
  const [tab, setTab] = useState("students");
  const [centreId, setCentreId] = useState("");
  const [centreName, setCentreName] = useState("");
  const [manualStart, setManualStart] = useState("2026-07-04");
  const [manualEnd, setManualEnd] = useState("2026-08-05");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const db = useSupabase(centreId);

  // Auto-set centre for non-head-office users
  useEffect(() => {
    if (auth.profile && auth.userCentreId && !centreId) {
      const c = db.centres.find((x) => x.id === auth.userCentreId);
      if (c) {
        setCentreId(c.id);
        setCentreName(c.name);
      }
    }
  }, [auth.profile, auth.userCentreId, db.centres, centreId]);

  const handleCentreChange = (name) => {
    setCentreName(name);
    const c = db.centres.find((x) => x.name === name);
    setCentreId(c ? c.id : "");
  };

  useEffect(() => {
    if (db.settings.prog_start) setManualStart(db.settings.prog_start);
    if (db.settings.prog_end) setManualEnd(db.settings.prog_end);
  }, [db.settings]);

  const { progStart, progEnd } = useMemo(() => {
    const allDates = [];
    db.groups.forEach((g) => {
      if (g.arr) allDates.push({ d: g.arr, type: "start" });
      if (g.dep) allDates.push({ d: g.dep, type: "end" });
    });
    db.staff.forEach((s) => {
      if (s.arr) allDates.push({ d: s.arr, type: "start" });
      if (s.dep) allDates.push({ d: s.dep, type: "end" });
    });
    if (allDates.length === 0) return { progStart: manualStart, progEnd: manualEnd };
    const starts = allDates.filter((x) => x.type === "start").map((x) => x.d).sort();
    const ends = allDates.filter((x) => x.type === "end").map((x) => x.d).sort();
    const earliest = starts[0] || manualStart;
    const latest = ends[ends.length - 1] || manualEnd;
    return {
      progStart: earliest < manualStart ? earliest : manualStart,
      progEnd: latest > manualEnd ? latest : manualEnd,
    };
  }, [db.groups, db.staff, manualStart, manualEnd]);

  // Debounced auto-save for grids
  const rotaSaveTimer = useRef(null);
  const progSaveTimer = useRef(null);
  const excSaveTimer = useRef(null);

  const setRotaGrid = useCallback((updater) => {
    db.setRotaGrid((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      clearTimeout(rotaSaveTimer.current);
      rotaSaveTimer.current = setTimeout(async () => {
        setSaving(true);
        await db.saveRotaGrid(next);
        setSaving(false);
        setLastSaved(new Date());
      }, 2000);
      return next;
    });
  }, [db.saveRotaGrid]);

  const setProgGrid = useCallback((updater) => {
    db.setProgGrid((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      clearTimeout(progSaveTimer.current);
      progSaveTimer.current = setTimeout(async () => {
        setSaving(true);
        await db.saveProgGrid(next);
        setSaving(false);
        setLastSaved(new Date());
      }, 2000);
      return next;
    });
  }, [db.saveProgGrid]);

  const setExcDays = useCallback((updater) => {
    db.setExcDays((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      clearTimeout(excSaveTimer.current);
      excSaveTimer.current = setTimeout(async () => {
        await db.saveExcDays(next);
        setLastSaved(new Date());
      }, 1000);
      return next;
    });
  }, [db.saveExcDays]);

  const setGroups = useCallback((updater) => {
    db.setGroups((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      next.forEach((g) => {
        const old = prev.find((p) => p.id === g.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(g)) db.saveGroup(g);
      });
      prev.forEach((p) => {
        if (!next.find((g) => g.id === p.id)) db.deleteGroup(p.id);
      });
      setLastSaved(new Date());
      return next;
    });
  }, [db.saveGroup, db.deleteGroup]);

  const setStaff = useCallback((updater) => {
    db.setStaff((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      next.forEach((s) => {
        const old = prev.find((p) => p.id === s.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(s)) db.saveStaffMember(s);
      });
      prev.forEach((p) => {
        if (!next.find((s) => s.id === p.id)) db.deleteStaffMember(p.id);
      });
      setLastSaved(new Date());
      return next;
    });
  }, [db.saveStaffMember, db.deleteStaffMember]);

  const transfersSaveTimer = useRef(null);
  const setTransfers = useCallback((updater) => {
    db.setTransfersData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      clearTimeout(transfersSaveTimer.current);
      transfersSaveTimer.current = setTimeout(async () => {
        await db.saveTransfersData(next);
        setLastSaved(new Date());
      }, 1000);
      return next;
    });
  }, [db.saveTransfersData]);

  const excSaveTimer2 = useRef(null);
  const setExcursions = useCallback((updater) => {
    db.setExcursions((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      clearTimeout(excSaveTimer2.current);
      excSaveTimer2.current = setTimeout(async () => {
        await db.saveExcursions(next);
        setLastSaved(new Date());
      }, 1000);
      return next;
    });
  }, [db.saveExcursions]);

  const cateringSaveTimer = useRef(null);
  const setCateringData = useCallback((newData) => {
    db.setCateringData(newData);
    clearTimeout(cateringSaveTimer.current);
    cateringSaveTimer.current = setTimeout(async () => {
      await db.saveCateringData(newData);
      setLastSaved(new Date());
    }, 1000);
  }, [db.saveCateringData]);

  const handleDateChange = (key, val) => {
    if (key === "start") { setManualStart(val); db.saveSetting("prog_start", val); }
    else { setManualEnd(val); db.saveSetting("prog_end", val); }
  };

  // Auth gates — after all hooks
  if (auth.loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: B.navy, fontFamily: "Open Sans, sans-serif" }}>
      <div style={{ color: "white", fontSize: 14, fontWeight: 600 }}>Loading...</div>
    </div>
  );
  if (!auth.isAuthenticated) return <LoginPage onLogin={auth.login} error={auth.error} />;

  const renderTab = () => {
    if (!centreId) return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: B.textMuted, fontSize: 14, fontWeight: 600 }}>
        {"\u2190"} Select a centre to get started
      </div>
    );
    if (db.loading) return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: B.navy, fontSize: 13, fontWeight: 600 }}>
        Loading {centreName}...
      </div>
    );
    switch (tab) {
      case "students": return <StudentsTab groups={db.groups} setGroups={setGroups} />;
      case "rota": return <RotaTab staff={db.staff} progStart={progStart} progEnd={progEnd} excDays={db.excDays} groups={db.groups} rotaGrid={db.rotaGrid} setRotaGrid={setRotaGrid} />;
      case "programmes": return <ProgrammesTab groups={db.groups} progStart={progStart} progEnd={progEnd} centre={centreName} excDays={db.excDays} setExcDays={setExcDays} progGrid={db.progGrid} setProgGrid={setProgGrid} />;
      case "catering": return <CateringTab groups={db.groups} staff={db.staff} progStart={progStart} progEnd={progEnd} excDays={db.excDays} cateringData={db.cateringData} setCateringData={setCateringData} />;
      case "transfers": return <TransfersTab groups={db.groups} transfers={db.transfersData} setTransfers={setTransfers} />;
      case "team": return <TeamTab staff={db.staff} setStaff={setStaff} />;
      case "excursions": return <ExcursionsTab excDays={db.excDays} setExcDays={setExcDays} groups={db.groups} progStart={progStart} progEnd={progEnd} excursions={db.excursions} setExcursions={setExcursions} />;
      case "pettycash": return <PettyCashTab />;
      case "contacts": return <ContactsTab />;
      default: return null;
    }
  };

  return (
    <div style={{ fontFamily: "Open Sans, sans-serif", background: B.bg, color: B.text, minHeight: "100vh", fontSize: 13 }}>
      <header style={{ background: B.navy, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: B.red, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: B.white }}>UK</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: B.white }}>UKLC Centre Dashboard</div>
          {saving && <span style={{ fontSize: 9, color: "#86efac", fontWeight: 600, marginLeft: 8 }}>Saving...</span>}
          {!saving && lastSaved && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>{"\u2713"} Saved</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(auth.isHeadOffice || !auth.userCentreId) ? (
            <select value={centreName} onChange={(e) => handleCentreChange(e.target.value)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "6px 10px", borderRadius: 5, fontSize: 11, fontFamily: "inherit", maxWidth: 220 }}>
              <option value="" style={{ color: "#333" }}>Select Centre...</option>
              {db.centres.map((c) => <option key={c.id} value={c.name} style={{ color: "#333" }}>{c.name}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{centreName || "No centre assigned"}</span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>DATES</span>
            <input type="date" value={manualStart} onChange={(e) => handleDateChange("start", e.target.value)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontFamily: "inherit" }} />
            <span style={{ color: "rgba(255,255,255,0.3)" }}>{"\u2192"}</span>
            <input type="date" value={manualEnd} onChange={(e) => handleDateChange("end", e.target.value)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontFamily: "inherit" }} />
            {(progStart !== manualStart || progEnd !== manualEnd) && (
              <span style={{ fontSize: 8, color: "#86efac", fontWeight: 700 }}>Auto: {progStart.slice(5)} {"\u2192"} {progEnd.slice(5)}</span>
            )}
          </div>
          <div style={{ borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{auth.userName}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>{auth.userRole.replace(/_/g, " ")}</div>
            </div>
            <button onClick={auth.logout} title="Sign out" style={{
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)", borderRadius: 5, padding: "5px 8px", cursor: "pointer",
              fontSize: 10, fontFamily: "inherit", fontWeight: 600,
            }}>Logout</button>
          </div>
        </div>
      </header>
      <nav style={{ background: B.white, borderBottom: "2px solid " + B.border, padding: "0 12px", display: "flex", overflowX: "auto", gap: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "10px 14px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
            borderBottom: tab === t.id ? "3px solid " + B.red : "3px solid transparent",
            background: "transparent", color: tab === t.id ? B.navy : B.textMuted, transition: "all 0.15s",
          }}><span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}</button>
        ))}
      </nav>
      <div style={{ minHeight: "calc(100vh - 100px)", maxWidth: "100vw" }}>{renderTab()}</div>
    </div>
  );
}
