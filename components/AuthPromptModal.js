"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Apple, Mail, Sparkles, X } from "lucide-react";
import { useAuth } from "../app/lib/auth";
import { isDisplayNameTaken } from "../app/lib/firebaseHelpers";
import { useLanguage } from "./LanguageProvider";

export default function AuthPromptModal({ open, onClose, title = "Log in required" }) {
  const { signInWithApple, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("login");
    setEmail("");
    setPassword("");
    setDisplayName("");
    setAuthError("");
  }, [open]);

  if (!open) return null;
  const isSignup = mode === "signup";
  const inputClass =
    "w-full rounded-[1.1rem] border border-white/10 bg-[#181818] px-4 py-3.5 text-white placeholder:text-white/34 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-[#2BD36B]/35";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/72 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md sm:items-center">
      <div className="flex w-full max-w-[25rem] max-h-[min(43rem,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem))] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0D0D0D] p-4 text-white shadow-[0_28px_90px_rgba(0,0,0,0.58)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/7 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/48">
              <Sparkles size={13} className="text-[#F0A623]" />
              {t("Account")}
            </div>
            <h2 className="mt-3 text-[1.78rem] leading-none font-semibold tracking-[-0.03em] text-white">
              {isSignup ? t("Create account") : t(title)}
            </h2>
            <p className="mt-2 max-w-[18rem] text-[13px] leading-5 text-white/55">
              {isSignup
                ? t("Create your profile to save dishes and keep your DishList.")
                : t("Sign in to save dishes and open your profile.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[1rem] border border-white/10 bg-white/7 text-white/70 shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
            aria-label={t("Close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isSignup ? (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setAuthError("");
              }}
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/7 px-3 py-2 text-[13px] font-semibold text-white/68"
            >
              <ArrowLeft size={16} />
              {t("Back to log in")}
            </button>
          ) : null}

          <div className="space-y-3">
            {isSignup ? (
              <input
                type="text"
                placeholder={t("Display name")}
                className={inputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            ) : null}
            <input
              type="email"
              placeholder={t("Email")}
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder={t("Password")}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {authError ? (
            <p className="mt-3 rounded-[1rem] border border-[#E64646]/30 bg-[#2A1111] px-3 py-2 text-center text-[13px] font-medium text-[#FFB4B4]">
              {t(authError)}
            </p>
          ) : null}
        </div>

        <div className="mt-4 space-y-2.5">
          {mode === "login" ? (
            <>
              <button
                onClick={() => {
                  setMode("signup");
                  setAuthError("");
                }}
                className="w-full rounded-[1.15rem] border border-[#45C47A]/45 bg-[#1FA463] py-3.5 font-bold text-white shadow-[0_12px_26px_rgba(31,164,99,0.22)]"
              >
                {t("Create account")}
              </button>
              <button
                onClick={async () => {
                  setAuthError("");
                  if (!email || !password) {
                    setAuthError(t("Email and password are required."));
                    return;
                  }
                  try {
                    await signInWithEmail(email, password);
                    onClose?.();
                  } catch (err) {
                    setAuthError(err?.message || t("Login failed."));
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[1.15rem] border border-white/12 bg-[#181818] py-3.5 font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
              >
                <Mail size={17} />
                {t("Log in")}
              </button>
            </>
          ) : (
            <button
              onClick={async () => {
                setAuthError("");
                if (!displayName.trim() || !email || !password) {
                  setAuthError(t("Display name, email and password are required."));
                  return;
                }
                try {
                  if (await isDisplayNameTaken(displayName.trim())) {
                    setAuthError(t("That display name is already taken."));
                    return;
                  }
                  await signUpWithEmail(email, password, displayName);
                  onClose?.();
                } catch (err) {
                  setAuthError(err?.message || t("Create account failed."));
                }
              }}
              className="w-full rounded-[1.15rem] border border-[#45C47A]/45 bg-[#1FA463] py-3.5 font-bold text-white shadow-[0_12px_26px_rgba(31,164,99,0.22)]"
            >
              {t("Create account")}
            </button>
          )}

          <div className="my-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-semibold text-white/38">{t("or")}</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={async () => {
              setAuthError("");
              try {
                await signInWithApple();
                onClose?.();
              } catch (err) {
                setAuthError(err?.message || t("Apple sign-in failed."));
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-[1.15rem] border border-white/14 bg-white py-3.5 font-bold text-black shadow-[0_12px_28px_rgba(255,255,255,0.08)]"
          >
            <Apple size={18} fill="currentColor" />
            {t("Continue with Apple")}
          </button>

          <button
            onClick={async () => {
              setAuthError("");
              try {
                await signInWithGoogle();
                onClose?.();
              } catch (err) {
                setAuthError(err?.message || t("Google sign-in failed."));
              }
            }}
            className="w-full rounded-[1.15rem] border border-white/12 bg-[#181818] py-3.5 font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
          >
            {t("Continue with Google")}
          </button>
        </div>
      </div>
    </div>
  );
}
