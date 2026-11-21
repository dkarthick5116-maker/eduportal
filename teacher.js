import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentTeacher = null;
let currentLang = "en";
let attendanceRecords = [];

// Strict multi-tenant normalizers
function cleanSchool(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function cleanClass(v) {
  return (v || "").toString().replace(/^class\s*/i, "").trim().toLowerCase();
}

// Localization Dictionary
const tDict = {
  en: {
    navTitle: "Teacher Portal",
    logout: "Logout",
    tabQp: "📝 Question Papers",
    tabHw: "📚 Assign Homework",
    tabMat: "📖 Notes & Materials",
    tabNotices: "📢 Notice Board",
    tabRoster: "👥 Student Roster",
    tabAttendance: "📅 Attendance",
    tabResults: "📊 Enter Marks",
    qpPublished: "Question paper published successfully!",
    hwAssigned: "Homework assigned successfully!",
    matPublished: "Study material shared successfully!",
    noticePosted: "School notice broadcasted successfully!",
    attendanceSaved: "Attendance saved successfully!",
    marksSaved: "Exam marks saved successfully!",
    confirmDelete: "Are you sure you want to delete this question paper?",
    deleteSuccess: "Question paper deleted successfully!",
    noPapers: "No question papers published by your school yet.",
    noStudentsRoster: "No students found for your school under this selection.",
    noStudentsAttendance: "No students registered for this class and section.",
    selectDateAlert: "Please select a date for attendance."
  },
  ta: {
    navTitle: "ஆசிரியர் தளம்",
    logout: "வெளியேறு",
    tabQp: "📝 வினாத்தாள்கள்",
    tabHw: "📚 வீட்டுப்பாடம் வழங்கு",
    tabMat: "📖 பாடக் குறிப்புகள்",
    tabNotices: "📢 அறிவிப்புப் பலகை",
    tabRoster: "👥 மாணவர் பட்டியல்",
    tabAttendance: "📅 வருகைப் பதிவு",
    tabResults: "📊 மதிப்பெண் பதிவேற்று",
    qpPublished: "வினாத்தாள் வெற்றிகரமாக பதிவேற்றப்பட்டது!",
    hwAssigned: "வீட்டுப்பாடம் வெற்றிகரமாக ஒதுக்கப்பட்டது!",
    matPublished: "பாடக் குறிப்பு வெற்றிகரமாக பகிரப்பட்டது!",
    noticePosted: "பள்ளி அறிவிப்பு வெற்றிகரமாக வெளியிடப்பட்டது!",
    attendanceSaved: "வருகைப் பதிவு வெற்றிகரமாக சேமிக்கப்பட்டது!",
    marksSaved: "தேர்வு மதிப்பெண்கள் வெற்றிகரமாக சேமிக்கப்பட்டது!",
    confirmDelete: "இந்த வினாத்தாளை நிச்சயமாக நீக்க விரும்புகிறீர்களா?",
    deleteSuccess: "வினாத்தாள் வெற்றிகரமாக நீக்கப்பட்டது!",
    noPapers: "உங்கள் பள்ளிக்கான வினாத்தாள்கள் எதுவும் இல்லை.",
    noStudentsRoster: "உங்கள் பள்ளியில் இந்த வகுப்பில் மாணவர்கள் யாரும் இல்லை.",
    noStudentsAttendance: "இந்த வகுப்பிற்கு மாணவர்கள் பதிவு செய்யப்படவில்லை.",
    selectDateAlert: "வருகைப் பதிவிற்கு ஒரு தேதியைத் தேர்ந்தெடுக்கவும்."
  }
};
document.addEventListener("DOMContentLoaded", () => {
  setupLanguageHandlers();
  
  // Set default attendance date to today
  const attDateInput = document.getElementById("att-date");
  if (attDateInput) {
    attDateInput.value = new Date().toISOString().split("T")[0];
  }
});

function setupLanguageHandlers() {
  const btnEn = document.getElementById("btn-en");
  const btnTa = document.getElementById("btn-ta");

  if (btnEn && btnTa) {
    btnEn.addEventListener("click", () => {
      currentLang = "en";
      btnEn.classList.add("active");
      btnTa.classList.remove("active");
      applyTeacherTranslations();
    });

    btnTa.addEventListener("click", () => {
      currentLang = "ta";
      btnTa.classList.add("active");
      btnEn.classList.remove("active");
      applyTeacherTranslations();
    });
  }
}

function applyTeacherTranslations() {
  const t = tDict[currentLang];
  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt("nav-title", t.navTitle);
  setTxt("btn-logout", t.logout);
  setTxt("tab-btn-qp", t.tabQp);
  setTxt("tab-btn-hw", t.tabHw);
  setTxt("tab-btn-mat", t.tabMat);
  setTxt("tab-btn-notices", t.tabNotices);
  setTxt("tab-btn-roster", t.tabRoster);
  setTxt("tab-btn-attendance", t.tabAttendance);
  setTxt("tab-btn-results", t.tabResults);
}

// Authentication State Monitor with Strict Role Verification
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      currentTeacher = userDoc.data();

      // Guard: Role must strictly be teacher
      if (currentTeacher.role !== "teacher") {
        window.location.href = "student-dashboard.html";
        return;
      }

      const nameEl = document.getElementById("teacher-name");
      const schoolEl = document.getElementById("teacher-school");
      if (nameEl) nameEl.textContent = currentTeacher.fullName || "Teacher";
      if (schoolEl) schoolEl.textContent = `School: ${currentTeacher.schoolName || "EduPortal School"}`;

      applyTeacherTranslations();
      await loadQuestionPapersList();
    } else {
      window.location.href = "login.html";
    }
  } catch (err) {
    console.error("Teacher authentication error:", err);
  }
});

