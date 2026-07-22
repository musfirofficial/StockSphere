"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "../ThemeContext";
import { useData } from "../DataContext";
import {
  User,
  Lock,
  Mail,
  Phone,
  CreditCard,
  AtSign,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
} from "lucide-react";

// ── Reusable field components ─────────────────────────────────

function FieldLabel({ label, c }: { label: string; c: any }) {
  return (
    <label
      style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.04em",
        color: c.textMuted,
        textTransform: "uppercase",
        marginBottom: 5,
        display: "block",
      }}
    >
      {label}
    </label>
  );
}

function InputField({
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  c,
  disabled = false,
  rightElement,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: any;
  c: any;
  disabled?: boolean;
  rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: disabled ? c.surfaceMuted : c.inputBg,
        border: `1.5px solid ${focused ? c.accent : c.border}`,
        borderRadius: 9,
        padding: "0 12px",
        gap: 8,
        transition: "border-color .15s",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {Icon && (
        <Icon
          size={15}
          style={{
            color: focused ? c.accent : c.textFaint,
            flexShrink: 0,
            transition: "color .15s",
          }}
        />
      )}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 13.5,
          color: c.text,
          padding: "10px 0",
          fontFamily: "inherit",
        }}
      />
      {rightElement}
    </div>
  );
}

