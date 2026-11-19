const CACHE_NAME = "eduportal-v4";
const ASSETS_TO_CACHE = [
  "/",
  "/login.html",
  "/student-dashboard.html",
  "/teacher-dashboard.html",
  "/style.css",
  "/manifest.json",
  "/file_0000000018c8820bbb5ed8b1c124a4c3.png"
];

// Install Event: Caches critical app shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching updated app shell & assets");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event: Clears previous cache versions immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing outdated cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Direct network bypass for Firebase Auth / Firestore, cache-first for local static files
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Do not intercept or cache live Firebase Auth and Firestore network calls
  if (
    requestUrl.origin.includes("firestore.googleapis.com") ||
    requestUrl.origin.includes("identitytoolkit.googleapis.com") ||
    requestUrl.origin.includes("gstatic.com")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    }).catch(() => {
      if (event.request.mode === "navigate") {
        return caches.match("/login.html");
      }
    })
  );
});
