import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentStudent = null;
let currentLang = "en";
let fetchedResults = [];

// Strict multi-tenant normalizers
function cleanSchool(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function cleanClass(v) {
  return (v || "").toString().replace(/^class\s*/i, "").trim().toLowerCase();
}

function boardsMatch(b1, b2) {
  const norm1 = (b1 || "").trim().toLowerCase();
  const norm2 = (b2 || "").trim().toLowerCase();
  if (!norm1 || !norm2 || norm1 === "all" || norm2 === "all" || norm1 === norm2) return true;

  const isState1 = norm1.includes("state") || norm1.includes("samacheer");
  const isState2 = norm2.includes("state") || norm2.includes("samacheer");
  if (isState1 && isState2) return true;

  const isCbse1 = norm1.includes("cbse");
  const isCbse2 = norm2.includes("cbse");
  if (isCbse1 && isCbse2) return true;

  const isIcse1 = norm1.includes("icse");
  const isIcse2 = norm2.includes("icse");
  if (isIcse1 && isIcse2) return true;

  return false;
}

const dict = {
  en: {
    navTitle: "Education Portal V2.2",
    logout: "Logout",
    tabQp: "📝 Question Papers",
    tabHw: "📚 My Homework",
    tabAttendance: "📅 My Attendance",
    tabMat: "📖 Study Notes",
    tabNotices: "📢 Notices",
    tabResults: "📊 Report Card",
    titleQp: "Exam Question Papers & Write Answers",
    titleHw: "Assigned Homework",
    titleAttendance: "My Attendance & Academic Eligibility",
    titleMat: "Class Study Notes",
    titleNotices: "School Notice Board",
    titleResults: "My Exam Marks",
    thExamName: "Exam Name",
    thSubject: "Subject",
    thScore: "Score",
    thTotal: "Total",
    noQp: "No question papers published for your class and section yet.",
    noHw: "No homework assigned for your class and section right now.",
    noMat: "No study materials posted for your class and section yet.",
    noNotices: "No announcements posted on the notice board.",
    noResults: "No exam records found yet.",
    examDateWord: "Exam Date:",
    marksWord: "Total Marks:",
    deadlinePrefix: "Deadline:",
    viewResource: "🔗 View Assignment Resource",
    viewDriveMat: "🔗 Open Drive Study Material",
    openQpPdf: "📄 Open Official Question Paper Link",
    submitHwBtn: "Submit Homework",
    submitAnswersBtn: "Submit Exam Answers",
    writeAnswersHeader: "Write Your Exam Answers Below:",
    answerTextPlaceholder: "Type your answers here (e.g. Q1. Answer..., Q2. Answer...)...",
    driveOptionalPlaceholder: "Or paste handwritten answer sheet Google Drive link (Optional)...",
    examSubmitSuccess: "Exam answers submitted successfully!",
    hwSuccessAlert: "Homework submitted successfully!",
    enterAnswerAlert: "Please write an answer or paste a drive link first.",
    lblAttPct: "Attendance %",
    lblPresentDays: "Present Days",
    lblAbsentDays: "Absent Days",
    lblLateDays: "Late Days",
    lblMinPct: "Min Requirement",
    thAttDate: "Date",
    thAttStatus: "Status",
    thAttSession: "Class & Section",
    noAttendance: "No attendance records submitted for your class yet.",
    attEligible: "✓ Excellent! Your attendance satisfies the minimum 75% exam criterion.",
    attShortage: "⚠️ Attendance Shortage! Your attendance is below the 75% requirement. Please contact your class teacher.",
    btnDownloadPdf: "📥 Download PDF Report",
    pdfReportTitle: "Official Student Academic Progress Report",
    pdfNoData: "No exam records found to generate report."
  },
  ta: {
    navTitle: "கல்வி தளம் பதிப்பு 2.2",
    logout: "வெளியேறு",
    tabQp: "📝 வினாத்தாள்கள்",
    tabHw: "📚 என் வீட்டுப்பாடம்",
    tabAttendance: "📅 என் வருகைப் பதிவு",
    tabMat: "📖 பாடக் குறிப்புகள்",
    tabNotices: "📢 அறிவிப்புகள்",
    tabResults: "📊 மதிப்பெண் அட்டை",
    titleQp: "வினாத்தாள்கள் & விடை எழுதுதல்",
    titleHw: "வழங்கப்பட்ட வீட்டுப்பாடங்கள்",
    titleAttendance: "என் வருகைப் பதிவு & தேர்வு தகுதி",
    titleMat: "வகுப்பு பாடக் குறிப்புகள்",
    titleNotices: "பள்ளி அறிவிப்புப் பலகை",
    titleResults: "என் தேர்வு மதிப்பெண்கள்",
    thExamName: "தேர்வு பெயர்",
    thSubject: "பாடம்",
    thScore: "மதிப்பெண்",
    thTotal: "மொத்தம்",
    noQp: "உங்கள் பள்ளி மற்றும் வகுப்பிற்கு வினாத்தாள்கள் எதுவும் இல்லை.",
    noHw: "உங்கள் பள்ளி மற்றும் வகுப்பிற்கு வீட்டுப்பாடங்கள் எதுவும் இல்லை.",
    noMat: "உங்கள் வகுப்புக்கான பாடக் குறிப்புகள் எதுவும் பதிவேற்றப்படவில்லை.",
    noNotices: "அறிவிப்புகள் எதுவும் இல்லை.",
    noResults: "தேர்வு பதிவுகள் எதுவும் இல்லை.",
    examDateWord: "தேர்வு தேதி:",
    marksWord: "மொத்த மதிப்பெண்கள்:",
    deadlinePrefix: "கடைசி நாள்:",
    viewResource: "🔗 வீட்டுப்பாட குறிப்பை பார்க்கவும்",
    viewDriveMat: "🔗 டிரைவ் பாட குறிப்பை திறக்கவும்",
    openQpPdf: "📄 அதிகாரப்பூர்வ வினாத்தாள் இணைப்பை திறக்கவும்",
    submitHwBtn: "வீட்டுப்பாடம் சமர்ப்பி",
    submitAnswersBtn: "தேர்வு விடைகளை சமர்ப்பி",
    writeAnswersHeader: "உங்கள் தேர்வு விடைகளை கீழே எழுதவும்:",
    answerTextPlaceholder: "உங்கள் விடைகளை இங்கே தட்டச்சு செய்யவும் (எ.கா: கேள்வி 1. விடை...)...",
    driveOptionalPlaceholder: "அல்லது கையால் எழுதிய விடைத்தாள் டிரைவ் இணைப்பை உள்ளிடவும்...",
    examSubmitSuccess: "தேர்வு விடைகள் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!",
    hwSuccessAlert: "வீட்டுப்பாடம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!",
    enterAnswerAlert: "முதலில் உங்கள் விடை அல்லது இணைப்பை உள்ளிடவும்.",
    lblAttPct: "வருகை %",
    lblPresentDays: "வந்த நாட்கள்",
    lblAbsentDays: "வராத நாட்கள்",
    lblLateDays: "தாமதமான நாட்கள்",
    lblMinPct: "குறைந்தபட்ச தேவை",
    thAttDate: "தேதி",
    thAttStatus: "நிலை",
    thAttSession: "வகுப்பு & பிரிவு",
    noAttendance: "உங்கள் வகுப்பிற்கு வருகைப் பதிவு விவரங்கள் எதுவும் இல்லை.",
    attEligible: "✓ சிறப்பு! உங்கள் வருகை குறைந்தபட்ச 75% தேர்வு தகுதி வரம்பை பூர்த்தி செய்கிறது.",
    attShortage: "⚠️ வருகைப் பற்றாக்குறை! உங்கள் வருகை 75% வரம்பிற்கு கீழ் உள்ளது. உங்கள் வகுப்பு ஆசிரியரை அணுகவும்.",
    btnDownloadPdf: "📥 PDF பதிவிறக்கு",
    pdfReportTitle: "அதிகாரப்பூர்வ மாணவர் கல்வி முன்னேற்ற அறிக்கை",
    pdfNoData: "அறிக்கையை உருவாக்க தேர்வு பதிவுகள் எதுவும் இல்லை."
  }
};
    document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupLanguage();
  setupPdfDownloadListener();
});

