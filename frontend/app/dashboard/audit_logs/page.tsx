"use client";

import React from "react";
import { useTheme } from "../ThemeContext";

export default function AuditLogsPage() {
  const { c } = useTheme();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: 280,
        gap: 10,
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        color: c.textMuted,
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 600 }}>Audit Logs Page</span>
      <span style={{ fontSize: 12.5, color: c.textFaint }}>
        This mock inventory page is currently under development.
      </span>
    </div>
  );
}
