"use client";
import { useState, useMemo } from "react";
import { B, uid, fmtDate, dayName, dayKey } from "@/lib/constants";
import { StatCard, StatusBadge, Fld, TableWrap, IconBtn, IcWand, IcPlus, IcTrash, IcEdit, IcCheck, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const STATUS_MAP = {
  Pending: { color: B.warning, bg: B.warningBg },
  Booked: { color: B.success, bg: B.successBg },
  Confirmed: { color: "#0369a1", bg: "#e0f2fe" },
  "Own Transfer": { color: B.textMuted, bg: "#f1f5f9" },
  Cancelled: { color: B.danger, bg: B.dangerBg },
};

const AIRPORTS = ["Heathrow", "Gatwick", "Stansted", "Luton", "Manchester", "Birmingham", "Bristol", "Edinburgh", "Glasgow", "Other"];
const TERMINALS = ["T1", "T2", "T3", "T4", "T5", "North", "South", "N/A"];
const UKLC_OPTIONS = ["Yes", "No", "Arr Only", "Dep Only", "TBC"];

export default function TransfersTab({ groups = [], transfers = [], setTransfers }) {
  const [view, setView] = useState("overview"); // overview | arrivals | departures | timeline
  const [editId, setEditId] = useState(null);
  const fi = inputStyle;

  // Auto-sync from groups
  const sync = () => {
    const existingGids = new Set(transfers.map((t) => t.gid));
    const newT = groups
      .filter((g) => !existingGids.has(g.id))
      .map((g) => ({
        id: uid(), gid: g.id, agent: g.agent || "", group: g.group || "",
        pax: (g.stu || 0) + (g.gl || 0),
        arrAirport: g.arrAirport || "Heathrow", arrDate: g.arr || "", arrFlight: g.arrFlight || "",
        arrTime: g.arrTime || "", arrTerminal: "", arrNotes: "",
        depAirport: g.depAirport || "Heathrow", depDate: g.dep || "", depFlight: g.depFlight || "",
        depTime: g.depTime || "", depTerminal: "", depNotes: "",
        uklc: "Yes", status: "Pending",
      }));
    if (newT.length) setTransfers((p) => [...p, ...newT]);
  };

  // Also update existing transfers when group data changes
  const syncUpdate = () => {
    setTransfers((prev) => prev.map((t) => {
      const g = groups.find((gr) => gr.id === t.gid);
      if (!g) return t;
      return {
        ...t,
        agent: g.agent || t.agent,
        group: g.group || t.group,
        pax: (g.stu || 0) + (g.gl || 0),
        arrDate: g.arr || t.arrDate,
        depDate: g.dep || t.depDate,
        arrAirport: g.arrAirport || t.arrAirport,
        arrFlight: g.arrFlight || t.arrFlight,
        arrTime: g.arrTime || t.arrTime,
        depAirport: g.depAirport || t.depAirport,
        depFlight: g.depFlight || t.depFlight,
        depTime: g.depTime || t.depTime,
      };
    }));
  };

  const upd = (id, field, value) => setTransfers((p) => p.map((t) => t.id === id ? { ...t, [field]: value } : t));
  const del = (id) => setTransfers((p) => p.filter((t) => t.id !== id));

  const unsyncedCount = groups.filter((g) => !transfers.find((t) => t.gid === g.id)).length;

  // Timeline data: group by date
  const timeline = useMemo(() => {
    const days = {};
    transfers.forEach((t) => {
      if (t.arrDate) {
        if (!days[t.arrDate]) days[t.arrDate] = { arrivals: [], departures: [] };
        days[t.arrDate].arrivals.push(t);
      }
      if (t.depDate) {
        if (!days[t.depDate]) days[t.depDate] = { arrivals: [], departures: [] };
        days[t.depDate].departures.push(t);
      }
    });
    return Object.entries(days).sort(([a], [b]) => a.localeCompare(b));
  }, [transfers]);

  // Stats
  const totalPax = transfers.reduce((s, t) => s + (t.pax || 0), 0);
  const pendingCount = transfers.filter((t) => t.status === "Pending").length;
  const arrCount = transfers.filter((t) => t.arrDate).length;
  const depCount = transfers.filter((t) => t.depDate).length;

  const edFi = { ...fi, padding: "3px", fontSize: 10, minWidth: 60 };

  // Editable row for combined view
  const renderRow = (t, showArr, showDep) => {
    const isEd = editId === t.id;
    return (
      <tr key={t.id} style={{ borderBottom: "1px solid " + B.borderLight, background: isEd ? "#f0f4ff" : "transparent" }}>
        <td style={tdStyle}>{t.agent}</td>
        <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{t.group}</td>
        <td style={{ ...tdStyle, fontWeight: 800, textAlign: "center" }}>{t.pax}</td>
        <td style={tdStyle}>
          {isEd ? (
            <select value={t.uklc || "Yes"} onChange={(e) => upd(t.id, "uklc", e.target.value)} style={{ ...edFi, minWidth: 50 }}>
              {UKLC_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <span style={{ background: t.uklc === "No" ? "#f1f5f9" : t.uklc === "TBC" ? "#fef3c7" : "#dcfce7", color: t.uklc === "No" ? "#64748b" : t.uklc === "TBC" ? "#92400e" : "#16a34a", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{t.uklc || "Yes"}</span>
          )}
        </td>
        {showArr && <>
          <td style={tdStyle}>{isEd ? <select value={t.arrAirport} onChange={(e) => upd(t.id, "arrAirport", e.target.value)} style={edFi}>{AIRPORTS.map((a) => <option key={a}>{a}</option>)}</select> : t.arrAirport}</td>
          <td style={tdStyle}>{isEd ? <select value={t.arrTerminal || ""} onChange={(e) => upd(t.id, "arrTerminal", e.target.value)} style={{ ...edFi, minWidth: 45 }}><option value="">—</option>{TERMINALS.map((t2) => <option key={t2}>{t2}</option>)}</select> : <span style={{ fontSize: 9, color: B.textMuted }}>{t.arrTerminal || "—"}</span>}</td>
          <td style={tdStyle}>{isEd ? <input type="date" value={t.arrDate} onChange={(e) => upd(t.id, "arrDate", e.target.value)} style={edFi} /> : fmtDate(t.arrDate)}</td>
          <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 10 }}>{isEd ? <input value={t.arrFlight} onChange={(e) => upd(t.id, "arrFlight", e.target.value)} style={edFi} placeholder="TBC" /> : t.arrFlight || <span style={{ color: B.textLight }}>TBC</span>}</td>
          <td style={tdStyle}>{isEd ? <input value={t.arrTime} onChange={(e) => upd(t.id, "arrTime", e.target.value)} style={{ ...edFi, minWidth: 50 }} placeholder="14:30" /> : t.arrTime || <span style={{ color: B.textLight }}>TBC</span>}</td>
        </>}
        {showDep && <>
          <td style={tdStyle}>{isEd ? <select value={t.depAirport} onChange={(e) => upd(t.id, "depAirport", e.target.value)} style={edFi}>{AIRPORTS.map((a) => <option key={a}>{a}</option>)}</select> : t.depAirport}</td>
          <td style={tdStyle}>{isEd ? <select value={t.depTerminal || ""} onChange={(e) => upd(t.id, "depTerminal", e.target.value)} style={{ ...edFi, minWidth: 45 }}><option value="">—</option>{TERMINALS.map((t2) => <option key={t2}>{t2}</option>)}</select> : <span style={{ fontSize: 9, color: B.textMuted }}>{t.depTerminal || "—"}</span>}</td>
          <td style={tdStyle}>{isEd ? <input type="date" value={t.depDate} onChange={(e) => upd(t.id, "depDate", e.target.value)} style={edFi} /> : fmtDate(t.depDate)}</td>
          <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 10 }}>{isEd ? <input value={t.depFlight} onChange={(e) => upd(t.id, "depFlight", e.target.value)} style={edFi} placeholder="TBC" /> : t.depFlight || <span style={{ color: B.textLight }}>TBC</span>}</td>
          <td style={tdStyle}>{isEd ? <input value={t.depTime} onChange={(e) => upd(t.id, "depTime", e.target.value)} style={{ ...edFi, minWidth: 50 }} placeholder="10:00" /> : t.depTime || <span style={{ color: B.textLight }}>TBC</span>}</td>
        </>}
        <td style={tdStyle}>
          {isEd ? (
            <select value={t.status} onChange={(e) => upd(t.id, "status", e.target.value)} style={edFi}>
              {Object.keys(STATUS_MAP).map((s) => <option key={s}>{s}</option>)}
            </select>
          ) : <StatusBadge status={t.status} map={STATUS_MAP} />}
        </td>
        <td style={tdStyle}>
          <div style={{ display: "flex", gap: 2 }}>
            <IconBtn onClick={() => setEditId(isEd ? null : t.id)}>{isEd ? <IcCheck /> : <IcEdit />}</IconBtn>
            <IconBtn danger onClick={() => del(t.id)}><IcTrash /></IconBtn>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatCard label="Transfers" value={transfers.length} accent={B.navy} />
        <StatCard label="Total Pax" value={totalPax} accent={B.red} />
        <StatCard label="Arrivals" value={arrCount} accent="#16a34a" />
        <StatCard label="Departures" value={depCount} accent="#dc2626" />
        <StatCard label="Pending" value={pendingCount} accent={B.warning} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["overview", "arrivals", "departures", "timeline"].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "5px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
              border: "1px solid " + (view === v ? B.navy : B.border),
              background: view === v ? B.navy : B.white, color: view === v ? B.white : B.textMuted,
            }}>{v === "overview" ? "\ud83d\udccb Overview" : v === "arrivals" ? "\u2708\ufe0f Arrivals" : v === "departures" ? "\ud83d\udeeb Departures" : "\ud83d\udcc5 Timeline"}</button>
          ))}
        </div>
      </div>

      {/* Sync bar */}
      <div style={{ background: B.white, borderBottom: "1px solid " + B.border, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: B.textMuted }}>{transfers.length} transfers {"\u00b7"} {totalPax} total pax</span>
        <div style={{ display: "flex", gap: 6 }}>
          {transfers.length > 0 && (
            <button onClick={syncUpdate} style={{ padding: "5px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1px solid " + B.border, background: B.white, color: B.textMuted }}>
              {"\ud83d\udd04"} Update from Groups
            </button>
          )}
          <button onClick={sync} style={{ ...btnPrimary, background: B.navy }}>
            <IcWand /> Sync from Students{unsyncedCount > 0 ? ` (+${unsyncedCount})` : ""}
          </button>
        </div>
      </div>

      {/* ── OVERVIEW ───────────────────────────────────── */}
      {view === "overview" && (
        <div style={{ padding: "0 8px 16px", overflowX: "auto" }}>
          <TableWrap>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={thStyle} rowSpan={2}>Agent</th>
                  <th style={thStyle} rowSpan={2}>Group</th>
                  <th style={{ ...thStyle, textAlign: "center" }} rowSpan={2}>Pax</th>
                  <th style={{ ...thStyle, textAlign: "center" }} rowSpan={2}>UKLC</th>
                  <th style={{ ...thStyle, textAlign: "center", background: "#dcfce7", color: "#16a34a" }} colSpan={5}>{"\u2708\ufe0f"} Arrival</th>
                  <th style={{ ...thStyle, textAlign: "center", background: "#fee2e2", color: "#dc2626" }} colSpan={5}>{"\ud83d\udeeb"} Departure</th>
                  <th style={thStyle} rowSpan={2}>Status</th>
                  <th style={thStyle} rowSpan={2}></th>
                </tr>
                <tr>
                  {["Airport", "Term", "Date", "Flight", "Time"].map((h) => <th key={"a"+h} style={{ ...thStyle, fontSize: 8, background: "#f0fdf4" }}>{h}</th>)}
                  {["Airport", "Term", "Date", "Flight", "Time"].map((h) => <th key={"d"+h} style={{ ...thStyle, fontSize: 8, background: "#fef2f2" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr><td colSpan={16} style={{ textAlign: "center", padding: 36, color: B.textLight }}>Click "Sync from Students" to create transfer rows from imported groups</td></tr>
                ) : transfers.map((t) => renderRow(t, true, true))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}

      {/* ── ARRIVALS ───────────────────────────────────── */}
      {view === "arrivals" && (
        <div style={{ padding: "0 8px 16px", overflowX: "auto" }}>
          <TableWrap>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  {["Agent", "Group", "Pax", "UKLC", "Airport", "Terminal", "Date", "Flight", "Time", "Status", ""].map((h) => (
                    <th key={h} style={{ ...thStyle, background: "#f0fdf4" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.filter((t) => t.uklc !== "Dep Only" && t.uklc !== "No")
                  .sort((a, b) => (a.arrDate || "").localeCompare(b.arrDate || "") || (a.arrTime || "").localeCompare(b.arrTime || ""))
                  .map((t) => {
                    const isEd = editId === t.id;
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid " + B.borderLight, background: isEd ? "#f0f4ff" : "transparent" }}>
                        <td style={tdStyle}>{t.agent}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{t.group}</td>
                        <td style={{ ...tdStyle, fontWeight: 800, textAlign: "center" }}>{t.pax}</td>
                        <td style={tdStyle}><span style={{ background: "#dcfce7", color: "#16a34a", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{t.uklc}</span></td>
                        <td style={tdStyle}>{isEd ? <select value={t.arrAirport} onChange={(e) => upd(t.id, "arrAirport", e.target.value)} style={edFi}>{AIRPORTS.map((a) => <option key={a}>{a}</option>)}</select> : t.arrAirport}</td>
                        <td style={tdStyle}>{isEd ? <select value={t.arrTerminal||""} onChange={(e) => upd(t.id, "arrTerminal", e.target.value)} style={{...edFi,minWidth:45}}><option value="">—</option>{TERMINALS.map((x) => <option key={x}>{x}</option>)}</select> : t.arrTerminal || "—"}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{isEd ? <input type="date" value={t.arrDate} onChange={(e) => upd(t.id, "arrDate", e.target.value)} style={edFi} /> : fmtDate(t.arrDate)}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace" }}>{isEd ? <input value={t.arrFlight} onChange={(e) => upd(t.id, "arrFlight", e.target.value)} style={edFi} /> : t.arrFlight || <span style={{color:B.textLight}}>TBC</span>}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{isEd ? <input value={t.arrTime} onChange={(e) => upd(t.id, "arrTime", e.target.value)} style={{...edFi,minWidth:50}} placeholder="14:30" /> : t.arrTime || <span style={{color:B.textLight}}>TBC</span>}</td>
                        <td style={tdStyle}>{isEd ? <select value={t.status} onChange={(e) => upd(t.id, "status", e.target.value)} style={edFi}>{Object.keys(STATUS_MAP).map((s) => <option key={s}>{s}</option>)}</select> : <StatusBadge status={t.status} map={STATUS_MAP} />}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 2 }}>
                            <IconBtn onClick={() => setEditId(isEd ? null : t.id)}>{isEd ? <IcCheck /> : <IcEdit />}</IconBtn>
                            <IconBtn danger onClick={() => del(t.id)}><IcTrash /></IconBtn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}

      {/* ── DEPARTURES ─────────────────────────────────── */}
      {view === "departures" && (
        <div style={{ padding: "0 8px 16px", overflowX: "auto" }}>
          <TableWrap>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  {["Agent", "Group", "Pax", "UKLC", "Airport", "Terminal", "Date", "Flight", "Time", "Status", ""].map((h) => (
                    <th key={h} style={{ ...thStyle, background: "#fef2f2" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.filter((t) => t.uklc !== "Arr Only" && t.uklc !== "No")
                  .sort((a, b) => (a.depDate || "").localeCompare(b.depDate || "") || (a.depTime || "").localeCompare(b.depTime || ""))
                  .map((t) => {
                    const isEd = editId === t.id;
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid " + B.borderLight, background: isEd ? "#f0f4ff" : "transparent" }}>
                        <td style={tdStyle}>{t.agent}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{t.group}</td>
                        <td style={{ ...tdStyle, fontWeight: 800, textAlign: "center" }}>{t.pax}</td>
                        <td style={tdStyle}><span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{t.uklc}</span></td>
                        <td style={tdStyle}>{isEd ? <select value={t.depAirport} onChange={(e) => upd(t.id, "depAirport", e.target.value)} style={edFi}>{AIRPORTS.map((a) => <option key={a}>{a}</option>)}</select> : t.depAirport}</td>
                        <td style={tdStyle}>{isEd ? <select value={t.depTerminal||""} onChange={(e) => upd(t.id, "depTerminal", e.target.value)} style={{...edFi,minWidth:45}}><option value="">—</option>{TERMINALS.map((x) => <option key={x}>{x}</option>)}</select> : t.depTerminal || "—"}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{isEd ? <input type="date" value={t.depDate} onChange={(e) => upd(t.id, "depDate", e.target.value)} style={edFi} /> : fmtDate(t.depDate)}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace" }}>{isEd ? <input value={t.depFlight} onChange={(e) => upd(t.id, "depFlight", e.target.value)} style={edFi} /> : t.depFlight || <span style={{color:B.textLight}}>TBC</span>}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{isEd ? <input value={t.depTime} onChange={(e) => upd(t.id, "depTime", e.target.value)} style={{...edFi,minWidth:50}} placeholder="10:00" /> : t.depTime || <span style={{color:B.textLight}}>TBC</span>}</td>
                        <td style={tdStyle}>{isEd ? <select value={t.status} onChange={(e) => upd(t.id, "status", e.target.value)} style={edFi}>{Object.keys(STATUS_MAP).map((s) => <option key={s}>{s}</option>)}</select> : <StatusBadge status={t.status} map={STATUS_MAP} />}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 2 }}>
                            <IconBtn onClick={() => setEditId(isEd ? null : t.id)}>{isEd ? <IcCheck /> : <IcEdit />}</IconBtn>
                            <IconBtn danger onClick={() => del(t.id)}><IcTrash /></IconBtn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}

      {/* ── TIMELINE ───────────────────────────────────── */}
      {view === "timeline" && (
        <div style={{ padding: "0 12px 20px" }}>
          {timeline.length === 0 ? (
            <div style={{ textAlign: "center", padding: 50, color: B.textLight }}>No transfers — sync from Students first</div>
          ) : timeline.map(([date, data]) => {
            const d = new Date(date + "T12:00:00");
            const totalArr = data.arrivals.reduce((s, t) => s + (t.pax || 0), 0);
            const totalDep = data.departures.reduce((s, t) => s + (t.pax || 0), 0);
            return (
              <div key={date} style={{ background: B.white, border: "1px solid " + B.border, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                {/* Day header */}
                <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", borderBottom: "1px solid " + B.borderLight }}>
                  <div style={{ minWidth: 90 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: B.navy }}>{dayName(d)}</div>
                    <div style={{ fontSize: 10, color: B.textMuted }}>{fmtDate(date)}</div>
                  </div>
                  {data.arrivals.length > 0 && (
                    <span style={{ background: "#dcfce7", color: "#16a34a", padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 800 }}>
                      {"\u2708\ufe0f"} {data.arrivals.length} arrival{data.arrivals.length > 1 ? "s" : ""} ({totalArr} pax)
                    </span>
                  )}
                  {data.departures.length > 0 && (
                    <span style={{ background: "#fee2e2", color: "#dc2626", padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 800 }}>
                      {"\ud83d\udeeb"} {data.departures.length} departure{data.departures.length > 1 ? "s" : ""} ({totalDep} pax)
                    </span>
                  )}
                </div>

                <div style={{ padding: "8px 16px" }}>
                  {/* Arrivals for this day */}
                  {data.arrivals.length > 0 && (
                    <div style={{ marginBottom: data.departures.length > 0 ? 10 : 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#16a34a", marginBottom: 4, textTransform: "uppercase" }}>Arrivals</div>
                      {data.arrivals
                        .sort((a, b) => (a.arrTime || "99:99").localeCompare(b.arrTime || "99:99"))
                        .map((t) => (
                        <div key={t.id + "-arr"} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid " + B.borderLight, fontSize: 11 }}>
                          <span style={{ fontWeight: 800, color: B.navy, minWidth: 50 }}>{t.arrTime || "TBC"}</span>
                          <span style={{ fontWeight: 700, color: B.navy, minWidth: 100 }}>{t.group}</span>
                          <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{t.pax} pax</span>
                          <span style={{ fontSize: 10, color: B.textMuted }}>{t.arrAirport}{t.arrTerminal ? " " + t.arrTerminal : ""}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 10 }}>{t.arrFlight || ""}</span>
                          <span style={{ fontSize: 9, color: B.textMuted }}>{t.agent}</span>
                          <div style={{ marginLeft: "auto" }}><StatusBadge status={t.status} map={STATUS_MAP} /></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Departures for this day */}
                  {data.departures.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#dc2626", marginBottom: 4, textTransform: "uppercase" }}>Departures</div>
                      {data.departures
                        .sort((a, b) => (a.depTime || "99:99").localeCompare(b.depTime || "99:99"))
                        .map((t) => (
                        <div key={t.id + "-dep"} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid " + B.borderLight, fontSize: 11 }}>
                          <span style={{ fontWeight: 800, color: B.navy, minWidth: 50 }}>{t.depTime || "TBC"}</span>
                          <span style={{ fontWeight: 700, color: B.navy, minWidth: 100 }}>{t.group}</span>
                          <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{t.pax} pax</span>
                          <span style={{ fontSize: 10, color: B.textMuted }}>{t.depAirport}{t.depTerminal ? " " + t.depTerminal : ""}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 10 }}>{t.depFlight || ""}</span>
                          <span style={{ fontSize: 9, color: B.textMuted }}>{t.agent}</span>
                          <div style={{ marginLeft: "auto" }}><StatusBadge status={t.status} map={STATUS_MAP} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