function setupTabs() {
  const tabBtns = document.querySelectorAll(".nav-tab-btn");
  const panels = document.querySelectorAll(".panel-box");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      tabBtns.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.add("hidden"));

      btn.classList.add("active");
      const target = btn.getAttribute("data-tab");
      const targetPanel = document.getElementById(target);
      if (targetPanel) {
        targetPanel.classList.remove("hidden");
      }
    });
  });
}

function setupLanguage() {
  const btnEn = document.getElementById("btn-en");
  const btnTa = document.getElementById("btn-ta");

  if (btnEn && btnTa) {
    btnEn.addEventListener("click", () => {
      currentLang = "en";
      btnEn.classList.add("active");
      btnTa.classList.remove("active");
      applyTranslations();
      loadStudentData();
    });

    btnTa.addEventListener("click", () => {
      currentLang = "ta";
      btnTa.classList.add("active");
      btnEn.classList.remove("active");
      applyTranslations();
      loadStudentData();
    });
  }
}

function applyTranslations() {
  const t = dict[currentLang];
  safeText("nav-title", t.navTitle);
  safeText("btn-logout", t.logout);

  safeText("tab-btn-qp", t.tabQp);
  safeText("tab-btn-hw", t.tabHw);
  safeText("tab-btn-attendance", t.tabAttendance);
  safeText("tab-btn-mat", t.tabMat);
  safeText("tab-btn-notices", t.tabNotices);
  safeText("tab-btn-results", t.tabResults);

  safeText("title-exam-qp", t.titleQp);
  safeText("title-my-hw", t.titleHw);
  safeText("title-my-attendance", t.titleAttendance);
  safeText("title-my-mat", t.titleMat);
  safeText("title-my-notices", t.titleNotices);
  safeText("title-my-results", t.titleResults);

  safeText("lbl-att-pct", t.lblAttPct);
  safeText("lbl-present-days", t.lblPresentDays);
  safeText("lbl-absent-days", t.lblAbsentDays);
  safeText("lbl-late-days", t.lblLateDays);
  safeText("lbl-min-pct", t.lblMinPct);

  safeText("th-att-date", t.thAttDate);
  safeText("th-att-status", t.thAttStatus);
  safeText("th-att-session", t.thAttSession);

  safeText("th-exam-name", t.thExamName);
  safeText("th-subject", t.thSubject);
  safeText("th-score", t.thScore);
  safeText("th-total", t.thTotal);

  const dlBtn = document.getElementById("btn-download-report-pdf");
  if (dlBtn) dlBtn.textContent = t.btnDownloadPdf;
}

