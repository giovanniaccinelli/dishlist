"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../app/lib/firebase";
import { useAuth } from "../app/lib/auth";

export const LANGUAGE_EN = "en";
export const LANGUAGE_IT = "it";
const LANGUAGE_STORAGE_KEY = "dishlist-language";
const TEXT_ATTRIBUTES = ["placeholder", "aria-label", "title", "value"];
const textNodeOriginals = new WeakMap();
const elementAttrOriginals = new WeakMap();

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
    uploaded: "caricati",
    dishes: "piatti",
    Shuffle: "Mescola",
    "My Profile": "Il mio profilo",
    "User Profile": "Profilo utente",
    "No users found.": "Nessun utente trovato.",
    "Search users...": "Cerca utenti...",
    Follow: "Segui",
    Unfollow: "Smetti di seguire",
    Followers: "Follower",
    Following: "Seguiti",
    "No dishes to shuffle.": "Nessun piatto da mischiare.",
    "No dishes here.": "Nessun piatto qui.",
    "Top picks": "Preferiti",
    "All dishes": "Tutti i piatti",
    Directs: "Messaggi",
    "Profile options": "Opzioni profilo",
    "World map": "Mappa mondiale",
    "Restaurants map": "Mappa ristoranti",
    "Loading map": "Caricamento mappa",
    "Share Dish": "Condividi piatto",
    Loading: "Caricamento",
    "Loading...": "Caricamento...",
    "Send dish": "Invia piatto",
    "Add to a DishList": "Aggiungi a una DishList",
    Home: "Casa",
    Restaurant: "Ristorante",
    "Recipe to cook at home": "Ricetta da cucinare a casa",
    "Suggestion to eat out": "Idea per mangiare fuori",
    "Add a photo or video": "Aggiungi una foto o un video",
    Optional: "Facoltativo",
    Tags: "Tag",
    "Ingredients and recipe": "Ingredienti e ricetta",
    "Add a dish": "Aggiungi un piatto",
    "Create dish": "Crea piatto",
    "Post a new dish to your DishList.": "Pubblica un nuovo piatto nella tua DishList.",
    "Find dish": "Trova piatto",
    "See if it already exists.": "Guarda se esiste gi\u00e0.",
    "Dish mode": "Modalit\u00e0 piatto",
    "Show dishes from": "Mostra piatti da",
    DishList: "DishList",
    "Got a few in mind?": "Hai gi\u00e0 qualche idea?",
    "Swipe on the feed": "Scorri nel feed",
    "You can add an image later.": "Puoi aggiungere un'immagine dopo.",
    "Some ideas": "Qualche idea",
    "No ideas yet.": "Ancora nessuna idea.",
    "Loading views...": "Caricamento visualizzazioni...",
    Comments: "Commenti",
    "No comments yet": "Nessun commento ancora",
    "Start the conversation.": "Inizia la conversazione.",
    Link: "Link",
    Ingredients: "Ingredienti",
    Method: "Procedimento",
    "This dish has no recipe.": "Questo piatto non ha una ricetta.",
    "Loading restaurant search...": "Caricamento ricerca ristorante...",
    Searching: "Ricerca in corso...",
    "Loading restaurant details...": "Caricamento dettagli ristorante...",
    or: "oppure",
    Dishlists: "DishList",
    "Select tags": "Seleziona tag",
    "Pick a dishlist first": "Scegli prima una dishlist",
    "Send this dish?": "Inviare questo piatto?",
    "Delete message?": "Eliminare il messaggio?",
    "This removes the message you sent from the chat.": "Questo rimuove il messaggio che hai inviato dalla chat.",
    "Name and cover": "Nome e copertina",
    "Change photo": "Cambia foto",
    "Description and tags": "Descrizione e tag",
    "Review changes": "Rivedi modifiche",
    "Sign in to see the people you follow.": "Accedi per vedere le persone che segui.",
    "No dishes from followed accounts yet.": "Ancora nessun piatto dagli account che segui.",
    "Hide tags": "Nascondi tag",
    "Your playlist, for dishes": "La tua playlist, per i piatti",
    "Save what you crave.": "Salva quello che ti va.",
    Feed: "Feed",
    Stories: "Storie",
    "Why it works": "Perch\u00e9 funziona",
    Explore: "Esplora",
    "Add New Dish": "Aggiungi nuovo piatto",
    "Edit profile": "Modifica profilo",
    "Update your name, photo and bio.": "Aggiorna nome, foto e bio.",
    "Display name": "Nome profilo",
    "Profile picture": "Foto profilo",
    Bio: "Bio",
    "Delete account": "Elimina account",
    "Confirm your password": "Conferma la tua password",
    "Your DishLists": "Le tue DishList",
    "Create dishlist": "Crea dishlist",
    "Remove from profile completely": "Rimuovi completamente dal profilo",
    "Delete it from your saved lists and profile": "Eliminalo dalle liste salvate e dal profilo",
    "Pick an existing dish for your story.": "Scegli un piatto esistente per la tua storia.",
    "Post directly to your story.": "Pubblica direttamente nella tua storia.",
    "Search restaurant": "Cerca ristorante",
    "Restaurant (optional)": "Ristorante (facoltativo)",
    "Restaurant selected": "Ristorante selezionato",
    "Clear restaurant": "Cancella ristorante",
    "Search people...": "Cerca persone...",
    "Open profile": "Apri profilo",
    "Open dish": "Apri piatto",
    "Open dish card": "Apri scheda piatto",
    "Saved By": "Salvato da",
    "Story pushes": "Condivisioni in storia",
    "No story pushes yet": "Ancora nessuna condivisione in storia",
    "Searching people...": "Ricerca persone...",
    "Loading dishes": "Caricamento piatti",
    Back: "Indietro",
    Save: "Salva",
    "Choose dishlists": "Scegli dishlist",
    "Add To": "Aggiungi a",
    "No restaurant dishes yet": "Ancora nessun piatto ristorante",
    "Nothing pinned here yet.": "Qui non c'\u00e8 ancora niente.",
    "Search restaurant": "Cerca ristorante",
    "Pinned restaurant": "Ristorante salvato",
    "Map unavailable": "Mappa non disponibile",
    "Google Maps could not be loaded right now.": "Google Maps non pu\u00f2 essere caricato ora.",
    "Open all dishlists": "Apri tutte le dishlist",
    "Open profile map": "Apri mappa profilo",
    "Open your stories": "Apri le tue storie",
    "Add story": "Aggiungi storia",
    "Open user stories": "Apri storie utente",
    "Dish name": "Nome del piatto",
    Description: "Descrizione",
    "Dish link": "Link del piatto",
    "Add link": "Aggiungi link",
    "Tag a user (optional)": "Tagga un utente (facoltativo)",
    Ingredients: "Ingredienti",
    Method: "Procedimento",
    "Review and publish": "Rivedi e pubblica",
    "Review and upload": "Rivedi e carica",
    "Untitled dish": "Piatto senza titolo",
    "Publish story": "Pubblica storia",
    "Upload dish": "Carica piatto",
    "Publishing...": "Pubblicazione...",
    "Uploading...": "Caricamento...",
    "Previous step": "Passo precedente",
    Continue: "Continua",
    "Story title and cover": "Titolo e copertina della storia",
    "Story details and tags": "Dettagli e tag della storia",
    "Ingredients": "Ingredienti",
    "Method": "Procedimento",
    "Dish name is required": "Il nome del piatto \u00e8 obbligatorio",
    "Story published": "Storia pubblicata",
    "Dish uploaded": "Piatto caricato",
    "Story failed": "Storia non riuscita",
    "Upload failed": "Caricamento non riuscito",
    "Loading upload": "Caricamento upload",
    "Loading map...": "Caricamento mappa...",
    fit: "fit",
    "high protein": "alta proteina",
    veg: "veg",
    vegan: "vegano",
    light: "light",
    easy: "facile",
    quick: "veloce",
    fancy: "elegante",
    comfort: "comfort",
    "carb heavy": "ricco di carboidrati",
    "low carb": "pochi carboidrati",
    spicy: "piccante",
    "late night": "tarda notte",
    cheat: "sgarro",
    budget: "economico",
    premium: "premium",
    summer: "estate",
    winter: "inverno",
    gourmet: "gourmet",
    "date night": "serata romantica",
  },
};

