import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Helper normalizers
function cleanStr(val) {
  return (val || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

// Builds unique synthetic student email to prevent collisions across schools/classes
export function buildStudentEmail(schoolName, className, section, rollNumber) {
  const s = cleanStr(schoolName);
  const c = cleanStr(className);
  const sec = cleanStr(section);
  const r = cleanStr(rollNumber);
  return `${s}_c${c}_s${sec}_${r}@eduportal.com`;
}

// Builds teacher email
export function buildTeacherEmail(schoolName, emailOrUsername) {
  const input = (emailOrUsername || "").trim().toLowerCase();
  if (input.includes("@")) {
    return input;
  }
  const s = cleanStr(schoolName);
  const u = cleanStr(input);
  return `${s}_teacher_${u}@eduportal.com`;
}

// 1. AUTO REDIRECT CHECK
export function initAuthWatcher() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const currentPath = window.location.pathname;

          if (data.role === "teacher" && !currentPath.includes("teacher-dashboard")) {
            window.location.href = "teacher-dashboard.html";
          } else if (data.role === "student" && !currentPath.includes("student-dashboard")) {
            window.location.href = "student-dashboard.html";
          }
        }
      } catch (e) {
        console.error("Auth redirect error:", e);
      }
    }
  });
}

// 2. STUDENT REGISTRATION
export async function registerStudent(studentData) {
  const { fullName, schoolName, board, className, section, rollNumber, password } = studentData;
  const syntheticEmail = buildStudentEmail(schoolName, className, section, rollNumber);

  const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
  const user = cred.user;

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    role: "student",
    fullName: fullName.trim(),
    schoolName: schoolName.trim(),
    board: board || "State Board",
    className: className.toString().trim(),
    section: section.toString().trim().toUpperCase(),
    rollNumber: rollNumber.toString().trim(),
    email: syntheticEmail,
    createdAt: new Date().toISOString()
  });

  window.location.href = "student-dashboard.html";
}

// 3. STUDENT LOGIN
export async function loginStudent({ schoolName, className, section, rollNumber, password }) {
  const syntheticEmail = buildStudentEmail(schoolName, className, section, rollNumber);
  await signInWithEmailAndPassword(auth, syntheticEmail, password);
  window.location.href = "student-dashboard.html";
}

// 4. TEACHER REGISTRATION
export async function registerTeacher(teacherData) {
  const { fullName, schoolName, email, password } = teacherData;
  const finalEmail = buildTeacherEmail(schoolName, email);

  const cred = await createUserWithEmailAndPassword(auth, finalEmail, password);
  const user = cred.user;

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    role: "teacher",
    fullName: fullName.trim(),
    schoolName: schoolName.trim(),
    email: finalEmail,
    createdAt: new Date().toISOString()
  });

  window.location.href = "teacher-dashboard.html";
}

// 5. TEACHER LOGIN
export async function loginTeacher({ schoolName, email, password }) {
  const finalEmail = buildTeacherEmail(schoolName, email);
  await signInWithEmailAndPassword(auth, finalEmail, password);
  window.location.href = "teacher-dashboard.html";
}

// 6. LOGOUT
export async function logoutUser() {
  await signOut(auth);
  window.location.href = "login.html";
}

// 7. PASSWORD RESET / SET
// Sends password reset email (for teachers with standard email)
export async function resetPasswordByEmail(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

// Updates/sets new password for the currently logged-in user (student or teacher)
export async function setNewPassword(newPassword) {
  if (!auth.currentUser) {
    throw new Error("No active user logged in.");
  }
  await updatePassword(auth.currentUser, newPassword);
}

// Auto-run watcher when auth.js is loaded
initAuthWatcher();