// Logout handler
document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});
// 1. PUBLISH EXAM QUESTION PAPER
const formQp = document.getElementById("form-qp");

if (formQp) {
  formQp.addEventListener("submit", async (e) => {
    e.preventDefault();

    const qpTypeSelect = document.getElementById("qp-type");
    let examName = qpTypeSelect ? qpTypeSelect.value : "Mid-Term 1";

    if (examName === "Custom") {
      const customInput = document.getElementById("qp-custom-name");
      examName = customInput ? customInput.value.trim() : "Custom Test";
    }

    const subject = (document.getElementById("qp-subject")?.value || "").trim();
    const board = document.getElementById("qp-board")?.value || "State Board";
    const className = document.getElementById("qp-class")?.value || "Class 6";
    const section = (
      document.getElementById("qp-section")?.value || 
      document.getElementById("qp-sec")?.value || 
      "All"
    ).trim();

    const totalMarks = Number(
      document.getElementById("qp-marks")?.value || 
      document.getElementById("qp-total-marks")?.value
    ) || 100;

    const examDate = (
      document.getElementById("qp-date")?.value || 
      document.getElementById("qp-exam-date")?.value || 
      ""
    ).trim();

    const typedContent = document.getElementById("qp-typed-content")?.value.trim() || "";
    const fileLink = document.getElementById("qp-file-link")?.value.trim() || "";

    const isUploadMode = document.getElementById("btn-mode-upload")?.classList.contains("active");
    const formatMode = isUploadMode ? "upload" : "type";

    if (formatMode === "type" && !typedContent) {
      alert("Please enter the question paper questions or draft with AI.");
      return;
    }

    if (formatMode === "upload" && !fileLink) {
      alert("Please enter the Google Drive / Document link for this question paper.");
      return;
    }

    const submitBtn = document.getElementById("btn-publish-qp");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Publishing...";
    }

    try {
      await addDoc(collection(db, "question_papers"), {
        examName: examName,
        subject: subject,
        board: board,
        className: className,
        section: section,
        totalMarks: totalMarks,
        examDate: examDate,
        formatMode: formatMode,
        typedContent: formatMode === "type" ? typedContent : "",
        fileLink: formatMode === "upload" ? fileLink : "",
        schoolName: currentTeacher?.schoolName || "",
        teacherId: auth.currentUser ? auth.currentUser.uid : "",
        teacherName: currentTeacher?.fullName || "Teacher",
        createdAt: new Date().toISOString()
      });

      alert(tDict[currentLang].qpPublished);
      formQp.reset();

      document.getElementById("btn-mode-type")?.click();
      await loadQuestionPapersList();
    } catch (err) {
      alert("Error publishing paper: " + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Publish Question Paper";
      }
    }
  });
        }
