"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const NAV = "#1c3048";
const RED = "#ec273b";
const BORDER = "#e2e8f0";

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function RoomFormPage({ params }) {
  const { token } = params;

  const [status, setStatus] = useState("loading"); // loading | ready | saving | saved | error
  const [errorMsg, setErrorMsg] = useState("");
  const [groupName, setGroupName] = useState("");
  const [centreId, setCentreId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [houses, setHouses] = useState([]);
  const [rooms, setRooms] = useState([]);
  // { [roomId]: { [slotIndex]: string } }
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!token) return;
    (async () => {
      // 1. Validate token
      const { data: tok, error: tokErr } = await supabase
        .from("room_form_tokens")
        .select("*")
        .eq("token", token)
        .single();

      if (tokErr || !tok) {
        setErrorMsg("This link is invalid or has been revoked. Please contact the centre team.");
        setStatus("error");
        return;
      }

      const { centre_id, group_id, group_name } = tok;
      setCentreId(centre_id);
      setGroupId(group_id);
      setGroupName(group_name || "Your Group");

      // 2. Load houses + rooms
      const [{ data: hs }, { data: rs }] = await Promise.all([
        supabase.from("rooming_houses").select("*").eq("centre_id", centre_id).order("sort_order"),
        supabase.from("rooming_rooms").select("*").eq("centre_id", centre_id).order("sort_order"),
      ]);

      if (!rs || rs.length === 0) {
        setErrorMsg("No rooms have been configured yet. Please contact the centre team.");
        setStatus("error");
        return;
      }

      setHouses(hs || []);
      setRooms(rs || []);

      // 3. Pre-populate with existing assignments for this group
      const { data: existing } = await supabase
        .from("rooming_assignments")
        .select("*")
        .eq("centre_id", centre_id)
        .eq("group_id", group_id);

      const pre = {};
      (existing || []).forEach((a) => {
        if (!pre[a.room_id]) pre[a.room_id] = {};
        pre[a.room_id][a.slot_index] = a.occupant_name || "";
      });
      setForm(pre);
      setStatus("ready");
    })();
  }, [token]);

  const setSlot = (roomId, slotIdx, value) => {
    setForm((prev) => ({
      ...prev,
      [roomId]: { ...(prev[roomId] || {}), [slotIdx]: value },
    }));
  };

  const handleSave = async () => {
    setStatus("saving");
    try {
      // Delete all existing assignments for this group in this centre
      const { error: delErr } = await supabase
        .from("rooming_assignments")
        .delete()
        .eq("centre_id", centreId)
        .eq("group_id", groupId);
      if (delErr) throw delErr;

      // Insert new non-empty assignments
      const toInsert = [];
      Object.entries(form).forEach(([roomId, slots]) => {
        Object.entries(slots).forEach(([slotIdx, name]) => {
          if (name?.trim()) {
            toInsert.push({
              id: uid(),
              centre_id: centreId,
              room_id: roomId,
              slot_index: parseInt(slotIdx),
              occupant_name: name.trim(),
              group_id: groupId,
              occupant_type: "student",
              notes: "",
            });
          }
        });
      });

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from("rooming_assignments").insert(toInsert);
        if (insErr) throw insErr;
      }

      setStatus("saved");
    } catch (err) {
      setErrorMsg("Failed to save: " + err.message);
      setStatus("error");
    }
  };

  const totalFilled = Object.values(form).reduce((sum, slots) =>
    sum + Object.values(slots).filter((v) => v?.trim()).length, 0
  );

  // ── Loading ────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Loading rooming form…</div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────
  if (status === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Link Error</div>
          <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{errorMsg}</div>
        </div>
      </div>
    );
  }

  // ── Saved ──────────────────────────────────────────────
  if (status === "saved") {
    return (
      <div style={{ minHeight: "100vh", background: "#f0fdf4", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#dcfce7", border: "3px solid #4ade80", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#15803d", marginBottom: 8 }}>Rooming List Saved!</div>
          <div style={{ fontSize: 14, color: "#166534", marginBottom: 4 }}>
            <strong>{totalFilled} student{totalFilled !== 1 ? "s" : ""}</strong> saved for <strong>{groupName}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#4ade80", marginTop: 12 }}>The centre team can see this on the dashboard.</div>
          <button onClick={() => setStatus("ready")} style={{
            marginTop: 20, padding: "10px 24px", background: NAV, color: "#fff", border: "none",
            borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>
            Edit List
          </button>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────
  const groupsByHouse = houses.map((h) => ({
    ...h,
    rooms: rooms.filter((r) => r.house_id === h.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  })).filter((h) => h.rooms.length > 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: NAV, padding: "16px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 600, margin: "0 auto" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: RED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>UKLC Centre Dashboard</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Rooming Form</div>
          </div>
        </div>
      </div>

      {/* Intro banner */}
      <div style={{ background: RED, padding: "14px 20px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{groupName}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
            Please fill in your students' names for each bed. Tap a box and type the student's name.
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {totalFilled > 0 && (
        <div style={{ background: "#e0f2fe", borderBottom: "1px solid #bae6fd", padding: "8px 20px" }}>
          <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 6, background: "#bae6fd", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#0369a1", borderRadius: 3, width: Math.min(100, (totalFilled / rooms.reduce((s, r) => s + (r.capacity || 0), 0)) * 100) + "%" }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", whiteSpace: "nowrap" }}>{totalFilled} filled</span>
          </div>
        </div>
      )}

      {/* Room form */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 100px" }}>
        {groupsByHouse.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14 }}>
            No rooms have been set up yet. Please contact the centre team.
          </div>
        ) : groupsByHouse.map((house) => {
          // Group by floor
          const floors = {};
          house.rooms.forEach((r) => {
            const fl = r.floor_label || "Main";
            if (!floors[fl]) floors[fl] = [];
            floors[fl].push(r);
          });
          const houseFilledCount = house.rooms.reduce((s, r) =>
            s + Array.from({ length: r.capacity }, (_, i) => i).filter((i) => form[r.id]?.[i]?.trim()).length, 0
          );
          const houseTotalBeds = house.rooms.reduce((s, r) => s + (r.capacity || 0), 0);

          return (
            <div key={house.id} style={{ marginBottom: 20 }}>
              {/* House header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 0" }}>
                <div style={{ flex: 1, height: 1, background: BORDER }} />
                <div style={{ fontSize: 11, fontWeight: 800, color: NAV, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
                  {house.name}
                </div>
                <div style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>{houseFilledCount}/{houseTotalBeds} beds</div>
                <div style={{ flex: 1, height: 1, background: BORDER }} />
              </div>

              {Object.entries(floors).map(([floorLabel, floorRooms]) => (
                <div key={floorLabel}>
                  {Object.keys(floors).length > 1 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 4 }}>
                      {floorLabel}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                    {floorRooms.map((room) => {
                      const slots = Array.from({ length: room.capacity }, (_, i) => i);
                      const filled = slots.filter((i) => form[room.id]?.[i]?.trim()).length;
                      return (
                        <div key={room.id} style={{
                          background: "#fff", border: "1.5px solid " + (filled >= room.capacity ? "#4ade80" : BORDER),
                          borderRadius: 12, padding: "10px 12px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: NAV }}>{room.room_name}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: filled >= room.capacity ? "#16a34a" : "#94a3b8" }}>
                              {filled}/{room.capacity}
                            </div>
                          </div>
                          {slots.map((slotIdx) => (
                            <input
                              key={slotIdx}
                              type="text"
                              value={form[room.id]?.[slotIdx] || ""}
                              onChange={(e) => setSlot(room.id, slotIdx, e.target.value)}
                              placeholder={"Bed " + (slotIdx + 1)}
                              autoComplete="off"
                              style={{
                                display: "block", width: "100%", boxSizing: "border-box",
                                padding: "8px 10px", marginBottom: slotIdx < slots.length - 1 ? 6 : 0,
                                border: "1px solid " + (form[room.id]?.[slotIdx]?.trim() ? "#a5f3fc" : BORDER),
                                borderRadius: 8, fontSize: 14, fontFamily: "inherit",
                                background: form[room.id]?.[slotIdx]?.trim() ? "#f0f9ff" : "#fafafa",
                                color: "#1e293b", outline: "none",
                              }}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Sticky save button */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(255,255,255,0.97)", borderTop: "1px solid " + BORDER,
        padding: "12px 20px", backdropFilter: "blur(8px)",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <button
            onClick={handleSave}
            disabled={status === "saving" || totalFilled === 0}
            style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none",
              background: totalFilled === 0 ? "#e2e8f0" : NAV,
              color: totalFilled === 0 ? "#94a3b8" : "#fff",
              fontSize: 15, fontWeight: 800, cursor: totalFilled === 0 ? "default" : "pointer",
              fontFamily: "inherit", transition: "background 0.15s",
            }}>
            {status === "saving" ? "Saving…" : totalFilled === 0 ? "Fill in names above to save" : `Save Rooming List (${totalFilled} student${totalFilled !== 1 ? "s" : ""})`}
          </button>
        </div>
      </div>
    </div>
  );
}
