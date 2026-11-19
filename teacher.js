import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global Cache & State
let currentTeacher = null;
let cachedStudents = [];
let cachedHomework = [];
let cachedQPs = [];
let currentLang = "en";
let qpFormatMode = "type";

// Translation Dictionary
const tDict = {
  en: {
    noStudents: "No students found",
    loadingStudents: "Loading students...",
    attendanceSaved: "Attendance recorded successfully!",
    qpPublished: "Question Paper Published Successfully!",
    hwPublished: "Homework published successfully!",
    matUploaded: "Study material uploaded successfully!",
    resultSaved: "Exam result saved successfully!",
    noticePublished: "Notice published successfully!",
    noQp: "No question papers published yet.",
    noHw: "No homework posted yet.",
    noSub: "No submissions yet.",
    noMat: "No study materials posted.",
    noResults: "No results recorded.",
    noNotices: "No notices posted."
  },
  ta: {
    noStudents: "மாணவர்கள் யாரும் இல்லை",
    loadingStudents: "மாணவர்கள் பட்டியல் ஏற்றப்படுகிறது...",
    attendanceSaved: "வருகைப் பதிவு வெற்றிகரமாகச் சேமிக்கப்பட்டது!",
    qpPublished: "வினாத்தாள் வெற்றிகரமாக வெளியிடப்பட்டது!",
    hwPublished: "வீட்டுப்பாடம் வெற்றிகரமாக வெளியிடப்பட்டது!",
    matUploaded: "பாடக் குறிப்பு வெற்றிகரமாக பதிவேற்றப்பட்டது!",
    resultSaved: "தேர்வு முடிவு சேமிக்கப்பட்டது!",
    noticePublished: "அறிவிப்பு வெளியிடப்பட்டது!",
    noQp: "வினாத்தாள்கள் எதுவும் இல்லை.",
    noHw: "வீட்டுப்பாடங்கள் எதுவும் இல்லை.",
    noSub: "சமர்ப்பிப்புகள் எதுவும் இல்லை.",
    noMat: "பாடக் குறிப்புகள் எதுவும் இல்லை.",
    noResults: "தேர்வு முடிவுகள் எதுவும் இல்லை.",
    noNotices: "அறிவிப்புகள் எதுவும் இல்லை."
  }
};

// Immediate DOM Setup
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupLanguage();
  setupExamToggles();
});

// Instant Responsive Tab Switcher
function setupTabs() {
  const tabBtns = document.querySelectorAll(".nav-tab-btn");
  const panels = document.querySelectorAll(".panel-box");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      tabBtns.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.add("hidden"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.remove("hidden");
      }

      if (targetId === "tab-submissions") {
        loadSubmissions();
      }
    });
  });
}

// Question Paper Mode Toggle (Type vs Drive Upload)
function setupExamToggles() {
  const btnType = document.getElementById("btn-mode-type");
  const btnUpload = document.getElementById("btn-mode-upload");
  const boxType = document.getElementById("mode-type-container");
  const boxUpload = document.getElementById("mode-upload-container");

  if (btnType && btnUpload) {
    btnType.addEventListener("click", () => {
      qpFormatMode = "type";
      btnType.classList.add("active");
      btnUpload.classList.remove("active");
      if (boxType) boxType.classList.remove("hidden");
      if (boxUpload) boxUpload.classList.add("hidden");
    });

    btnUpload.addEventListener("click", () => {
      qpFormatMode = "upload";
      btnUpload.classList.add("active");
      btnType.classList.remove("active");
      if (boxUpload) boxUpload.classList.remove("hidden");
      if (boxType) boxType.classList.add("hidden");
    });
  }

  const qpExamSelect = document.getElementById("qp-exam-type");
  const boxCustomExam = document.getElementById("box-custom-exam");
  if (qpExamSelect && boxCustomExam) {
    qpExamSelect.addEventListener("change", () => {
      boxCustomExam.classList.toggle("hidden", qpExamSelect.value !== "Custom");
    });
  }
}

