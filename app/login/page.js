"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleEmailPasswordAuth = async () => {
    console.log("Login attempt with", email);
    try {
      setError("");
      if (isNewUser) {
        await createUserWithEmailAndPassword(auth, email, password);
        console.log("Sign up success");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Sign in success");
      }
      router.replace("/profile");
    } catch (e) {
      console.error("Login error", e);
      setError(e.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.replace("/profile");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#0E0E0E] text-white p-6">
      <h1 className="text-3xl mb-6 font-bold">Dishlist Login</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-4 p-3 rounded-lg bg-[#2a2a2a] w-80 focus:outline-none focus:ring-2 focus:ring-red-500"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-4 p-3 rounded-lg bg-[#2a2a2a] w-80 focus:outline-none focus:ring-2 focus:ring-red-500"
      />
      {error && <div className="mb-4 text-red-500">{error}</div>}
      <button
        onClick={handleEmailPasswordAuth}
        className="mb-4 bg-gradient-to-tr from-red-500 to-pink-500 py-3 px-6 rounded-full font-semibold hover:opacity-90 transition w-80"
      >
        {isNewUser ? "Sign Up" : "Sign In"}
      </button>
      <button
        onClick={handleGoogleSignIn}
        className="mb-2 bg-gray-700 py-3 px-6 rounded-full font-semibold hover:bg-gray-600 transition w-80"
      >
        Continue with Google
      </button>
      <button
        onClick={() => setIsNewUser(!isNewUser)}
        className="text-sm text-gray-400 hover:text-white transition"
      >
        {isNewUser
          ? "Already have an account? Sign In"
          : "New user? Sign Up"}
      </button>
    </div>
  );
}
