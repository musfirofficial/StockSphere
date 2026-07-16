"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export const theme = {
  light: {
    bg: "#FAFAF8",
    surface: "#FFFFFF",
    surfaceMuted: "#F1F0EC",
    border: "#E7E5DF",
    text: "#1A1A18",
    textMuted: "#6B6A63",
    textFaint: "#9A988F",
    accent: "#3B6E5E",
    accentSoft: "#E7F0EC",
    danger: "#B3473C",
    dangerSoft: "#F8E9E7",
    warn: "#A6792F",
    warnSoft: "#F6EEDF",
    inputBg: "#F5F4F0",
  },
  dark: {
    bg: "#15140F",
    surface: "#1D1C16",
    surfaceMuted: "#252420",
    border: "#322F27",
    text: "#F2F1EA",
    textMuted: "#A8A597",
    textFaint: "#73705F",
    accent: "#6FAE97",
    accentSoft: "#22302A",
    danger: "#E08374",
    dangerSoft: "#372120",
    warn: "#D8AF63",
    warnSoft: "#332B1C",
    inputBg: "#252420",
  },
};

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  mode: ThemeMode;
  c: typeof theme.light;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedMode = localStorage.getItem("theme-mode") as ThemeMode;
    if (savedMode) setMode(savedMode);
  }, []);

  const toggleTheme = () => {
    const nextMode = mode === "light" ? "dark" : "light";
    setMode(nextMode);
    localStorage.setItem("theme-mode", nextMode);
  };

  const c = theme[mode];

  // Prevent flash during SSR
  if (!mounted) {
    return <div style={{ background: theme.light.bg, minHeight: "100vh" }} />;
  }

  return (
    <ThemeContext.Provider value={{ mode, c, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
