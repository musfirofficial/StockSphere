"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";

const c = {
  bg: "#FAFAF8",
  surface: "#FFFFFF",
  border: "#E7E5DF",
  text: "#1A1A18",
  textMuted: "#6B6A63",
  accent: "#3B6E5E",
  accentHover: "#2E574A",
  accentSoft: "#E7F0EC",
  error: "#B3473C",
  inputBg: "#F5F4F0",
};

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Reset token is missing from the link. Please request a new password reset link.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword.includes(" ")) {
      setError("Password cannot contain spaces.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg =
          typeof data.detail === "string"
            ? data.detail
            : data.detail?.[0]?.msg || "Failed to reset password. The link may have expired.";
        setError(errorMsg);
        return;
      }

      setSuccess("Your password has been reset successfully! Redirecting to sign in...");
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err) {
      setError("Unable to connect to the server. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div
      style={{
        background: c.bg,
        color: c.text,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: 20,
      }}
    >
      {/* Main card */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 16,
          padding: "40px 32px",
          boxShadow: "0 4px 20px -2px rgba(107, 106, 99, 0.08), 0 2px 8px -1px rgba(107, 106, 99, 0.04)",
        }}
      >
        {/* Brand/Logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            marginBottom: 28,
            textAlign: "center",
          }}
        >
          <img
            src="/stocksphere_logo.svg"
            alt="StockSphere Logo"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              objectFit: "contain",
            }}
          />
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginBottom: 4,
              }}
            >
              Set New Password
            </h1>
            <p style={{ fontSize: 13.5, color: c.textMuted }}>
              Create a secure new password for your account
            </p>
          </div>
        </div>

        {success ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                background: "#EBF7F2",
                color: "#2E574A",
                fontSize: 13.5,
                lineHeight: 1.5,
                border: `1px solid ${c.accent}44`,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{success}</div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/login")}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: c.accent,
                color: "#FFFFFF",
                fontSize: 14.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <ArrowLeft size={16} />
              <span>Go to Sign In Now</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleResetPassword}
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#FCECEB",
                  color: c.error,
                  fontSize: 13,
                  fontWeight: 500,
                  border: `1px solid ${c.error}33`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {!token && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#FFF8E6",
                  color: "#8A6D14",
                  fontSize: 12.5,
                  border: "1px solid #ECC94B55",
                }}
              >
                Notice: No reset token detected in URL. Please make sure you clicked the full link from your email.
              </div>
            )}

            {/* New Password Field */}
            <div>
              <label
                htmlFor="newPassword"
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: c.textMuted,
                  marginBottom: 6,
                }}
              >
                New Password (min 8 characters)
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: c.textMuted,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Lock size={16} />
                </span>
                <input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{
                    width: "100%",
                    padding: "11px 40px 11px 38px",
                    borderRadius: 10,
                    border: `1px solid ${c.border}`,
                    background: c.inputBg,
                    color: c.text,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: c.textMuted,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                  }}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: c.textMuted,
                  marginBottom: 6,
                }}
              >
                Confirm New Password
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: c.textMuted,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Lock size={16} />
                </span>
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{
                    width: "100%",
                    padding: "11px 40px 11px 38px",
                    borderRadius: 10,
                    border: `1px solid ${c.border}`,
                    background: c.inputBg,
                    color: c.text,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: c.textMuted,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                  }}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !token}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: c.accent,
                color: "#FFFFFF",
                fontSize: 14.5,
                fontWeight: 600,
                cursor: loading || !token ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: loading || !token ? 0.75 : 1,
                marginTop: 4,
              }}
            >
              {loading ? "Resetting password..." : "Set New Password"}
            </button>

            {/* Back to Login link */}
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <a
                href="/login"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: c.textMuted,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ArrowLeft size={14} />
                <span>Back to Sign In</span>
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FAFAF8",
            color: "#6B6A63",
            fontSize: 14,
          }}
        >
          Loading password reset...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
