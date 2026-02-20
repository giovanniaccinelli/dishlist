"use client";

import { useState } from "react";
import { useAuth } from "../app/lib/auth";

export default function AuthPromptModal({ open, onClose, title = "Log in required" }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl border border-black/10">
        <h2 className="text-2xl font-bold mb-2 text-center">{title}</h2>
        <p className="text-sm text-black/60 text-center mb-6">
          Sign in to save dishes and open your profile
        </p>
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
          className="w-full bg-black text-white py-3 rounded-full font-semibold mb-4 hover:opacity-90 transition"
        >
          Continue with Google
        </button>
        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-black/10" />
          <span className="text-xs text-black/50">or</span>
          <div className="h-px flex-1 bg-black/10" />
        </div>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-3 mb-3 rounded-full bg-[#F6F6F2] border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/20"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 mb-4 rounded-full bg-[#F6F6F2] border border-black/10 text-black focus:outline-none focus:ring-2 focus:ring-black/20"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {authError && <p className="mb-3 text-sm text-red-500 text-center">{authError}</p>}

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
          className="w-full bg-black text-white py-3 rounded-full font-semibold mb-2 hover:opacity-90 transition"
        >
          Log In
        </button>
        <button
          onClick={async () => {
            setAuthError("");
            if (!email || !password) {
              setAuthError("Email and password are required.");
              return;
            }
            try {
              await signUpWithEmail(email, password);
              onClose?.();
            } catch (err) {
              setAuthError(err?.message || "Create account failed.");
            }
          }}
          className="w-full bg-white border border-black/20 py-3 rounded-full font-semibold hover:bg-black/5 transition"
        >
          Create Account
        </button>

        <button
          onClick={onClose}
          className="w-full mt-3 text-sm text-black/60 hover:text-black"
        >
          Close
        </button>
      </div>
    </div>
  );
}