// 2. LOAD PUBLISHED QUESTION PAPERS (STRICT SCHOOL FILTER)
async function loadQuestionPapersList() {
  const container = document.getElementById("qp-list-container");
  if (!container) return;

  try {
    const snap = await getDocs(collection(db, "question_papers"));
    const teacherSchool = cleanSchool(currentTeacher?.schoolName);
    const items = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const paperSchool = cleanSchool(data.schoolName);

      // Strict institutional match
      if (Boolean(paperSchool) && Boolean(teacherSchool) && paperSchool === teacherSchool) {
        items.push({ id: docSnap.id, ...data });
      }
    });

    if (items.length === 0) {
      container.innerHTML = `<p style="font-size:13px; color:#64748b;">${tDict[currentLang].noPapers}</p>`;
      return;
    }

    container.innerHTML = items.map((qp) => `
      <div class="card-entry" id="paper_item_${qp.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h4>${qp.examName} - ${qp.subject} (${qp.board || "State Board"})</h4>
            <div class="card-meta">
              ${qp.className} - Section ${qp.section || "All"} | Marks: ${qp.totalMarks} | Date: ${qp.examDate || "-"}
            </div>
          </div>
          <button type="button" class="btn-delete-qp" data-id="${qp.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; border-radius:6px; padding:4px 8px; font-size:12px; cursor:pointer;">
            🗑️ Delete
          </button>
        </div>

        ${qp.formatMode === "type" 
          ? `<p style="font-size:13px; color:#334155; margin-top:8px; white-space:pre-wrap;">${qp.typedContent}</p>`
          : `<p style="font-size:13px; margin-top:8px;"><a href="${qp.fileLink}" target="_blank" style="color:#2563eb;">🔗 Open Drive Paper</a></p>`
        }
      </div>
    `).join("");

    container.querySelectorAll(".btn-delete-qp").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const paperId = btn.getAttribute("data-id");
        if (!paperId) return;

        const willDelete = confirm(tDict[currentLang].confirmDelete);
        if (!willDelete) return;

        try {
          await deleteDoc(doc(db, "question_papers", paperId));
          alert(tDict[currentLang].deleteSuccess);
          await loadQuestionPapersList();
        } catch (err) {
          alert("Error deleting paper: " + err.message);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p style="font-size:13px; color:#dc2626;">Error: ${err.message}</p>`;
  }
}

// 3. STUDENT ROSTER (STRICT SCHOOL ISOLATION)
async function loadStudentRoster() {
  const tbody = document.getElementById("roster-tbody");
  if (!tbody || !currentTeacher?.schoolName) return;

  const teacherSchool = cleanSchool(currentTeacher.schoolName);
  const filterClass = document.getElementById("roster-filter-class")?.value || "All";
  const filterSec = document.getElementById("roster-filter-sec")?.value || "All";

  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "student")
    );
    const snap = await getDocs(q);
    const students = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const studentSchool = cleanSchool(data.schoolName);

      // Strict school match: zero cross-institution leakage
      const matchesSchool = Boolean(teacherSchool) && Boolean(studentSchool) && teacherSchool === studentSchool;

      if (matchesSchool) {
        const sClass = cleanClass(data.className);
        const sSec = (data.section || "").trim().toUpperCase();

        const matchClass = filterClass === "All" || sClass === cleanClass(filterClass);
        const matchSec = filterSec === "All" || sSec === filterSec.toUpperCase();

        if (matchClass && matchSec) {
          students.push(data);
        }
      }
    });

    students.sort((a, b) => (a.rollNumber || "").localeCompare(b.rollNumber || ""));

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 14px; color: #64748b;">${tDict[currentLang].noStudentsRoster}</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map((s) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 600;">${s.rollNumber || "-"}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1;">${s.fullName || "-"}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1;">Class ${s.className || "-"} - ${s.section || "-"}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1;">${s.board || "State Board"}</td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #dc2626; padding: 14px;">Error: ${err.message}</td></tr>`;
  }
}

