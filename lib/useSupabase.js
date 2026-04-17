"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

/*
  useSupabase(centreId)
  - Loads all data for a centre via server-side API routes (service role key, never exposed to client)
  - Returns { data, loading, error, save*, delete* } functions
  - Realtime subscriptions still use the anon key (SELECT-only) for live sync between managers
*/

async function api(path, method = "GET", body = undefined) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "API error");
  return json;
}

export function useSupabase(centreId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [centres, setCentres] = useState([]);

  // Data
  const [groups, setGroups] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rotaGrid, setRotaGrid] = useState({});
  const [progGrid, setProgGrid] = useState({});
  const [excDays, setExcDays] = useState({});
  const [excursions, setExcursions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [settings, setSettings] = useState({});
  const [roomingHouses, setRoomingHouses] = useState([]);
  const [roomingRooms, setRoomingRooms] = useState([]);
  const [roomingAssignments, setRoomingAssignments] = useState([]);

  // Track last-saved state for diff-based saves (eliminates delete-all race condition)
  const lastSavedRotaRef = useRef({});
  const lastSavedProgRef = useRef({});
  const lastSavedExcDaysRef = useRef({});
  const lastSavedExcursionsRef = useRef([]);
  const lastSavedAssignmentsRef = useRef([]);

  // Track if initial load done
  const loaded = useRef(false);

  // ── Load centres list ─────────────────────────────────
  useEffect(() => {
    api("/api/db/centres")
      .then((data) => setCentres(data))
      .catch((e) => console.error("centres load:", e));
  }, []);

  // ── Load all data for selected centre ─────────────────
  const loadCentre = useCallback(async (cid) => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api(`/api/db/centre/${cid}`);

      // Groups + students
      const studentsMap = {};
      (d.students || []).forEach((s) => {
        if (!studentsMap[s.group_id]) studentsMap[s.group_id] = { students: [], leaders: [] };
        if (s.type === "gl") studentsMap[s.group_id].leaders.push(dbToStudent(s));
        else studentsMap[s.group_id].students.push(dbToStudent(s));
      });
      setGroups((d.groups || []).map((g) => ({
        id: g.id,
        agent: g.agent || "",
        group: g.group_name || "",
        nat: g.nationality || "",
        stu: g.students_count || 0,
        gl: g.gls_count || 0,
        arr: g.arrival_date || "",
        dep: g.departure_date || "",
        firstMeal: g.first_meal || "Dinner",
        lastMeal: g.last_meal || "Packed Lunch",
        prog: g.programme || "Multi-Activity",
        lessonSlot: g.lesson_slot || "AM",
        centre: g.centre_name || "",
        arrAirport: g.arr_airport || "",
        arrFlight: g.arr_flight || "",
        arrTime: g.arr_time || "",
        depAirport: g.dep_airport || "",
        depFlight: g.dep_flight || "",
        depTime: g.dep_time || "",
        archived: g.archived || false,
        students: studentsMap[g.id]?.students || [],
        leaders: studentsMap[g.id]?.leaders || [],
      })));

      // Staff
      setStaff((d.staff || []).map((s) => ({
        id: s.id, name: s.name, role: s.role,
        acc: s.accommodation || "Residential",
        arr: s.arrival_date || "", dep: s.departure_date || "",
        to: s.time_off || "", email: s.email || "", phone: s.phone || "",
        dbs: s.dbs_number || "", dbsExpiry: s.dbs_expiry || "",
        contract: s.contract_type || "", notes: s.notes || "",
      })));

      // Rota grid
      const rg = {};
      (d.rotaCells || []).forEach((r) => { rg[r.staff_id + "-" + r.cell_date + "-" + r.slot] = r.value; });
      setRotaGrid(rg);
      lastSavedRotaRef.current = { ...rg };

      // Programme grid
      const pg = {};
      (d.programmeCells || []).forEach((p) => { pg[p.group_id + "-" + p.cell_date + "-" + p.slot] = p.value; });
      setProgGrid(pg);
      lastSavedProgRef.current = { ...pg };

      // Excursion days
      const ed = {};
      (d.excursionDays || []).forEach((e) => { ed[e.exc_date] = e.exc_type; });
      setExcDays(ed);
      lastSavedExcDaysRef.current = { ...ed };

      // Excursions
      const excList = (d.excursions || []).map((e) => ({
        id: e.id, date: e.exc_date,
        destination: e.destination || "",
        coaches: e.coaches || [],
        notes: e.notes || "",
      }));
      setExcursions(excList);
      lastSavedExcursionsRef.current = [...excList];

      // Transfers
      setTransfers((d.transfers || []).map((t) => {
        let extras = {};
        try { if (t.notes && t.notes.startsWith("{")) extras = JSON.parse(t.notes); } catch {}
        return {
          id: t.id, groupId: t.group_id,
          agent: extras.agent || "",
          group: extras.group || "",
          pax: t.pax || 0,
          arrAirport: t.airport || "Heathrow",
          arrDate: t.transfer_date || "",
          arrFlight: t.flight_number || "",
          arrTime: t.transfer_time || "",
          arrTerminal: extras.arrTerminal || "",
          arrNotes: extras.arrNotes || "",
          depAirport: extras.depAirport || "Heathrow",
          depDate: extras.depDate || "",
          depFlight: extras.depFlight || "",
          depTime: extras.depTime || "",
          depTerminal: extras.depTerminal || "",
          depNotes: extras.depNotes || "",
          uklc: extras.uklc || "Yes",
          status: t.status || "Pending",
        };
      }));

      // Settings
      const st = {};
      (d.settings || []).forEach((s) => { st[s.setting_key] = s.setting_value; });
      setSettings(st);

      // Rooming: houses
      setRoomingHouses((d.roomingHouses || []).map((h) => ({
        id: h.id, name: h.name, sortOrder: h.sort_order || 0,
      })));

      // Rooming: rooms
      setRoomingRooms((d.roomingRooms || []).map((r) => ({
        id: r.id, houseId: r.house_id, floorLabel: r.floor_label || "",
        roomName: r.room_name, capacity: r.capacity || 2, sortOrder: r.sort_order || 0,
      })));

      // Rooming: assignments
      const mappedAssignments = (d.roomingAssignments || []).map((a) => ({
        id: a.id, roomId: a.room_id, slotIndex: a.slot_index || 0,
        occupantName: a.occupant_name || "", groupId: a.group_id || "",
        occupantType: a.occupant_type || "student", notes: a.notes || "",
      }));
      setRoomingAssignments(mappedAssignments);
      lastSavedAssignmentsRef.current = [...mappedAssignments];

      loaded.current = true;
    } catch (err) {
      console.error("Load error:", err);
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (centreId) loadCentre(centreId);
  }, [centreId, loadCentre]);

  // ── Realtime subscriptions ────────────────────────────
  // Uses anon key (SELECT-only) to receive live changes from other managers.
  // Requires concurrent_fix_migration.sql to have been run in Supabase.
  useEffect(() => {
    if (!centreId) return;

    const ch = supabase
      .channel(`rt-centre-${centreId}`)

      // Rota cells
      .on("postgres_changes", {
        event: "*", schema: "public", table: "rota_cells",
        filter: `centre_id=eq.${centreId}`,
      }, (payload) => {
        if (payload.eventType === "DELETE") {
          const r = payload.old;
          const key = `${r.staff_id}-${r.cell_date}-${r.slot}`;
          setRotaGrid((prev) => { const n = { ...prev }; delete n[key]; return n; });
          delete lastSavedRotaRef.current[key];
        } else {
          const r = payload.new;
          const key = `${r.staff_id}-${r.cell_date}-${r.slot}`;
          setRotaGrid((prev) => prev[key] === r.value ? prev : { ...prev, [key]: r.value });
          lastSavedRotaRef.current[key] = r.value;
        }
      })

      // Programme cells
      .on("postgres_changes", {
        event: "*", schema: "public", table: "programme_cells",
        filter: `centre_id=eq.${centreId}`,
      }, (payload) => {
        if (payload.eventType === "DELETE") {
          const r = payload.old;
          const key = `${r.group_id}-${r.cell_date}-${r.slot}`;
          setProgGrid((prev) => { const n = { ...prev }; delete n[key]; return n; });
          delete lastSavedProgRef.current[key];
        } else {
          const r = payload.new;
          const key = `${r.group_id}-${r.cell_date}-${r.slot}`;
          setProgGrid((prev) => prev[key] === r.value ? prev : { ...prev, [key]: r.value });
          lastSavedProgRef.current[key] = r.value;
        }
      })

      // Excursion days
      .on("postgres_changes", {
        event: "*", schema: "public", table: "excursion_days",
        filter: `centre_id=eq.${centreId}`,
      }, (payload) => {
        if (payload.eventType === "DELETE") {
          const r = payload.old;
          setExcDays((prev) => { const n = { ...prev }; delete n[r.exc_date]; return n; });
          delete lastSavedExcDaysRef.current[r.exc_date];
        } else {
          const r = payload.new;
          setExcDays((prev) => prev[r.exc_date] === r.exc_type ? prev : { ...prev, [r.exc_date]: r.exc_type });
          lastSavedExcDaysRef.current[r.exc_date] = r.exc_type;
        }
      })

      // Excursions (destination + coaches)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "excursions",
        filter: `centre_id=eq.${centreId}`,
      }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = payload.old.id;
          setExcursions((prev) => prev.filter((e) => e.id !== id));
          lastSavedExcursionsRef.current = lastSavedExcursionsRef.current.filter((e) => e.id !== id);
        } else {
          const r = payload.new;
          const mapped = { id: r.id, date: r.exc_date, destination: r.destination || "", coaches: r.coaches || [], notes: r.notes || "" };
          setExcursions((prev) => {
            const exists = prev.find((e) => e.id === r.id);
            return exists ? prev.map((e) => e.id === r.id ? mapped : e) : [...prev, mapped];
          });
          const idx = lastSavedExcursionsRef.current.findIndex((e) => e.id === r.id);
          if (idx >= 0) lastSavedExcursionsRef.current[idx] = mapped;
          else lastSavedExcursionsRef.current.push(mapped);
        }
      })

      // Rooming assignments
      .on("postgres_changes", {
        event: "*", schema: "public", table: "rooming_assignments",
        filter: `centre_id=eq.${centreId}`,
      }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = payload.old.id;
          setRoomingAssignments((prev) => prev.filter((a) => a.id !== id));
          lastSavedAssignmentsRef.current = lastSavedAssignmentsRef.current.filter((a) => a.id !== id);
        } else {
          const a = payload.new;
          const mapped = {
            id: a.id, roomId: a.room_id, slotIndex: a.slot_index || 0,
            occupantName: a.occupant_name || "", groupId: a.group_id || "",
            occupantType: a.occupant_type || "student", notes: a.notes || "",
          };
          setRoomingAssignments((prev) => {
            const exists = prev.find((x) => x.id === a.id);
            return exists ? prev.map((x) => x.id === a.id ? mapped : x) : [...prev, mapped];
          });
          const idx = lastSavedAssignmentsRef.current.findIndex((x) => x.id === a.id);
          if (idx >= 0) lastSavedAssignmentsRef.current[idx] = mapped;
          else lastSavedAssignmentsRef.current.push(mapped);
        }
      })

      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [centreId]);

  // ── SAVE: Groups ──────────────────────────────────────
  const saveGroup = async (group) => {
    try {
      await api("/api/db/groups", "POST", { group, centreId });
      return true;
    } catch (e) {
      console.error("saveGroup:", e);
      return false;
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      await api("/api/db/groups", "DELETE", { groupId });
    } catch (e) {
      console.error("deleteGroup:", e);
    }
  };

  // ── SAVE: Staff ───────────────────────────────────────
  const saveStaffMember = async (s) => {
    try {
      await api("/api/db/staff", "POST", { staff: s, centreId });
    } catch (e) {
      console.error("saveStaff:", e);
      if (typeof window !== "undefined") alert(`Staff save failed: ${e.message}`);
    }
  };

  const deleteStaffMember = async (staffId) => {
    try {
      await api("/api/db/staff", "DELETE", { staffId });
    } catch (e) {
      console.error("deleteStaff:", e);
    }
  };

  // ── SAVE: Rota Grid (diff-based) ──────────────────────
  const ROTA_KEY_RE = /^(.+)-(\d{4}-\d{2}-\d{2})-(AM|PM|Eve)$/;

  const saveRotaGrid = async (newGrid) => {
    if (!centreId) return;
    const prev = lastSavedRotaRef.current;

    const toDelete = [];
    Object.entries(prev).forEach(([key, prevVal]) => {
      if (prevVal && !newGrid[key]) {
        const m = key.match(ROTA_KEY_RE);
        if (m) toDelete.push({ staffId: m[1], date: m[2], slot: m[3] });
      }
    });

    const toUpsert = [];
    Object.entries(newGrid).forEach(([key, value]) => {
      if (value && value !== prev[key]) {
        const m = key.match(ROTA_KEY_RE);
        if (m) toUpsert.push({ centre_id: centreId, staff_id: m[1], cell_date: m[2], slot: m[3], value });
      }
    });

    if (toDelete.length === 0 && toUpsert.length === 0) return;

    try {
      await api("/api/db/rota", "POST", { centreId, toDelete, toUpsert });
      lastSavedRotaRef.current = { ...newGrid };
    } catch (e) {
      console.error("saveRotaGrid:", e);
    }
  };

  // ── SAVE: Programme Grid (diff-based) ─────────────────
  const PROG_KEY_RE = /^(.+)-(\d{4}-\d{2}-\d{2})-(AM|PM|Eve|EVE)$/;

  const saveProgGrid = async (newGrid) => {
    if (!centreId) return;
    const prev = lastSavedProgRef.current;

    const toDelete = [];
    Object.entries(prev).forEach(([key, prevVal]) => {
      if (prevVal && !newGrid[key]) {
        const m = key.match(PROG_KEY_RE);
        if (m) toDelete.push({ groupId: m[1], date: m[2], slot: m[3] });
      }
    });

    const toUpsert = [];
    Object.entries(newGrid).forEach(([key, value]) => {
      if (value && value !== prev[key]) {
        const m = key.match(PROG_KEY_RE);
        if (m) toUpsert.push({ centre_id: centreId, group_id: m[1], cell_date: m[2], slot: m[3], value });
      }
    });

    if (toDelete.length === 0 && toUpsert.length === 0) return;

    try {
      await api("/api/db/programme", "POST", { centreId, toDelete, toUpsert });
      lastSavedProgRef.current = { ...newGrid };
    } catch (e) {
      console.error("saveProgGrid:", e);
    }
  };

  // ── SAVE: Excursion Days (diff-based) ─────────────────
  const saveExcDays = async (newExcDays) => {
    if (!centreId) return;
    const prev = lastSavedExcDaysRef.current;

    const toDelete = Object.keys(prev).filter((date) => prev[date] && !newExcDays[date]);
    const toUpsert = Object.entries(newExcDays)
      .filter(([date, type]) => type && type !== prev[date])
      .map(([date, type]) => ({ centre_id: centreId, exc_date: date, exc_type: type }));

    if (toDelete.length === 0 && toUpsert.length === 0) return;

    try {
      await api("/api/db/excursion-days", "POST", { centreId, toDelete, toUpsert });
      lastSavedExcDaysRef.current = { ...newExcDays };
    } catch (e) {
      console.error("saveExcDays:", e);
    }
  };

  // ── SAVE: Excursions list (diff-based) ────────────────
  const saveExcursions = async (newExcursions) => {
    if (!centreId) return;
    const prev = lastSavedExcursionsRef.current;

    const toDelete = prev
      .filter((pe) => !newExcursions.find((e) => e.id === pe.id))
      .map((pe) => pe.id);

    const toUpsert = newExcursions
      .filter((e) => {
        const pe = prev.find((p) => p.id === e.id);
        return !pe || JSON.stringify(pe) !== JSON.stringify(e);
      })
      .map((e) => ({
        id: e.id, centre_id: centreId,
        exc_date: e.date, destination: e.destination || "",
        coaches: e.coaches || [], notes: e.notes || "",
      }));

    if (toDelete.length === 0 && toUpsert.length === 0) return;

    try {
      await api("/api/db/excursions", "POST", { toDelete, toUpsert });
      lastSavedExcursionsRef.current = [...newExcursions];
    } catch (e) {
      console.error("saveExcursions:", e);
    }
  };

  // ── SAVE: Transfer ────────────────────────────────────
  const saveTransfer = async (t) => {
    const extras = {
      agent: t.agent || "", group: t.group || "",
      arrNotes: t.arrNotes || "", arrTerminal: t.arrTerminal || "",
      depAirport: t.depAirport || "Heathrow", depDate: t.depDate || "",
      depFlight: t.depFlight || "", depTime: t.depTime || "",
      depTerminal: t.depTerminal || "", depNotes: t.depNotes || "",
      uklc: t.uklc || "Yes",
    };
    const row = {
      id: t.id, centre_id: centreId, group_id: t.groupId || null,
      type: "group",
      transfer_date: t.arrDate || null, transfer_time: t.arrTime || "",
      airport: t.arrAirport || "", flight_number: t.arrFlight || "",
      pax: t.pax || 0,
      vehicle_type: "", driver_name: "", driver_phone: "", pickup_point: "",
      status: t.status || "Pending",
      notes: JSON.stringify(extras),
    };
    try {
      await api("/api/db/transfers", "POST", { row });
    } catch (e) {
      console.error("saveTransfer:", e);
    }
  };

  const deleteTransfer = async (transferId) => {
    try {
      await api("/api/db/transfers", "DELETE", { transferId });
    } catch (e) {
      console.error("deleteTransfer:", e);
    }
  };

  // ── SAVE: Rooming Houses ──────────────────────────────
  const saveRoomingHouse = async (house) => {
    try {
      await api("/api/db/rooming/houses", "POST", { house, centreId });
    } catch (e) {
      console.error("saveRoomingHouse:", e);
    }
  };

  const deleteRoomingHouse = async (houseId) => {
    try {
      await api("/api/db/rooming/houses", "DELETE", { houseId });
    } catch (e) {
      console.error("deleteRoomingHouse:", e);
    }
  };

  // ── SAVE: Rooming Rooms ───────────────────────────────
  const saveRoomingRoom = async (room) => {
    try {
      await api("/api/db/rooming/rooms", "POST", { room, centreId });
    } catch (e) {
      console.error("saveRoomingRoom:", e);
    }
  };

  const deleteRoomingRoom = async (roomId) => {
    try {
      await api("/api/db/rooming/rooms", "DELETE", { roomId });
    } catch (e) {
      console.error("deleteRoomingRoom:", e);
    }
  };

  // ── SAVE: Rooming Assignments (diff-based) ────────────
  const saveRoomingAssignments = async (newAssignments) => {
    if (!centreId) return;
    const prev = lastSavedAssignmentsRef.current;

    const toDelete = prev
      .filter((pa) => !newAssignments.find((na) => na.id === pa.id))
      .map((pa) => pa.id);

    const toUpsert = newAssignments
      .filter((a) => {
        const pa = prev.find((p) => p.id === a.id);
        return !pa || JSON.stringify(pa) !== JSON.stringify(a);
      })
      .filter((a) => a.occupantName || a.groupId)
      .map((a) => ({
        id: a.id, centre_id: centreId, room_id: a.roomId,
        slot_index: a.slotIndex || 0, occupant_name: a.occupantName || "",
        group_id: a.groupId || null, occupant_type: a.occupantType || "student",
        notes: a.notes || "",
      }));

    if (toDelete.length === 0 && toUpsert.length === 0) return;

    try {
      await api("/api/db/rooming/assignments", "POST", { toDelete, toUpsert });
      lastSavedAssignmentsRef.current = [...newAssignments];
    } catch (e) {
      console.error("saveRoomingAssignments:", e);
    }
  };

  // ── SAVE: Setting ─────────────────────────────────────
  const saveSetting = async (key, value) => {
    if (!centreId) return;
    try {
      await api("/api/db/settings", "POST", { centreId, key, value });
      setSettings((p) => ({ ...p, [key]: value }));
    } catch (e) {
      console.error("saveSetting:", e);
    }
  };

  // ── ARCHIVE & RESET ────────────────────────────────────
  const archiveProgramme = async (programmeName) => {
    if (!centreId) throw new Error("No centre selected");
    const meta = {
      groupCount: groups.length,
      studentCount: groups.reduce((s, g) => s + (g.stu || 0) + (g.gl || 0), 0),
      staffCount: staff.length,
      progStart: settings.prog_start || "",
      progEnd: settings.prog_end || "",
    };
    const snapshot = { meta, groups, staff, rotaGrid, progGrid, excDays, excursions, transfers, settings, roomingHouses, roomingRooms, roomingAssignments };
    const groupIds = groups.map((g) => g.id);

    await api("/api/db/archives", "POST", { centreId, programmeName, meta, snapshot, groupIds });

    // Reset local state
    setGroups([]); setStaff([]); setRotaGrid({}); setProgGrid({});
    setExcDays({}); setExcursions([]); setTransfers([]); setSettings({});
    setRoomingHouses([]); setRoomingRooms([]); setRoomingAssignments([]);
    lastSavedRotaRef.current = {}; lastSavedProgRef.current = {};
    lastSavedExcDaysRef.current = {}; lastSavedExcursionsRef.current = [];
    lastSavedAssignmentsRef.current = [];
  };

  const loadArchives = async () => {
    return await api(`/api/db/archives?centreId=${centreId}`);
  };

  const deleteArchive = async (archiveId) => {
    await api("/api/db/archives", "DELETE", { archiveId });
  };

  return {
    // State
    centres, loading, error,
    groups, setGroups,
    staff, setStaff,
    rotaGrid, setRotaGrid,
    progGrid, setProgGrid,
    excDays, setExcDays,
    excursions, setExcursions,
    transfers, setTransfers,
    settings,
    roomingHouses, setRoomingHouses,
    roomingRooms, setRoomingRooms,
    roomingAssignments, setRoomingAssignments,
    // Save functions
    saveGroup, deleteGroup,
    saveStaffMember, deleteStaffMember,
    saveRotaGrid, saveProgGrid,
    saveExcDays, saveExcursions,
    saveTransfer, deleteTransfer,
    saveSetting,
    saveRoomingHouse, deleteRoomingHouse,
    saveRoomingRoom, deleteRoomingRoom,
    saveRoomingAssignments,
    // Archive
    archiveProgramme, loadArchives, deleteArchive,
    // Reload
    reload: () => loadCentre(centreId),
  };
}

// ── Helpers ───────────────────────────────────────────────
function dbToStudent(s) {
  return {
    id: s.id, type: s.type,
    firstName: s.first_name || "", surname: s.surname || "",
    dob: s.dob || "", age: s.age || "", sex: s.sex || "",
    nationality: s.nationality || "", accommodation: s.accommodation || "",
    arrDate: s.arrival_date || "", depDate: s.departure_date || "",
    specialism1: s.specialism1 || "", medical: s.medical || "",
    swimming: s.swimming || "", mobile: s.mobile || "",
  };
}
