"use client";
import { useState, useEffect, useRef } from "react";
import { uid } from "@/lib/constants";
import { useB } from "@/lib/theme";
import { Fld, IcPlus, IcEdit, IcTrash, IcX, IcCheck, inputStyle, btnPrimary } from "@/components/ui";
import * as XLSX from "xlsx";

const ROLES = [
  { value: "head_office",                label: "Head Office" },
  { value: "centre_manager",             label: "Centre Manager" },
  { value: "course_director",            label: "Course Director" },
  { value: "excursion_activity_manager", label: "Excursions & Activity Manager" },
  { value: "safeguarding_welfare",       label: "Safeguarding & Welfare Coordinator" },
  { value: "sports_coordinator",         label: "Sports Coordinator" },
  { value: "teacher",                    label: "Teacher" },
  { value: "activity_leader",            label: "Activity Leader" },
  { value: "house_parent",               label: "House Parent" },
];

const READ_ONLY_ROLES = ["teacher", "activity_leader", "sports_coordinator", "house_parent"];
const MANAGER_ROLES = ["centre_manager", "course_director", "excursion_activity_manager", "safeguarding_welfare", "sports_coordinator"];
const STAFF_ROLES = ["teacher", "activity_leader", "house_parent"];
const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const EMPTY_FORM = { name: "", email: "", username: "", password: "", role: "centre_manager", centreId: "" };

