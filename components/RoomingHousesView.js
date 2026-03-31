"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { B, uid, dayKey, dayName, isWeekend, fmtDate } from "@/lib/constants";
import { Fld, TableWrap, IconBtn, IcPlus, IcTrash, IcEdit, IcCheck, inputStyle, thStyle, tdStyle, btnPrimary, btnNavy } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import RoomingImportModal from "@/components/RoomingImportModal";

const GROUP_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ea580c", "#16a34a",
  "#0891b2", "#d97706", "#dc2626", "#7c3aed", "#0369a1",
];

function inBed(dateStr, arrDate, depDate) {
  if (!arrDate || !depDate) return false;
  const dt = new Date(dateStr);
  const a = new Date(arrDate);
  const b = new Date(depDate);
  return dt >= a && dt < b;
}

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

export default function RoomingHousesView({
  dates,
  activeGroups,
  groupColorMap,
  roomingHouses, setRoomingHouses,
  roomingRooms, setRoomingRooms,
  roomingAssignments, setRoomingAssignments,
  totalBeds,
  occupiedBeds,
  centreId,
  readOnly,
  progStart,
  progEnd,
  onPrintNightly,
  onPrintRoomingList,
}) {
  const [houseView, setHouseView] = useState("setup");
  const [showImport, setShowImport] = useState(false);
  const [showAddHouse, setShowAddHouse] = useState(false);
  const [newHouseName, setNewHouseName] = useState("");
  const [editingHouseId, setEditingHouseId] = useState(null);
  const [editingHouseName, setEditingHouseName] = useState("");
  const [expandedHouse, setExpandedHouse] = useState(null);
  const [showAddRoom, setShowAddRoom] = useState(null);
  const [newRoom, setNewRoom] = useState({ floorLabel: "", roomName: "", capacity: 2 });
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoom, setEditingRoom] = useState({});
  const [nightDate, setNightDate] = useState(progStart || "");

  // Room form tokens
  const [roomTokens, setRoomTokens] = useState({});
  const [tokenModal, setTokenModal] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!centreId) return;
    supabase
      .from("room_form_tokens")
      .select("*")
      .eq("centre_id", centreId)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((t) => { map[t.group_id] = t; });
        setRoomTokens(map);
      });
  }, [centreId]);

  const getFormUrl = (token) => {
    if (typeof window === "undefined") return "";
    return window.location.origin + "/room-form/" + token;
  };

  const generateToken = async (group) => {
    setTokenLoading(group.id);
    const token = crypto.randomUUID ? crypto.randomUUID() : uid();
    const row = { token, centre_id: centreId, group_id: group.id, group_name: group.group };
    await supabase.from("room_form_tokens").upsert(row, { onConflict: "group_id,centre_id" });
    await supabase.from("room_form_tokens").delete().eq("centre_id", centreId).eq("group_id", group.id);
    await supabase.from("room_form_tokens").insert(row);
    setRoomTokens((p) => ({ ...p, [group.id]: row }));
    setTokenLoading(null);
    setTokenModal(group.id);
  };

  const revokeToken = async (groupId) => {
    await supabase.from("room_form_tokens").delete().eq("centre_id", centreId).eq("group_id", groupId);
    setRoomTokens((p) => { const n = { ...p }; delete n[groupId]; return n; });
    setTokenModal(null);
  };

  // House actions
  const addHouse = () => {
    if (!newHouseName.trim()) return;
    const house = { id: uid(), name: newHouseName.trim(), sortOrder: roomingHouses.length };
    setRoomingHouses((p) => [...p, house]);
    setNewHouseName("");
    setShowAddHouse(false);
  };

  const updateHouseName = (id) => {
    setRoomingHouses((p) => p.map((h) => h.id === id ? { ...h, name: editingHouseName } : h));
    setEditingHouseId(null);
  };

  const deleteHouse = (id) => {
    setRoomingHouses((p) => p.filter((h) => h.id !== id));
    const roomIds = roomingRooms.filter((r) => r.houseId === id).map((r) => r.id);
    setRoomingRooms((p) => p.filter((r) => r.houseId !== id));
    setRoomingAssignments((p) => p.filter((a) => !roomIds.includes(a.roomId)));
  };

  // Room actions
  const addRoom = (houseId) => {
    if (!newRoom.roomName.trim()) return;
    const room = {
      id: uid(), houseId,
      floorLabel: newRoom.floorLabel.trim(),
      roomName: newRoom.roomName.trim(),
      capacity: parseInt(newRoom.capacity) || 2,
      sortOrder: roomingRooms.filter((r) => r.houseId === houseId).length,
    };
    setRoomingRooms((p) => [...p, room]);
    setNewRoom({ floorLabel: "", roomName: "", capacity: 2 });
    setShowAddRoom(null);
  };

  const updateRoom = (id) => {
    setRoomingRooms((p) => p.map((r) => r.id === id ? { ...r, ...editingRoom, capacity: parseInt(editingRoom.capacity) || r.capacity } : r));
    const newCap = parseInt(editingRoom.capacity) || roomingRooms.find((r) => r.id === id)?.capacity || 2;
    setRoomingAssignments((p) => p.filter((a) => a.roomId !== id || a.slotIndex < newCap));
    setEditingRoomId(null);
  };

  const deleteRoom = (id) => {
    setRoomingRooms((p) => p.filter((r) => r.id !== id));
    setRoomingAssignments((p) => p.filter((a) => a.roomId !== id));
  };

  // Assignment actions
  const getAssignment = (roomId, slotIndex) =>
    roomingAssignments.find((a) => a.roomId === roomId && a.slotIndex === slotIndex);

  const setSlot = useCallback((roomId, slotIndex, updates) => {
    setRoomingAssignments((p) => {
      const existing = p.find((a) => a.roomId === roomId && a.slotIndex === slotIndex);
      if (existing) {
        return p.map((a) =>
          a.roomId === roomId && a.slotIndex === slotIndex ? { ...a, ...updates } : a
        );
      }
      return [...p, { id: uid(), roomId, slotIndex, occupantName: "", groupId: "", occupantType: "student", notes: "", ...updates }];
    });
  }, []);

  const clearSlot = useCallback((roomId, slotIndex) => {
    setRoomingAssignments((p) =>
      p.filter((a) => !(a.roomId === roomId && a.slotIndex === slotIndex))
    );
  }, []);

  const groupByFloor = (rooms) => {
    const floors = {};
    rooms.forEach((r) => {
      const fl = r.floorLabel || "Main";
      if (!floors[fl]) floors[fl] = [];
      floors[fl].push(r);
    });
    return floors;
  };

  const modalGroup = tokenModal ? activeGroups.find((g) => g.id === tokenModal) : null;
  const modalToken = tokenModal ? roomTokens[tokenModal] : null;
  const modalUrl = modalToken ? getFormUrl(modalToken.token) : "";

  return (
    <div style={{ padding: "0 8px 16px" }}>
      {/* Import modal */}
      {showImport && (
        <RoomingImportModal
          onClose={() => setShowImport(false)}
          existingHouses={roomingHouses}
          existingRooms={roomingRooms}
          activeGroups={activeGroups}
          centreId={centreId}
          onImport={({ newHouses, newRooms, newAssignments }) => {
            if (newHouses.length) setRoomingHouses((p) => [...p, ...newHouses]);
            if (newRooms.length) setRoomingRooms((p) => [...p, ...newRooms]);
            if (newAssignments.length) setRoomingAssignments((p) => [...p, ...newAssignments]);
          }}
        />
      )}

      {/* Room form link modal */}
      {tokenModal && modalGroup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setTokenModal(null)}>
          <div style={{ background: B.white, borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ background: B.navy, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: B.white }}>Rooming Form Link</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>{modalGroup.group}</div>
              </div>
              <button onClick={() => setTokenModal(null)} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: B.white, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✕</button>
            </div>
            <div style={{ padding: "18px 18px 20px" }}>
              <p style={{ fontSize: 12, color: B.textMuted, margin: "0 0 14px", lineHeight: 1.5 }}>
                Share this link with <strong>{modalGroup.group}</strong> group leader. They can open it on their phone and fill in their students' names for each room.
              </p>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(modalUrl)}&bgcolor=ffffff&color=1c3048&margin=10`}
                  alt="QR code"
                  width={180} height={180}
                  style={{ borderRadius: 8, border: "1px solid " + B.border }}
                />
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <input readOnly value={modalUrl}
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid " + B.border, borderRadius: 7, fontSize: 10, fontFamily: "inherit", color: B.textMuted, background: B.bg, minWidth: 0 }}
                  onFocus={(e) => e.target.select()} />
                <button
                  onClick={() => { navigator.clipboard?.writeText(modalUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  style={{ padding: "8px 14px", background: copied ? B.success : B.navy, border: "none", color: B.white, borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { window.open(modalUrl, "_blank"); }}
                  style={{ flex: 1, padding: "8px 14px", background: B.bg, border: "1px solid " + B.border, color: B.navy, borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Preview Form
                </button>
                <button
                  onClick={() => { if (confirm("Revoke this link? The group leader will no longer be able to access it.")) revokeToken(tokenModal); }}
                  style={{ padding: "8px 14px", background: B.dangerBg, border: "1px solid #fca5a5", color: B.danger, borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Revoke Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-view switcher */}
      <div style={{ padding: "0 4px 8px", display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        {[
          { id: "setup", label: "\u2699\ufe0f Setup Houses & Rooms" },
          { id: "assign", label: "\ud83d\udecf\ufe0f Assign Students" },
          { id: "nightly", label: "\ud83c\udf19 Nightly View" },
        ].map((sv) => (
          <button key={sv.id} onClick={() => setHouseView(sv.id)} style={{
            padding: "4px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700,
            fontFamily: "inherit", cursor: "pointer",
            border: "1px solid " + (houseView === sv.id ? B.red : B.border),
            background: houseView === sv.id ? B.red : B.white,
            color: houseView === sv.id ? B.white : B.textMuted,
          }}>{sv.label}</button>
        ))}
        {houseView === "assign" && (
          <button onClick={onPrintRoomingList} style={{ ...btnNavy, fontSize: 9, padding: "4px 10px", marginLeft: "auto" }}>
            {"\ud83d\udda8\ufe0f"} Print Rooming List
          </button>
        )}
      </div>

      {/* ── SETUP ─────────────────────────────────────── */}
      {houseView === "setup" && (
        <div>
          <div style={{ background: B.white, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "10px 10px 0 0", border: "1px solid " + B.border, borderBottom: "1px solid " + B.border }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: B.textMuted }}>
              {roomingHouses.length} house{roomingHouses.length !== 1 ? "s" : ""} · {roomingRooms.length} rooms · {totalBeds} beds total
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {!readOnly && <button onClick={() => setShowImport(true)} style={{ ...btnNavy, background: B.purple, display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Import Excel
              </button>}
              {!readOnly && <button onClick={() => setShowAddHouse(true)} style={btnPrimary}><IcPlus /> Add House</button>}
            </div>
          </div>

          {showAddHouse && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderTop: "none", padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-end" }}>
              <Fld label="House Name">
                <input value={newHouseName} onChange={(e) => setNewHouseName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addHouse()}
                  placeholder="e.g. Earlsdown, High House..."
                  style={{ ...inputStyle, width: 220 }} autoFocus />
              </Fld>
              <button onClick={addHouse} style={{ ...btnNavy, height: 30, fontSize: 10 }}>Add</button>
              <button onClick={() => { setShowAddHouse(false); setNewHouseName(""); }}
                style={{ color: B.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10 }}>Cancel</button>
            </div>
          )}

          {roomingHouses.length === 0 ? (
            <div style={{ background: B.white, border: "1px solid " + B.border, borderTop: "none", padding: 40, textAlign: "center", color: B.textLight, borderRadius: "0 0 10px 10px" }}>
              No houses defined — click <strong>Add House</strong> to start
            </div>
          ) : roomingHouses.map((house) => {
            const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
            const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);
            const houseOccupied = roomingAssignments.filter((a) => houseRooms.some((r) => r.id === a.roomId) && a.occupantName).length;
            const isExpanded = expandedHouse === house.id;
            const floors = groupByFloor(houseRooms);

            return (
              <div key={house.id} style={{ background: B.white, border: "1px solid " + B.border, borderTop: "none" }}>
                <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", cursor: "pointer", borderBottom: isExpanded ? "1px solid " + B.border : "none" }}
                  onClick={() => setExpandedHouse(isExpanded ? null : house.id)}>
                  <span style={{ fontSize: 11, color: B.textMuted }}>{isExpanded ? "\u25bc" : "\u25b6"}</span>
                  {editingHouseId === house.id ? (
                    <input value={editingHouseName}
                      onChange={(e) => setEditingHouseName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && updateHouseName(house.id)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus style={{ ...inputStyle, fontSize: 13, fontWeight: 700, width: 200 }} />
                  ) : (
                    <span style={{ fontWeight: 800, fontSize: 12, color: B.navy }}>{house.name}</span>
                  )}
                  <span style={{ fontSize: 9, color: B.textMuted, background: B.bg, padding: "2px 6px", borderRadius: 4 }}>
                    {houseRooms.length} rooms · {houseBeds} beds
                    {houseOccupied > 0 && <> · <span style={{ color: B.success }}>{houseOccupied} assigned</span></>}
                  </span>
                  {!readOnly && <div style={{ marginLeft: "auto", display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    {editingHouseId === house.id ? (
                      <IconBtn onClick={() => updateHouseName(house.id)}><IcCheck /></IconBtn>
                    ) : (
                      <IconBtn onClick={() => { setEditingHouseId(house.id); setEditingHouseName(house.name); }}><IcEdit /></IconBtn>
                    )}
                    <IconBtn danger onClick={() => { if (confirm("Delete " + house.name + " and all its rooms?")) deleteHouse(house.id); }}><IcTrash /></IconBtn>
                  </div>}
                </div>

                {isExpanded && (
                  <div style={{ padding: "8px 14px 12px" }}>
                    {Object.keys(floors).length === 0 ? (
                      <div style={{ fontSize: 10, color: B.textLight, padding: "8px 0" }}>No rooms — add rooms below</div>
                    ) : Object.entries(floors).map(([floor, fRooms]) => (
                      <div key={floor} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, paddingBottom: 2, borderBottom: "1px solid " + B.borderLight }}>
                          {floor}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {fRooms.map((room) => {
                            const roomAssigns = roomingAssignments.filter((a) => a.roomId === room.id && a.occupantName);
                            const occupancy = roomAssigns.length;
                            const isEditing = editingRoomId === room.id;
                            return (
                              <div key={room.id} style={{
                                border: "1px solid " + B.border, borderRadius: 6, padding: "6px 10px",
                                minWidth: 120, background: occupancy >= room.capacity ? "#f0fdf4" : "#f8fafc",
                                position: "relative",
                              }}>
                                {isEditing ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <input value={editingRoom.roomName ?? room.roomName}
                                      onChange={(e) => setEditingRoom((p) => ({ ...p, roomName: e.target.value }))}
                                      style={{ ...inputStyle, fontSize: 10, width: 90, padding: "3px 5px" }}
                                      placeholder="Room name" autoFocus />
                                    <input value={editingRoom.floorLabel ?? room.floorLabel}
                                      onChange={(e) => setEditingRoom((p) => ({ ...p, floorLabel: e.target.value }))}
                                      style={{ ...inputStyle, fontSize: 10, width: 90, padding: "3px 5px" }}
                                      placeholder="Floor" />
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <input type="number" min={1} max={20}
                                        value={editingRoom.capacity ?? room.capacity}
                                        onChange={(e) => setEditingRoom((p) => ({ ...p, capacity: e.target.value }))}
                                        style={{ ...inputStyle, fontSize: 10, width: 44, padding: "3px 5px" }} />
                                      <span style={{ fontSize: 9, color: B.textMuted }}>beds</span>
                                      <button onClick={() => updateRoom(room.id)} style={{ background: B.navy, border: "none", color: B.white, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}>Save</button>
                                      <button onClick={() => setEditingRoomId(null)} style={{ background: "none", border: "none", color: B.textMuted, cursor: "pointer", fontFamily: "inherit", fontSize: 9 }}>✕</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ fontWeight: 700, fontSize: 11, color: B.navy }}>{room.roomName}</div>
                                    <div style={{ fontSize: 9, color: occupancy >= room.capacity ? B.success : B.textMuted }}>
                                      {occupancy}/{room.capacity} beds
                                    </div>
                                    {roomAssigns.slice(0, 2).map((a) => (
                                      <div key={a.id} style={{ fontSize: 8, color: groupColorMap[a.groupId] || B.textMuted, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>
                                        {a.occupantName}
                                      </div>
                                    ))}
                                    {roomAssigns.length > 2 && <div style={{ fontSize: 8, color: B.textLight }}>+{roomAssigns.length - 2} more</div>}
                                    {!readOnly && <div style={{ display: "flex", gap: 2, position: "absolute", top: 4, right: 4 }}>
                                      <IconBtn onClick={() => { setEditingRoomId(room.id); setEditingRoom({ roomName: room.roomName, floorLabel: room.floorLabel, capacity: room.capacity }); }}><IcEdit /></IconBtn>
                                      <IconBtn danger onClick={() => deleteRoom(room.id)}><IcTrash /></IconBtn>
                                    </div>}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {showAddRoom === house.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 8, padding: "8px 10px", background: "#f0f9ff", borderRadius: 6, border: "1px dashed #bae6fd" }}>
                        <Fld label="Room Name">
                          <input value={newRoom.roomName} onChange={(e) => setNewRoom((p) => ({ ...p, roomName: e.target.value }))}
                            placeholder="e.g. Room 1, Dorm A..." style={{ ...inputStyle, width: 120 }} autoFocus />
                        </Fld>
                        <Fld label="Floor">
                          <input value={newRoom.floorLabel} onChange={(e) => setNewRoom((p) => ({ ...p, floorLabel: e.target.value }))}
                            placeholder="Ground, 1st..." style={{ ...inputStyle, width: 80 }} />
                        </Fld>
                        <Fld label="Beds">
                          <input type="number" min={1} max={20} value={newRoom.capacity}
                            onChange={(e) => setNewRoom((p) => ({ ...p, capacity: e.target.value }))}
                            style={{ ...inputStyle, width: 55 }} />
                        </Fld>
                        <button onClick={() => addRoom(house.id)} style={{ ...btnNavy, height: 30, fontSize: 10 }}>Add Room</button>
                        <button onClick={() => setShowAddRoom(null)} style={{ color: B.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10 }}>Cancel</button>
                      </div>
                    ) : (
                      !readOnly && <button onClick={() => { setShowAddRoom(house.id); setNewRoom({ floorLabel: "", roomName: "", capacity: 2 }); }}
                        style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: B.cyan, background: "transparent", border: "1px dashed #bae6fd", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                        <IcPlus /> Add Room
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ASSIGN ────────────────────────────────────── */}
      {houseView === "assign" && (
        <div>
          {roomingHouses.length === 0 ? (
            <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, padding: 40, textAlign: "center", color: B.textLight }}>
              Set up houses and rooms first in the <strong>Setup</strong> view
            </div>
          ) : (
            <>
              <div style={{ padding: "0 4px 10px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Groups:</span>
                {activeGroups.map((g, i) => (
                  <span key={g.id} style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] + "20", color: GROUP_COLORS[i % GROUP_COLORS.length], padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                    {g.group} ({(g.stu || 0) + (g.gl || 0)} pax)
                  </span>
                ))}
                {centreId && (
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {activeGroups.map((g) => {
                      const hasToken = !!roomTokens[g.id];
                      const isLoading = tokenLoading === g.id;
                      return (
                        <button key={g.id}
                          onClick={() => hasToken ? setTokenModal(g.id) : generateToken(g)}
                          disabled={isLoading}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "5px 10px", borderRadius: 6, fontSize: 9, fontWeight: 700,
                            fontFamily: "inherit", cursor: isLoading ? "default" : "pointer",
                            border: "1px solid " + (hasToken ? "#4ade80" : B.border),
                            background: hasToken ? "#f0fdf4" : B.white,
                            color: hasToken ? "#16a34a" : B.textMuted,
                          }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                            <line x1="12" y1="18" x2="12.01" y2="18"/>
                          </svg>
                          {isLoading ? "Generating…" : hasToken ? `${g.group} — View Link` : `${g.group} — Get Link`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {roomingHouses.map((house) => {
                const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
                if (houseRooms.length === 0) return null;
                const floors = groupByFloor(houseRooms);
                const houseOccupied = roomingAssignments.filter((a) => houseRooms.some((r) => r.id === a.roomId) && a.occupantName).length;
                const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);

                return (
                  <div key={house.id} style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
                    <div style={{ padding: "8px 16px", display: "flex", gap: 8, alignItems: "center", background: B.navy }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: B.white }}>{house.name}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                        {houseOccupied}/{houseBeds} beds filled
                      </span>
                      {houseBeds > 0 && (
                        <div style={{ marginLeft: "auto", height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 3, width: 100, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: Math.min(100, (houseOccupied / houseBeds) * 100) + "%", background: houseOccupied >= houseBeds ? "#4ade80" : "#60a5fa", borderRadius: 3 }} />
                        </div>
                      )}
                    </div>

                    {Object.entries(floors).map(([floor, fRooms]) => (
                      <div key={floor}>
                        {Object.keys(floors).length > 1 && (
                          <div style={{ padding: "4px 16px", fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, background: "#f8fafc", borderBottom: "1px solid " + B.borderLight }}>
                            {floor}
                          </div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "10px 16px 14px" }}>
                          {fRooms.map((room) => {
                            const slots = Array.from({ length: room.capacity }, (_, i) => i);
                            const roomFilled = slots.filter((i) => getAssignment(room.id, i)?.occupantName).length;
                            return (
                              <div key={room.id} style={{
                                border: "1px solid " + (roomFilled >= room.capacity ? "#86efac" : B.border),
                                borderRadius: 8, padding: "8px 10px", minWidth: 170, flex: "0 0 auto",
                                background: roomFilled >= room.capacity ? "#f0fdf4" : B.white,
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <div style={{ fontWeight: 700, fontSize: 11, color: B.navy }}>{room.roomName}</div>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: roomFilled >= room.capacity ? B.success : B.textMuted }}>
                                    {roomFilled}/{room.capacity}
                                  </span>
                                </div>
                                {slots.map((slotIdx) => {
                                  const a = getAssignment(room.id, slotIdx);
                                  const otype = a?.occupantType || "student";
                                  const dotColor = otype === "uklc" ? "#1c3048" : otype === "gl" ? "#16a34a" : (a?.groupId ? groupColorMap[a.groupId] : null);
                                  const inputBg = dotColor ? dotColor + "12" : "#f8fafc";
                                  const inputBorder = dotColor ? dotColor + "40" : B.borderLight;
                                  return (
                                    <div key={slotIdx} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor || B.border, flexShrink: 0 }} />
                                      <input
                                        value={a?.occupantName || ""}
                                        disabled={readOnly}
                                        onChange={(e) => e.target.value
                                          ? setSlot(room.id, slotIdx, { occupantName: e.target.value, groupId: otype === "uklc" ? "" : (a?.groupId || ""), occupantType: otype })
                                          : clearSlot(room.id, slotIdx)
                                        }
                                        placeholder={"Bed " + (slotIdx + 1)}
                                        style={{ background: inputBg, border: "1px solid " + inputBorder, color: B.text, padding: "3px 6px", borderRadius: 4, fontSize: 10, fontFamily: "inherit", width: "100%", minWidth: 0 }}
                                      />
                                      {a?.occupantName && !readOnly && (
                                        <>
                                          <select
                                            value={otype}
                                            onChange={(e) => setSlot(room.id, slotIdx, { occupantType: e.target.value, groupId: e.target.value === "uklc" ? "" : (a?.groupId || "") })}
                                            title="Occupant type"
                                            style={{ background: inputBg, border: "1px solid " + inputBorder, color: dotColor || B.textMuted, padding: "3px 2px", borderRadius: 4, fontSize: 9, fontFamily: "inherit", cursor: "pointer", width: 42 }}>
                                            <option value="student">Stu</option>
                                            <option value="gl">GL</option>
                                            <option value="uklc">UKLC</option>
                                          </select>
                                          {otype !== "uklc" && (
                                            <select value={a?.groupId || ""}
                                              onChange={(e) => setSlot(room.id, slotIdx, { groupId: e.target.value })}
                                              title="Assign to group"
                                              style={{ background: inputBg, border: "1px solid " + inputBorder, color: dotColor || B.textMuted, padding: "3px 2px", borderRadius: 4, fontSize: 9, fontFamily: "inherit", cursor: "pointer", width: 36 }}>
                                              <option value="">—</option>
                                              {activeGroups.map((g) => <option key={g.id} value={g.id}>{g.group.slice(0, 10)}</option>)}
                                            </select>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Occupancy summary */}
              <TableWrap>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr>{["House", "Rooms", "Beds", "Assigned", "Vacant", "Occupancy"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {roomingHouses.map((house) => {
                      const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
                      const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);
                      const houseOccupied = roomingAssignments.filter((a) => houseRooms.some((r) => r.id === a.roomId) && a.occupantName).length;
                      const pct = houseBeds ? Math.round((houseOccupied / houseBeds) * 100) : 0;
                      return (
                        <tr key={house.id} style={{ borderBottom: "1px solid " + B.borderLight }}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{house.name}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>{houseRooms.length}</td>
                          <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{houseBeds}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: B.success, fontWeight: 700 }}>{houseOccupied}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: houseBeds - houseOccupied === 0 ? B.textLight : B.warning, fontWeight: 700 }}>{houseBeds - houseOccupied}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 6, background: B.borderLight, borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: pct + "%", background: pct >= 100 ? B.success : pct > 50 ? "#3b82f6" : B.warning, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 700, color: B.textMuted, minWidth: 28 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "#f8fafc", borderTop: "2px solid " + B.border }}>
                      <td style={{ ...tdStyle, fontWeight: 800, color: B.navy }}>TOTAL</td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800 }}>{roomingRooms.length}</td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800 }}>{totalBeds}</td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: B.success }}>{occupiedBeds}</td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: B.warning }}>{totalBeds - occupiedBeds}</td>
                      <td style={{ ...tdStyle, fontSize: 9, fontWeight: 800, color: B.textMuted }}>
                        {totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </TableWrap>
            </>
          )}
        </div>
      )}

      {/* ── NIGHTLY VIEW ──────────────────────────────── */}
      {houseView === "nightly" && (
        <div>
          {roomingHouses.length === 0 ? (
            <div style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, padding: 40, textAlign: "center", color: B.textLight }}>
              Set up houses and rooms first in the <strong>Setup</strong> view
            </div>
          ) : (
            <>
              {/* Date navigator */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 12px", flexWrap: "wrap" }}>
                <button onClick={() => setNightDate((d) => shiftDate(d || progStart, -1))}
                  disabled={nightDate <= progStart}
                  style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 5, padding: "4px 10px", cursor: nightDate <= progStart ? "default" : "pointer", fontSize: 13, color: nightDate <= progStart ? B.textLight : B.navy, fontFamily: "inherit" }}>
                  ←
                </button>
                <div style={{ fontWeight: 800, fontSize: 13, color: B.navy, minWidth: 120, textAlign: "center" }}>
                  {nightDate ? fmtDate(nightDate) : "—"}
                  <div style={{ fontSize: 9, fontWeight: 600, color: B.textMuted }}>
                    {nightDate ? new Date(nightDate).toLocaleDateString("en-GB", { weekday: "long" }) : ""}
                  </div>
                </div>
                <button onClick={() => setNightDate((d) => shiftDate(d || progStart, 1))}
                  disabled={nightDate >= progEnd}
                  style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 5, padding: "4px 10px", cursor: nightDate >= progEnd ? "default" : "pointer", fontSize: 13, color: nightDate >= progEnd ? B.textLight : B.navy, fontFamily: "inherit" }}>
                  →
                </button>
                <input type="date" value={nightDate} min={progStart} max={progEnd}
                  onChange={(e) => setNightDate(e.target.value)}
                  style={{ ...inputStyle, fontSize: 11 }} />

                {nightDate && activeGroups.filter((g) => inBed(nightDate, g.arr, g.dep)).map((g) => (
                  <span key={g.id} style={{ background: groupColorMap[g.id] + "20", color: groupColorMap[g.id], padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                    {g.group}
                  </span>
                ))}

                <button onClick={onPrintNightly} style={{ ...btnNavy, fontSize: 9, padding: "4px 10px", marginLeft: "auto" }}>
                  {"\ud83d\udda8\ufe0f"} Print This Night
                </button>
              </div>

              {/* Houses */}
              {roomingHouses.map((house) => {
                const houseRooms = roomingRooms.filter((r) => r.houseId === house.id);
                if (houseRooms.length === 0) return null;
                const floors = groupByFloor(houseRooms);

                let onSiteCount = 0;
                houseRooms.forEach((room) => {
                  Array.from({ length: room.capacity }, (_, i) => i).forEach((idx) => {
                    const a = getAssignment(room.id, idx);
                    if (a?.occupantName && a.groupId) {
                      const g = activeGroups.find((x) => x.id === a.groupId);
                      if (g && inBed(nightDate, g.arr, g.dep)) onSiteCount++;
                    }
                  });
                });
                const houseBeds = houseRooms.reduce((s, r) => s + (r.capacity || 0), 0);

                return (
                  <div key={house.id} style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
                    <div style={{ padding: "8px 16px", display: "flex", gap: 10, alignItems: "center", background: B.navy }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: B.white }}>{house.name}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                        {onSiteCount} on-site tonight / {houseBeds} beds
                      </span>
                      {houseBeds > 0 && (
                        <div style={{ marginLeft: "auto", height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 3, width: 100, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: Math.min(100, (onSiteCount / houseBeds) * 100) + "%", background: "#4ade80", borderRadius: 3 }} />
                        </div>
                      )}
                    </div>

                    {Object.entries(floors).map(([floor, fRooms]) => (
                      <div key={floor}>
                        {Object.keys(floors).length > 1 && (
                          <div style={{ padding: "4px 16px", fontSize: 9, fontWeight: 700, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, background: "#f8fafc", borderBottom: "1px solid " + B.borderLight }}>
                            {floor}
                          </div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "10px 16px 14px" }}>
                          {fRooms.map((room) => {
                            const slots = Array.from({ length: room.capacity }, (_, i) => i);
                            const presentSlots = slots.map((idx) => {
                              const a = getAssignment(room.id, idx);
                              const g = a?.groupId ? activeGroups.find((x) => x.id === a.groupId) : null;
                              const isUklc = a?.occupantType === "uklc";
                              const present = a?.occupantName ? (isUklc ? true : g ? inBed(nightDate, g.arr, g.dep) : false) : false;
                              const away = a?.occupantName && !present;
                              return { a, g, present, away, idx };
                            });
                            const presentCount = presentSlots.filter((s) => s.present).length;
                            const isEmpty = presentCount === 0;

                            return (
                              <div key={room.id} style={{
                                border: "2px solid " + (presentCount >= room.capacity ? "#86efac" : isEmpty ? B.borderLight : B.border),
                                borderRadius: 8, padding: "8px 10px", minWidth: 150, flex: "0 0 auto",
                                background: presentCount >= room.capacity ? "#f0fdf4" : isEmpty ? "#fafafa" : B.white,
                                opacity: isEmpty && roomingAssignments.filter((a) => a.roomId === room.id && a.occupantName).length === 0 ? 0.5 : 1,
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                  <div style={{ fontWeight: 800, fontSize: 11, color: B.navy }}>{room.roomName}</div>
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                                    background: presentCount >= room.capacity ? "#dcfce7" : presentCount > 0 ? B.cyanBg : "#f1f5f9",
                                    color: presentCount >= room.capacity ? B.success : presentCount > 0 ? B.link : B.textLight,
                                  }}>
                                    {presentCount}/{room.capacity}
                                  </span>
                                </div>

                                {presentSlots.map(({ a, g, present, away, idx }) => {
                                  const otype = a?.occupantType || "student";
                                  const gc = otype === "uklc" ? "#1c3048" : otype === "gl" ? "#16a34a" : (g ? groupColorMap[g.id] : null);
                                  return (
                                    <div key={idx} style={{
                                      display: "flex", alignItems: "center", gap: 6, padding: "4px 6px",
                                      marginBottom: 3, borderRadius: 5,
                                      background: present ? (gc ? gc + "15" : "#f0fdf4") : away ? "#f5f5f5" : "#f8fafc",
                                      border: "1px solid " + (present ? (gc ? gc + "30" : "#86efac") : away ? "#e5e7eb" : B.borderLight),
                                      opacity: away ? 0.45 : 1,
                                    }}>
                                      <div style={{
                                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                        background: present ? (gc || B.success) : away ? "#d1d5db" : "#e5e7eb",
                                      }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        {a?.occupantName ? (
                                          <>
                                            <div style={{
                                              fontSize: 10,
                                              fontWeight: present ? 700 : 400,
                                              color: present ? B.navy : B.textLight,
                                              textDecoration: away ? "line-through" : "none",
                                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                            }}>
                                              {a.occupantName}
                                              {away && <span style={{ fontSize: 8, marginLeft: 4, color: B.textLight }}>(not on-site)</span>}
                                            </div>
                                            {g && present && (
                                              <div style={{ fontSize: 8, color: gc || B.textMuted, fontWeight: 600 }}>{g.group}</div>
                                            )}
                                          </>
                                        ) : (
                                          <div style={{ fontSize: 9, color: B.textLight, fontStyle: "italic" }}>Empty bed</div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
