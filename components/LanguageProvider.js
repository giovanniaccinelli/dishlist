"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../app/lib/firebase";
import { useAuth } from "../app/lib/auth";

export const LANGUAGE_EN = "en";
export const LANGUAGE_IT = "it";
const LANGUAGE_STORAGE_KEY = "dishlist-language";
const LANGUAGE_EXPLICIT_STORAGE_KEY = "dishlist-language-explicit";
const DARK_MODE_STORAGE_KEY = "dishlist-dark-mode";
const TEXT_ATTRIBUTES = ["placeholder", "aria-label", "title", "value"];
const textNodeOriginals = new WeakMap();
const elementAttrOriginals = new WeakMap();

function isNumericLikeText(value) {
  return /^[\s0-9.,:+\-/%()]*$/.test(String(value ?? ""));
}

const translations = {
  en: {},
  it: {
    feed: "Feed",
    explore: "Esplora",
    upload: "Carica",
    people: "Persone",
    People: "Persone",
    profile: "Profilo",
    "Edit Profile": "Modifica profilo",
    "Log Out": "Esci",
    "Delete Account": "Elimina account",
    Settings: "Impostazioni",
    Activity: "Attività",
    "Updates from your DishList": "Aggiornamenti dalla tua DishList",
    "Loading updates...": "Caricamento aggiornamenti...",
    "No updates yet": "Ancora nessun aggiornamento",
    recently: "di recente",
    "started following you": "ha iniziato a seguirti",
    "posted a new dish": "ha pubblicato un nuovo piatto",
    "commented on your dish": "ha commentato un tuo piatto",
    "commented on your story": "ha commentato una tua storia",
    "saved your dish": "ha salvato un tuo piatto",
    Leaderboard: "Leaderboard",
    Takes: "Takes",
    "Leaderboard question": "Domanda leaderboard",
    "Your answer": "La tua risposta",
    Answer: "Risposta",
    Vote: "Vota",
    Voted: "Votato",
    Votes: "Voti",
    "No votes yet": "Nessun voto",
    "Question manager": "Gestione domande",
    "Create the questions shown in Explore.": "Crea le domande mostrate in Esplora.",
    "Admin password": "Password admin",
    Question: "Domanda",
    Label: "Etichetta",
    Open: "Apri",
    Close: "Chiudi",
    "Publish question": "Pubblica domanda",
    "Update question": "Aggiorna domanda",
    "Load my questions": "Carica le mie domande",
    "Edit existing questions": "Modifica domande esistenti",
    Refresh: "Aggiorna",
    Editing: "In modifica",
    "Tap to edit": "Tocca per modificare",
    "No questions yet": "Nessuna domanda",
    "Create new question": "Crea nuova domanda",
    "Question deleted": "Domanda eliminata",
    "Could not delete question": "Impossibile eliminare la domanda",
    "Enter the admin password to manage leaderboard questions.": "Inserisci la password admin per gestire le domande leaderboard.",
    "Publishing...": "Pubblicazione...",
    "Wrong password": "Password errata",
    "Write a question": "Scrivi una domanda",
    "Leaderboard question published": "Domanda leaderboard pubblicata",
    "Leaderboard question updated": "Domanda leaderboard aggiornata",
    "Could not publish question": "Impossibile pubblicare la domanda",
    "Swipe between leaderboard questions": "Scorri tra le domande leaderboard",
    Account: "Account",
    "Log in required": "Accesso richiesto",
    "Create account": "Crea account",
    "Create your profile to save dishes and keep your DishList.": "Crea il tuo profilo per salvare piatti e tenere la tua DishList.",
    "Sign in to save dishes and open your profile.": "Accedi per salvare piatti e aprire il tuo profilo.",
    "Back to log in": "Torna al login",
    Email: "Email",
    Password: "Password",
    "Log in": "Accedi",
    "Continue with Apple": "Continua con Apple",
    "Continue with Google": "Continua con Google",
    "Email and password are required.": "Email e password sono obbligatorie.",
    "Display name, email and password are required.": "Nome, email e password sono obbligatori.",
    "That display name is already taken.": "Quel nome profilo \u00e8 gi\u00e0 in uso.",
    "Login failed.": "Accesso non riuscito.",
    "Create account failed.": "Creazione account non riuscita.",
    "Apple sign-in failed.": "Accesso con Apple non riuscito.",
    "Google sign-in failed.": "Accesso con Google non riuscito.",
    Appearance: "Aspetto",
    "Representative tags": "Tag rappresentativi",
    "Choose up to 3 tags for your profile. Leave empty to use your most common dish tags.": "Scegli fino a 3 tag per il profilo. Lascia vuoto per usare quelli piu presenti nei tuoi piatti.",
    "Use automatic tags": "Usa tag automatici",
    "Save tags": "Salva tag",
    "Tags saved": "Tag salvati",
    "Could not update tags": "Impossibile aggiornare i tag",
    "Saving...": "Salvataggio...",
    "Light mode": "Modalita chiara",
    "Save profile": "Salva profilo",
    "Display name": "Nome",
    "Profile picture": "Foto profilo",
    "Change photo": "Cambia foto",
    "Update your name, photo and bio.": "Aggiorna nome, foto e bio.",
    Language: "Lingua",
    "Dark mode": "Modalita scura",
    English: "Inglese",
    Italian: "Italiano",
    followers: "follower",
    following: "seguiti",
    uploaded: "caricati",
    Uploaded: "Caricati",
    dishes: "piatti",
    Shuffle: "Shuffle",
    "My Profile": "Il mio profilo",
    "User Profile": "Profilo utente",
    "No users found.": "Nessun utente trovato.",
    "Search users...": "Cerca utenti...",
    Follow: "Segui",
    Unfollow: "Non seguire",
    Followers: "Follower",
    Following: "Seguiti",
    "No dishes to shuffle.": "Nessun piatto da mischiare.",
    "No dishes here.": "Nessun piatto qui.",
    "Top picks": "Preferiti",
    Favorites: "I tuoi classici",
    "Your Classics": "I tuoi classici",
    "To Try": "Da provare",
    "All dishes": "Tutti i piatti",
    Dishes: "Piatti",
    Directs: "Messaggi",
    "Profile options": "Opzioni profilo",
    "World map": "Mappa mondiale",
    "Restaurants map": "Mappa ristoranti",
    Mappa: "Mappa",
    Restaurants: "Ristoranti",
    Calendar: "Calendario",
    Days: "giorni",
    "Restaurant map": "Mappa ristoranti",
    "Open map": "Apri mappa",
    "Meal calendar": "Calendario pasti",
    "Open calendar": "Apri calendario",
    "What you ate": "Cosa hai mangiato",
    "Story meals will show up here.": "Qui appariranno i piatti pubblicati nelle storie.",
    "No story meals that day.": "Nessun piatto in storia quel giorno.",
    "Calendar only": "Solo calendario",
    "Write what you ate": "Scrivi cosa hai mangiato",
    "Add to calendar": "Aggiungi al calendario",
    "Save to calendar": "Salva nel calendario",
    "What did you eat?": "Cosa hai mangiato?",
    "This will not post a story.": "Non verrà pubblicato nelle storie.",
    "No calendar entries that day.": "Nessun elemento quel giorno.",
    "Add today": "Aggiungi oggi",
    "Something went wrong": "Qualcosa è andato storto",
    "Most Saved": "Più salvati",
    "Trending Now": "Di tendenza ora",
    "Loading map": "Caricamento mappa",
    "For you": "Per te",
    "for you": "Per te",
    "For You": "Per te",
    "Show all": "Mostra tutti",
    "show all": "Mostra tutti",
    "Showing home dishes": "Stai vedendo i piatti Home",
    "Showing restaurant dishes": "Stai vedendo i piatti Ristorante",
    "Eat in": "A casa",
    "Eat out": "Al ristorante",
    "Load more": "Carica altri",
    Dish: "Piatto",
    dish: "piatto",
    Recipe: "Ricetta",
    recipe: "ricetta",
    saves: "salvato",
    "saves:": "salvato:",
    Saves: "Salvato",
    "Saves:": "Salvato:",
    saved: "salvato",
    Saved: "Salvato",
    "Be the first to comment": "Commenta",
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
    "Add media": "Aggiungi media",
    "Change media": "Cambia media",
    "Photo library": "Libreria foto",
    "Pick a photo or video": "Scegli una foto o un video",
    "Take photo": "Scatta foto",
    "Open the camera": "Apri la fotocamera",
    "Crop current photo": "Ritaglia foto attuale",
    "Reframe the existing image": "Reinquadra l'immagine esistente",
    Cancel: "Annulla",
    Optional: "Facoltativo",
    Tags: "Tag",
    "Ingredients and recipe": "Ingredienti e ricetta",
    "Add a dish": "Aggiungi un piatto",
    "Create dish": "Carica",
    "Upload dish": "Carica",
    "Post a new dish to your DishList.": "Pubblica un nuovo piatto nella tua DishList.",
    "Find dish": "Cerca",
    "See if it already exists.": "Guarda se esiste gi\u00e0.",
    "Dish mode": "Modalit\u00e0 piatto",
    "Show dishes from": "Mostra piatti da",
    DishList: "DishList",
    "Got a few in mind?": "Hai gi\u00e0 qualche idea?",
    "Swipe on the feed": "Scorri nel feed",
    "Save your first 3 dishes": "Salva i tuoi primi 3 piatti",
    "Start by adding three dishes you already know you want in your DishList.": "Inizia aggiungendo tre piatti che sai gi\u00e0 di volere nella tua DishList.",
    "Start swiping right away. After your third save, we ask you to create the profile.": "Inizia subito a scorrere. Dopo il terzo salvataggio ti chiediamo di creare il profilo.",
    "Add up to three dishes to your DishList. We'll ask you to create an account after the third.": "Aggiungi fino a tre piatti alla tua DishList. Dopo il terzo ti chiederemo di creare un account.",
    Steps: "Passi",
    "Dish 1": "Piatto 1",
    "Dish 2": "Piatto 2",
    "Dish 3": "Piatto 3",
    "Tags you can explore": "Tag da esplorare",
    "Skip for now": "Salta per ora",
    "Name a dish": "Dai un nome al piatto",
    "Enter all 3 dishes.": "Inserisci tutti e 3 i piatti.",
    "Enter a dish name.": "Inserisci il nome di un piatto.",
    "Enter DishList": "Entra in DishList",
    of: "di",
    "You can add an image later.": "Puoi aggiungere un'immagine dopo.",
    "Some ideas": "Qualche idea",
    "No ideas yet.": "Ancora nessuna idea.",
    "Loading views...": "Caricamento visualizzazioni...",
    Comments: "Commenti",
    "No comments yet": "Nessun commento ancora",
    Comments: "Commenti",
    "Recipe comments": "Commenti ricetta",
    "Comment on the recipe": "Commenta la ricetta",
    "Story comments": "Commenti storia",
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
    "Rename Dishlist": "Rinomina dishlist",
    "Edit the list name": "Modifica il nome della lista",
    "Dishlist name": "Nome dishlist",
    "Choose dishlists": "Scegli dishlist",
    "Save dish": "Salva piatto",
    "Add To": "Aggiungi a",
    Rating: "Valutazione",
    "Dish actions": "Azioni piatto",
    "Add to story": "Lo sto mangiando",
    "Confirm story": "Conferma storia",
    "Edit dish": "Modifica piatto",
    "Manage dishlists": "Gestisci DishList",
    "Move to DishList": "Sposta in DishList",
    Remove: "Rimuovi",
    Delete: "Elimina",
    "Remove Dish": "Rimuovi piatto",
    "Choose how to remove it": "Scegli come rimuoverlo",
    "Remove from": "Rimuovi da",
    only: "soltanto",
    "Remove it from Your Classics only": "Rimuovilo solo da I tuoi classici",
    "Remove from profile completely": "Rimuovi completamente dal profilo",
    "Delete it from your saved lists and profile": "Eliminalo dalle liste salvate e dal profilo",
    "Choose an existing dish to share.": "Scegli un piatto esistente da condividere.",
    "Pick an existing dish for your story.": "Scegli un piatto esistente per la tua storia.",
    "Pick from your uploaded dishes or Your Classics.": "Scegli dai tuoi piatti caricati o dai tuoi classici.",
    "Post directly to your story.": "Pubblica direttamente nella tua storia.",
    "Share it instantly to your story.": "Condividilo subito nella tua storia.",
    "Search restaurant": "Cerca ristorante",
    "Restaurant (optional)": "Ristorante (facoltativo)",
    "Restaurant selected": "Ristorante selezionato",
    "Clear restaurant": "Cancella ristorante",
    "Search people...": "Cerca persone...",
    Close: "Chiudi",
    close: "chiudi",
    Clear: "Cancella",
    clear: "cancella",
    Done: "Fatto",
    done: "fatto",
    "Open profile": "Apri profilo",
    "Open dish": "Apri piatto",
    "Open dish card": "Apri scheda piatto",
    "Saved By": "Salvato da",
    "No saves yet.": "Ancora nessun salvataggio.",
    "Story pushes": "Condivisioni in storia",
    comments: "commenti",
    "Start the conversation.": "Inizia la conversazione.",
    Reply: "Rispondi",
    "Replying to": "Risposta a",
    "Write a reply...": "Scrivi una risposta...",
    "Write a comment...": "Scrivi un commento...",
    "Loading comments...": "Caricamento commenti...",
    "Search people...": "Cerca persone...",
    "No users found.": "Nessun utente trovato.",
    "No story pushes yet": "Ancora nessuna condivisione in storia",
    "Searching people...": "Ricerca persone...",
    "Loading dishes": "Caricamento piatti",
    "No tag filters selected": "Nessun filtro tag selezionato",
    "Add filters": "Aggiungi filtri",
    "Search dishes or tags": "Cerca piatti o tag",
    "Search where you ate it": "Cerca dove l'hai mangiato",
    "What are you eating": "Cosa stai mangiando",
    "What are you eating?": "Cosa stai mangiando?",
    "A shared map of restaurants people have linked to their dishes, with the meals posted from each place.": "Una mappa condivisa dei ristoranti collegati ai piatti pubblicati dalle persone.",
    "Profile map": "Mappa profilo",
    "Restaurants you've pinned": "Ristoranti che hai salvato",
    "Restaurant dishes with a selected place will show up here.": "Qui appariranno i piatti ristorante con un luogo selezionato.",
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
    "Upload dish": "Carica",
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
    "high protein": "high protein",
    veg: "veg",
    vegan: "vegano",
    light: "light",
    easy: "facile",
    quick: "veloce",
    fancy: "ricercato",
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
    "date night": "date night",
    pasta: "pasta",
    italian: "italiano",
    ethnic: "etnico",
    seafood: "pesce",
    aesthetic: "aesthetic",
    fresh: "fresco",
    asian: "asiatico",
    fried: "fritto",
    delivery: "delivery",
    dessert: "dolce",
    american: "americano",
    rice: "riso",
    "fast food": "fast food",
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
    const parentTag = node.parentElement?.tagName;
    if (parentTag === "SCRIPT" || parentTag === "STYLE") return;
    if (node.parentElement?.closest?.("[data-no-translate='true']")) return;
    const currentValue = node.nodeValue;
    if (isNumericLikeText(currentValue)) return;
    const hadOriginal = textNodeOriginals.has(node);
    const storedOriginal = hadOriginal ? textNodeOriginals.get(node) : currentValue;
    const translatedStoredOriginal = translateString(storedOriginal, language);
    const original =
      hadOriginal && currentValue !== translatedStoredOriginal
        ? currentValue
        : storedOriginal;
    if (!hadOriginal || original !== storedOriginal) {
      textNodeOriginals.set(node, original);
    }
    const nextValue = translateString(original, language);
    if (node.nodeValue !== nextValue) {
      node.nodeValue = nextValue;
    }
  };

  const translateElementAttrs = (element) => {
    if (!element) return;
    const tagName = element.tagName;
    if (tagName === "SCRIPT" || tagName === "STYLE") return;
    if (element.closest?.("[data-no-translate='true']")) return;
    const attrStore = elementAttrOriginals.get(element) || {};
    TEXT_ATTRIBUTES.forEach((attr) => {
      if (!element.hasAttribute?.(attr)) return;
      const currentValue = element.getAttribute(attr);
      if (isNumericLikeText(currentValue)) return;
      const hadOriginal = attr in attrStore;
      const storedOriginal = hadOriginal ? attrStore[attr] : currentValue;
      const translatedStoredOriginal = translateString(storedOriginal, language);
      const original =
        hadOriginal && currentValue !== translatedStoredOriginal
          ? currentValue
          : storedOriginal;
      attrStore[attr] = original;
      const nextValue = translateString(original, language);
      if (element.getAttribute(attr) !== nextValue) {
        element.setAttribute(attr, nextValue);
      }
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
  language: LANGUAGE_IT,
  setLanguage: () => {},
  darkMode: false,
  setDarkMode: () => {},
  t: (value) => value,
});

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState(LANGUAGE_IT);
  const [darkMode, setDarkModeState] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const explicit = window.localStorage.getItem(LANGUAGE_EXPLICIT_STORAGE_KEY) === "1";
    if (explicit && (stored === LANGUAGE_EN || stored === LANGUAGE_IT)) {
      setLanguageState(stored);
    } else {
      setLanguageState(LANGUAGE_IT);
    }
    setDarkModeState(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return undefined;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? snap.data() : {};
        const remoteLanguage = data?.language || "";
        if (!cancelled && data?.languagePreferenceSet === true && (remoteLanguage === LANGUAGE_EN || remoteLanguage === LANGUAGE_IT)) {
          setLanguageState((prev) => {
            const stored = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : "";
            const explicit = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_EXPLICIT_STORAGE_KEY) === "1" : false;
            return explicit && (stored === LANGUAGE_EN || stored === LANGUAGE_IT) ? stored : remoteLanguage;
          });
        }
        if (!cancelled && data?.darkMode === true) {
          setDarkModeState((prev) => {
            const stored = typeof window !== "undefined" ? window.localStorage.getItem(DARK_MODE_STORAGE_KEY) : "";
            return stored === "1" || stored === "true" || stored === "0" || stored === "false" ? prev : data.darkMode;
          });
        }
      } catch (err) {
        console.warn("Failed to load user preferences:", err);
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DARK_MODE_STORAGE_KEY, darkMode ? "1" : "0");
    }
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", darkMode);
      document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
    }
  }, [darkMode]);

  useEffect(() => applyTranslationsToDocument(language), [language]);

  const setLanguage = async (nextLanguage) => {
    if (nextLanguage !== LANGUAGE_EN && nextLanguage !== LANGUAGE_IT) return;
    setLanguageState(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_EXPLICIT_STORAGE_KEY, "1");
    }
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, "users", user.uid), { language: nextLanguage, languagePreferenceSet: true }, { merge: true });
    } catch (err) {
      console.warn("Failed to persist language preference:", err);
    }
  };

  const setDarkMode = async (nextDarkMode) => {
    const enabled = Boolean(nextDarkMode);
    setDarkModeState(enabled);
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, "users", user.uid), { darkMode: enabled }, { merge: true });
    } catch (err) {
      console.warn("Failed to persist dark mode preference:", err);
    }
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      darkMode,
      setDarkMode,
      t: (input) => {
        return translateString(String(input ?? ""), language);
      },
    }),
    [darkMode, language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
