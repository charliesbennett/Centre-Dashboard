"use client";
import { useState } from "react";
import { B, MEALS, PROGRAMMES, uid, fmtDate } from "@/lib/constants";
import { Fld, StatCard, TableWrap, IconBtn, IcPlus, IcTrash, IcSearch, inputStyle, thStyle, tdStyle, btnPrimary } from "@/components/ui";

export default function StudentsTab({ groups, setGroups }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [n, setN] = useState({
    agent: "", group: "", nat: "", stu: 0, gl: 0, arr: "", dep: "",
    firstMeal: "Dinner", lastMeal: "Packed Lunch", prog: "Multi-Activity",
  });

  const add = () => {
    if (!n.group.trim()) return;
    setGroups((p) => [...p, { ...n, id: uid(), stu: +n.stu || 0, gl: +n.gl || 0 }]);
    setN({ agent: "", group: "", nat: "", stu: 0, gl: 0, arr: "", dep: "", firstMeal: "Dinner", lastMeal: "Packed Lunch", prog: "Multi-Activity" });
    setShowAdd(false);
  };

  const filtered = groups.filter((x) =>
    !search || `${x.agent} ${x.group} ${x.nat}`.toLowerCase().includes(search.toLowerCase())
  );
  const totalStu = groups.reduce((s, x) => s + (x.stu || 0), 0);
  const totalGL = groups.reduce((s, x) => s + (x.gl || 0), 0);

  const fi = inputStyle;

  return (
    <div>
      <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatCard label="Groups" value={groups.length} accent={B.navy} />
        <StatCard label="Students" value={totalStu} accent={B.red} />
        <StatCard label="GLs" value={totalGL} accent="#7c3aed" />
        <StatCard label="Total Pax" value={totalStu + totalGL} accent={B.success} />
      </div>

      <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 10px" }}>
          <IcSearch />
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ background: "none", border: "none", fontSize: 12, width: 130, fontFamily: "inherit", color: B.text }} />
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}><IcPlus /> Add Group</button>
      </div>

      {showAdd && (
        <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: "10px 20px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Fld label="Agent"><input value={n.agent} onChange={(e) => setN((p) => ({ ...p, agent: e.target.value }))} style={fi} /></Fld>
          <Fld label="Group"><input value={n.group} onChange={(e) => setN((p) => ({ ...p, group: e.target.value }))} style={fi} /></Fld>
          <Fld label="Nat"><input value={n.nat} onChange={(e) => setN((p) => ({ ...p, nat: e.target.value }))} style={{ ...fi, width: 60 }} /></Fld>
          <Fld label="Students"><input type="number" value={n.stu} onChange={(e) => setN((p) => ({ ...p, stu: e.target.value }))} style={{ ...fi, width: 60 }} /></Fld>
          <Fld label="GLs"><input type="number" value={n.gl} onChange={(e) => setN((p) => ({ ...p, gl: e.target.value }))} style={{ ...fi, width: 55 }} /></Fld>
          <Fld label="Arrival"><input type="date" value={n.arr} onChange={(e) => setN((p) => ({ ...p, arr: e.target.value }))} style={fi} /></Fld>
          <Fld label="Departure"><input type="date" value={n.dep} onChange={(e) => setN((p) => ({ ...p, dep: e.target.value }))} style={fi} /></Fld>
          <Fld label="1st Meal">
            <select value={n.firstMeal} onChange={(e) => setN((p) => ({ ...p, firstMeal: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>
              {MEALS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Fld>
          <Fld label="Last Meal">
            <select value={n.lastMeal} onChange={(e) => setN((p) => ({ ...p, lastMeal: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>
              {MEALS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Fld>
          <Fld label="Programme">
            <select value={n.prog} onChange={(e) => setN((p) => ({ ...p, prog: e.target.value }))} style={{ ...fi, cursor: "pointer" }}>
              {PROGRAMMES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Fld>
          <button onClick={add} style={{ padding: "6px 16px", background: B.navy, border: "none", color: B.white, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", height: 32 }}>Add</button>
          <button onClick={() => setShowAdd(false)} style={{ color: B.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}

      <div style={{ padding: "0 12px 16px", overflowX: "auto" }}>
        <TableWrap>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["Agent", "Group", "Nat", "Stu", "GLs", "Total", "Prog", "1st Meal", "Last", "Arr", "Dep", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: "center", padding: 36, color: B.textLight }}>No groups — data flows to Programmes, Catering &amp; Transfers</td></tr>
              ) : filtered.map((x) => (
                <tr key={x.id} style={{ borderBottom: `1px solid ${B.borderLight}` }}>
                  <td style={tdStyle}>{x.agent}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: B.navy }}>{x.group}</td>
                  <td style={tdStyle}><span style={{ background: B.pink, padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, color: B.red }}>{x.nat}</span></td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{x.stu}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{x.gl}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: B.navy }}>{x.stu + x.gl}</td>
                  <td style={tdStyle}><span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{x.prog}</span></td>
                  <td style={{ ...tdStyle, fontSize: 9 }}>{x.firstMeal}</td>
                  <td style={{ ...tdStyle, fontSize: 9 }}>{x.lastMeal}</td>
                  <td style={tdStyle}>{fmtDate(x.arr)}</td>
                  <td style={tdStyle}>{fmtDate(x.dep)}</td>
                  <td style={tdStyle}><IconBtn danger onClick={() => setGroups((p) => p.filter((z) => z.id !== x.id))}><IcTrash /></IconBtn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
      <div style={{ padding: "0 20px 8px", fontSize: 10, color: B.success, fontWeight: 600 }}>✓ Groups auto-flow to Programmes, Catering &amp; Transfers</div>
    </div>
  );
}
