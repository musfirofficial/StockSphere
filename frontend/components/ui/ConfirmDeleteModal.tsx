"use client";

import React from "react";
import { Modal } from "./Modal";

interface ConfirmDeleteModalProps {
  title?: string;
  itemName?: string;
  itemType?: string;
  message?: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  c: any;
  width?: number;
}

export function ConfirmDeleteModal({
  title,
  itemName,
  itemType = "item",
  message,
  confirmLabel,
  loading = false,
  onClose,
  onConfirm,
  c,
  width = 400,
}: ConfirmDeleteModalProps) {
  const modalTitle = title || `Delete ${itemType}`;
  const label = confirmLabel || `Delete ${itemType}`;

  return (
    <Modal title={modalTitle} onClose={onClose} c={c} width={width}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p
          style={{
            fontSize: 13.5,
            color: c.textMuted,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {message ? (
            message
          ) : (
            <>
              Are you sure you want to delete{" "}
              {itemName ? (
                <span style={{ color: c.text, fontWeight: 600 }}>{itemName}</span>
              ) : (
                `this ${itemType}`
              )}
              ? This action cannot be undone.
            </>
          )}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.surface,
              color: c.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: c.danger,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Deleting..." : label}
          </button>
        </div>
      </div>
    </Modal>
  );
}
