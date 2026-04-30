let googleMapsPromise = null;

export function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

export function loadGoogleMaps() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("Missing Google Maps API key."));
  }

  if (window.google?.maps?.Map && window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps="dishlist"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          reject(new Error("Google Maps loaded without the expected API."));
        }
      });
      existing.addEventListener("error", () => {
        reject(new Error("Google Maps failed to load."));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "dishlist";
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps loaded without the expected API."));
      }
    };
    script.onerror = () => {
      reject(new Error("Google Maps failed to load."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPromise = null;
    throw error;
  });

  return googleMapsPromise;
}
