"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { B as LIGHT_B, DARK_B } from "@/lib/constants";

const ThemeContext = createContext({ B: LIGHT_B, isDark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("uklc_dark");
      if (saved !== null) {
        setIsDark(saved === "1");
      } else {
        setIsDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
      }
    } catch {}
  }, []);

  const toggle = () => setIsDark((d) => {
    const next = !d;
    try { window.localStorage.setItem("uklc_dark", next ? "1" : "0"); } catch {}
    return next;
  });

  return (
    <ThemeContext.Provider value={{ B: isDark ? DARK_B : LIGHT_B, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useB() {
  return useContext(ThemeContext).B;
}

export function useTheme() {
  return useContext(ThemeContext);
}
