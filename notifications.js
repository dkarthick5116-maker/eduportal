import { auth, db } from "./firebase-config.js";
import { 
  collection, 
  addDoc, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Multi-tenant string normalizers
function cleanSchool(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function cleanClass(v) {
  return (v || "").toString().replace(/^class\s*/i, "").trim().toLowerCase();
}

/**
 * Dispatch a notification from Teacher to Students
 */
export async function sendStudentNotification(currentTeacher, title, message, className, section, category) {
  if (!currentTeacher?.schoolName) return;

  try {
    await addDoc(collection(db, "notifications"), {
      schoolName: currentTeacher.schoolName,
      targetRole: "student",
      className: cleanClass(className),
      section: (section || "All").trim().toUpperCase(),
      title: title,
      message: message,
      category: category, // 'qp', 'hw', 'mat', 'notice'
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to send student notification:", err);
  }
}

/**
 * Dispatch a notification from Student to Teacher
 */
export async function sendTeacherNotification(currentStudent, teacherId, title, message, category) {
  if (!currentStudent?.schoolName) return;

  try {
    await addDoc(collection(db, "notifications"), {
      schoolName: currentStudent.schoolName,
      targetRole: "teacher",
      recipientId: teacherId || "ALL",
      className: cleanClass(currentStudent.className),
      section: (currentStudent.section || "").trim().toUpperCase(),
      title: title,
      message: message,
      category: category, // 'exam_sub', 'hw_sub'
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to send teacher notification:", err);
  }
}

/**
 * Load notifications for Teacher Dashboard
 */
export async function loadTeacherNotifications(currentTeacher) {
  const container = document.getElementById("notif-list-container");
  const badge = document.getElementById("notif-badge");
  if (!container || !currentTeacher?.schoolName) return;

  const teacherSchool = cleanSchool(currentTeacher.schoolName);
  const teacherUid = auth.currentUser?.uid;

  try {
    const snap = await getDocs(collection(db, "notifications"));
    const items = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const notifSchool = cleanSchool(data.schoolName);

      // Strict school isolation + targeted to this teacher
      if (Boolean(notifSchool) && Boolean(teacherSchool) && notifSchool === teacherSchool) {
        if (data.targetRole === "teacher" && (data.recipientId === teacherUid || data.recipientId === "ALL")) {
          items.push({ id: docSnap.id, ...data });
        }
      }
    });

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderNotificationList(container, badge, items, "#4338ca");
  } catch (err) {
    console.error("Error loading teacher notifications:", err);
  }
}

/**
 * Load notifications for Student Dashboard
 */
export async function loadStudentNotifications(currentStudent) {
  const container = document.getElementById("notif-list-container");
  const badge = document.getElementById("notif-badge");
  if (!container || !currentStudent?.schoolName) return;

  const studentSchool = cleanSchool(currentStudent.schoolName);
  const studentClass = cleanClass(currentStudent.className);
  const studentSec = (currentStudent.section || "").trim().toUpperCase();

  try {
    const snap = await getDocs(collection(db, "notifications"));
    const items = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const notifSchool = cleanSchool(data.schoolName);
      const targetClass = cleanClass(data.className);
      const targetSec = (data.section || "All").trim().toUpperCase();

      // Strict school, class and section matching
      if (Boolean(notifSchool) && Boolean(studentSchool) && notifSchool === studentSchool) {
        if (data.targetRole === "student") {
          const matchClass = targetClass === "all" || targetClass === studentClass;
          const matchSec = targetSec === "ALL" || targetSec === studentSec;

          if (matchClass && matchSec) {
            items.push({ id: docSnap.id, ...data });
          }
        }
      }
    });

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderNotificationList(container, badge, items, "#10b981");
  } catch (err) {
    console.error("Error loading student notifications:", err);
  }
}

function renderNotificationList(container, badge, items, accentColor) {
  if (items.length > 0) {
    if (badge) {
      badge.textContent = items.length;
      badge.style.display = "inline-block";
    }
    container.innerHTML = items.map((n) => `
      <div style="background: #f8fafc; border-left: 3px solid ${accentColor}; padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 6px;">
        <div style="font-weight: 700; color: #1e1b4b;">${n.title}</div>
        <div style="color: #475569; margin: 2px 0;">${n.message}</div>
        <div style="font-size: 10px; color: #94a3b8;">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `).join("");
  } else {
    if (badge) badge.style.display = "none";
    container.innerHTML = `<p style="font-size: 12px; color: #64748b; text-align: center; margin: 10px 0;">No notifications yet.</p>`;
  }
}

// UI Dropdown Toggle Setup
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-toggle-notifs")?.addEventListener("click", () => {
    const dropdown = document.getElementById("notif-dropdown");
    dropdown?.classList.toggle("hidden");
  });
});
      