export default function UsersTab({ centres = [], isSuperAdmin = false }) {
  const B = useB();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef(null);
  const [loginLog, setLoginLog] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const fi = inputStyle;

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/db/dashboard-users");
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addUser = async () => {
    setFormErr("");
    if (!form.name.trim()) return setFormErr("Full name is required.");
    if (!form.email.trim() && !form.username.trim()) return setFormErr("Either an email or username is required.");
    if (!form.password.trim()) return setFormErr("Password is required.");
    setSaving(true);
    const password_hash = await hashPassword(form.password.trim());
    const res = await fetch("/api/db/dashboard-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.name.trim(),
        email: form.email.trim().toLowerCase() || null,
        username: form.username.trim().toLowerCase() || null,
        password_hash,
        role: form.role,
        centre_id: form.centreId || null,
      }),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setFormErr(result.error); return; }
    setForm(EMPTY_FORM);
    setShowAdd(false);
    load();
  };

  const startEdit = (u) => {
    setEditId(u.id);
    setEditForm({ name: u.full_name, role: u.role, centreId: u.centre_id || "", username: u.username || "", password: "" });
  };

  const saveEdit = async () => {
    setSaving(true);
    const update = {
      id: editId,
      full_name: editForm.name,
      role: editForm.role,
      centre_id: editForm.centreId || null,
      username: editForm.username.trim().toLowerCase() || null,
    };
    if (editForm.password.trim()) update.password_hash = await hashPassword(editForm.password.trim());
    await fetch("/api/db/dashboard-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    setSaving(false);
    setEditId(null);
    load();
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? They will immediately lose access.`)) return;
    await fetch("/api/db/dashboard-users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (importRef.current) importRef.current.value = "";
    setImporting(true);
    setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const h = (row, ...keys) => {
        for (const k of keys) {
          const found = Object.keys(row).find((rk) => rk.toLowerCase().trim() === k.toLowerCase());
          if (found) return String(row[found] || "").trim();
        }
        return "";
      };

      const parsed = rows.map((row) => ({
        full_name: h(row, "name", "full name", "full_name"),
        username:  h(row, "username", "user name", "user"),
        password:  h(row, "password", "pass"),
        email:     h(row, "email"),
        role:      h(row, "role") || "centre_manager",
      })).filter((u) => u.full_name && u.username && u.password);

      if (parsed.length === 0) {
        setImportResult({ error: "No valid rows found. Check the file has Name, Username, and Password columns." });
        setImporting(false);
        return;
      }

      // Hash passwords client-side
      const users = await Promise.all(parsed.map(async (u) => {
        const enc = new TextEncoder().encode(u.password);
        const buf = await crypto.subtle.digest("SHA-256", enc);
        const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
        return { full_name: u.full_name, username: u.username, email: u.email || null, role: u.role, password_hash: hash };
      }));

      const res = await fetch("/api/db/dashboard-users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
      });
      const data = await res.json();
      if (!res.ok) { setImportResult({ error: data.error }); }
      else { setImportResult({ created: data.created, skipped: data.skipped, errors: data.errors }); load(); }
    } catch (err) {
      setImportResult({ error: "Import failed: " + err.message });
    }
    setImporting(false);
  };

  const toggleLog = async () => {
    if (showLog) { setShowLog(false); return; }
    setShowLog(true);
    if (loginLog) return;
    const res = await fetch("/api/db/login-log");
    const data = await res.json();
    setLoginLog(Array.isArray(data) ? data : [{ _error: data.error || "Failed to load" }]);
  };

  const centreLabel = (centreId) => {
    if (!centreId) return <span style={{ color: B.textMuted, fontSize: 10 }}>All Centres</span>;
    const c = centres.find((x) => x.id === centreId);
    return c ? c.name : centreId;
  };

  return (
    <div>
      <div style={{ background: B.card, borderBottom: `1px solid ${B.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: B.textMuted }}>{users.length} users</span>
        {isSuperAdmin && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={toggleLog} style={{ padding: "6px 14px", background: showLog ? B.navy : B.ice, border: `1px solid ${showLog ? B.navy : B.border}`, color: showLog ? B.white : B.text, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>
              Login History
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleImport} />
            <button onClick={() => importRef.current?.click()} disabled={importing} style={{ padding: "6px 14px", background: B.ice, border: `1px solid ${B.border}`, color: B.text, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>
              {importing ? "Importing…" : "Import Excel"}
            </button>
            <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}><IcPlus /> Add User</button>
          </div>
        )}
      </div>

      {showAdd && (
        <div style={{ background: B.card, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Fld label="Full Name"><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={{ ...fi, minWidth: 160 }} autoFocus /></Fld>
          <Fld label="Username"><input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} style={{ ...fi, minWidth: 130 }} placeholder="e.g. jsmith" /></Fld>
          <Fld label="Email (optional)"><input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} style={{ ...fi, minWidth: 180 }} /></Fld>
          {isSuperAdmin && <Fld label="Password"><input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} style={{ ...fi, width: 130 }} /></Fld>}
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

      {importResult && (
        <div style={{ background: importResult.error ? "#fef2f2" : "#f0fdf4", border: `1px solid ${importResult.error ? "#fecaca" : "#bbf7d0"}`, borderRadius: 8, margin: "8px 20px 0", padding: "10px 14px", fontSize: 12, color: importResult.error ? "#b91c1c" : "#15803d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {importResult.error
              ? importResult.error
              : `${importResult.created} user${importResult.created !== 1 ? "s" : ""} created${importResult.skipped ? `, ${importResult.skipped} skipped` : ""}${importResult.errors?.length ? ` — ${importResult.errors.length} error(s): ${importResult.errors[0]}` : ""}`
            }
          </span>
          <button onClick={() => setImportResult(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "inherit", padding: "0 4px", lineHeight: 1 }}>×</button>
        </div>
      )}

      {showLog && (
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${B.border}` }}>
          <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>Login History — last 30 days</div>
          {!loginLog ? (
            <div style={{ padding: 20, textAlign: "center", color: B.textMuted, fontSize: 12 }}>Loading…</div>
          ) : loginLog[0]?._error ? (
            <div style={{ padding: 20, textAlign: "center", color: "#b91c1c", fontSize: 12 }}>Error: {loginLog[0]._error}</div>
          ) : loginLog.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: B.textLight, fontSize: 12 }}>No logins recorded yet.</div>
          ) : (
            <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 10, overflow: "hidden", maxHeight: 340, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: B.ice, position: "sticky", top: 0, zIndex: 1 }}>
                    {["User", "Identifier", "When", "IP Address", "Result"].map((h) => (
                      <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loginLog.map((row) => {
                    const d = new Date(row.logged_at);
                    const when = d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                    const matched = users.find((u) => u.id === row.user_id);
                    const name = matched ? matched.full_name : <span style={{ color: B.textLight, fontStyle: "italic" }}>Unknown</span>;
                    return (
                      <tr key={row.id} style={{ borderBottom: `1px solid ${B.borderLight}`, background: row.success ? "transparent" : "#fff5f5" }}>
                        <td style={{ padding: "7px 12px", fontSize: 12, fontWeight: 600, color: B.text, whiteSpace: "nowrap" }}>{name}</td>
                        <td style={{ padding: "7px 12px", fontSize: 11, color: B.textMuted }}>{row.identifier}</td>
                        <td style={{ padding: "7px 12px", fontSize: 11, color: B.textMuted, whiteSpace: "nowrap" }}>{when}</td>
                        <td style={{ padding: "7px 12px", fontSize: 11, color: B.textMuted, fontFamily: "monospace" }}>{row.ip_address || "—"}</td>
                        <td style={{ padding: "7px 12px" }}>
                          <span style={{ background: row.success ? "#dcfce7" : "#fee2e2", color: row.success ? "#15803d" : "#b91c1c", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                            {row.success ? "Success" : "Failed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: B.textMuted }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: B.textLight }}>No users yet. Add one above.</div>
        ) : [
          { label: "Head Office",                 filter: (u) => u.role === "head_office" },
          { label: "Managers",                    filter: (u) => MANAGER_ROLES.includes(u.role) },
          { label: "Teachers & Activity Leaders", filter: (u) => STAFF_ROLES.includes(u.role) },
        ].map(({ label, filter }) => {
          const sectionUsers = users.filter(filter);
          if (!sectionUsers.length) return null;
          const byCentre = sectionUsers.reduce((acc, u) => {
            const k = u.centre_id || "__ho";
            acc[k] = acc[k] || [];
            acc[k].push(u);
            return acc;
          }, {});
          const centreKeys = Object.keys(byCentre);
          const thStyle = { padding: "8px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${B.border}` };
          const renderRow = (u) => (
            <>
              <tr key={u.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: B.text }}>{u.full_name}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: B.textMuted }}>{u.username || <span style={{ color: B.textLight, fontSize: 10 }}>—</span>}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: B.textMuted }}>{u.email || <span style={{ color: B.textLight, fontSize: 10 }}>—</span>}</td>
                <td style={{ padding: "10px 14px", fontSize: 11 }}>
                  <span style={{ background: READ_ONLY_ROLES.includes(u.role) ? B.warningBg : B.ice, color: READ_ONLY_ROLES.includes(u.role) ? B.warning : B.text, padding: "2px 8px", borderRadius: 10, fontWeight: 700, fontSize: 10 }}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
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
                      <Fld label="Username"><input value={editForm.username} onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))} style={{ ...fi, minWidth: 120 }} placeholder="e.g. jsmith" /></Fld>
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
                      {isSuperAdmin && <Fld label="New Password (optional)"><input type="password" value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} placeholder="Leave blank to keep" style={{ ...fi, width: 160 }} /></Fld>}
                      <button onClick={saveEdit} disabled={saving} style={{ padding: "6px 14px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32, display: "flex", alignItems: "center", gap: 4 }}>
                        <IcCheck /> {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
          return (
            <div key={label} style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: B.navy, padding: "9px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: B.white, fontSize: 12, fontWeight: 800 }}>{label}</span>
                <span style={{ background: "rgba(255,255,255,0.15)", color: B.white, padding: "1px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{sectionUsers.length}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: B.ice }}>
                    {["Name", "Username", "Email", "Role", "Actions"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {centreKeys.map((ck) => <>
                    {centreKeys.length > 1 && (
                      <tr key={`ch-${ck}`}><td colSpan={5} style={{ padding: "5px 14px", background: B.ice, fontSize: 10, fontWeight: 800, color: B.textMuted, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${B.borderLight}`, borderTop: `1px solid ${B.border}` }}>
                        {centreLabel(ck === "__ho" ? null : ck)}
                      </td></tr>
                    )}
                    {byCentre[ck].map(renderRow)}
                  </>)}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
