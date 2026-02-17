"use client";
import { useState } from "react";
import { B, uid } from "@/lib/constants";
import { Fld, IcPlus, IcX, inputStyle, btnPrimary } from "@/components/ui";

const CATEGORIES = ["Centre / Venue", "Coaches & Transport", "Excursions", "DJ / Entertainment", "Medical / Emergency", "UKLC Head Office", "Other"];
const CAT_ICONS = { "Centre / Venue": "🏫", "Coaches & Transport": "🚌", Excursions: "🎯", "DJ / Entertainment": "🎵", "Medical / Emergency": "🏥", "UKLC Head Office": "🏢", Other: "📋" };

export default function ContactsTab() {
  const [contacts, setContacts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [n, setN] = useState({ name: "", email: "", phone: "", role: "", cat: "Centre / Venue", notes: "" });
  const fi = inputStyle;

  const addContact = () => {
    if (!n.name.trim() && !n.email.trim()) return;
    setContacts((p) => [...p, { ...n, id: uid() }]);
    setN({ name: "", email: "", phone: "", role: "", cat: "Centre / Venue", notes: "" });
    setShowAdd(false);
  };

  return (
    <div>
      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: B.textMuted }}>{contacts.length} contacts</span>
        <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}><IcPlus /> Add Contact</button>
      </div>

      {showAdd && (
        <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Fld label="Name"><input value={n.name} onChange={(e) => setN((p) => ({ ...p, name: e.target.value }))} style={fi} /></Fld>
          <Fld label="Email"><input value={n.email} onChange={(e) => setN((p) => ({ ...p, email: e.target.value }))} style={{ ...fi, minWidth: 180 }} /></Fld>
          <Fld label="Phone"><input value={n.phone} onChange={(e) => setN((p) => ({ ...p, phone: e.target.value }))} style={{ ...fi, width: 110 }} /></Fld>
          <Fld label="Role"><input value={n.role} onChange={(e) => setN((p) => ({ ...p, role: e.target.value }))} style={{ ...fi, minWidth: 130 }} /></Fld>
          <Fld label="Category">
            <select value={n.cat} onChange={(e) => setN((p) => ({ ...p, cat: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Fld>
          <Fld label="Notes"><input value={n.notes} onChange={(e) => setN((p) => ({ ...p, notes: e.target.value }))} style={{ ...fi, minWidth: 150 }} /></Fld>
          <button onClick={addContact} style={{ padding: "6px 16px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32 }}>
            Add
          </button>
        </div>
      )}

      <div style={{ padding: "12px 20px" }}>
        {contacts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: B.textLight }}>Add venue, coach, excursion &amp; emergency contacts</div>
        ) : (
          CATEGORIES.filter((cat) => contacts.some((x) => x.cat === cat)).map((cat) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{CAT_ICONS[cat]}</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: B.navy }}>{cat}</span>
                <span style={{ background: B.ice, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, color: B.textMuted }}>
                  {contacts.filter((x) => x.cat === cat).length}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {contacts.filter((x) => x.cat === cat).map((x) => (
                  <div key={x.id} style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: 10, padding: "14px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", position: "relative" }}>
                    <button onClick={() => setContacts((p) => p.filter((z) => z.id !== x.id))}
                      style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: B.textLight, cursor: "pointer" }}>
                      <IcX />
                    </button>
                    <div style={{ fontWeight: 800, fontSize: 14, color: B.navy, paddingRight: 24 }}>{x.name || "Unnamed"}</div>
                    {x.role && <div style={{ fontSize: 11, color: B.textMuted, marginTop: 2 }}>{x.role}</div>}
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {x.email && <div style={{ fontSize: 12 }}>✉️ <a href={`mailto:${x.email}`} style={{ color: "#0369a1", textDecoration: "none" }}>{x.email}</a></div>}
                      {x.phone && <div style={{ fontSize: 12 }}>📞 <a href={`tel:${x.phone}`} style={{ color: "#0369a1", textDecoration: "none" }}>{x.phone}</a></div>}
                    </div>
                    {x.notes && <div style={{ marginTop: 6, fontSize: 11, color: B.textMuted, borderTop: `1px solid ${B.borderLight}`, paddingTop: 6 }}>{x.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