document.getElementById("roster-filter-class")?.addEventListener("change", loadStudentRoster);
document.getElementById("roster-filter-sec")?.addEventListener("change", loadStudentRoster);
document.getElementById("tab-btn-roster")?.addEventListener("click", loadStudentRoster);
// 4. DAILY ATTENDANCE (STRICT SCHOOL ISOLATION)
document.getElementById("btn-load-att-students")?.addEventListener("click", async () => {
  const container = document.getElementById("att-students-container");
  const saveBtn = document.getElementById("btn-save-attendance");
  const selectedClass = cleanClass(document.getElementById("att-class")?.value);
  const selectedSec = (document.getElementById("att-sec")?.value || "").trim().toUpperCase();

  if (!container || !currentTeacher?.schoolName) return;
  const teacherSchool = cleanSchool(currentTeacher.schoolName);

  container.innerHTML = "<p style='color: #64748b; font-size: 13px;'>Loading students...</p>";

  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "student")
    );
    const snap = await getDocs(q);
    const students = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const studentSchool = cleanSchool(data.schoolName);

      // Strict school match
      if (Boolean(teacherSchool) && Boolean(studentSchool) && teacherSchool === studentSchool) {
        if (cleanClass(data.className) === selectedClass && (data.section || "").trim().toUpperCase() === selectedSec) {
          students.push({ uid: docSnap.id, ...data });
        }
      }
    });

    students.sort((a, b) => (a.rollNumber || "").localeCompare(b.rollNumber || ""));

    if (students.length === 0) {
      container.innerHTML = `<p style="color: #64748b; font-size: 13px;">${tDict[currentLang].noStudentsAttendance}</p>`;
      if (saveBtn) saveBtn.classList.add("hidden");
      return;
    }

    // Default status: Present
    attendanceRecords = students.map((s) => ({
      uid: s.uid,
      rollNumber: s.rollNumber,
      fullName: s.fullName,
      status: "Present"
    }));

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
        <thead>
          <tr style="background: #e2e8f0; color: #1e1b4b;">
            <th style="padding: 10px; border: 1px solid #cbd5e1;">Roll No</th>
            <th style="padding: 10px; border: 1px solid #cbd5e1;">Student Name</th>
            <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((s, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 600;">${s.rollNumber}</td>
              <td style="padding: 10px; border: 1px solid #cbd5e1;">${s.fullName}</td>
              <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">
                <label style="margin-right: 12px; cursor: pointer; color: #166534; font-weight: 600;">
                  <input type="radio" name="att_status_${idx}" value="Present" checked data-idx="${idx}" class="att-radio" /> Present
                </label>
                <label style="cursor: pointer; color: #991b1b; font-weight: 600;">
                  <input type="radio" name="att_status_${idx}" value="Absent" data-idx="${idx}" class="att-radio" /> Absent
                </label>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    container.querySelectorAll(".att-radio").forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const idx = Number(e.target.getAttribute("data-idx"));
        if (attendanceRecords[idx]) {
          attendanceRecords[idx].status = e.target.value;
        }
      });
    });

    if (saveBtn) saveBtn.classList.remove("hidden");
  } catch (err) {
    container.innerHTML = `<p style="color: #dc2626; font-size: 13px;">Error: ${err.message}</p>`;
  }
});

document.getElementById("btn-save-attendance")?.addEventListener("click", async () => {
  const dateVal = document.getElementById("att-date")?.value;
  const classVal = document.getElementById("att-class")?.value;
  const secVal = document.getElementById("att-sec")?.value;
  const saveBtn = document.getElementById("btn-save-attendance");

  if (!dateVal) {
    alert(tDict[currentLang].selectDateAlert);
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    await addDoc(collection(db, "attendance"), {
      date: dateVal,
      className: classVal,
      section: secVal,
      records: attendanceRecords,
      schoolName: currentTeacher?.schoolName || "",
      teacherId: auth.currentUser ? auth.currentUser.uid : "",
      createdAt: new Date().toISOString()
    });

    alert(tDict[currentLang].attendanceSaved);
    document.getElementById("att-students-container").innerHTML = "<p style='color: #166534; font-size: 13px; font-weight: 600;'>✓ Attendance saved successfully for this session.</p>";
    if (saveBtn) saveBtn.classList.add("hidden");
  } catch (err) {
    alert("Error saving attendance: " + err.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Attendance";
    }
  }
});
// 5. ASSIGN HOMEWORK
const formHw = document.getElementById("form-hw");