function safeText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

// Authentication & Profile Fetching
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      currentStudent = snap.data();
      safeText("student-name", currentStudent.fullName || "Student");
      safeText("student-school", currentStudent.schoolName || "EduPortal School");

      const boardName = currentStudent.board || "State Board";
      safeText(
        "student-class-info",
        `Class ${currentStudent.className || "6"} - Section ${currentStudent.section || "A"} | ${boardName}`
      );

      applyTranslations();
      await loadStudentData();
    }
  } catch (err) {
    console.error("Auth profile error:", err);
  }
});

const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

async function loadStudentData() {
  await Promise.allSettled([
    loadQuestionPapers(),
    loadHomework(),
    loadStudentAttendance(),
    loadMaterials(),
    loadNotices(),
    loadResults()
  ]);
}
// 1. QUESTION PAPERS (FLEXIBLE BOARD MATCHING + STRICT SCHOOL ISOLATION)
async function loadQuestionPapers() {
  const container = document.getElementById("qp-container");
  const t = dict[currentLang];
  if (!container) return;

  try {
    const snap = await getDocs(collection(db, "question_papers"));
    const studentSchool = cleanSchool(currentStudent?.schoolName);
    const studentClass = cleanClass(currentStudent?.className);
    const studentSec = (currentStudent?.section || "").trim().toUpperCase();
    const studentBoard = currentStudent?.board || "State Board";
    const items = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const targetSchool = cleanSchool(data.schoolName);
      const targetClass = cleanClass(data.className);
      const targetSec = (data.section || "All").trim().toUpperCase();
      const targetBoard = data.board || "";

      // Strict school, class and board match
      const matchesSchool = Boolean(targetSchool) && Boolean(studentSchool) && targetSchool === studentSchool;
      const matchesClass = targetClass === studentClass;
      const matchesSec = targetSec === "ALL" || targetSec === studentSec;
      const matchesBoard = boardsMatch(targetBoard, studentBoard);

      if (matchesSchool && matchesClass && matchesSec && matchesBoard) {
        items.push({ id: docSnap.id, ...data });
      }
    });

    if (items.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">${t.noQp}</p>`;
      return;
    }

    container.innerHTML = items.map((qp) => `
      <div class="card-entry" id="card_qp_${qp.id}">
        <h4>${qp.examName} - ${qp.subject}</h4>
        <div class="card-meta">Class ${qp.className} - Section ${qp.section || "All"} | ${t.examDateWord} ${qp.examDate || "-"} | ${t.marksWord} ${qp.totalMarks}</div>
        
        ${qp.formatMode === "type"
          ? `<div class="card-desc"><strong>Question Paper:</strong><br/>${qp.typedContent}</div>`
          : `<a class="link-attach" href="${qp.fileLink}" target="_blank">${t.openQpPdf}</a>`
        }

        <div class="submit-box">
          <strong style="font-size:12px;color:#1e1b4b;">${t.writeAnswersHeader}</strong>
          <textarea rows="6" id="text_ans_${qp.id}" placeholder="${t.answerTextPlaceholder}"></textarea>
          <input type="text" id="drive_ans_${qp.id}" placeholder="${t.driveOptionalPlaceholder}" />
          <button type="button" class="btn-submit-action btn-submit-qp-ans" 
            data-qpid="${qp.id}" 
            data-exam="${qp.examName}" 
            data-subject="${qp.subject}"
            data-marks="${qp.totalMarks}">
            ${t.submitAnswersBtn}
          </button>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".btn-submit-qp-ans").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const qpId = btn.getAttribute("data-qpid");
        const examName = btn.getAttribute("data-exam");
        const subject = btn.getAttribute("data-subject");
        const totalMarks = btn.getAttribute("data-marks");

        const writtenText = document.getElementById(`text_ans_${qpId}`)?.value.trim() || "";
        const driveLink = document.getElementById(`drive_ans_${qpId}`)?.value.trim() || "";

        if (!writtenText && !driveLink) {
          alert(t.enterAnswerAlert);
          return;
        }

        btn.disabled = true;
        btn.textContent = "Submitting...";

        try {
          await addDoc(collection(db, "exam_submissions"), {
            questionPaperId: qpId,
            examName: examName,
            subject: subject,
            totalMarks: Number(totalMarks),
            studentId: auth.currentUser.uid,
            studentName: currentStudent.fullName,
            rollNumber: currentStudent.rollNumber,
            className: currentStudent.className,
            section: currentStudent.section,
            board: currentStudent.board || "State Board",
            schoolName: currentStudent.schoolName || "",
            writtenAnswers: writtenText,
            driveLink: driveLink,
            submittedAt: new Date().toISOString()
          });

          alert(t.examSubmitSuccess);
          btn.textContent = "Submitted ✓";
          const txtEl = document.getElementById(`text_ans_${qpId}`);
          const drvEl = document.getElementById(`drive_ans_${qpId}`);
          if (txtEl) txtEl.disabled = true;
          if (drvEl) drvEl.disabled = true;
        } catch (err) {
          alert("Error submitting answers: " + err.message);
          btn.disabled = false;
          btn.textContent = t.submitAnswersBtn;
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${err.message}</p>`;
  }
}

