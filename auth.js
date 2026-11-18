// ==========================================
// EDUPORTAL - AUTHENTICATION MODULE
// ==========================================

import { auth } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

// ---------- CREATE ACCOUNT ----------
export async function registerUser(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}

// ---------- LOGIN ----------
export async function loginUser(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

// ---------- LOGOUT ----------
export async function logoutUser() {
  return await signOut(auth);
}

// ---------- LOGIN STATUS ----------
export function monitorAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---------- PASSWORD RESET ----------
export async function resetPassword(email) {
  return await sendPasswordResetEmail(auth, email);
}

// ---------- CURRENT USER ----------
export function getCurrentUser() {
  return auth.currentUser;
}