function translateString(value, language) {
  if (language === LANGUAGE_EN) return value;
  const raw = String(value ?? "");
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const translated = translations[language]?.[trimmed];
  if (!translated) return raw;
  const leading = raw.match(/^\s*/)?.[0] || "";
  const trailing = raw.match(/\s*$/)?.[0] || "";
  return `${leading}${translated}${trailing}`;
}

function applyTranslationsToDocument(language) {
  if (typeof document === "undefined") return () => {};

  const translateNode = (node) => {
    if (!node) return;
    const original = textNodeOriginals.has(node) ? textNodeOriginals.get(node) : node.nodeValue;
    if (!textNodeOriginals.has(node)) textNodeOriginals.set(node, original);
    node.nodeValue = translateString(original, language);
  };

  const translateElementAttrs = (element) => {
    if (!element) return;
    const attrStore = elementAttrOriginals.get(element) || {};
    TEXT_ATTRIBUTES.forEach((attr) => {
      if (!element.hasAttribute?.(attr)) return;
      if (!(attr in attrStore)) attrStore[attr] = element.getAttribute(attr);
      const original = attrStore[attr];
      element.setAttribute(attr, translateString(original, language));
    });
    elementAttrOriginals.set(element, attrStore);
  };

  const walk = (root) => {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateNode(root);
      return;
    }
    if (root.nodeType === Node.ELEMENT_NODE) {
      translateElementAttrs(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) translateNode(current);
      if (current.nodeType === Node.ELEMENT_NODE) translateElementAttrs(current);
      current = walker.nextNode();
    }
  };

  walk(document.body);
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        translateNode(mutation.target);
      } else if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => walk(node));
      } else if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
        translateElementAttrs(mutation.target);
      }
    });
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: TEXT_ATTRIBUTES,
  });
  return () => observer.disconnect();
}

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

  useEffect(() => applyTranslationsToDocument(language), [language]);

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
        return translateString(String(input ?? ""), language);
      },
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
