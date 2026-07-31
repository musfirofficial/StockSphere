"use client";

import React from "react";
import { Check } from "lucide-react";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  c: any;
}

export function Checkbox({ checked, onChange, c }: CheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      style={{
        width: 17,
        height: 17,
        borderRadius: 5,
        flexShrink: 0,
        border: `1.5px solid ${checked ? c.accent : c.border}`,
        background: checked ? c.accent : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {checked && <Check size={11} strokeWidth={3} color="#fff" />}
    </button>
  );
}

// Alias for backwards compatibility with Cb
export const Cb = Checkbox;
