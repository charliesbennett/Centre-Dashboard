"use client";
import { useState } from "react";
import { B, uid, fmtDate } from "@/lib/constants";
import { Fld, StatusBadge, TableWrap, IconBtn, IcPlus, IcTrash, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";

export default function ExcursionsTab({ excDays }) {
  const SM = {
    Pending: { color: B.warning, bg: B.warningBg },
    Booked: { color: B.success, bg: B.successBg },
    Confirmed: { color: "#0369a1", bg: "#e0f2fe" },
    Paid: { color: "#5b21b6", bg: "#ede9fe" },
  };
  const [bookings, setBookings] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({ att: "", place: "", type: "Full Day", stu: 0, gl: 0, staff: 0, date: "", status: "Pending", ref: "" });
  const fi = inputStyle;

  const excList = Object.entries(excDays || {}).sort(([a], [b]) => a.localeCompare(b));

  const addBooking = () => {
    if (!n.att.trim()) return;
    setBookings((p) => [...p, { ...n, id: uid(), total: (+n.stu || 0) + (+n.gl || 0) + (+n.staff || 0) }]);
    setN({ att: "", place: "", type: "Full Day", stu: 0, gl: 0, staff: 0, date: "", status: "Pending", ref: "" });
    setShowAdd(false);
  };

  return (
    <div>
      {excList.length > 0 && (
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: B.textMuted, marginBottom: 6, textTransform: "uppercase" }}>
            Excursion Days (from Programmes)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {excList.map(([d, type]) => (
              <span key={d} style={{
                background: type === "Full" ? "#fed7aa" : "#e0f2fe",
                color: type === "Full" ? "#ea580c" : "#0369a1",
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              }}>{fmtDate(d)} — {type} Day</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: B.textMuted }}>{bookings.length} bookings</span>
        <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}><IcPlus /> Add Booking</button>
      </div>

      {showAdd && (
        <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Fld label="Attraction"><input value={n.att} onChange={(e) => setN((p) => ({ ...p, att: e.target.value }))} style={fi} /></Fld>
          <Fld label="Place"><input value={n.place} onChange={(e) => setN((p) => ({ ...p, place: e.target.value }))} style={{ ...fi, width: 80 }} /></Fld>
          <Fld label="Type">
            <select value={n.type} onChange={(e) => setN((p) => ({ ...p, type: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>
              {["Full Day", "AM Half Day", "PM Half Day"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Fld>
          <Fld label="Stu"><input type="number" value={n.stu} onChange={(e) => setN((p) => ({ ...p, stu: e.target.value }))} style={{ ...fi, width: 55 }} /></Fld>
          <Fld label="GLs"><input type="number" value={n.gl} onChange={(e) => setN((p) => ({ ...p, gl: e.target.value }))} style={{ ...fi, width: 50 }} /></Fld>
          <Fld label="Staff"><input type="number" value={n.staff} onChange={(e) => setN((p) => ({ ...p, staff: e.target.value }))} style={{ ...fi, width: 50 }} /></Fld>
          <Fld label="Date"><input type="date" value={n.date} onChange={(e) => setN((p) => ({ ...p, date: e.target.value }))} style={fi} /></Fld>
          <Fld label="Status">
            <select value={n.status} onChange={(e) => setN((p) => ({ ...p, status: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>
              {Object.keys(SM).map((s) => <option key={s}>{s}</option>)}
            </select>
          </Fld>
          <Fld label="Ref"><input value={n.ref} onChange={(e) => setN((p) => ({ ...p, ref: e.target.value }))} style={{ ...fi, width: 90 }} /></Fld>
          <button onClick={addBooking} style={{ padding: "6px 16px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32 }}>
            Add
          </button>
        </div>
      )}

      <div style={{ padding: "0 12px 16px", overflowX: "auto" }}>
        <TableWrap>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>{["Attraction", "Place", "Type", "Total", "Date", "Status", "Ref", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 36, color: B.textLight }}>No bookings — excursion days from Programmes shown above</td></tr>
              ) : bookings.map((x) => (
                <tr key={x.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{x.att}</td>
                  <td style={tdStyle}>{x.place}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: x.type.includes("Full") ? "#fed7aa" : "#e0f2fe",
                      color: x.type.includes("Full") ? "#ea580c" : "#0369a1",
                      padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800,
                    }}>{x.type}</span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 800 }}>{x.total}</td>
                  <td style={tdStyle}>{fmtDate(x.date)}</td>
                  <td style={tdStyle}><StatusBadge status={x.status} map={SM} /></td>
                  <td style={{ ...tdStyle, fontSize: 9, fontFamily: "monospace" }}>{x.ref || "—"}</td>
                  <td style={tdStyle}><IconBtn danger onClick={() => setBookings((p) => p.filter((z) => z.id !== x.id))}><IcTrash /></IconBtn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </div>
  );
}