// Language Toggle Setup
function setupLanguage() {
  const btnEn = document.getElementById("btn-en");
  const btnTa = document.getElementById("btn-ta");

  if (btnEn && btnTa) {
    btnEn.addEventListener("click", () => {
      currentLang = "en";
      btnEn.classList.add("active");
      btnTa.classList.remove("active");
      renderRoster();
      renderAttendanceList();
    });

    btnTa.addEventListener("click", () => {
      currentLang = "ta";
      btnTa.classList.add("active");
      btnEn.classList.remove("active");
      renderRoster();
      renderAttendanceList();
    });
  }
}

function safeText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}
// Authentication & Initial Profile Load
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      currentTeacher = snap.data();
      safeText("teacher-name", currentTeacher.fullName || "Teacher");
      safeText("school-name", currentTeacher.schoolName || "EduPortal School");
    }
  } catch (err) {
    console.error("Auth profile error:", err);
  } finally {
    // Refresh all data regardless of profile retrieval errors
    refreshAllData();
  }
});

// Logout Handler
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// Data Hydration Pipeline
async function refreshAllData() {
  await Promise.allSettled([
    loadStudents(),
    loadQuestionPapers(),
    loadHomeworkList(),
    loadMaterialsList(),
    loadResultsList(),
    loadNoticesList()
  ]);
}

