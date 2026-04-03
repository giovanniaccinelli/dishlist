"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useAuth } from "../app/lib/auth";

export default function AuthPromptModal({ open, onClose, title = "Log in required" }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
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

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF6E8_100%)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.18)] flex flex-col">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-black/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
              Account
            </div>
            <h2 className="mt-3 text-[2rem] leading-none font-semibold text-black">
              {mode === "signup" ? "Create account" : title}
            </h2>
            <p className="mt-3 text-sm text-black/58">
              {mode === "signup"
                ? "Create your profile to save dishes and keep your DishList."
                : "Sign in to save dishes and open your profile."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 shrink-0 rounded-[1rem] border border-black/10 bg-white/85 text-black/60 hover:text-black"
            aria-label="Close"
          >
            <X size={18} className="mx-auto" />
          </button>
        </div>

        <div className="overflow-y-auto pr-1 min-h-0 flex-1">
          {mode === "signup" ? (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setAuthError("");
              }}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-black/55 hover:text-black"
            >
              <ArrowLeft size={16} />
              Back to log in
            </button>
          ) : null}

          <button
            onClick={async () => {
              setAuthError("");
              try {
                await signInWithGoogle();
                onClose?.();
              } catch (err) {
                setAuthError(err?.message || "Google sign-in failed.");
              }
            }}
            className="w-full rounded-full bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] py-3 text-white font-semibold shadow-[0_16px_36px_rgba(0,0,0,0.16)] mb-4"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-xs text-black/50">or</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          <div className="space-y-3">
            {mode === "signup" ? (
              <input
                type="text"
                placeholder="Display name"
                className="w-full rounded-full bg-white/92 border border-black/10 text-black px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/10"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            ) : null}
            <input
              type="email"
              placeholder="Email"
              className="w-full rounded-full bg-white/92 border border-black/10 text-black px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-full bg-white/92 border border-black/10 text-black px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {authError ? <p className="mt-3 text-sm text-red-500 text-center">{authError}</p> : null}
        </div>

        <div className="mt-5 space-y-2">
          {mode === "login" ? (
            <>
              <button
                onClick={async () => {
                  setAuthError("");
                  if (!email || !password) {
                    setAuthError("Email and password are required.");
                    return;
                  }
                  try {
                    await signInWithEmail(email, password);
                    onClose?.();
                  } catch (err) {
                    setAuthError(err?.message || "Login failed.");
                  }
                }}
                className="w-full rounded-full border border-black/10 bg-[#D7B443] py-3 font-semibold text-black shadow-[0_14px_30px_rgba(0,0,0,0.12)]"
              >
                Log in
              </button>
              <button
                onClick={() => {
                  setMode("signup");
                  setAuthError("");
                }}
                className="w-full rounded-full border border-black/12 bg-white/82 py-3 font-semibold text-black/75"
              >
                Create account
              </button>
            </>
          ) : (
            <button
              onClick={async () => {
                setAuthError("");
                if (!displayName.trim() || !email || !password) {
                  setAuthError("Display name, email and password are required.");
                  return;
                }
                try {
                  await signUpWithEmail(email, password, displayName);
                  onClose?.();
                } catch (err) {
                  setAuthError(err?.message || "Create account failed.");
                }
              }}
              className="w-full rounded-full bg-[linear-gradient(135deg,#111111_0%,#1E8A4C_58%,#F59E0B_100%)] py-3 font-semibold text-white shadow-[0_16px_36px_rgba(0,0,0,0.16)]"
            >
              Create account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
