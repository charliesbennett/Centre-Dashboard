"use client";
import { useState } from "react";
import { B } from "@/lib/constants";

export default function LoginPage({ onLogin, error: authError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const success = await onLogin(email.trim().toLowerCase(), password);
    if (!success) setLoading(false);
  };

  const displayError = error || authError;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0c1f3f 0%, #1a3a6b 50%, #2563eb 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{
        background: "white", borderRadius: 16, padding: "40px 36px", width: 380,
        boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, background: B.navy,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <span style={{ color: "white", fontSize: 24, fontWeight: 900 }}>U</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: B.navy, margin: "0 0 4px" }}>Centre Dashboard</h1>
          <p style={{ fontSize: 12, color: B.textMuted, margin: 0 }}>Sign in with your UKLC account</p>
        </div>

        {/* Error */}
        {displayError && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
            padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#dc2626",
            fontWeight: 600,
          }}>
            {displayError}
          </div>
        )}

        {/* Form */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: B.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
              placeholder="yourname@uklc.org"
              autoComplete="email"
              autoFocus
              style={{
                width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: 8,
                border: "1px solid " + B.border, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => e.target.style.borderColor = B.navy}
              onBlur={(e) => e.target.style.borderColor = B.border}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: B.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "10px 44px 10px 14px", fontSize: 14, borderRadius: 8,
                  border: "1px solid " + B.border, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => e.target.style.borderColor = B.navy}
                onBlur={(e) => e.target.style.borderColor = B.border}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", fontSize: 12,
                  color: B.textMuted, fontFamily: "inherit", padding: "4px",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 8,
              background: loading ? "#94a3b8" : B.navy, border: "none",
              color: "white", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
              cursor: loading ? "default" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 10, color: B.textLight }}>
          Contact Head Office if you need an account or forgot your password.
        </div>
      </div>
    </div>
  );
}
