"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { B, CENTRES, TABS } from "@/lib/constants";
import { IcHome, IcGradCap, IcCalGrid, IcClipboard, IcFork, IcPlane, IcUsersTab, IcMapPin, IcKey, IcCoins, IcPhone, IcBuilding } from "@/components/ui";
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

  const TAB_ICONS = {
    home: <IcHome />, students: <IcGradCap />, rota: <IcCalGrid />,
    programmes: <IcClipboard />, catering: <IcFork />, transfers: <IcPlane />,
    team: <IcUsersTab />, excursions: <IcMapPin />, rooming: <IcKey />,
    pettycash: <IcCoins />, contacts: <IcPhone />,
  };

  const renderTab = () => {
    if (!centreId) return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 14 }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: B.ice, border: `2px solid ${B.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: B.navy }}>
          <IcBuilding />
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: B.navy, fontFamily: "'Raleway', sans-serif" }}>Select a centre to get started</div>
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
      case "excursions": return <ExcursionsTab excDays={db.excDays} setExcDays={setExcDays} groups={activeGroups} progStart={progStart} progEnd={progEnd} excursions={db.excursions} setExcursions={setExcursions} centre={centreName} progGrid={db.progGrid} settings={db.settings} />;
      case "rooming": return <RoomingTab
        groups={db.groups} progStart={progStart} progEnd={progEnd}
        roomingHouses={db.roomingHouses} setRoomingHouses={setRoomingHouses}
        roomingRooms={db.roomingRooms} setRoomingRooms={setRoomingRooms}
        roomingAssignments={db.roomingAssignments} setRoomingAssignments={setRoomingAssignments}
        roomingOverrides={roomingOverrides} setRoomingOverrides={setRoomingOverrides}
        centreId={centreId}
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
        position: "relative", overflow: "hidden",
        padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 68, flexShrink: 0,
      }}>
        {/* Brand graphic — subtle union jack cross pattern */}
        <svg aria-hidden="true" style={{ position: "absolute", right: -20, top: -20, opacity: 0.055, pointerEvents: "none" }} width="320" height="110" viewBox="0 0 320 110">
          <rect x="130" y="0" width="60" height="110" fill="white" />
          <rect x="0" y="35" width="320" height="40" fill="white" />
          <path d="M0 0 L80 110M240 0 L320 110" stroke="white" strokeWidth="28" />
          <path d="M320 0 L240 110M80 0 L0 110" stroke="white" strokeWidth="28" />
        </svg>

        {/* Left: logo + subtitle */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 1 }}>
          <div style={{
            background: B.white, borderRadius: 8, padding: "5px 14px 5px 10px",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          }}>
            <img src="/logo-new.png" alt="UKLC" style={{ height: 34, display: "block" }} />
            <div style={{ width: 1, height: 28, background: B.border }} />
            <div style={{ fontSize: 8, fontWeight: 700, color: B.textMuted, letterSpacing: 1.8, textTransform: "uppercase", whiteSpace: "nowrap", fontFamily: "'Raleway', sans-serif" }}>Centre Dashboard</div>
          </div>
          {saving && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 6, padding: "3px 10px", background: "rgba(134,239,172,0.15)", border: "1px solid rgba(134,239,172,0.3)", borderRadius: 20 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#86efac", display: "block", animation: "spin 1.2s linear infinite" }} />
              <span style={{ fontSize: 10, color: "#86efac", fontWeight: 700, fontFamily: "'Raleway', sans-serif" }}>Saving…</span>
            </div>
          )}
          {!saving && lastSaved && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>Saved</span>
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
          <select value={centreName} onChange={(e) => handleCentreChange(e.target.value)} style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 12,
            fontFamily: "'Open Sans', sans-serif", fontWeight: 600, maxWidth: 260, cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}>
            <option value="" style={{ color: "#333", background: "#1c3048" }}>Select Centre…</option>
            {db.centres.map((c) => <option key={c.id} value={c.name} style={{ color: "#333", background: "#fff" }}>{c.name}</option>)}
          </select>

          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8, padding: "7px 14px", backdropFilter: "blur(4px)",
          }}>
            <span style={{ fontSize: 8, color: B.yellow, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Raleway', sans-serif" }}>Season</span>
            <input type="date" value={manualStart} onChange={(e) => handleDateChange("start", e.target.value)} style={{ background: "transparent", border: "none", color: "#fff", padding: "1px 4px", fontSize: 11, fontFamily: "'Open Sans', sans-serif", outline: "none", cursor: "pointer" }} />
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>→</span>
            <input type="date" value={manualEnd} onChange={(e) => handleDateChange("end", e.target.value)} style={{ background: "transparent", border: "none", color: "#fff", padding: "1px 4px", fontSize: 11, fontFamily: "'Open Sans', sans-serif", outline: "none", cursor: "pointer" }} />
            {(progStart !== manualStart || progEnd !== manualEnd) && (
              <span style={{ fontSize: 9, color: B.yellow, fontWeight: 800, marginLeft: 2, fontFamily: "'Raleway', sans-serif" }}>Auto: {progStart.slice(5)} → {progEnd.slice(5)}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Brand colour strip ──────────────────────────────────────────── */}
      <div aria-hidden="true" style={{ height: 4, background: `linear-gradient(90deg, ${B.navy} 0%, ${B.red} 20%, ${B.yellow} 42%, ${B.pink} 64%, ${B.ice} 86%, ${B.white} 100%)`, flexShrink: 0 }} />

      {/* ── Nav tabs ────────────────────────────────────────────────────── */}
      <nav style={{
        background: B.white, borderBottom: `1px solid ${B.border}`,
        padding: "0 12px", display: "flex", overflowX: "auto", gap: 0,
        boxShadow: "0 2px 12px rgba(28,48,72,0.08)", flexShrink: 0,
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className="nav-tab" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 14px", height: 48, border: "none", cursor: "pointer",
              fontFamily: "'Raleway', sans-serif", fontSize: 11, fontWeight: 700,
              whiteSpace: "nowrap", transition: "all 0.12s",
              borderBottom: active ? `3px solid ${B.red}` : "3px solid transparent",
              background: active ? "rgba(28,48,72,0.05)" : "transparent",
              color: active ? B.navy : B.textMuted,
              borderRadius: "4px 4px 0 0",
            }}>
              <span style={{ color: active ? B.red : B.textLight, display: "flex", alignItems: "center" }}>
                {TAB_ICONS[t.id]}
              </span>
              {t.label}
            </button>
          );
        })}
      </nav>

      <div style={{ minHeight: "calc(100vh - 120px)" }}>{renderTab()}</div>
    </div>
  );
}