// 1. STUDENTS ROSTER
async function loadStudents() {
  const tbody = document.getElementById("roster-tbody");
  try {
    const q = query(collection(db, "users"), where("role", "==", "student"));
    const snap = await getDocs(q);
    cachedStudents = [];
    snap.forEach((d) => cachedStudents.push({ id: d.id, ...d.data() }));

    safeText("stat-students", cachedStudents.length);
    renderRoster();
    renderAttendanceList();
  } catch (err) {
    console.error("Error loading students:", err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#dc2626;">Error: ${err.message}</td></tr>`;
  }
}

function renderRoster() {
  const tbody = document.getElementById("roster-tbody");
  if (!tbody) return;
  const search = (document.getElementById("roster-search")?.value || "").toLowerCase();
  const clsFilter = document.getElementById("roster-class-filter")?.value || "All";
  const secFilter = document.getElementById("roster-sec-filter")?.value || "All";

  const list = cachedStudents.filter((s) => {
    const sCls = (s.className || "").toString().replace(/^class\s*/i, "").trim().toLowerCase();
    const tCls = clsFilter.replace(/^class\s*/i, "").trim().toLowerCase();
    const matchCls = clsFilter === "All" || sCls === tCls;

    const sSec = (s.section || "").trim().toUpperCase();
    const tSec = secFilter.trim().toUpperCase();
    const matchSec = secFilter === "All" || sSec === tSec;

    const matchSearch = !search ||
      (s.fullName && s.fullName.toLowerCase().includes(search)) ||
      (s.rollNumber && s.rollNumber.toString().includes(search));

    return matchCls && matchSec && matchSearch;
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;">${tDict[currentLang].noStudents}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((s) => `
    <tr>
      <td><strong>${s.rollNumber || "-"}</strong></td>
      <td>${s.fullName || "-"}</td>
      <td>Class ${s.className || "-"}</td>
      <td>Section - ${s.section || "-"}</td>
      <td>${s.board || "State Board"}</td>
    </tr>
  `).join("");
}

document.getElementById("roster-search")?.addEventListener("input", renderRoster);
document.getElementById("roster-class-filter")?.addEventListener("change", renderRoster);
document.getElementById("roster-sec-filter")?.addEventListener("change", renderRoster);

// 2. ATTENDANCE MANAGEMENT
function renderAttendanceList() {
  const container = document.getElementById("att-student-list");
  if (!container) return;
  const clsVal = (document.getElementById("att-class-select")?.value || "").trim().toLowerCase();
  const secVal = (document.getElementById("att-sec-select")?.value || "").trim().toUpperCase();

  const list = cachedStudents.filter((s) => {
    const sCls = (s.className || "").toString().replace(/^class\s*/i, "").trim().toLowerCase();
    const sSec = (s.section || "").trim().toUpperCase();
    return sCls === clsVal && sSec === secVal;
  });

  if (list.length === 0) {
    container.innerHTML = `<p style="color:#64748b;font-size:13px;">No students registered for Class ${clsVal} - Sec ${secVal}.</p>`;
    return;
  }

  container.innerHTML = list.map((s) => `
    <div class="att-row" data-id="${s.id}" data-roll="${s.rollNumber}">
      <div class="att-name">${s.rollNumber} - ${s.fullName}</div>
      <div class="att-options">
        <label><input type="radio" name="att_${s.id}" value="P" checked /> P</label>
        <label><input type="radio" name="att_${s.id}" value="A" /> A</label>
        <label><input type="radio" name="att_${s.id}" value="L" /> L</label>
      </div>
    </div>
  `).join("");
}

document.getElementById("att-class-select")?.addEventListener("change", renderAttendanceList);
document.getElementById("att-sec-select")?.addEventListener("change", renderAttendanceList);

document.getElementById("btn-save-attendance")?.addEventListener("click", async () => {
  const rows = document.querySelectorAll(".att-row");
  const records = [];
  rows.forEach((r) => {
    const id = r.getAttribute("data-id");
    const roll = r.getAttribute("data-roll");
    const val = r.querySelector(`input[name="att_${id}"]:checked`)?.value || "P";
    records.push({ studentId: id, rollNumber: roll, status: val });
  });

  const dateInput = document.getElementById("att-date");
  const dateVal = dateInput?.value || new Date().toISOString().split("T")[0];

  try {
    await addDoc(collection(db, "attendance"), {
      date: dateVal,
      className: document.getElementById("att-class-select").value,
      section: document.getElementById("att-sec-select").value,
      records: records,
      schoolName: currentTeacher?.schoolName || "",
      createdAt: new Date().toISOString()
    });
    alert(tDict[currentLang].attendanceSaved);
  } catch (err) {
    alert("Error: " + err.message);
  }
});
// 3. EXAM QUESTION PAPERS
document.getElementById("form-qp")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const qpType = document.getElementById("qp-exam-type").value;
  const examName = qpType === "Custom" 
    ? document.getElementById("qp-custom-name").value.trim() 
    : qpType;

  if (!examName) {
    alert("Please enter the exam name.");
    return;
  }

  const typedContent = document.getElementById("qp-typed-text")?.value.trim() || "";
  const fileLink = document.getElementById("qp-file-link")?.value.trim() || "";

  if (qpFormatMode === "type" && !typedContent) {
    alert("Please write the question paper content.");
    return;
  }
  if (qpFormatMode === "upload" && !fileLink) {
    alert("Please provide the drive or file link.");
    return;
  }

  try {
    await addDoc(collection(db, "question_papers"), {
      examName: examName,
      subject: document.getElementById("qp-subject").value.trim(),
      board: document.getElementById("qp-board").value,
      className: document.getElementById("qp-class").value,
      section: document.getElementById("qp-sec").value,
      totalMarks: Number(document.getElementById("qp-total-marks").value) || 100,
      examDate: document.getElementById("qp-exam-date").value,
      formatMode: qpFormatMode,
      typedContent: typedContent,
      fileLink: fileLink,
      schoolName: currentTeacher?.schoolName || "",
      teacherName: currentTeacher?.fullName || "Teacher",
      createdAt: new Date().toISOString()
    });

    alert(tDict[currentLang].qpPublished);
    e.target.reset();
    loadQuestionPapers();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

async function loadQuestionPapers() {
  const container = document.getElementById("qp-list-container");
  try {
    const snap = await getDocs(collection(db, "question_papers"));
    cachedQPs = [];
    snap.forEach((d) => cachedQPs.push({ id: d.id, ...d.data() }));
    safeText("stat-exams", cachedQPs.length);

    if (!container) return;
    if (cachedQPs.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">${tDict[currentLang].noQp}</p>`;
      return;
    }

    container.innerHTML = cachedQPs.map((qp) => `
      <div class="card-entry">
        <h4>${qp.examName} - ${qp.subject} (${qp.board || "State Board"})</h4>
        <div class="card-meta">Class ${qp.className} - Section ${qp.section || "All"} | Total Marks: ${qp.totalMarks}</div>
        ${qp.formatMode === "type" 
          ? `<div class="card-desc">${qp.typedContent}</div>` 
          : `<a class="link-attach" href="${qp.fileLink}" target="_blank">📄 Open Question Paper PDF / Link</a>`}
      </div>
    `).join("");
  } catch (err) {
    console.error("Error loading question papers:", err);
  }
}

// 4. HOMEWORK MANAGEMENT
document.getElementById("form-hw")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await addDoc(collection(db, "homework"), {
      title: document.getElementById("hw-title").value.trim(),
      subject: document.getElementById("hw-subject").value.trim(),
      className: document.getElementById("hw-class").value,
      section: document.getElementById("hw-sec").value,
      deadline: document.getElementById("hw-deadline").value,
      instructions: document.getElementById("hw-instructions")?.value.trim() || "",
      link: document.getElementById("hw-link")?.value.trim() || "",
      schoolName: currentTeacher?.schoolName || "",
      teacherName: currentTeacher?.fullName || "Teacher",
      createdAt: new Date().toISOString()
    });

    alert(tDict[currentLang].hwPublished);
    e.target.reset();
    loadHomeworkList();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

async function loadHomeworkList() {
  const container = document.getElementById("hw-list-container");
  const filter = document.getElementById("submission-hw-filter");
  try {
    const snap = await getDocs(collection(db, "homework"));
    cachedHomework = [];
    snap.forEach((d) => cachedHomework.push({ id: d.id, ...d.data() }));
    safeText("stat-homework", cachedHomework.length);

    if (filter) {
      filter.innerHTML = cachedHomework.length === 0
        ? `<option value="">${tDict[currentLang].noHw}</option>`
        : cachedHomework.map((h) => `<option value="${h.id}">${h.title} (Class ${h.className} - ${h.section})</option>`).join("");
    }

    if (!container) return;
    if (cachedHomework.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">${tDict[currentLang].noHw}</p>`;
      return;
    }

    container.innerHTML = cachedHomework.map((hw) => `
      <div class="card-entry">
        <h4>${hw.title} (${hw.subject})</h4>
        <div class="card-meta">Class ${hw.className} - Sec ${hw.section} | Due: ${hw.deadline}</div>
        <p class="card-desc">${hw.instructions || ""}</p>
        ${hw.link ? `<a class="link-attach" href="${hw.link}" target="_blank">🔗 Assignment Link</a><br/>` : ""}
      </div>
    `).join("");
  } catch (err) {
    console.error("Error loading homework:", err);
  }
}
// 5. SUBMISSIONS REVIEW
async function loadSubmissions() {
  const tbody = document.getElementById("submission-tbody");
  const hwId = document.getElementById("submission-hw-filter")?.value;
  if (!tbody) return;

  if (!hwId) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;">${tDict[currentLang].noHw}</td></tr>`;
    return;
  }

  try {
    const q = query(collection(db, "homework_submissions"), where("homeworkId", "==", hwId));
    const snap = await getDocs(q);
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;">${tDict[currentLang].noSub}</td></tr>`;
      return;
    }

    tbody.innerHTML = snap.docs.map((docSnap) => {
      const sub = docSnap.data();
      const isLink = sub.answer?.startsWith("http");
      const answerHtml = isLink 
        ? `<a href="${sub.answer}" target="_blank" style="color:#2563eb;text-decoration:underline;">🔗 Open Link</a>` 
        : (sub.answer || "-");

      return `
        <tr>
          <td><strong>${sub.rollNumber || "-"}</strong></td>
          <td>${sub.studentName || "-"}</td>
          <td>Class ${sub.className} - ${sub.section}</td>
          <td>${answerHtml}</td>
          <td>${sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "-"}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#dc2626;">Error: ${err.message}</td></tr>`;
  }
}

document.getElementById("submission-hw-filter")?.addEventListener("change", loadSubmissions);

// 6. STUDY MATERIALS
document.getElementById("form-mat")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await addDoc(collection(db, "materials"), {
      title: document.getElementById("mat-title").value.trim(),
      subject: document.getElementById("mat-subject").value.trim(),
      className: document.getElementById("mat-class").value,
      section: document.getElementById("mat-sec").value,
      link: document.getElementById("mat-link").value.trim(),
      schoolName: currentTeacher?.schoolName || "",
      createdAt: new Date().toISOString()
    });

    alert(tDict[currentLang].matUploaded);
    e.target.reset();
    loadMaterialsList();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

async function loadMaterialsList() {
  const container = document.getElementById("mat-list-container");
  if (!container) return;
  try {
    const snap = await getDocs(collection(db, "materials"));
    if (snap.empty) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">${tDict[currentLang].noMat}</p>`;
      return;
    }

    container.innerHTML = snap.docs.map((d) => {
      const m = d.data();
      return `
        <div class="card-entry">
          <h4>${m.title} - ${m.subject}</h4>
          <div class="card-meta">Class ${m.className} - Section ${m.section}</div>
          <a class="link-attach" href="${m.link}" target="_blank">🔗 Open Material Link</a>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading materials:", err);
  }
}

// 7. EXAM RESULTS
document.getElementById("form-results")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await addDoc(collection(db, "exam_results"), {
      examName: document.getElementById("res-exam-select").value,
      subject: document.getElementById("res-subject").value.trim(),
      className: document.getElementById("res-class").value,
      section: document.getElementById("res-sec").value,
      rollNumber: document.getElementById("res-roll").value.trim(),
      marksScored: Number(document.getElementById("res-marks").value),
      totalMarks: Number(document.getElementById("res-total").value) || 100,
      schoolName: currentTeacher?.schoolName || "",
      createdAt: new Date().toISOString()
    });

    alert(tDict[currentLang].resultSaved);
    e.target.reset();
    loadResultsList();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

async function loadResultsList() {
  const container = document.getElementById("res-list-container");
  if (!container) return;
  try {
    const snap = await getDocs(collection(db, "exam_results"));
    if (snap.empty) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">${tDict[currentLang].noResults}</p>`;
      return;
    }

    container.innerHTML = snap.docs.map((d) => {
      const r = d.data();
      return `
        <div class="card-entry">
          <h4>${r.examName} - ${r.subject}</h4>
          <div class="card-meta">Class ${r.className} - Section ${r.section} | Roll No: ${r.rollNumber}</div>
          <p class="card-desc">Marks: ${r.marksScored} / ${r.totalMarks}</p>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading results:", err);
  }
}

// 8. NOTICES
document.getElementById("form-notice")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await addDoc(collection(db, "notices"), {
      title: document.getElementById("notice-title").value.trim(),
      details: document.getElementById("notice-desc").value.trim(),
      schoolName: currentTeacher?.schoolName || "",
      createdAt: new Date().toISOString()
    });

    alert(tDict[currentLang].noticePublished);
    e.target.reset();
    loadNoticesList();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

async function loadNoticesList() {
  const container = document.getElementById("notice-list-container");
  if (!container) return;
  try {
    const snap = await getDocs(collection(db, "notices"));
    if (snap.empty) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">${tDict[currentLang].noNotices}</p>`;
      return;
    }

    container.innerHTML = snap.docs.map((d) => {
      const n = d.data();
      return `
        <div class="card-entry">
          <h4>${n.title}</h4>
          <p class="card-desc">${n.details}</p>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading notices:", err);
  }
}