if (formHw) {
  formHw.addEventListener("submit", async (e) => {
    e.preventDefault();

    const subject = document.getElementById("hw-subject")?.value.trim() || "";
    const title = document.getElementById("hw-title")?.value.trim() || "";
    const className = document.getElementById("hw-class")?.value || "Class 6";
    const section = document.getElementById("hw-section")?.value || "All";
    const deadline = document.getElementById("hw-deadline")?.value || "";
    const instructions = document.getElementById("hw-instructions")?.value.trim() || "";
    const link = document.getElementById("hw-link")?.value.trim() || "";

    try {
      await addDoc(collection(db, "homework"), {
        subject: subject,
        title: title,
        className: className,
        section: section,
        deadline: deadline,
        instructions: instructions,
        link: link,
        schoolName: currentTeacher?.schoolName || "",
        teacherId: auth.currentUser ? auth.currentUser.uid : "",
        createdAt: new Date().toISOString()
      });

      alert(tDict[currentLang].hwAssigned);
      formHw.reset();
    } catch (err) {
      alert("Error assigning homework: " + err.message);
    }
  });
}

// 6. PUBLISH STUDY MATERIALS & NOTES
const formMat = document.getElementById("form-mat");

if (formMat) {
  formMat.addEventListener("submit", async (e) => {
    e.preventDefault();

    const subject = document.getElementById("mat-subject")?.value.trim() || "";
    const title = document.getElementById("mat-title")?.value.trim() || "";
    const className = document.getElementById("mat-class")?.value || "Class 6";
    const section = document.getElementById("mat-section")?.value || "All";
    const link = document.getElementById("mat-link")?.value.trim() || "";

    try {
      await addDoc(collection(db, "materials"), {
        subject: subject,
        title: title,
        className: className,
        section: section,
        link: link,
        schoolName: currentTeacher?.schoolName || "",
        teacherId: auth.currentUser ? auth.currentUser.uid : "",
        createdAt: new Date().toISOString()
      });

      alert(tDict[currentLang].matPublished);
      formMat.reset();
    } catch (err) {
      alert("Error sharing study material: " + err.message);
    }
  });
}

// 7. POST SCHOOL NOTICE
const formNotice = document.getElementById("form-notice");

if (formNotice) {
  formNotice.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("notice-title")?.value.trim() || "";
    const details = document.getElementById("notice-details")?.value.trim() || "";

    try {
      await addDoc(collection(db, "notices"), {
        title: title,
        details: details,
        schoolName: currentTeacher?.schoolName || "",
        teacherName: currentTeacher?.fullName || "Teacher",
        createdAt: new Date().toISOString()
      });

      alert(tDict[currentLang].noticePosted);
      formNotice.reset();
    } catch (err) {
      alert("Error posting notice: " + err.message);
    }
  });
}

// 8. RECORD STUDENT EXAM MARKS
const formResults = document.getElementById("form-results");

if (formResults) {
  formResults.addEventListener("submit", async (e) => {
    e.preventDefault();

    const examName = document.getElementById("res-exam-name")?.value.trim() || "";
    const subject = document.getElementById("res-subject")?.value.trim() || "";
    const rollNumber = document.getElementById("res-roll")?.value.trim() || "";
    const marksScored = Number(document.getElementById("res-scored")?.value) || 0;
    const totalMarks = Number(document.getElementById("res-total")?.value) || 100;

    try {
      await addDoc(collection(db, "exam_results"), {
        examName: examName,
        subject: subject,
        rollNumber: rollNumber,
        marksScored: marksScored,
        totalMarks: totalMarks,
        schoolName: currentTeacher?.schoolName || "",
        teacherId: auth.currentUser ? auth.currentUser.uid : "",
        createdAt: new Date().toISOString()
      });

      alert(tDict[currentLang].marksSaved);
      formResults.reset();
    } catch (err) {
      alert("Error saving exam marks: " + err.message);
    }
  });
}

// Module exports
export {
  loadQuestionPapersList,
  loadStudentRoster,
  currentTeacher
};

