"use client";

import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  c: any;
  width?: number;
  closeOnOverlayClick?: boolean;
}

export function Modal({
  title,
  onClose,
  children,
  c,
  width = 440,
  closeOnOverlayClick = true,
}: ModalProps) {
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      onMouseDown={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,8,0.5)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "100%",
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 14,
          padding: 22,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: c.textMuted,
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

