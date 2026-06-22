"use client";
import { useState, useEffect } from "react";

async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("uklc_user");
      if (saved) setUser(JSON.parse(saved));
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, []);

  const login = async (identifier, password) => {
    setError(null);
    const isEmail = identifier.includes("@");
    if (isEmail && !identifier.endsWith("@uklc.org")) {
      setError("Only @uklc.org email addresses are allowed.");
      return false;
    }
    try {
      const password_hash = await hashPassword(password);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password_hash }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid username/email or password.");
        return false;
      }
      const u = { id: data.id, email: data.email, name: data.full_name, role: data.role, centreId: data.centre_id, isSuperAdmin: !!data.isSuperAdmin };
      setUser(u);
      try { window.localStorage.setItem("uklc_user", JSON.stringify(u)); } catch (e) {}
      return true;
    } catch (e) {
      setError("Login failed. Please try again.");
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    try { window.localStorage.removeItem("uklc_user"); } catch (e) {}
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  };

  return {
    user, loading, error, login, logout,
    isAuthenticated: !!user,
    isHeadOffice: user?.role === "head_office",
    isSuperAdmin: !!user?.isSuperAdmin,
    userCentreId: user?.centreId || null,
    userName: user?.name || user?.email?.split("@")[0] || "",
    userRole: user?.role || "teacher",
  };
}
