"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff } from "lucide-react";

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

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (sessionStorage.getItem("isLoggedIn") === "true") {
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          typeof data.detail === "string"
            ? data.detail
            : data.detail?.[0]?.msg || "Login failed. Please check your credentials.";
        setError(errorMessage);
        return;
      }

      sessionStorage.setItem("access_token", data.access_token);
      sessionStorage.setItem("refresh_token", data.refresh_token);
      sessionStorage.setItem("isLoggedIn", "true");

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);

      try {
        const payloadBase64 = data.access_token.split(".")[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        sessionStorage.setItem(
          "user",
          JSON.stringify({
            userId: decodedPayload.sub,
            fullName: decodedPayload.full_name,
            role: decodedPayload.role,
            username: decodedPayload.user_name || identifier.trim().toLowerCase(),
          })
        );
        localStorage.setItem("user_role", decodedPayload.role || "Admin");
        localStorage.setItem("username", decodedPayload.user_name || identifier.trim().toLowerCase());
        localStorage.setItem("user_full_name", decodedPayload.full_name || "");
      } catch {
        sessionStorage.setItem(
          "user",
          JSON.stringify({ username: identifier.toLowerCase() })
        );
      }

      // Pre-fetch dashboard data
      try {
        const dashRes = await fetch("http://localhost:8000/dashboard/", {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
            "Content-Type": "application/json",
          },
        });
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          sessionStorage.setItem("dashboardData", JSON.stringify(dashData));
        }
      } catch {
        // Non-fatal
      }

      router.push("/dashboard");
    } catch (err) {
      setError("Unable to connect to the server. Please check your connection.");
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
            marginBottom: 32,
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
              StockSphere
            </h1>
            <p style={{ fontSize: 13.5, color: c.textMuted }}>
              Inventory Management Portal
            </p>
          </div>
        </div>

        <form
          onSubmit={handleLogin}
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
              }}
            >
              {error}
            </div>
          )}

          {/* Identifier Field (Email or Username) */}
          <div>
            <label
              htmlFor="identifier"
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 600,
                color: c.textMuted,
                marginBottom: 6,
              }}
            >
              Email or Username
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
                <User size={16} />
              </span>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin or user@stocksphere.com"
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

          {/* Password Field */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <label
                htmlFor="password"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: c.textMuted,
                }}
              >
                Password
              </label>
              <a
                href="/forgot-password"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: c.accent,
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                Forgot password?
              </a>
            </div>
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
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
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
                onClick={() => setShowPassword(!showPassword)}
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
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Login Button */}
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
              marginTop: 6,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
