"use client";
import { B } from "@/lib/constants";

export default function RotaTab(props) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: B.textMuted }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🚧</div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>RotaTab — Connected</div>
      <div style={{ fontSize: 11, marginTop: 4 }}>This tab will be built out in the next step.</div>
      {props.groups && <div style={{ marginTop: 8, fontSize: 11, color: B.success }}>✓ Receiving {props.groups.length} groups from Students</div>}
      {props.staff && <div style={{ marginTop: 4, fontSize: 11, color: B.success }}>✓ Receiving {props.staff.length} staff from Team</div>}
      {props.excDays && <div style={{ marginTop: 4, fontSize: 11, color: B.success }}>✓ Receiving {Object.keys(props.excDays).length} excursion days</div>}
    </div>
  );
}
