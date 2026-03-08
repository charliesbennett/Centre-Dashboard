"use client";
import { useState } from "react";
import { B, ROLES, uid, fmtDate } from "@/lib/constants";
import { Fld, StatCard, TableWrap, IconBtn, IcPlus, IcTrash, IcEdit, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const EMPTY = { name: "", role: "TAL", acc: "Residential", arr: "", dep: "", to: "", email: "", phone: "", dbs: "", dbsExpiry: "", contract: "", notes: "" };
const CONTRACT_TYPES = ["", "Full-time", "Part-time", "Sessional", "Volunteer"];
const fi = inputStyle;

function StaffForm({ value, onChange, onSave, onCancel, saveLabel = "Save" }) {
  return (
    <div style={{ background: B.ice, border: `1px solid ${B.border}`, borderRadius: 8, padding: "12px 16px", margin: "4px 0", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
      <Fld label="Name *"><input value={value.name} onChange={(e) => onChange("name", e.target.value)} style={{ ...fi, minWidth: 120 }} /></Fld>
      <Fld label="Role"><select value={value.role} onChange={(e) => onChange("role", e.target.value)} style={{ ...fi, cursor: "pointer" }}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Fld>
      <Fld label="Acc."><select value={value.acc} onChange={(e) => onChange("acc", e.target.value)} style={{ ...fi, cursor: "pointer" }}>{["Residential", "Non-residential"].map((a) => <option key={a}>{a}</option>)}</select></Fld>
      <Fld label="Arrival"><input type="date" value={value.arr} onChange={(e) => onChange("arr", e.target.value)} style={fi} /></Fld>
      <Fld label="Departure"><input type="date" value={value.dep} onChange={(e) => onChange("dep", e.target.value)} style={fi} /></Fld>
      <Fld label="Time Off"><input value={value.to} onChange={(e) => onChange("to", e.target.value)} style={{ ...fi, minWidth: 120 }} placeholder="e.g. 16/07 eve" /></Fld>
      <Fld label="Email"><input type="email" value={value.email} onChange={(e) => onChange("email", e.target.value)} style={{ ...fi, minWidth: 160 }} /></Fld>
      <Fld label="Phone"><input value={value.phone} onChange={(e) => onChange("phone", e.target.value)} style={{ ...fi, width: 110 }} /></Fld>
      <Fld label="DBS No."><input value={value.dbs} onChange={(e) => onChange("dbs", e.target.value)} style={{ ...fi, width: 110 }} /></Fld>
      <Fld label="DBS Expiry"><input type="date" value={value.dbsExpiry} onChange={(e) => onChange("dbsExpiry", e.target.value)} style={fi} /></Fld>
      <Fld label="Contract"><select value={value.contract} onChange={(e) => onChange("contract", e.target.value)} style={{ ...fi, cursor: "pointer" }}>{CONTRACT_TYPES.map((c) => <option key={c}>{c}</option>)}</select></Fld>
      <Fld label="Notes"><input value={value.notes} onChange={(e) => onChange("notes", e.target.value)} style={{ ...fi, minWidth: 150 }} /></Fld>
      <div style={{ display: "flex", gap: 5, alignItems: "flex-end", paddingBottom: 1 }}>
        <button onClick={onSave} style={{ padding: "6px 16px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32 }}>{saveLabel}</button>
        {onCancel && <button onClick={onCancel} style={{ padding: "6px 12px", background: "none", border: `1px solid ${B.border}`, color: B.textMuted, borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit", height: 32 }}>Cancel</button>}
      </div>
    </div>
  );
}

export default function TeamTab({ staff, setStaff, readOnly = false }) {
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY);

  const startEdit = (s) => {
    setShowAdd(false);
    setEditId(s.id);
    setEditForm({ ...EMPTY, ...s });
  };

  const saveEdit = () => {
    if (!editForm.name.trim()) return;
    setStaff((p) => p.map((s) => s.id === editId ? { ...editForm } : s));
    setEditId(null);
  };

  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatCard label="Total" value={staff.length} accent={B.navy} />
        <StatCard label="Res" value={staff.filter((s) => s.acc === "Residential").length} accent="#0369a1" />
        <StatCard label="Non-res" value={staff.filter((s) => s.acc !== "Residential").length} accent={B.textMuted} />
      </div>
      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: B.success, fontWeight: 600 }}>✓ Staff flow to Rota + Catering</span>
        {!readOnly && <button onClick={() => { setShowAdd(!showAdd); setEditId(null); }} style={btnPrimary}><IcPlus /> Add Staff</button>}
      </div>

      {showAdd && (
        <div style={{ padding: "8px 20px", background: B.white, borderBottom: `1px solid ${B.border}` }}>
          <StaffForm
            value={n}
            onChange={(k, v) => setN((p) => ({ ...p, [k]: v }))}
            onSave={() => {
              if (n.name.trim()) {
                setStaff((p) => [...p, { ...n, id: uid() }]);
                setN(EMPTY);
                setShowAdd(false);
              }
            }}
            onCancel={() => setShowAdd(false)}
            saveLabel="Add"
          />
        </div>
      )}

      <div style={{ padding: "0 12px 16px", overflowX: "auto" }}>
        <TableWrap>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr>{["Role", "Name", "Accomm.", "Arrival", "Departure", "Time Off", "Contact", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {staff.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 36, color: B.textLight }}>No team members yet</td></tr>
              ) : staff.map((x) => (
                <>
                  <tr key={x.id} style={{ borderBottom: editId === x.id ? "none" : `1px solid ${B.borderLight}`, background: editId === x.id ? B.ice : "transparent" }}>
                    <td style={tdStyle}><span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 5px", borderRadius: 3, fontSize: 9, fontWeight: 800 }}>{x.role}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{x.name}</td>
                    <td style={tdStyle}><span style={{ fontSize: 10, color: x.acc === "Residential" ? B.success : B.textMuted, fontWeight: 600 }}>{x.acc === "Residential" ? "Res" : "Non-res"}</span></td>
                    <td style={tdStyle}>{fmtDate(x.arr)}</td>
                    <td style={tdStyle}>{fmtDate(x.dep)}</td>
                    <td style={tdStyle}>{x.to ? <span style={{ background: B.warningBg, color: B.warning, padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>{x.to}</span> : "—"}</td>
                    <td style={tdStyle}>
                      {(x.email || x.phone) ? (
                        <span style={{ fontSize: 10, color: B.textMuted }}>
                          {x.email && <a href={`mailto:${x.email}`} style={{ color: "#0369a1", textDecoration: "none" }}>{x.email}</a>}
                          {x.email && x.phone && " · "}
                          {x.phone && <a href={`tel:${x.phone}`} style={{ color: "#0369a1", textDecoration: "none" }}>{x.phone}</a>}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ ...tdStyle, display: "flex", gap: 4 }}>
                      {!readOnly && <IconBtn onClick={() => editId === x.id ? setEditId(null) : startEdit(x)} title="Edit"><IcEdit /></IconBtn>}
                      {!readOnly && <IconBtn danger onClick={() => {
                        if (window.confirm(`Remove ${x.name} from the team? This will also clear their rota entries.`)) {
                          setStaff((p) => p.filter((z) => z.id !== x.id));
                        }
                      }}><IcTrash /></IconBtn>}
                    </td>
                  </tr>
                  {editId === x.id && (
                    <tr key={x.id + "-edit"} style={{ borderBottom: `1px solid ${B.border}` }}>
                      <td colSpan={8} style={{ padding: "0 12px 8px" }}>
                        <StaffForm
                          value={editForm}
                          onChange={(k, v) => setEditForm((p) => ({ ...p, [k]: v }))}
                          onSave={saveEdit}
                          onCancel={() => setEditId(null)}
                          saveLabel="Save Changes"
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </div>
  );
}
