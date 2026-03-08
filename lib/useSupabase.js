"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

/*
  useSupabase(centreId)
  - Loads groups, students, staff, rota, programme, excursions, transfers for a centre
  - Returns { data, loading, error, save*, delete* } functions
  - All writes go to Supabase immediately, then update local state
  - Works without auth for now (RLS bypassed when no user logged in — we'll add auth next)
*/

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
    supabase.from("centres").select("*").order("name").then(({ data, error }) => {
      if (data) setCentres(data);
      if (error) console.error("centres load:", error);
    });
  }, []);

  // ── Load all data for selected centre ─────────────────
  const loadCentre = useCallback(async (cid) => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    try {
      // Groups + students
      const { data: grpData } = await supabase
        .from("groups").select("*").eq("centre_id", cid).order("created_at");
      const groupsList = grpData || [];

      // Load students for each group
      const groupIds = groupsList.map((g) => g.id);
      let studentsMap = {};
      if (groupIds.length > 0) {
        const { data: stuData } = await supabase
          .from("students").select("*").in("group_id", groupIds).order("created_at");
        (stuData || []).forEach((s) => {
          if (!studentsMap[s.group_id]) studentsMap[s.group_id] = { students: [], leaders: [] };
          if (s.type === "gl") studentsMap[s.group_id].leaders.push(dbToStudent(s));
          else studentsMap[s.group_id].students.push(dbToStudent(s));
        });
      }

      const mappedGroups = groupsList.map((g) => ({
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
      }));
      setGroups(mappedGroups);

      // Staff
      const { data: staffData } = await supabase
        .from("staff").select("*").eq("centre_id", cid).order("created_at");
      setStaff((staffData || []).map((s) => ({
        id: s.id, name: s.name, role: s.role,
        acc: s.accommodation || "Residential",
        arr: s.arrival_date || "", dep: s.departure_date || "",
        to: s.time_off || "", email: s.email || "", phone: s.phone || "",
        dbs: s.dbs_number || "", dbsExpiry: s.dbs_expiry || "",
        contract: s.contract_type || "", notes: s.notes || "",
      })));

      // Rota grid
      const { data: rotaData } = await supabase
        .from("rota_cells").select("*").eq("centre_id", cid);
      const rg = {};
      (rotaData || []).forEach((r) => { rg[r.staff_id + "-" + r.cell_date + "-" + r.slot] = r.value; });
      setRotaGrid(rg);
      lastSavedRotaRef.current = { ...rg };

      // Programme grid
      const { data: progData } = await supabase
        .from("programme_cells").select("*").eq("centre_id", cid);
      const pg = {};
      (progData || []).forEach((p) => { pg[p.group_id + "-" + p.cell_date + "-" + p.slot] = p.value; });
      setProgGrid(pg);
      lastSavedProgRef.current = { ...pg };

      // Excursion days
      const { data: excData } = await supabase
        .from("excursion_days").select("*").eq("centre_id", cid);
      const ed = {};
      (excData || []).forEach((e) => { ed[e.exc_date] = e.exc_type; });
      setExcDays(ed);
      lastSavedExcDaysRef.current = { ...ed };

      // Excursions (destination + coaches per date)
      const { data: excListData } = await supabase
        .from("excursions").select("*").eq("centre_id", cid).order("exc_date");
      const excList = (excListData || []).map((e) => ({
        id: e.id,
        date: e.exc_date,
        destination: e.destination || "",
        coaches: e.coaches || [],
        notes: e.notes || "",
      }));
      setExcursions(excList);
      lastSavedExcursionsRef.current = [...excList];

      // Transfers
      const { data: trData } = await supabase
        .from("transfers").select("*").eq("centre_id", cid).order("transfer_date");
      setTransfers((trData || []).map((t) => ({
        id: t.id, groupId: t.group_id, type: t.type,
        date: t.transfer_date || "", time: t.transfer_time || "",
        airport: t.airport || "", flight: t.flight_number || "",
        pax: t.pax || 0, vehicle: t.vehicle_type || "",
        driver: t.driver_name || "", driverPhone: t.driver_phone || "",
        pickup: t.pickup_point || "", status: t.status || "pending",
        notes: t.notes || "",
      })));

      // Settings
      const { data: setData } = await supabase
        .from("programme_settings").select("*").eq("centre_id", cid);
      const st = {};
      (setData || []).forEach((s) => { st[s.setting_key] = s.setting_value; });
      setSettings(st);

      // Rooming: houses
      const { data: housesData } = await supabase
        .from("rooming_houses").select("*").eq("centre_id", cid).order("sort_order");
      setRoomingHouses((housesData || []).map((h) => ({
        id: h.id, name: h.name, sortOrder: h.sort_order || 0,
      })));

      // Rooming: rooms
      const { data: roomsData } = await supabase
        .from("rooming_rooms").select("*").eq("centre_id", cid).order("sort_order");
      setRoomingRooms((roomsData || []).map((r) => ({
        id: r.id, houseId: r.house_id, floorLabel: r.floor_label || "",
        roomName: r.room_name, capacity: r.capacity || 2, sortOrder: r.sort_order || 0,
      })));

      // Rooming: assignments
      const { data: assignData } = await supabase
        .from("rooming_assignments").select("*").eq("centre_id", cid).order("slot_index");
      const mappedAssignments = (assignData || []).map((a) => ({
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
  // Syncs other managers' changes into local state without triggering re-saves.
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
    const row = {
      id: group.id, centre_id: centreId,
      agent: group.agent, group_name: group.group,
      nationality: group.nat, students_count: group.stu || 0, gls_count: group.gl || 0,
      arrival_date: group.arr || null, departure_date: group.dep || null,
      first_meal: group.firstMeal, last_meal: group.lastMeal,
      programme: group.prog, lesson_slot: group.lessonSlot || "AM",
      centre_name: group.centre || "",
      arr_airport: group.arrAirport || "", arr_flight: group.arrFlight || "",
      arr_time: group.arrTime || "", dep_airport: group.depAirport || "",
      dep_flight: group.depFlight || "", dep_time: group.depTime || "",
      archived: group.archived || false,
    };
    const { error } = await supabase.from("groups").upsert(row);
    if (error) { console.error("saveGroup:", error); return false; }

    // Save students + leaders
    if (group.students || group.leaders) {
      const allPeople = [
        ...(group.students || []).map((s) => studentToDb(s, group.id, "student")),
        ...(group.leaders || []).map((s) => studentToDb(s, group.id, "gl")),
      ];
      if (allPeople.length > 0) {
        // Upsert current students, then delete any that were removed
        const { error: sErr } = await supabase.from("students").upsert(allPeople, { onConflict: "id" });
        if (sErr) console.error("saveStudents:", sErr);
        const keepIds = allPeople.map((s) => s.id);
        await supabase.from("students").delete().eq("group_id", group.id).not("id", "in", `(${keepIds.join(",")})`);
      }
    }
    return true;
  };

  const deleteGroup = async (groupId) => {
    await supabase.from("students").delete().eq("group_id", groupId);
    await supabase.from("programme_cells").delete().eq("group_id", groupId);
    await supabase.from("transfers").delete().eq("group_id", groupId);
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) console.error("deleteGroup:", error);
  };

  // ── SAVE: Staff ───────────────────────────────────────
  const saveStaffMember = async (s) => {
    const row = {
      id: s.id, centre_id: centreId,
      name: s.name, role: s.role,
      accommodation: s.acc || "Residential",
      arrival_date: s.arr || null, departure_date: s.dep || null,
      time_off: s.to || "", email: s.email || "", phone: s.phone || "",
      dbs_number: s.dbs || "", dbs_expiry: s.dbsExpiry || null,
      contract_type: s.contract || "", notes: s.notes || "",
    };
    const { error } = await supabase.from("staff").upsert(row);
    if (error) console.error("saveStaff:", error);
  };

  const deleteStaffMember = async (staffId) => {
    await supabase.from("rota_cells").delete().eq("staff_id", staffId);
    const { error } = await supabase.from("staff").delete().eq("id", staffId);
    if (error) console.error("deleteStaff:", error);
  };

  // ── SAVE: Rota Grid (diff-based — no more delete-all) ─────────────────────
  // Key regex: {uuid}-{YYYY-MM-DD}-{AM|PM|Eve}
  const ROTA_KEY_RE = /^(.+)-(\d{4}-\d{2}-\d{2})-(AM|PM|Eve)$/;

  const saveRotaGrid = async (newGrid) => {
    if (!centreId) return;
    const prev = lastSavedRotaRef.current;

    // Cells present in prev but empty/absent in newGrid → delete
    const toDelete = [];
    Object.entries(prev).forEach(([key, prevVal]) => {
      if (prevVal && !newGrid[key]) {
        const m = key.match(ROTA_KEY_RE);
        if (m) toDelete.push({ staffId: m[1], date: m[2], slot: m[3] });
      }
    });

    // Non-empty cells in newGrid that changed vs prev → upsert
    const toUpsert = [];
    Object.entries(newGrid).forEach(([key, value]) => {
      if (value && value !== prev[key]) {
        const m = key.match(ROTA_KEY_RE);
        if (m) toUpsert.push({ centre_id: centreId, staff_id: m[1], cell_date: m[2], slot: m[3], value });
      }
    });

    for (const { staffId, date, slot } of toDelete) {
      await supabase.from("rota_cells").delete()
        .eq("centre_id", centreId).eq("staff_id", staffId)
        .eq("cell_date", date).eq("slot", slot);
    }
    for (let i = 0; i < toUpsert.length; i += 500) {
      const { error } = await supabase.from("rota_cells")
        .upsert(toUpsert.slice(i, i + 500), { onConflict: "centre_id,staff_id,cell_date,slot" });
      if (error) console.error("saveRotaGrid upsert:", error);
    }

    lastSavedRotaRef.current = { ...newGrid };
  };

  // ── SAVE: Programme Grid (diff-based) ─────────────────────────────────────
  const PROG_KEY_RE = /^(.+)-(\d{4}-\d{2}-\d{2})-(AM|PM|EVE)$/;

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

    for (const { groupId, date, slot } of toDelete) {
      await supabase.from("programme_cells").delete()
        .eq("centre_id", centreId).eq("group_id", groupId)
        .eq("cell_date", date).eq("slot", slot);
    }
    for (let i = 0; i < toUpsert.length; i += 500) {
      const { error } = await supabase.from("programme_cells")
        .upsert(toUpsert.slice(i, i + 500), { onConflict: "centre_id,group_id,cell_date,slot" });
      if (error) console.error("saveProgGrid upsert:", error);
    }

    lastSavedProgRef.current = { ...newGrid };
  };

  // ── SAVE: Excursion Days (diff-based) ─────────────────────────────────────
  const saveExcDays = async (newExcDays) => {
    if (!centreId) return;
    const prev = lastSavedExcDaysRef.current;

    // Dates removed → delete
    for (const date of Object.keys(prev)) {
      if (prev[date] && !newExcDays[date]) {
        await supabase.from("excursion_days").delete()
          .eq("centre_id", centreId).eq("exc_date", date);
      }
    }

    // Dates added/changed → upsert
    const toUpsert = Object.entries(newExcDays)
      .filter(([date, type]) => type && type !== prev[date])
      .map(([date, type]) => ({ centre_id: centreId, exc_date: date, exc_type: type }));

    if (toUpsert.length > 0) {
      const { error } = await supabase.from("excursion_days")
        .upsert(toUpsert, { onConflict: "centre_id,exc_date" });
      if (error) console.error("saveExcDays upsert:", error);
    }

    lastSavedExcDaysRef.current = { ...newExcDays };
  };

  // ── SAVE: Excursions list (destination + coaches, diff-based) ─────────────
  const saveExcursions = async (newExcursions) => {
    if (!centreId) return;
    const prev = lastSavedExcursionsRef.current;

    // Removed → delete
    for (const pe of prev) {
      if (!newExcursions.find((e) => e.id === pe.id)) {
        await supabase.from("excursions").delete().eq("id", pe.id);
      }
    }

    // Added / changed → upsert
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

    if (toUpsert.length > 0) {
      const { error } = await supabase.from("excursions")
        .upsert(toUpsert, { onConflict: "centre_id,exc_date" });
      if (error) console.error("saveExcursions upsert:", error);
    }

    lastSavedExcursionsRef.current = [...newExcursions];
  };

  // ── SAVE: Transfer ────────────────────────────────────
  const saveTransfer = async (t) => {
    const row = {
      id: t.id, centre_id: centreId, group_id: t.groupId || null,
      type: t.type, transfer_date: t.date || null, transfer_time: t.time || "",
      airport: t.airport || "", flight_number: t.flight || "",
      pax: t.pax || 0, vehicle_type: t.vehicle || "",
      driver_name: t.driver || "", driver_phone: t.driverPhone || "",
      pickup_point: t.pickup || "", status: t.status || "pending",
      notes: t.notes || "",
    };
    const { error } = await supabase.from("transfers").upsert(row);
    if (error) console.error("saveTransfer:", error);
  };

  const deleteTransfer = async (transferId) => {
    const { error } = await supabase.from("transfers").delete().eq("id", transferId);
    if (error) console.error("deleteTransfer:", error);
  };

  // ── SAVE: Rooming Houses ──────────────────────────────
  const saveRoomingHouse = async (house) => {
    const row = { id: house.id, centre_id: centreId, name: house.name, sort_order: house.sortOrder || 0 };
    const { error } = await supabase.from("rooming_houses").upsert(row);
    if (error) console.error("saveRoomingHouse:", error);
  };

  const deleteRoomingHouse = async (houseId) => {
    // Cascade: rooms and assignments deleted via FK on delete cascade
    const { error } = await supabase.from("rooming_houses").delete().eq("id", houseId);
    if (error) console.error("deleteRoomingHouse:", error);
  };

  // ── SAVE: Rooming Rooms ───────────────────────────────
  const saveRoomingRoom = async (room) => {
    const row = {
      id: room.id, centre_id: centreId, house_id: room.houseId,
      floor_label: room.floorLabel || "", room_name: room.roomName,
      capacity: room.capacity || 2, sort_order: room.sortOrder || 0,
    };
    const { error } = await supabase.from("rooming_rooms").upsert(row);
    if (error) console.error("saveRoomingRoom:", error);
  };

  const deleteRoomingRoom = async (roomId) => {
    const { error } = await supabase.from("rooming_rooms").delete().eq("id", roomId);
    if (error) console.error("deleteRoomingRoom:", error);
  };

  // ── SAVE: Rooming Assignments (diff-based) ────────────────────────────────
  const saveRoomingAssignments = async (newAssignments) => {
    if (!centreId) return;
    const prev = lastSavedAssignmentsRef.current;

    // Removed assignments → delete by id
    const toDelete = prev.filter((pa) => !newAssignments.find((na) => na.id === pa.id));
    for (const a of toDelete) {
      await supabase.from("rooming_assignments").delete().eq("id", a.id);
    }

    // Added / changed assignments → upsert
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

    if (toUpsert.length > 0) {
      const { error } = await supabase.from("rooming_assignments")
        .upsert(toUpsert, { onConflict: "centre_id,room_id,slot_index" });
      if (error) console.error("saveRoomingAssignments upsert:", error);
    }

    lastSavedAssignmentsRef.current = [...newAssignments];
  };

  // ── SAVE: Setting ─────────────────────────────────────
  const saveSetting = async (key, value) => {
    if (!centreId) return;
    const { error } = await supabase.from("programme_settings").upsert({
      centre_id: centreId, setting_key: key, setting_value: value,
    }, { onConflict: "centre_id,setting_key" });
    if (error) console.error("saveSetting:", error);
    setSettings((p) => ({ ...p, [key]: value }));
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

function studentToDb(s, groupId, type) {
  return {
    id: s.id, group_id: groupId, type,
    first_name: s.firstName || "", surname: s.surname || "",
    dob: s.dob || null, age: s.age || null, sex: s.sex || "",
    nationality: s.nationality || "", accommodation: s.accommodation || "",
    arrival_date: s.arrDate || null, departure_date: s.depDate || null,
    specialism1: s.specialism1 || "", medical: s.medical || "",
    swimming: s.swimming || "", mobile: s.mobile || "",
  };
}