// 2. HOMEWORK (STRICT SCHOOL ISOLATION)
async function loadHomework() {
  const container = document.getElementById("hw-container");
  const t = dict[currentLang];
  if (!container) return;

  try {
    const snap = await getDocs(collection(db, "homework"));
    const studentSchool = cleanSchool(currentStudent?.schoolName);
    const studentClass = cleanClass(currentStudent?.className);
    const studentSec = (currentStudent?.section || "").trim().toUpperCase();
    const items = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const targetSchool = cleanSchool(data.schoolName);
      const targetClass = cleanClass(data.className);
      const targetSec = (data.section || "All").trim().toUpperCase();

      const matchesSchool = Boolean(targetSchool) && Boolean(studentSchool) && targetSchool === studentSchool;
      const matchesClass = targetClass === studentClass;
      const matchesSec = targetSec === "ALL" || targetSec === studentSec;

      if (matchesSchool && matchesClass && matchesSec) {
        items.push({ id: docSnap.id, ...data });
      }
    });

    if (items.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">${t.noHw}</p>`;
      return;
    }

    container.innerHTML = items.map((hw) => `
      <div class="card-entry">
        <h4>${hw.title} (${hw.subject})</h4>
        <div class="card-meta">Class ${hw.className} - Section ${hw.section || "All"} | ${t.deadlinePrefix} ${hw.deadline}</div>
        <p class="card-desc">${hw.instructions || ""}</p>
        ${hw.link ? `<a class="link-attach" href="${hw.link}" target="_blank">${t.viewResource}</a>` : ""}
        <div class="submit-box">
          <input type="text" id="ans_${hw.id}" placeholder="Paste your answer or Google Drive link..." />
          <button type="button" class="btn-submit-action btn-submit-hw" data-hwid="${hw.id}">${t.submitHwBtn}</button>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".btn-submit-hw").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const hwId = e.target.getAttribute("data-hwid");
        const ansInput = document.getElementById(`ans_${hwId}`);
        const answer = ansInput?.value.trim() || "";

        if (!answer) {
          alert(t.enterAnswerAlert);
          return;
        }

        try {
          await addDoc(collection(db, "homework_submissions"), {
            homeworkId: hwId,
            studentId: auth.currentUser.uid,
            studentName: currentStudent.fullName,
            rollNumber: currentStudent.rollNumber,
            className: currentStudent.className,
            section: currentStudent.section,
            schoolName: currentStudent.schoolName || "",
            answer: answer,
            submittedAt: new Date().toISOString()
          });
          alert(t.hwSuccessAlert);
          if (ansInput) ansInput.value = "";
        } catch (err) {
          alert("Error: " + err.message);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${err.message}</p>`;
  }
                 }
            // 3. STUDENT ATTENDANCE ANALYTICS (STRICT SCHOOL & ROLL ISOLATION)
