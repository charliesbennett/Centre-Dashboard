"use client";
import { useState } from "react";
import { B } from "@/lib/constants";

export default function LoginPage({ onLogin, error: authError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const ok = await onLogin(email.trim().toLowerCase(), password);
    if (!ok) setLoading(false);
  };

  const err = authError;
  const fieldStyle = {
    width: "100%", padding: "14px 18px", fontSize: 15, borderRadius: 24,
    border: "1.5px solid #c8d0da", background: "#eef2f7", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box", color: "#334155",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: B.navy, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Triangle grid — top left */}
      <img src="/triangle_grid.svg" alt="" style={{ position: "absolute", top: 0, left: 0, width: 260 }} />

      {/* Diagonal stripes — bottom right, shifted to align stripes with corner */}
      <img src="/diagonal_stripes.svg" alt="" style={{ position: "absolute", bottom: 0, right: -200, width: 520 }} />

      <div style={{
        background: "#fff", borderRadius: 20, padding: "44px 40px 36px", width: 400,
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)", position: "relative", zIndex: 1,
      }}>
        {/* UKLC Logo */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img src="/logo-new.png" alt="UKLC" style={{ height: 70 }} />
        </div>

        <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: "0 0 4px" }}>Centre Dashboard</h1>
        <p style={{ textAlign: "center", fontSize: 13, color: "#7a8599", margin: "0 0 28px" }}>Sign in with your UKLC Account</p>

        {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 16px", marginBottom: 18, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>{err}</div>}

        {/* Email */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="yourname@uklc.org" autoFocus style={fieldStyle} />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>Password</label>
          <div style={{ position: "relative" }}>
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Enter your password" style={{ ...fieldStyle, paddingRight: 60 }} />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#64748b", fontFamily: "inherit", fontWeight: 600 }}>{showPw ? "Hide" : "Show"}</button>
          </div>
        </div>

        {/* Sign In */}
        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "15px 0", borderRadius: 28,
          background: loading ? "#64748b" : B.navy, border: "none",
          color: "#fff", fontSize: 17, fontWeight: 700, fontFamily: "inherit",
          cursor: loading ? "default" : "pointer",
        }}>{loading ? "Signing in..." : "Sign in"}</button>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
          Contact Head Office if you need an account or have forgotten<br />your password.
        </p>
      </div>
    </div>
  );
}
