// Service Worker Version & Cache Name
const CACHE_NAME = "eduportal-v8";

// Core App Shell Assets to Pre-cache
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

// 1. INSTALL EVENT: Pre-caches essential UI files and activates immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching updated app shell and static assets");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE EVENT: Cleans up obsolete cache versions from previous updates
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Purging outdated cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH EVENT: Network bypass for dynamic Firebase APIs + Cache-First for static UI
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Directly bypass service worker for live Firebase Auth & Firestore API calls
  if (
    requestUrl.origin.includes("firestore.googleapis.com") ||
    requestUrl.origin.includes("identitytoolkit.googleapis.com") ||
    requestUrl.origin.includes("securetoken.googleapis.com") ||
    requestUrl.origin.includes("gstatic.com")
  ) {
    return;
  }

  // Non-GET requests (POST, PUT, DELETE) must never be served from cache
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached asset if present
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request).catch(() => {
        // Offline fallback to login page for navigation requests
        if (event.request.mode === "navigate") {
          return caches.match("/login.html");
        }
      });
    })
  );
});
