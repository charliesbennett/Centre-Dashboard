"use client";
import { useState } from "react";
import { B, ROLES, uid, fmtDate } from "@/lib/constants";
import { Fld, StatCard, TableWrap, IconBtn, IcPlus, IcTrash, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";

export default function TeamTab({ staff, setStaff }) {
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({ name: "", role: "TAL", acc: "Residential", arr: "", dep: "", to: "" });

  const fi = inputStyle;
  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatCard label="Total" value={staff.length} accent={B.navy} />
        <StatCard label="Res" value={staff.filter((s) => s.acc === "Residential").length} accent="#0369a1" />
        <StatCard label="Non-res" value={staff.filter((s) => s.acc !== "Residential").length} accent={B.textMuted} />
      </div>
      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: B.success, fontWeight: 600 }}>✓ Staff flow to Rota + Catering</span>
        <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}><IcPlus /> Add Staff</button>
      </div>
      {showAdd && (
        <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Fld label="Name"><input value={n.name} onChange={(e) => setN((p) => ({ ...p, name: e.target.value }))} style={fi} /></Fld>
          <Fld label="Role"><select value={n.role} onChange={(e) => setN((p) => ({ ...p, role: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Fld>
          <Fld label="Acc."><select value={n.acc} onChange={(e) => setN((p) => ({ ...p, acc: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>{["Residential", "Non-residential"].map((a) => <option key={a}>{a}</option>)}</select></Fld>
          <Fld label="Arrival"><input type="date" value={n.arr} onChange={(e) => setN((p) => ({ ...p, arr: e.target.value }))} style={fi} /></Fld>
          <Fld label="Departure"><input type="date" value={n.dep} onChange={(e) => setN((p) => ({ ...p, dep: e.target.value }))} style={fi} /></Fld>
          <Fld label="Time Off"><input value={n.to} onChange={(e) => setN((p) => ({ ...p, to: e.target.value }))} style={{ ...fi, minWidth: 130 }} placeholder="e.g. 16/07 eve" /></Fld>
          <button onClick={() => { if (n.name.trim()) { setStaff((p) => [...p, { ...n, id: uid() }]); setN({ name: "", role: "TAL", acc: "Residential", arr: "", dep: "", to: "" }); setShowAdd(false); } }}
            style={{ padding: "6px 16px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32 }}>Add</button>
        </div>
      )}
      <div style={{ padding: "0 12px 16px", overflowX: "auto" }}>
        <TableWrap>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr>{["Role", "Name", "Accomm.", "Arrival", "Departure", "Time Off", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {staff.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 36, color: B.textLight }}>No team members yet</td></tr> :
                staff.map((x) => (
                  <tr key={x.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                    <td style={tdStyle}><span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 5px", borderRadius: 3, fontSize: 9, fontWeight: 800 }}>{x.role}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{x.name}</td>
                    <td style={tdStyle}><span style={{ fontSize: 10, color: x.acc === "Residential" ? B.success : B.textMuted, fontWeight: 600 }}>{x.acc === "Residential" ? "Res" : "Non-res"}</span></td>
                    <td style={tdStyle}>{fmtDate(x.arr)}</td>
                    <td style={tdStyle}>{fmtDate(x.dep)}</td>
                    <td style={tdStyle}>{x.to ? <span style={{ background: B.warningBg, color: B.warning, padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>{x.to}</span> : "—"}</td>
                    <td style={tdStyle}><IconBtn danger onClick={() => setStaff((p) => p.filter((z) => z.id !== x.id))}><IcTrash /></IconBtn></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </div>
  );
}
