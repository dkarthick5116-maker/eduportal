// Service Worker Cache Version
const CACHE_NAME = "eduportal-v11";

// Essential App Shell & Static Assets to Pre-cache
const ASSETS_TO_CACHE = [
  "/",
  "/login.html",
  "/student-dashboard.html",
  "/teacher-dashboard.html",
  "/teacher.js",
  "/style.css",
  "/manifest.json",
  "/firebase-config.js",
  "/file_0000000018c8820bbb5ed8b1c124a4c3.png"
];

// 1. INSTALL EVENT: Pre-caches shell assets and activates immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching updated app shell & assets");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE EVENT: Deletes any old, outdated caches automatically
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Purging old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH EVENT: Real-time network bypass for Firebase APIs + Cache-first for UI files
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass service worker caching for Firebase Auth & Firestore live data
  if (
    requestUrl.origin.includes("firestore.googleapis.com") ||
    requestUrl.origin.includes("identitytoolkit.googleapis.com") ||
    requestUrl.origin.includes("securetoken.googleapis.com") ||
    requestUrl.origin.includes("gstatic.com")
  ) {
    return;
  }

  // Never cache non-GET requests (POST, PUT, DELETE)
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).catch(() => {
        // Fallback to login page if offline and navigating
        if (event.request.mode === "navigate") {
          return caches.match("/login.html");
        }
      });
    })
  );
});
