"use client";

import React, { createContext, useContext } from "react";

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
};

interface ThemeContextType {
  mode: "light";
  c: typeof theme.light;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "light",
  c: theme.light,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ mode: "light", c: theme.light, toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
