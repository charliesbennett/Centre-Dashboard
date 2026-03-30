"use client";
import { useState, useRef } from "react";
import { B, uid, fmtMoney, fmtDate, dayKey } from "@/lib/constants";
import { Fld, StatCard, TableWrap, IconBtn, IcPlus, IcTrash, inputStyle, thStyle, tdStyle, btnPrimary, btnNavy } from "@/components/ui";

const TODAY = dayKey(new Date());

export default function PettyCashTab({ pettyCash = {}, setPettyCash, readOnly = false }) {
  const income = pettyCash.income || [];
  const expenses = pettyCash.expenses || [];
  const opening = pettyCash.opening || 0;
  const toRom = pettyCash.toRom || 0;

  const [showAddInc, setShowAddInc] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [ni, setNi] = useState({ date: TODAY, group: "", cat: "Activity", amt: "" });
  const [ne, setNe] = useState({ date: TODAY, desc: "", cat: "Activities & Equipment", amt: "" });
  const incGroupRef = useRef(null);
  const expDescRef = useRef(null);

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
        <Fld label="Opening (£)"><input type="number" step="0.01" value={opening} onChange={(e) => setOpening(+e.target.value || 0)} style={{ ...fi, width: 80 }} disabled={readOnly} /></Fld>
        <Fld label="To ROM (£)"><input type="number" step="0.01" value={toRom} onChange={(e) => setToRom(+e.target.value || 0)} style={{ ...fi, width: 80 }} disabled={readOnly} /></Fld>
      </div>

      <div style={{ padding: "12px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {/* Income */}
        <div style={{ background: B.white, borderRadius: 10, border: `1px solid ${B.border}`, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", background: B.successBg, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 11, color: B.success }}>Cash In</span>
            {!readOnly && <button onClick={() => setShowAddInc(!showAddInc)} style={{ ...btnNavy, background: B.success, fontSize: 9, padding: "3px 8px", boxShadow: "none" }}>
              <IcPlus /> Add
            </button>}
          </div>
          {showAddInc && (
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}`, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Fld label="Date"><input type="date" value={ni.date} onChange={(e) => setNi((p) => ({ ...p, date: e.target.value }))} style={{ ...fi, width: 115 }} /></Fld>
              <Fld label="Group"><input ref={incGroupRef} value={ni.group} onChange={(e) => setNi((p) => ({ ...p, group: e.target.value }))} style={{ ...fi, minWidth: 80 }} /></Fld>
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
                  setTimeout(() => incGroupRef.current?.focus(), 0);
                }
              }} style={{ ...btnNavy, padding: "4px 10px", fontSize: 10 }}>Add</button>
            </div>
          )}
          <TableWrap>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, fontSize: 9 }}>Date</th>
                  <th style={{ ...thStyle, fontSize: 9 }}>Description</th>
                  <th style={{ ...thStyle, fontSize: 9, textAlign: "right" }}>Amount</th>
                  {!readOnly && <th style={{ ...thStyle, fontSize: 9, width: 32 }}></th>}
                </tr>
              </thead>
              <tbody>
                {income.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 3 : 4} style={{ color: B.textMuted, fontSize: 12, padding: "12px 0", textAlign: "center" }}>No income recorded yet</td>
                  </tr>
                ) : income.map((i) => (
                  <tr key={i.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                    <td style={{ ...tdStyle, fontSize: 10, color: B.textMuted, whiteSpace: "nowrap" }}>{fmtDate(i.date)}</td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>
                      {i.group} <span style={{ color: B.textMuted, fontSize: 9 }}>({i.cat})</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: B.success, textAlign: "right", whiteSpace: "nowrap" }}>{fmtMoney(+i.amt)}</td>
                    {!readOnly && <td style={{ ...tdStyle, textAlign: "center", padding: "4px" }}>
                      <IconBtn danger onClick={() => setPettyCash((p) => ({ ...p, income: (p.income || []).filter((z) => z.id !== i.id) }))}><IcTrash /></IconBtn>
                    </td>}
                  </tr>
                ))}
                {income.length > 0 && (
                  <tr style={{ background: B.ice }}>
                    <td colSpan={readOnly ? 2 : 3} style={{ ...tdStyle, fontWeight: 800, fontSize: 11 }}>Total</td>
                    <td style={{ ...tdStyle, fontWeight: 800, fontSize: 11, color: B.success, textAlign: "right" }}>{fmtMoney(totalInc)}</td>
                    {!readOnly && <td style={tdStyle}></td>}
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </div>

        {/* Expenses */}
        <div style={{ background: B.white, borderRadius: 10, border: `1px solid ${B.border}`, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", background: B.dangerBg, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 11, color: B.danger }}>Cash Out</span>
            {!readOnly && <button onClick={() => setShowAddExp(!showAddExp)} style={{ ...btnNavy, background: B.danger, fontSize: 9, padding: "3px 8px", boxShadow: "none" }}>
              <IcPlus /> Add
            </button>}
          </div>
          {showAddExp && (
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}`, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Fld label="Date"><input type="date" value={ne.date} onChange={(e) => setNe((p) => ({ ...p, date: e.target.value }))} style={{ ...fi, width: 115 }} /></Fld>
              <Fld label="Desc"><input ref={expDescRef} value={ne.desc} onChange={(e) => setNe((p) => ({ ...p, desc: e.target.value }))} style={{ ...fi, minWidth: 100 }} /></Fld>
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
                  setTimeout(() => expDescRef.current?.focus(), 0);
                }
              }} style={{ ...btnNavy, padding: "4px 10px", fontSize: 10 }}>Add</button>
            </div>
          )}
          <TableWrap>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, fontSize: 9 }}>Date</th>
                  <th style={{ ...thStyle, fontSize: 9 }}>Description</th>
                  <th style={{ ...thStyle, fontSize: 9, textAlign: "right" }}>Amount</th>
                  {!readOnly && <th style={{ ...thStyle, fontSize: 9, width: 32 }}></th>}
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 3 : 4} style={{ color: B.textMuted, fontSize: 12, padding: "12px 0", textAlign: "center" }}>No expenses recorded yet</td>
                  </tr>
                ) : expenses.map((e) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                    <td style={{ ...tdStyle, fontSize: 10, color: B.textMuted, whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>
                      {e.desc} <span style={{ color: B.textMuted, fontSize: 9 }}>({e.cat})</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: B.danger, textAlign: "right", whiteSpace: "nowrap" }}>{fmtMoney(+e.amt)}</td>
                    {!readOnly && <td style={{ ...tdStyle, textAlign: "center", padding: "4px" }}>
                      <IconBtn danger onClick={() => setPettyCash((p) => ({ ...p, expenses: (p.expenses || []).filter((z) => z.id !== e.id) }))}><IcTrash /></IconBtn>
                    </td>}
                  </tr>
                ))}
                {expenses.length > 0 && (
                  <tr style={{ background: B.ice }}>
                    <td colSpan={readOnly ? 2 : 3} style={{ ...tdStyle, fontWeight: 800, fontSize: 11 }}>Total</td>
                    <td style={{ ...tdStyle, fontWeight: 800, fontSize: 11, color: B.danger, textAlign: "right" }}>{fmtMoney(totalExp)}</td>
                    {!readOnly && <td style={tdStyle}></td>}
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
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