async function loadStudentAttendance() {
  const t = dict[currentLang];
  const tbody = document.getElementById("att-history-tbody");
  const pctEl = document.getElementById("stat-att-percentage");
  const presentEl = document.getElementById("stat-present-count");
  const absentEl = document.getElementById("stat-absent-count");
  const lateEl = document.getElementById("stat-late-count");
  const totalWorkingEl = document.getElementById("stat-total-working");
  const badgeEl = document.getElementById("stat-att-badge");
  const bannerEl = document.getElementById("att-eligibility-banner");

  if (!tbody || !currentStudent) return;

  try {
    const studentSchool = cleanSchool(currentStudent.schoolName);
    const studentClass = cleanClass(currentStudent.className);
    const studentSec = (currentStudent.section || "").trim().toUpperCase();
    const myRoll = (currentStudent.rollNumber || "").trim().toLowerCase();
    const myUid = auth.currentUser.uid;

    const snap = await getDocs(collection(db, "attendance"));
    const sessions = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const targetSchool = cleanSchool(data.schoolName);
      const targetClass = cleanClass(data.className);
      const targetSec = (data.section || "").trim().toUpperCase();

      // Strict school, class and section filtering
      if (Boolean(targetSchool) && Boolean(studentSchool) && targetSchool === studentSchool) {
        if (targetClass === studentClass && (targetSec === "ALL" || targetSec === studentSec)) {
          const studentEntry = (data.records || []).find((r) => {
            const matchUid = r.uid && r.uid === myUid;
            const matchRoll = r.rollNumber && r.rollNumber.trim().toLowerCase() === myRoll;
            return matchUid || matchRoll;
          });

          if (studentEntry) {
            sessions.push({
              date: data.date || "Unknown",
              status: studentEntry.status || "Present",
              className: data.className,
              section: data.section
            });
          }
        }
      }
    });

    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sessions.length === 0) {
      if (pctEl) pctEl.textContent = "100%";
      if (presentEl) presentEl.textContent = "0";
      if (absentEl) absentEl.textContent = "0";
      if (lateEl) lateEl.textContent = "0";
      if (totalWorkingEl) totalWorkingEl.textContent = "out of 0 working days";
      if (badgeEl) badgeEl.innerHTML = `<span class="badge-safe">Status: No records</span>`;
      if (bannerEl) bannerEl.innerHTML = t.noAttendance;
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:14px;color:#64748b;">${t.noAttendance}</td></tr>`;
      return;
    }

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    sessions.forEach((s) => {
      const st = (s.status || "").toLowerCase();
      if (st === "present") presentCount++;
      else if (st === "absent") absentCount++;
      else if (st === "late") {
        lateCount++;
        presentCount += 0.5; // Partial attendance credit
      } else {
        presentCount++;
      }
    });

    const totalDays = sessions.length;
    const percentage = Math.round((presentCount / totalDays) * 100);

    if (pctEl) pctEl.textContent = `${percentage}%`;
    if (presentEl) presentEl.textContent = Math.floor(presentCount);
    if (absentEl) absentEl.textContent = absentCount;
    if (lateEl) lateEl.textContent = lateCount;
    if (totalWorkingEl) totalWorkingEl.textContent = `out of ${totalDays} working days`;

    // 75% minimum threshold evaluation
    if (percentage >= 75) {
      if (badgeEl) badgeEl.innerHTML = `<span class="badge-safe">Eligible (≥75%)</span>`;
      if (bannerEl) {
        bannerEl.style.background = "#dcfce7";
        bannerEl.style.color = "#166534";
        bannerEl.innerHTML = t.attEligible;
      }
    } else {
      if (badgeEl) badgeEl.innerHTML = `<span class="badge-danger">Shortage (&lt;75%)</span>`;
      if (bannerEl) {
        bannerEl.style.background = "#fee2e2";
        bannerEl.style.color = "#991b1b";
        bannerEl.innerHTML = t.attShortage;
      }
    }

    tbody.innerHTML = sessions.map((s) => {
      let badgeHtml = "";
      const st = (s.status || "").toLowerCase();
      if (st === "present") {
        badgeHtml = `<span class="badge-safe">Present</span>`;
      } else if (st === "absent") {
        badgeHtml = `<span class="badge-danger">Absent</span>`;
      } else if (st === "late") {
        badgeHtml = `<span style="background:#fef3c7;color:#b45309;padding:2px 6px;border-radius:4px;font-weight:700;font-size:11px;">Late</span>`;
      } else {
        badgeHtml = `<span class="badge-safe">${s.status}</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 600;">${s.date}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1;">${badgeHtml}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1;">Class ${s.className} - ${s.section}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    if (bannerEl) bannerEl.innerHTML = `Error loading attendance: ${err.message}`;
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#dc2626;padding:14px;">Error: ${err.message}</td></tr>`;
  }
}
// 4. STUDY MATERIALS (STRICT SCHOOL ISOLATION)
async function loadMaterials() {
  const container = document.getElementById("mat-container");
  const t = dict[currentLang];
  if (!container) return;

  try {
    const snap = await getDocs(collection(db, "materials"));
    const studentSchool = cleanSchool(currentStudent?.schoolName);
    const studentClass = cleanClass(currentStudent?.className);
    const studentSec = (currentStudent?.section || "").trim().toUpperCase();
    const items = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const targetSchool = cleanSchool(data.schoolName);
      const targetClass = cleanClass(data.className);
      const targetSec = (data.section || "All").trim().toUpperCase();

      const matchesSchool = Boolean(targetSchool) && Boolean(studentSchool) && targetSchool === studentSchool;
      const matchesClass = targetClass === studentClass;
      const matchesSec = targetSec === "ALL" || targetSec === studentSec;

      if (matchesSchool && matchesClass && matchesSec) {
        items.push(data);
      }
    });

    if (items.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">${t.noMat}</p>`;
      return;
    }

    container.innerHTML = items.map((mat) => `
      <div class="card-entry">
        <h4>${mat.title} - ${mat.subject}</h4>
        <div class="card-meta">Class ${mat.className} - Section ${mat.section || "All"}</div>
        <a class="link-attach" href="${mat.link}" target="_blank">${t.viewDriveMat}</a>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${err.message}</p>`;
  }
}

