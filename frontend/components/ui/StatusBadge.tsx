"use client";

import React from "react";

interface StatusBadgeProps {
  active: boolean;
  c: any;
  activeText?: string;
  inactiveText?: string;
}

export function StatusBadge({
  active,
  c,
  activeText = "Active",
  inactiveText = "Inactive",
}: StatusBadgeProps) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        background: active ? c.accentSoft : c.surfaceMuted,
        color: active ? c.accent : c.textFaint,
      }}
    >
      {active ? activeText : inactiveText}
    </span>
  );
}
