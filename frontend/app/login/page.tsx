"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Lock, User, Eye, EyeOff } from "lucide-react";

const theme = {
  light: {
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
  },
  dark: {
    bg: "#15140F",
    surface: "#1D1C16",
    border: "#322F27",
    text: "#F2F1EA",
    textMuted: "#A8A597",
    accent: "#6FAE97",
    accentHover: "#5B9680",
    accentSoft: "#22302A",
    error: "#E08374",
    inputBg: "#252420",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Load theme from localStorage if available
    const savedMode = localStorage.getItem("theme-mode") as "light" | "dark";
    if (savedMode) {
      setMode(savedMode);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setMode("dark");
    }

    // sessionStorage is per-tab, so this only matters within the same tab session
    if (sessionStorage.getItem("isLoggedIn") === "true") {
      router.push("/dashboard");
    }
  }, [router]);

  const toggleTheme = () => {
    const nextMode = mode === "light" ? "dark" : "light";
    setMode(nextMode);
    localStorage.setItem("theme-mode", nextMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      // 1. Prepare form data
      const formData = new URLSearchParams();
      formData.append("username", username.trim());
      formData.append("password", password);

      // 2. Call your FastAPI backend endpoint
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      const data = await response.json();

      // 3. Handle unsuccessful login
      if (!response.ok) {
        const errorMessage =
          typeof data.detail === "string"
            ? data.detail
            : data.detail?.[0]?.msg || "Login failed. Please try again.";
        setError(errorMessage);
        return;
      }

      // 4. sessionStorage instead of localStorage — cleared on tab/browser close
      sessionStorage.setItem("access_token", data.access_token);
      sessionStorage.setItem("refresh_token", data.refresh_token);
      sessionStorage.setItem("isLoggedIn", "true");

      try {
        const payloadBase64 = data.access_token.split(".")[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        sessionStorage.setItem(
          "user",
          JSON.stringify({
            userId: decodedPayload.sub,
            fullName: decodedPayload.full_name,
            role: decodedPayload.role,
            username: username.trim().toLowerCase(),
          })
        );
      } catch {
        // Fallback if payload decoding fails
        sessionStorage.setItem(
          "user",
          JSON.stringify({ username: username.toLowerCase() })
        );
      }

      // 5. Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  const c = theme[mode];

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
        transition: "background 0.2s, color 0.2s",
        padding: 20,
      }}
    >
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 8,
          padding: "6px 10px",
          cursor: "pointer",
          color: c.textMuted,
          fontSize: 13,
        }}
      >
        {mode === "light" ? "🌙 Dark" : "☀️ Light"}
      </button>

      {/* Main card */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 16,
          padding: "40px 32px",
          boxShadow:
            mode === "light"
              ? "0 4px 20px -2px rgba(107, 106, 99, 0.08), 0 2px 8px -1px rgba(107, 106, 99, 0.04)"
              : "0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 2px 8px -1px rgba(0, 0, 0, 0.3)",
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
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: c.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 12px ${c.accent}33`,
            }}
          >
            <Boxes size={24} color="#fff" strokeWidth={2.4} />
          </div>
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
                background: mode === "light" ? "#FCECEB" : "#372120",
                color: c.error,
                fontSize: 13,
                fontWeight: 500,
                border: `1px solid ${c.error}33`,
              }}
            >
              {error}
            </div>
          )}

          {/* Username Field */}
          <div>
            <label
              htmlFor="username"
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 600,
                color: c.textMuted,
                marginBottom: 6,
              }}
            >
              Username
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
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                style={{
                  width: "100%",
                  padding: "11px 12px 11px 38px",
                  borderRadius: 10,
                  border: `1px solid ${c.border}`,
                  background: c.inputBg,
                  color: c.text,
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 600,
                color: c.textMuted,
                marginBottom: 6,
              }}
            >
              Password
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

      {/* Helper text removed */}
    </div>
  );
}