// 5. NOTICES (STRICT SCHOOL ISOLATION)
async function loadNotices() {
  const container = document.getElementById("notices-container");
  const t = dict[currentLang];
  if (!container) return;

  try {
    const snap = await getDocs(collection(db, "notices"));
    const studentSchool = cleanSchool(currentStudent?.schoolName);
    const items = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const targetSchool = cleanSchool(data.schoolName);
      if (Boolean(targetSchool) && Boolean(studentSchool) && targetSchool === studentSchool) {
        items.push(data);
      }
    });

    if (items.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">${t.noNotices}</p>`;
      return;
    }

    container.innerHTML = items.map((n) => `
      <div class="card-entry">
        <h4>${n.title}</h4>
        <p class="card-desc">${n.details}</p>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p style="color:#dc2626;font-size:13px;">Error: ${err.message}</p>`;
  }
}

// 6. EXAM RESULTS (STRICT ROLL NUMBER & SCHOOL ISOLATION)
async function loadResults() {
  const tbody = document.getElementById("results-tbody");
  const t = dict[currentLang];
  if (!tbody) return;

  try {
    const q = query(
      collection(db, "exam_results"),
      where("rollNumber", "==", (currentStudent?.rollNumber || "").toString())
    );
    const snap = await getDocs(q);
    const studentSchool = cleanSchool(currentStudent?.schoolName);
    const items = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const targetSchool = cleanSchool(data.schoolName);
      if (Boolean(targetSchool) && Boolean(studentSchool) && targetSchool === studentSchool) {
        items.push(data);
      }
    });

    fetchedResults = items; // Stored for PDF generation

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#64748b;">${t.noResults}</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((r) => `
      <tr>
        <td><strong>${r.examName || "-"}</strong></td>
        <td>${r.subject || "-"}</td>
        <td><strong>${r.marksScored}</strong></td>
        <td>${r.totalMarks}</td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#dc2626;">Error: ${err.message}</td></tr>`;
  }
}
// 7. DOWNLOADABLE PDF FORMAT FOR EXAM REPORT SLIDE
function setupPdfDownloadListener() {
  document.getElementById("btn-download-report-pdf")?.addEventListener("click", () => {
    const t = dict[currentLang];

    if (!window.jspdf) {
      alert("PDF library is loading. Please check your internet connection and try again.");
      return;
    }
    if (!currentStudent) {
      alert("Student profile not loaded yet.");
      return;
    }
    if (!fetchedResults || fetchedResults.length === 0) {
      alert(t.pdfNoData);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Header banner with institutional navy fill
    doc.setFillColor(30, 27, 75); // #1e1b4b
    doc.rect(0, 0, 210, 36, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(currentStudent.schoolName || "EduPortal School", 105, 16, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(t.pdfReportTitle, 105, 26, { align: "center" });

    // Student information card block
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(10);

    doc.setFont("helvetica", "bold");
    doc.text("Student Name:", 14, 46);
    doc.setFont("helvetica", "normal");
    doc.text(currentStudent.fullName || "-", 45, 46);

    doc.setFont("helvetica", "bold");
    doc.text("Roll Number:", 14, 53);
    doc.setFont("helvetica", "normal");
    doc.text(currentStudent.rollNumber || "-", 45, 53);

    doc.setFont("helvetica", "bold");
    doc.text("Class & Section:", 120, 46);
    doc.setFont("helvetica", "normal");
    doc.text(`Class ${currentStudent.className || "-"} - ${currentStudent.section || "-"}`, 155, 46);

    doc.setFont("helvetica", "bold");
    doc.text("Curriculum/Board:", 120, 53);
    doc.setFont("helvetica", "normal");
    doc.text(currentStudent.board || "State Board", 155, 53);

    // Divider line
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 59, 196, 59);

    // Compute aggregate marks and percentages
    let totalScored = 0;
    let totalPossible = 0;

    const tableBody = fetchedResults.map((item) => {
      const scored = Number(item.marksScored) || 0;
      const max = Number(item.totalMarks) || 100;
      totalScored += scored;
      totalPossible += max;
      const pct = max > 0 ? ((scored / max) * 100).toFixed(1) + "%" : "-";

      return [
        item.examName || "-",
        item.subject || "-",
        scored.toString(),
        max.toString(),
        pct
      ];
    });

    const overallPct = totalPossible > 0 ? ((totalScored / totalPossible) * 100).toFixed(1) + "%" : "-";

    // AutoTable structured tabular report
    doc.autoTable({
      startY: 65,
      head: [["Exam Name", "Subject", "Marks Scored", "Max Marks", "Percentage"]],
      body: tableBody,
      theme: "striped",
      headStyles: {
        fillColor: [67, 56, 202], // Indigo header
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 45 },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" }
      }
    });

    // Summary Card Box
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, finalY, 182, 22, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Total Marks: ${totalScored} / ${totalPossible}`, 20, finalY + 9);
    doc.text(`Overall Percentage: ${overallPct}`, 20, finalY + 16);

    doc.setFont("helvetica", "normal");
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 130, finalY + 12);

    // Save and trigger browser download
    const filename = `${(currentStudent.rollNumber || "Student")}_Report_Card.pdf`;
    doc.save(filename);
  });
}

// Module exports
export {
  loadStudentData,
  loadStudentAttendance,
  loadResults,
  currentStudent
};