function Toast({
  type,
  message,
  c,
}: {
  type: "success" | "error";
  message: string;
  c: any;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 9,
        background: type === "success" ? c.accentSoft : c.dangerSoft,
        border: `1px solid ${
          type === "success" ? c.accent + "33" : c.danger + "33"
        }`,
        color: type === "success" ? c.accent : c.danger,
        fontSize: 13,
        fontWeight: 500,
        animation: "fadeIn .2s ease",
      }}
    >
      {type === "success" ? (
        <CheckCircle size={15} strokeWidth={2.5} />
      ) : (
        <AlertCircle size={15} strokeWidth={2.5} />
      )}
      {message}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function ProfilePage() {
  const { c } = useTheme();
  const { saveUserEdit, loggedInUser, setLoggedInUser } = useData();

  // currentUser is driven by DataContext
  const currentUser = loggedInUser;
  const setCurrentUser = setLoggedInUser;

  // ── Profile edit state ──
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    nic: "",
  });
  const [profileMsg, setProfileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [profileDirty, setProfileDirty] = useState(false);

  // ── Password change state ──
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Populate form when user loads
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        fullName: currentUser.fullName || "",
        username: currentUser.username || "",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        nic: currentUser.nic || "",
      });
    }
  }, [currentUser]);

  // Detect dirty
  useEffect(() => {
    if (!currentUser) return;
    const dirty =
      profileForm.fullName !== (currentUser.fullName || "") ||
      profileForm.username !== (currentUser.username || "") ||
      profileForm.email !== (currentUser.email || "") ||
      profileForm.phone !== (currentUser.phone || "") ||
      profileForm.nic !== (currentUser.nic || "");
    setProfileDirty(dirty);
  }, [profileForm, currentUser]);

  const clearProfileMsg = () => setTimeout(() => setProfileMsg(null), 3500);
  const clearPasswordMsg = () => setTimeout(() => setPasswordMsg(null), 3500);

  // ── Save profile details ──
  const handleSaveProfile = () => {
    if (!profileForm.fullName.trim()) {
      setProfileMsg({ type: "error", text: "Full name is required." });
      clearProfileMsg();
      return;
    }
    if (!profileForm.email.trim() || !profileForm.email.includes("@")) {
      setProfileMsg({ type: "error", text: "A valid email is required." });
      clearProfileMsg();
      return;
    }

    const updatedUser = {
      ...currentUser,
      ...profileForm,
    } as import("../DataContext").User;
    saveUserEdit(updatedUser);
    sessionStorage.setItem("user", JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);

    setProfileMsg({ type: "success", text: "Profile updated successfully." });
    clearProfileMsg();
    setProfileDirty(false);
  };

  // ── Save password ──
  const handleChangePassword = () => {
    if (!passwordForm.oldPassword) {
      setPasswordMsg({
        type: "error",
        text: "Please enter your current password.",
      });
      clearPasswordMsg();
      return;
    }
    if (passwordForm.oldPassword !== currentUser?.password) {
      setPasswordMsg({ type: "error", text: "Current password is incorrect." });
      clearPasswordMsg();
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordMsg({
        type: "error",
        text: "New password must be at least 6 characters.",
      });
      clearPasswordMsg();
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      clearPasswordMsg();
      return;
    }
    if (passwordForm.newPassword === passwordForm.oldPassword) {
      setPasswordMsg({
        type: "error",
        text: "New password must differ from the current one.",
      });
      clearPasswordMsg();
      return;
    }

    const updatedUser = {
      ...currentUser,
      password: passwordForm.newPassword,
    } as import("../DataContext").User;
    saveUserEdit(updatedUser);
    sessionStorage.setItem("user", JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);

    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordMsg({ type: "success", text: "Password changed successfully." });
    clearPasswordMsg();
  };

  const updateProfile = (key: string, value: string) =>
    setProfileForm((prev) => ({ ...prev, [key]: value }));

  const updatePassword = (key: string, value: string) =>
    setPasswordForm((prev) => ({ ...prev, [key]: value }));

  const getInitials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  if (!currentUser) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          color: c.textFaint,
          fontSize: 14,
        }}
      >
        Loading profile...
      </div>
    );
  }

  // ── Styles ──
  const cardStyle: React.CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    padding: "28px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  };

  const sectionHeadStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBottom: 16,
    borderBottom: `1px solid ${c.border}`,
    marginBottom: 4,
  };

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  };

  const saveBtnStyle = (disabled: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 20px",
    borderRadius: 9,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? c.surfaceMuted : c.accent,
    color: disabled ? c.textFaint : "#fff",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    transition: "background .15s, opacity .15s",
    opacity: disabled ? 0.6 : 1,
  });

  const passwordStrength = (
    pwd: string
  ): { label: string; color: string; width: string } => {
    if (!pwd) return { label: "", color: "transparent", width: "0%" };
    if (pwd.length < 6)
      return { label: "Too short", color: c.danger, width: "20%" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: "Weak", color: c.danger, width: "35%" };
    if (score === 2) return { label: "Fair", color: c.warn, width: "60%" };
    if (score === 3) return { label: "Good", color: c.accent, width: "80%" };
    return { label: "Strong", color: "#3B8A6E", width: "100%" };
  };

  const strength = passwordStrength(passwordForm.newPassword);

  const eyeBtn = (visible: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: c.textFaint,
        display: "flex",
        alignItems: "center",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {visible ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  );

  return (
    <>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div
        style={{
          maxWidth: 760,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* ── Avatar / Greeting card ── */}
        <div
          style={{
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${c.accent}, ${c.accent}88)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              letterSpacing: 1,
            }}
          >
            {getInitials(currentUser.fullName || "U")}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.text }}>
              {currentUser.fullName}
            </div>
            <div style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>
              @{currentUser.username} · {currentUser.role}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginTop: 6,
                padding: "3px 10px",
                borderRadius: 20,
                background: currentUser.active ? c.accentSoft : c.dangerSoft,
                color: currentUser.active ? c.accent : c.danger,
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: currentUser.active ? c.accent : c.danger,
                  display: "inline-block",
                }}
              />
              {currentUser.active ? "Active" : "Inactive"}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: c.textFaint, fontWeight: 500 }}>
              ACCOUNT ID
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: c.textMuted,
                marginTop: 2,
              }}
            >
              {currentUser.id}
            </div>
            <div style={{ fontSize: 11, color: c.textFaint, marginTop: 6 }}>
              Member since {currentUser.createdAt?.split(" ")[0] || "—"}
            </div>
          </div>
        </div>

        {/* ── Personal Details Card ── */}
        <div style={cardStyle}>
          <div style={sectionHeadStyle}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: c.accentSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={16} color={c.accent} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
                Personal Details
              </div>
              <div style={{ fontSize: 12, color: c.textFaint }}>
                Update your personal information
              </div>
            </div>
          </div>

          <div style={rowStyle}>
            <div>
              <FieldLabel label="Full Name" c={c} />
              <InputField
                value={profileForm.fullName}
                onChange={(v) => updateProfile("fullName", v)}
                placeholder="Enter full name"
                icon={User}
                c={c}
              />
            </div>
            <div>
              <FieldLabel label="Username" c={c} />
              <InputField
                value={profileForm.username}
                onChange={(v) => updateProfile("username", v)}
                placeholder="Enter username"
                icon={AtSign}
                c={c}
              />
            </div>
          </div>

          <div style={rowStyle}>
            <div>
              <FieldLabel label="Email Address" c={c} />
              <InputField
                value={profileForm.email}
                onChange={(v) => updateProfile("email", v)}
                placeholder="Enter email"
                type="email"
                icon={Mail}
                c={c}
              />
            </div>
            <div>
              <FieldLabel label="Phone Number" c={c} />
              <InputField
                value={profileForm.phone}
                onChange={(v) => updateProfile("phone", v)}
                placeholder="Enter phone"
                type="tel"
                icon={Phone}
                c={c}
              />
            </div>
          </div>

          <div style={{ maxWidth: "calc(50% - 8px)" }}>
            <FieldLabel label="NIC Number" c={c} />
            <InputField
              value={profileForm.nic}
              onChange={(v) => updateProfile("nic", v)}
              placeholder="Enter NIC"
              icon={CreditCard}
              c={c}
            />
          </div>

          {/* Non-editable fields */}
          <div style={rowStyle}>
            <div>
              <FieldLabel label="Role" c={c} />
              <InputField value={currentUser.role} c={c} disabled />
            </div>
            <div>
              <FieldLabel label="Account Status" c={c} />
              <InputField
                value={currentUser.active ? "Active" : "Inactive"}
                c={c}
                disabled
              />
            </div>
          </div>

          {profileMsg && (
            <Toast type={profileMsg.type} message={profileMsg.text} c={c} />
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={() => {
                setProfileForm({
                  fullName: currentUser.fullName || "",
                  username: currentUser.username || "",
                  email: currentUser.email || "",
                  phone: currentUser.phone || "",
                  nic: currentUser.nic || "",
                });
                setProfileMsg(null);
              }}
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                border: `1.5px solid ${c.border}`,
                background: "transparent",
                color: c.textMuted,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Reset
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={!profileDirty}
              style={saveBtnStyle(!profileDirty)}
            >
              <Save size={14} />
              Save Changes
            </button>
          </div>
        </div>

        {/* ── Password Change Card ── */}
        <div style={cardStyle}>
          <div style={sectionHeadStyle}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: c.warnSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={16} color={c.warn} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
                Change Password
              </div>
              <div style={{ fontSize: 12, color: c.textFaint }}>
                Keep your account secure with a strong password
              </div>
            </div>
          </div>

          <div>
            <FieldLabel label="Current Password" c={c} />
            <InputField
              value={passwordForm.oldPassword}
              onChange={(v) => updatePassword("oldPassword", v)}
              placeholder="Enter current password"
              type={showOld ? "text" : "password"}
              icon={Lock}
              c={c}
              rightElement={eyeBtn(showOld, () => setShowOld((v) => !v))}
            />
          </div>

          <div style={rowStyle}>
            <div>
              <FieldLabel label="New Password" c={c} />
              <InputField
                value={passwordForm.newPassword}
                onChange={(v) => updatePassword("newPassword", v)}
                placeholder="Enter new password"
                type={showNew ? "text" : "password"}
                icon={Lock}
                c={c}
                rightElement={eyeBtn(showNew, () => setShowNew((v) => !v))}
              />
              {/* Strength bar */}
              {passwordForm.newPassword && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 4,
                      background: c.border,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: strength.width,
                        background: strength.color,
                        borderRadius: 4,
                        transition: "width .3s, background .3s",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: strength.color,
                      marginTop: 4,
                      fontWeight: 600,
                    }}
                  >
                    {strength.label}
                  </div>
                </div>
              )}
            </div>
            <div>
              <FieldLabel label="Confirm New Password" c={c} />
              <InputField
                value={passwordForm.confirmPassword}
                onChange={(v) => updatePassword("confirmPassword", v)}
                placeholder="Confirm new password"
                type={showConfirm ? "text" : "password"}
                icon={Lock}
                c={c}
                rightElement={eyeBtn(showConfirm, () =>
                  setShowConfirm((v) => !v)
                )}
              />
              {/* Match indicator */}
              {passwordForm.confirmPassword && (
                <div
                  style={{
                    fontSize: 11,
                    marginTop: 6,
                    fontWeight: 600,
                    color:
                      passwordForm.newPassword === passwordForm.confirmPassword
                        ? c.accent
                        : c.danger,
                  }}
                >
                  {passwordForm.newPassword === passwordForm.confirmPassword
                    ? "✓ Passwords match"
                    : "✗ Passwords do not match"}
                </div>
              )}
            </div>
          </div>

          {passwordMsg && (
            <Toast type={passwordMsg.type} message={passwordMsg.text} c={c} />
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleChangePassword} style={saveBtnStyle(false)}>
              <Lock size={14} />
              Update Password
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
