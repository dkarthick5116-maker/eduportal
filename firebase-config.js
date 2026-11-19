// ==========================================
// EDUPORTAL - FIREBASE CONFIGURATION
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDB5oWWOWVE06gKFdMLubpq2wuOWm9wFmY",
  authDomain: "eduportal-ee4ba.firebaseapp.com",
  projectId: "eduportal-ee4ba",
  storageBucket: "eduportal-ee4ba.firebasestorage.app",
  messagingSenderId: "286107907510",
  appId: "1:286107907510:web:471d8c79817213bdcebd17"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
const auth = getAuth(app);

// Cloud Firestore
const db = getFirestore(app);

// Export for other EduPortal files
export { app, auth, db };
