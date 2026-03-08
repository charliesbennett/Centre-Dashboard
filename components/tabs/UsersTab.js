"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { B, uid } from "@/lib/constants";
import { Fld, IcPlus, IcEdit, IcTrash, IcX, IcCheck, inputStyle, btnPrimary } from "@/components/ui";

const ROLES = [
  { value: "head_office",                label: "Head Office" },
  { value: "centre_manager",             label: "Centre Manager" },
  { value: "course_director",            label: "Course Director" },
  { value: "excursion_activity_manager", label: "Excursions & Activity Manager" },
  { value: "safeguarding_welfare",       label: "Safeguarding & Welfare" },
  { value: "teacher",                    label: "Teacher" },
  { value: "activity_leader",            label: "Activity Leader" },
  { value: "sports_activity_instructor", label: "Sports & Activity Instructor" },
  { value: "house_parent",               label: "House Parent" },
];

const READ_ONLY_ROLES = ["teacher", "activity_leader", "sports_activity_instructor", "house_parent"];

const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const EMPTY_FORM = { name: "", email: "", password: "", role: "centre_manager", centreId: "" };

export default function UsersTab({ centres = [] }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const fi = inputStyle;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("app_users").select("*").order("full_name");
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addUser = async () => {
    setFormErr("");
    if (!form.name.trim()) return setFormErr("Full name is required.");
    if (!form.email.trim()) return setFormErr("Email is required.");
    if (!form.email.trim().endsWith("@uklc.org")) return setFormErr("Email must end with @uklc.org");
    if (!form.password.trim()) return setFormErr("Password is required.");
    setSaving(true);
    const hash = await hashPassword(form.password.trim());
    const { error } = await supabase.from("app_users").insert({
      email: form.email.trim().toLowerCase(),
      full_name: form.name.trim(),
      password_hash: hash,
      role: form.role,
      centre_id: form.centreId || null,
    });
    setSaving(false);
    if (error) { setFormErr(error.message); return; }
    setForm(EMPTY_FORM);
    setShowAdd(false);
    load();
  };

  const startEdit = (u) => {
    setEditId(u.id);
    setEditForm({ name: u.full_name, role: u.role, centreId: u.centre_id || "", password: "" });
  };

  const saveEdit = async () => {
    setSaving(true);
    const update = { full_name: editForm.name, role: editForm.role, centre_id: editForm.centreId || null };
    if (editForm.password.trim()) update.password_hash = await hashPassword(editForm.password.trim());
    await supabase.from("app_users").update(update).eq("id", editId);
    setSaving(false);
    setEditId(null);
    load();
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? They will immediately lose access.`)) return;
    await supabase.from("app_users").delete().eq("id", id);
    load();
  };

  const centreLabel = (centreId) => {
    if (!centreId) return <span style={{ color: B.textLight, fontSize: 10 }}>All Centres</span>;
    const c = centres.find((x) => x.id === centreId);
    return c ? c.name : centreId;
  };

  return (
    <div>
      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: B.textMuted }}>{users.length} users</span>
        <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}><IcPlus /> Add User</button>
      </div>

      {showAdd && (
        <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Fld label="Full Name"><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={{ ...fi, minWidth: 160 }} autoFocus /></Fld>
          <Fld label="Email (@uklc.org)"><input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} style={{ ...fi, minWidth: 200 }} /></Fld>
          <Fld label="Password"><input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} style={{ ...fi, width: 130 }} /></Fld>
          <Fld label="Role">
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} style={{ ...fi, cursor: "pointer", minWidth: 180 }}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Fld>
          <Fld label="Centre">
            <select value={form.centreId} onChange={(e) => setForm((p) => ({ ...p, centreId: e.target.value }))} style={{ ...fi, cursor: "pointer", minWidth: 160 }}>
              <option value="">Head Office / All Centres</option>
              {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Fld>
          {formErr && <div style={{ width: "100%", fontSize: 11, color: B.danger, fontWeight: 600 }}>{formErr}</div>}
          <button onClick={addUser} disabled={saving} style={{ padding: "6px 16px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32 }}>
            {saving ? "Saving…" : "Add"}
          </button>
          <button onClick={() => { setShowAdd(false); setFormErr(""); }} style={{ padding: "6px 10px", background: "none", border: `1px solid ${B.border}`, borderRadius: 6, cursor: "pointer", fontSize: 11, color: B.textMuted, fontFamily: "inherit", height: 32 }}>Cancel</button>
        </div>
      )}

      <div style={{ padding: "12px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: B.textMuted }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: B.textLight }}>No users yet. Add one above.</div>
        ) : (
          <div style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: B.ice }}>
                  {["Name", "Email", "Role", "Centre", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${B.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <>
                    <tr key={u.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: B.navy }}>{u.full_name}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: B.textMuted }}>{u.email}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11 }}>
                        <span style={{ background: READ_ONLY_ROLES.includes(u.role) ? B.warningBg : B.ice, color: READ_ONLY_ROLES.includes(u.role) ? B.warning : B.navy, padding: "2px 8px", borderRadius: 10, fontWeight: 700, fontSize: 10 }}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                        {READ_ONLY_ROLES.includes(u.role) && <span style={{ marginLeft: 6, fontSize: 9, color: B.textLight }}>View only</span>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: B.text }}>{centreLabel(u.centre_id)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => editId === u.id ? setEditId(null) : startEdit(u)} style={{ padding: "3px 8px", background: editId === u.id ? B.navy : B.ice, color: editId === u.id ? B.white : B.textMuted, border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3 }}>
                            {editId === u.id ? <><IcX /> Cancel</> : <><IcEdit /> Edit</>}
                          </button>
                          <button onClick={() => deleteUser(u.id, u.full_name)} style={{ padding: "3px 8px", background: B.dangerBg, color: B.danger, border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3 }}>
                            <IcTrash /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editId === u.id && (
                      <tr key={`edit-${u.id}`} style={{ background: B.ice }}>
                        <td colSpan={5} style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
                            <Fld label="Full Name"><input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} style={{ ...fi, minWidth: 160 }} autoFocus /></Fld>
                            <Fld label="Role">
                              <select value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))} style={{ ...fi, cursor: "pointer", minWidth: 180 }}>
                                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                            </Fld>
                            <Fld label="Centre">
                              <select value={editForm.centreId} onChange={(e) => setEditForm((p) => ({ ...p, centreId: e.target.value }))} style={{ ...fi, cursor: "pointer", minWidth: 160 }}>
                                <option value="">Head Office / All Centres</option>
                                {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </Fld>
                            <Fld label="New Password (optional)"><input type="password" value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} placeholder="Leave blank to keep" style={{ ...fi, width: 160 }} /></Fld>
                            <button onClick={saveEdit} disabled={saving} style={{ padding: "6px 14px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32, display: "flex", alignItems: "center", gap: 4 }}>
                              <IcCheck /> {saving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
