"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../app/lib/firebase";
import { useAuth } from "../app/lib/auth";

export const LANGUAGE_EN = "en";
export const LANGUAGE_IT = "it";
const LANGUAGE_STORAGE_KEY = "dishlist-language";

const translations = {
  en: {},
  it: {
    feed: "feed",
    explore: "esplora",
    upload: "carica",
    people: "persone",
    profile: "profilo",
    "Edit Profile": "Modifica profilo",
    "Log Out": "Esci",
    "Delete Account": "Elimina account",
    Language: "Lingua",
    English: "Inglese",
    Italian: "Italiano",
    followers: "follower",
    following: "seguiti",
    uploaded: "pubblicati",
    dishes: "piatti",
    Shuffle: "Shuffle",
    "My Profile": "Il mio profilo",
    "No users found.": "Nessun utente trovato.",
    "Search users...": "Cerca utenti...",
    Follow: "Segui",
    Unfollow: "Smetti di seguire",
    Followers: "Follower",
    Following: "Seguiti",
    "No dishes to shuffle.": "Nessun piatto da mischiare.",
    "No dishes here.": "Nessun piatto qui.",
    "Top picks": "Top picks",
    "All dishes": "Tutti i piatti",
    Directs: "Messaggi",
    "Profile options": "Opzioni profilo",
    "World map": "Mappa mondiale",
    "Restaurants map": "Mappa ristoranti",
    "Loading map": "Caricamento mappa",
  },
};

const LanguageContext = createContext({
  language: LANGUAGE_EN,
  setLanguage: () => {},
  t: (value) => value,
});

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState(LANGUAGE_EN);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === LANGUAGE_EN || stored === LANGUAGE_IT) {
      setLanguageState(stored);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return undefined;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const remoteLanguage = snap.exists() ? snap.data()?.language : "";
        if (!cancelled && (remoteLanguage === LANGUAGE_EN || remoteLanguage === LANGUAGE_IT)) {
          setLanguageState((prev) => {
            const stored = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : "";
            return stored === LANGUAGE_EN || stored === LANGUAGE_IT ? stored : remoteLanguage;
          });
        }
      } catch (err) {
        console.warn("Failed to load language preference:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = async (nextLanguage) => {
    if (nextLanguage !== LANGUAGE_EN && nextLanguage !== LANGUAGE_IT) return;
    setLanguageState(nextLanguage);
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, "users", user.uid), { language: nextLanguage }, { merge: true });
    } catch (err) {
      console.warn("Failed to persist language preference:", err);
    }
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (input) => {
        const key = String(input ?? "");
        return translations[language]?.[key] || key;
      },
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
