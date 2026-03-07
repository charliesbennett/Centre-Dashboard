"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { B, CENTRES, TABS } from "@/lib/constants";
import { useSupabase } from "@/lib/useSupabase";
import StudentsTab from "@/components/tabs/StudentsTab";
import RotaTab from "@/components/tabs/RotaTab";
import ProgrammesTab from "@/components/tabs/ProgrammesTab";
import CateringTab from "@/components/tabs/CateringTab";
import TransfersTab from "@/components/tabs/TransfersTab";
import TeamTab from "@/components/tabs/TeamTab";
import ExcursionsTab from "@/components/tabs/ExcursionsTab";
import PettyCashTab from "@/components/tabs/PettyCashTab";
import ContactsTab from "@/components/tabs/ContactsTab";
import RoomingTab from "@/components/tabs/RoomingTab";
import HomeTab from "@/components/tabs/HomeTab";

export default function Dashboard() {
  const [tab, setTab] = useState("home");
  const [centreId, setCentreId] = useState("");
  const [centreName, setCentreName] = useState("");
  const [manualStart, setManualStart] = useState("2026-07-04");
  const [manualEnd, setManualEnd] = useState("2026-08-05");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const db = useSupabase(centreId);

  const handleCentreChange = (name) => {
    setCentreName(name);
    const c = db.centres.find((x) => x.name === name);
    setCentreId(c ? c.id : "");
  };

  useEffect(() => {
    if (db.settings.prog_start) setManualStart(db.settings.prog_start);
    if (db.settings.prog_end) setManualEnd(db.settings.prog_end);
  }, [db.settings]);

  const isMinistay = centreName.toLowerCase().includes("ministay");
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
      progStart: isMinistay ? earliest : (earliest < manualStart ? earliest : manualStart),
      progEnd: isMinistay ? latest : (latest > manualEnd ? latest : manualEnd),
    };
  }, [db.groups, db.staff, manualStart, manualEnd, isMinistay]);

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

  const setTransfers = useCallback((updater) => {
    db.setTransfers((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      next.forEach((t) => {
        const old = prev.find((p) => p.id === t.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(t)) db.saveTransfer(t);
      });
      prev.forEach((p) => {
        if (!next.find((t) => t.id === p.id)) db.deleteTransfer(p.id);
      });
      return next;
    });
  }, [db.saveTransfer, db.deleteTransfer]);

  const roomingAssignSaveTimer = useRef(null);
  const [roomingOverrides, setRoomingOverridesState] = useState({});

  // Load rooming overrides from settings
  useEffect(() => {
    if (db.settings.rooming_overrides) {
      try { setRoomingOverridesState(JSON.parse(db.settings.rooming_overrides)); } catch {}
    } else {
      setRoomingOverridesState({});
    }
  }, [db.settings.rooming_overrides]);

  const setRoomingOverrides = useCallback((updater) => {
    setRoomingOverridesState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      db.saveSetting("rooming_overrides", JSON.stringify(next));
      setLastSaved(new Date());
      return next;
    });
  }, [db.saveSetting]);

  const setRoomingHouses = useCallback((updater) => {
    db.setRoomingHouses((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      next.forEach((h) => {
        const old = prev.find((p) => p.id === h.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(h)) db.saveRoomingHouse(h);
      });
      prev.forEach((p) => { if (!next.find((h) => h.id === p.id)) db.deleteRoomingHouse(p.id); });
      setLastSaved(new Date());
      return next;
    });
  }, [db.saveRoomingHouse, db.deleteRoomingHouse]);

  const setRoomingRooms = useCallback((updater) => {
    db.setRoomingRooms((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      next.forEach((r) => {
        const old = prev.find((p) => p.id === r.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(r)) db.saveRoomingRoom(r);
      });
      prev.forEach((p) => { if (!next.find((r) => r.id === p.id)) db.deleteRoomingRoom(p.id); });
      setLastSaved(new Date());
      return next;
    });
  }, [db.saveRoomingRoom, db.deleteRoomingRoom]);

  const setRoomingAssignments = useCallback((updater) => {
    db.setRoomingAssignments((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      clearTimeout(roomingAssignSaveTimer.current);
      roomingAssignSaveTimer.current = setTimeout(async () => {
        await db.saveRoomingAssignments(next);
        setLastSaved(new Date());
      }, 1500);
      return next;
    });
  }, [db.saveRoomingAssignments]);

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

  const handleDateChange = (key, val) => {
    if (key === "start") { setManualStart(val); db.saveSetting("prog_start", val); }
    else { setManualEnd(val); db.saveSetting("prog_end", val); }
  };

  const renderTab = () => {
    if (!centreId) return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: B.ice, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🏛️</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: B.navy, fontFamily: "'Raleway', sans-serif" }}>Select a centre to get started</div>
        <div style={{ fontSize: 12, color: B.textMuted }}>Choose a centre from the dropdown in the top bar</div>
      </div>
    );
    if (db.loading) return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 10 }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${B.border}`, borderTopColor: B.red, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: B.textMuted }}>Loading {centreName}…</div>
      </div>
    );
    const activeGroups = (db.groups || []).filter((g) => !g.archived);
    switch (tab) {
      case "home": return <HomeTab groups={db.groups} staff={db.staff} excDays={db.excDays} progGrid={db.progGrid} rotaGrid={db.rotaGrid} progStart={progStart} progEnd={progEnd} />;
      case "students": return <StudentsTab groups={db.groups} setGroups={setGroups} />;
      case "rota": return <RotaTab staff={db.staff} progStart={progStart} progEnd={progEnd} excDays={db.excDays} groups={activeGroups} rotaGrid={db.rotaGrid} setRotaGrid={setRotaGrid} />;
      case "programmes": return <ProgrammesTab groups={activeGroups} progStart={progStart} progEnd={progEnd} centre={centreName} excDays={db.excDays} setExcDays={setExcDays} progGrid={db.progGrid} setProgGrid={setProgGrid} settings={db.settings} saveSetting={db.saveSetting} />;
      case "catering": return <CateringTab groups={activeGroups} staff={db.staff} progStart={progStart} progEnd={progEnd} excDays={db.excDays} />;
      case "transfers": return <TransfersTab groups={activeGroups} transfers={db.transfers} setTransfers={setTransfers} />;
      case "team": return <TeamTab staff={db.staff} setStaff={setStaff} />;
      case "excursions": return <ExcursionsTab excDays={db.excDays} setExcDays={setExcDays} groups={activeGroups} progStart={progStart} progEnd={progEnd} excursions={db.excursions} setExcursions={setExcursions} />;
      case "rooming": return <RoomingTab
        groups={db.groups} progStart={progStart} progEnd={progEnd}
        roomingHouses={db.roomingHouses} setRoomingHouses={setRoomingHouses}
        roomingRooms={db.roomingRooms} setRoomingRooms={setRoomingRooms}
        roomingAssignments={db.roomingAssignments} setRoomingAssignments={setRoomingAssignments}
        roomingOverrides={roomingOverrides} setRoomingOverrides={setRoomingOverrides}
      />;
      case "pettycash": return <PettyCashTab />;
      case "contacts": return <ContactsTab />;
      default: return null;
    }
  };

  return (
    <div style={{ fontFamily: "'Open Sans', sans-serif", background: B.bg, color: B.text, minHeight: "100vh", fontSize: 13 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        background: B.navy,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 60, flexShrink: 0,
      }}>
        {/* Left: brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: B.red,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Raleway', sans-serif", fontWeight: 900, fontSize: 14,
            color: B.white, letterSpacing: 0.5, flexShrink: 0,
            boxShadow: "0 3px 10px rgba(236,39,59,0.45)",
          }}>UK</div>
          <div>
            <div style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 900, fontSize: 19, color: B.white, letterSpacing: -0.5, lineHeight: 1 }}>UKLC</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 1.8, textTransform: "uppercase", marginTop: 1 }}>Centre Dashboard</div>
          </div>
          {saving && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4, padding: "3px 10px", background: "rgba(134,239,172,0.12)", border: "1px solid rgba(134,239,172,0.25)", borderRadius: 20 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#86efac", display: "block" }} />
              <span style={{ fontSize: 10, color: "#86efac", fontWeight: 600 }}>Saving</span>
            </div>
          )}
          {!saving && lastSaved && (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: 4, fontWeight: 500 }}>✓ Saved</span>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={centreName} onChange={(e) => handleCentreChange(e.target.value)} style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff", padding: "7px 12px", borderRadius: 8, fontSize: 12,
            fontFamily: "'Open Sans', sans-serif", fontWeight: 600, maxWidth: 240, cursor: "pointer",
          }}>
            <option value="" style={{ color: "#333", background: "#1c3048" }}>Select Centre…</option>
            {db.centres.map((c) => <option key={c.id} value={c.name} style={{ color: "#333", background: "#fff" }}>{c.name}</option>)}
          </select>

          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 8, padding: "5px 12px",
          }}>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Raleway', sans-serif" }}>Dates</span>
            <input type="date" value={manualStart} onChange={(e) => handleDateChange("start", e.target.value)} style={{ background: "transparent", border: "none", color: "#fff", padding: "2px 6px", fontSize: 11, fontFamily: "'Open Sans', sans-serif", outline: "none", cursor: "pointer" }} />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>→</span>
            <input type="date" value={manualEnd} onChange={(e) => handleDateChange("end", e.target.value)} style={{ background: "transparent", border: "none", color: "#fff", padding: "2px 6px", fontSize: 11, fontFamily: "'Open Sans', sans-serif", outline: "none", cursor: "pointer" }} />
            {(progStart !== manualStart || progEnd !== manualEnd) && (
              <span style={{ fontSize: 9, color: "#86efac", fontWeight: 700, marginLeft: 2, fontFamily: "'Raleway', sans-serif" }}>Auto: {progStart.slice(5)} → {progEnd.slice(5)}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Nav tabs ────────────────────────────────────────────────────── */}
      <nav style={{
        background: B.white, borderBottom: `1px solid ${B.border}`,
        padding: "0 16px", display: "flex", overflowX: "auto", gap: 0,
        boxShadow: "0 2px 8px rgba(28,48,72,0.06)", flexShrink: 0,
      }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="nav-tab" style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "0 15px", height: 46, border: "none", cursor: "pointer",
            fontFamily: "'Raleway', sans-serif", fontSize: 12, fontWeight: 700,
            whiteSpace: "nowrap",
            borderBottom: tab === t.id ? `3px solid ${B.red}` : "3px solid transparent",
            background: tab === t.id ? "rgba(28,48,72,0.04)" : "transparent",
            color: tab === t.id ? B.navy : B.textMuted,
            borderRadius: "4px 4px 0 0",
          }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ minHeight: "calc(100vh - 106px)" }}>{renderTab()}</div>
    </div>
  );
}
