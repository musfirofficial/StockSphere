"use client";

import React from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  c: any;
  maxWidth?: number | string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  c,
  maxWidth = 320,
}: SearchBarProps) {
  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        maxWidth,
      }}
    >
      <Search
        size={15}
        color={c.textFaint}
        style={{
          position: "absolute",
          left: 11,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "7px 32px 7px 34px",
          borderRadius: 8,
          border: `1px solid ${c.border}`,
          background: c.surfaceMuted,
          color: c.text,
          fontSize: 13,
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          style={{
            position: "absolute",
            right: 9,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "none",
            color: c.textFaint,
            cursor: "pointer",
            display: "flex",
            padding: 0,
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
