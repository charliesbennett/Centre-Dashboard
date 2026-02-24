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
  const [transfers, setTransfers] = useState([]);
  const [settings, setSettings] = useState({});

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
        students: studentsMap[g.id]?.students || [],
        leaders: studentsMap[g.id]?.leaders || [],
      }));
      setGroups(mappedGroups);

      // Staff
      const { data: staffData } = await supabase
        .from("staff").select("*").eq("centre_id", cid).order("created_at");
      setStaff((staffData || []).map((s) => ({
        id: s.id, name: s.name, role: s.role,
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

      // Programme grid
      const { data: progData } = await supabase
        .from("programme_cells").select("*").eq("centre_id", cid);
      const pg = {};
      (progData || []).forEach((p) => { pg[p.group_id + "-" + p.cell_date + "-" + p.slot] = p.value; });
      setProgGrid(pg);

      // Excursion days
      const { data: excData } = await supabase
        .from("excursion_days").select("*").eq("centre_id", cid);
      const ed = {};
      (excData || []).forEach((e) => { ed[e.exc_date] = e.exc_type; });
      setExcDays(ed);

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
        // Delete existing then insert fresh
        await supabase.from("students").delete().eq("group_id", group.id);
        const { error: sErr } = await supabase.from("students").insert(allPeople);
        if (sErr) console.error("saveStudents:", sErr);
      }
    }
    return true;
  };

  const deleteGroup = async (groupId) => {
    await supabase.from("students").delete().eq("group_id", groupId);
    await supabase.from("programme_cells").delete().eq("group_id", groupId);
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) console.error("deleteGroup:", error);
  };

  // ── SAVE: Staff ───────────────────────────────────────
  const saveStaffMember = async (s) => {
    const row = {
      id: s.id, centre_id: centreId,
      name: s.name, role: s.role,
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

  // ── SAVE: Rota Grid (bulk) ────────────────────────────
  const saveRotaGrid = async (newGrid) => {
    if (!centreId) return;
    // Delete all existing rota cells for this centre
    await supabase.from("rota_cells").delete().eq("centre_id", centreId);

    // Insert all cells
    const rows = [];
    // Key format: {uuid}-{YYYY-MM-DD}-{Slot}
    // UUID contains dashes, so we match the date pattern instead
    const keyRegex = /^(.+)-(\d{4}-\d{2}-\d{2})-(AM|PM|Eve)$/;
    Object.entries(newGrid).forEach(([key, value]) => {
      if (!value) return;
      const m = key.match(keyRegex);
      if (!m) return;
      rows.push({ centre_id: centreId, staff_id: m[1], cell_date: m[2], slot: m[3], value });
    });

    if (rows.length > 0) {
      // Batch insert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from("rota_cells").insert(chunk);
        if (error) console.error("saveRotaGrid chunk:", error);
      }
    }
  };

  // ── SAVE: Programme Grid (bulk) ───────────────────────
  const saveProgGrid = async (newGrid) => {
    if (!centreId) return;
    await supabase.from("programme_cells").delete().eq("centre_id", centreId);

    const rows = [];
    // Key format: {uuid}-{YYYY-MM-DD}-{Slot}
    const keyRegex = /^(.+)-(\d{4}-\d{2}-\d{2})-(AM|PM)$/;
    Object.entries(newGrid).forEach(([key, value]) => {
      if (!value) return;
      const m = key.match(keyRegex);
      if (!m) return;
      rows.push({ centre_id: centreId, group_id: m[1], cell_date: m[2], slot: m[3], value });
    });

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from("programme_cells").insert(chunk);
        if (error) console.error("saveProgGrid chunk:", error);
      }
    }
  };

  // ── SAVE: Excursion Days ──────────────────────────────
  const saveExcDays = async (newExcDays) => {
    if (!centreId) return;
    await supabase.from("excursion_days").delete().eq("centre_id", centreId);
    const rows = Object.entries(newExcDays).map(([date, type]) => ({
      centre_id: centreId, exc_date: date, exc_type: type,
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from("excursion_days").insert(rows);
      if (error) console.error("saveExcDays:", error);
    }
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
    transfers, setTransfers,
    settings,
    // Save functions
    saveGroup, deleteGroup,
    saveStaffMember, deleteStaffMember,
    saveRotaGrid, saveProgGrid,
    saveExcDays, saveTransfer, deleteTransfer,
    saveSetting,
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
