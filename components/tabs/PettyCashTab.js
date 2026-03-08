"use client";
import { useState } from "react";
import { B, uid, fmtMoney, fmtDate, dayKey } from "@/lib/constants";
import { Fld, StatCard, IconBtn, IcPlus, IcTrash, inputStyle } from "@/components/ui";

const TODAY = dayKey(new Date());

export default function PettyCashTab({ pettyCash = {}, setPettyCash }) {
  const income = pettyCash.income || [];
  const expenses = pettyCash.expenses || [];
  const opening = pettyCash.opening || 0;
  const toRom = pettyCash.toRom || 0;

  const [showAddInc, setShowAddInc] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [ni, setNi] = useState({ date: TODAY, group: "", cat: "Activity", amt: "" });
  const [ne, setNe] = useState({ date: TODAY, desc: "", cat: "Activities & Equipment", amt: "" });

  const fi = inputStyle;
  const totalInc = income.reduce((s, x) => s + (+x.amt || 0), 0);
  const totalExp = expenses.reduce((s, x) => s + (+x.amt || 0), 0);
  const balance = opening + totalInc - totalExp - toRom;

  const incCats = ["Activity", "Housekeeping", "Transfer", "Equals Card Top-Up", "Other"];
  const expCats = ["Activities & Equipment", "Cleaning", "Transport", "Food & Drink", "Stationery", "Medical", "Staff Expenses", "Prizes", "Other"];

  const setOpening = (v) => setPettyCash((p) => ({ ...p, opening: v }));
  const setToRom = (v) => setPettyCash((p) => ({ ...p, toRom: v }));

  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatCard label="Opening" value={fmtMoney(opening)} accent={B.navy} />
        <StatCard label="Income" value={fmtMoney(totalInc)} accent={B.success} />
        <StatCard label="Expenses" value={fmtMoney(totalExp)} accent={B.danger} />
        <StatCard label="To ROM" value={fmtMoney(toRom)} accent="#7c3aed" />
        <StatCard label="Balance" value={fmtMoney(balance)} accent={balance >= 0 ? B.success : B.danger} />
      </div>

      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", gap: 10, alignItems: "center" }}>
        <Fld label="Opening (£)"><input type="number" step="0.01" value={opening} onChange={(e) => setOpening(+e.target.value || 0)} style={{ ...fi, width: 80 }} /></Fld>
        <Fld label="To ROM (£)"><input type="number" step="0.01" value={toRom} onChange={(e) => setToRom(+e.target.value || 0)} style={{ ...fi, width: 80 }} /></Fld>
      </div>

      <div style={{ padding: "12px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Income */}
        <div style={{ background: B.white, borderRadius: 10, border: `1px solid ${B.border}`, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", background: B.successBg, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 11, color: B.success }}>Cash In</span>
            <button onClick={() => setShowAddInc(!showAddInc)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", background: B.success, color: B.white, border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9, fontWeight: 700, fontFamily: "inherit" }}>
              <IcPlus /> Add
            </button>
          </div>
          {showAddInc && (
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}`, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Fld label="Date"><input type="date" value={ni.date} onChange={(e) => setNi((p) => ({ ...p, date: e.target.value }))} style={{ ...fi, width: 115 }} /></Fld>
              <Fld label="Group"><input value={ni.group} onChange={(e) => setNi((p) => ({ ...p, group: e.target.value }))} style={{ ...fi, minWidth: 80 }} /></Fld>
              <Fld label="Cat">
                <select value={ni.cat} onChange={(e) => setNi((p) => ({ ...p, cat: e.target.value }))} style={{ ...fi, cursor: "pointer", width: 90 }}>
                  {incCats.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Fld>
              <Fld label="£"><input type="number" step="0.01" value={ni.amt} onChange={(e) => setNi((p) => ({ ...p, amt: e.target.value }))} style={{ ...fi, width: 65 }} /></Fld>
              <button onClick={() => {
                if (ni.group.trim() && ni.amt) {
                  setPettyCash((p) => ({ ...p, income: [...(p.income || []), { ...ni, id: uid() }] }));
                  setNi({ date: TODAY, group: "", cat: "Activity", amt: "" });
                  setShowAddInc(false);
                }
              }} style={{ padding: "4px 10px", background: B.navy, border: "none", color: B.white, borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit" }}>Add</button>
            </div>
          )}
          {income.map((i) => (
            <div key={i.id} style={{ padding: "5px 12px", borderBottom: `1px solid ${B.borderLight}`, display: "flex", justifyContent: "space-between", fontSize: 11, alignItems: "center" }}>
              <span>
                {i.date && <span style={{ color: B.textMuted, fontSize: 9, marginRight: 4 }}>{fmtDate(i.date)}</span>}
                {i.group} <span style={{ color: B.textMuted, fontSize: 8 }}>({i.cat})</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontWeight: 800, color: B.success }}>{fmtMoney(+i.amt)}</span>
                <IconBtn danger onClick={() => setPettyCash((p) => ({ ...p, income: (p.income || []).filter((z) => z.id !== i.id) }))}><IcTrash /></IconBtn>
              </div>
            </div>
          ))}
          {income.length > 0 && (
            <div style={{ padding: "6px 12px", background: B.ice, fontWeight: 800, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
              <span>Total</span><span style={{ color: B.success }}>{fmtMoney(totalInc)}</span>
            </div>
          )}
        </div>

        {/* Expenses */}
        <div style={{ background: B.white, borderRadius: 10, border: `1px solid ${B.border}`, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", background: B.dangerBg, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 11, color: B.danger }}>Cash Out</span>
            <button onClick={() => setShowAddExp(!showAddExp)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", background: B.danger, color: B.white, border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9, fontWeight: 700, fontFamily: "inherit" }}>
              <IcPlus /> Add
            </button>
          </div>
          {showAddExp && (
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}`, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Fld label="Date"><input type="date" value={ne.date} onChange={(e) => setNe((p) => ({ ...p, date: e.target.value }))} style={{ ...fi, width: 115 }} /></Fld>
              <Fld label="Desc"><input value={ne.desc} onChange={(e) => setNe((p) => ({ ...p, desc: e.target.value }))} style={{ ...fi, minWidth: 100 }} /></Fld>
              <Fld label="Cat">
                <select value={ne.cat} onChange={(e) => setNe((p) => ({ ...p, cat: e.target.value }))} style={{ ...fi, cursor: "pointer", width: 100 }}>
                  {expCats.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Fld>
              <Fld label="£"><input type="number" step="0.01" value={ne.amt} onChange={(e) => setNe((p) => ({ ...p, amt: e.target.value }))} style={{ ...fi, width: 65 }} /></Fld>
              <button onClick={() => {
                if (ne.desc.trim() && ne.amt) {
                  setPettyCash((p) => ({ ...p, expenses: [...(p.expenses || []), { ...ne, id: uid() }] }));
                  setNe({ date: TODAY, desc: "", cat: "Activities & Equipment", amt: "" });
                  setShowAddExp(false);
                }
              }} style={{ padding: "4px 10px", background: B.navy, border: "none", color: B.white, borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit" }}>Add</button>
            </div>
          )}
          {expenses.map((e) => (
            <div key={e.id} style={{ padding: "5px 12px", borderBottom: `1px solid ${B.borderLight}`, display: "flex", justifyContent: "space-between", fontSize: 11, alignItems: "center" }}>
              <span>
                {e.date && <span style={{ color: B.textMuted, fontSize: 9, marginRight: 4 }}>{fmtDate(e.date)}</span>}
                {e.desc} <span style={{ color: B.textMuted, fontSize: 8 }}>({e.cat})</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontWeight: 800, color: B.danger }}>{fmtMoney(+e.amt)}</span>
                <IconBtn danger onClick={() => setPettyCash((p) => ({ ...p, expenses: (p.expenses || []).filter((z) => z.id !== e.id) }))}><IcTrash /></IconBtn>
              </div>
            </div>
          ))}
          {expenses.length > 0 && (
            <div style={{ padding: "6px 12px", background: B.ice, fontWeight: 800, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
              <span>Total</span><span style={{ color: B.danger }}>{fmtMoney(totalExp)}</span>
            </div>
          )}
        </div>
      </div>

      {balance > 4000 && (
        <div style={{ margin: "0 20px 12px", padding: "8px 14px", background: B.dangerBg, borderRadius: 8, fontSize: 11, color: B.danger, fontWeight: 700 }}>
          ⚠️ Cash exceeds £4,000 — contact Regional Operations Manager
        </div>
      )}
    </div>
  );
}
