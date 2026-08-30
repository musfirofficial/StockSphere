"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

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

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg =
          typeof data.detail === "string"
            ? data.detail
            : data.detail?.[0]?.msg || "Failed to process request. Please try again.";
        setError(errorMsg);
        return;
      }

      setMessage(
        data.detail ||
          "If an account exists with this email, a password reset link has been sent. Please check your inbox (and server console in dev mode)."
      );
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
              Reset Password
            </h1>
            <p style={{ fontSize: 13.5, color: c.textMuted }}>
              Enter your account email to receive a recovery link
            </p>
          </div>
        </div>

        {message ? (
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
              <div>{message}</div>
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
              <span>Return to Sign In</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleForgotPassword}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
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

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: c.textMuted,
                  marginBottom: 6,
                }}
              >
                Account Email
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
                  <Mail size={16} />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{
                    width: "100%",
                    padding: "11px 12px 11px 38px",
                    borderRadius: 10,
                    border: `1px solid ${c.border}`,
                    background: c.inputBg,
                    color: c.text,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: c.accent,
                color: "#FFFFFF",
                fontSize: 14.5,
                fontWeight: 600,
                cursor: loading ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.75 : 1,
                marginTop: 4,
              }}
            >
              {loading ? "Sending link..." : "Send Reset Link"}
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
