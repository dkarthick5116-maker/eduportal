
/* ==========================================
   EDUPORTAL - COMPLETE JAVASCRIPT
   Version 1.0
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {

  // ---------- 1. LANGUAGE SYSTEM ----------
  let currentLanguage = localStorage.getItem("eduportal-language") || "en";

  const languageBtn = document.getElementById("languageBtn");

  function applyLanguage(language) {
    currentLanguage = language;

    document.querySelectorAll("[data-en][data-ta]").forEach(element => {
      element.innerHTML = element.getAttribute(`data-${language}`);
    });

    document.documentElement.lang = language;

    if (languageBtn) {
      languageBtn.textContent = language === "en" ? "தமிழ்" : "English";
    }

    localStorage.setItem("eduportal-language", language);
  }

  if (languageBtn) {
    languageBtn.addEventListener("click", () => {
      const newLanguage = currentLanguage === "en" ? "ta" : "en";
      applyLanguage(newLanguage);
    });
  }

  applyLanguage(currentLanguage);


  // ---------- 2. FOOTER YEAR ----------
  const yearElement = document.getElementById("year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }


  // ---------- 3. SMOOTH SCROLL ----------
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", event => {
      const targetId = link.getAttribute("href");

      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);

      if (target) {
        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });


  // ---------- 4. SCROLL REVEAL ANIMATION ----------
  const revealElements = document.querySelectorAll(
    ".feature-card, .section-heading, .about-box, .hero-content, .hero-art"
  );

  revealElements.forEach(element => {
    element.classList.add("reveal");
  });

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12
    });

    revealElements.forEach(element => {
      revealObserver.observe(element);
    });
  } else {
    revealElements.forEach(element => {
      element.classList.add("visible");
    });
  }


  // ---------- 5. FEATURE CARD INTERACTIONS ----------
  const featureCards = document.querySelectorAll(".feature-card");

  featureCards.forEach(card => {
    card.addEventListener("mouseenter", () => {
      card.style.transition = "transform 0.25s ease";
    });

    card.addEventListener("touchstart", () => {
      card.style.transform = "scale(0.98)";
    }, { passive: true });

    card.addEventListener("touchend", () => {
      card.style.transform = "";
    }, { passive: true });
  });


  // ---------- 6. HERO BOOK FLOAT ANIMATION ----------
  const book = document.querySelector(".book");

  if (book) {
    let animationEnabled = true;

    function floatBook() {
      if (!animationEnabled) return;

      book.animate([
        { transform: "rotate(-7deg) translateY(0px)" },
        { transform: "rotate(-4deg) translateY(-10px)" },
        { transform: "rotate(-7deg) translateY(0px)" }
      ], {
        duration: 3500,
        iterations: Infinity,
        easing: "ease-in-out"
      });
    }

    floatBook();

    // Respect reduced-motion settings
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animationEnabled = false;
    }
  }


  // ---------- 7. BUTTON PRESS FEEDBACK ----------
  document.querySelectorAll(".primary-btn, .secondary-btn, .lang-btn").forEach(button => {
    button.addEventListener("touchstart", () => {
      button.style.opacity = "0.8";
    }, { passive: true });

    button.addEventListener("touchend", () => {
      button.style.opacity = "1";
    }, { passive: true });
  });


  // ---------- 8. CURRENT PAGE ACTIVE NAVIGATION ----------
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll(".nav-links a");

  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => {
            link.classList.remove("active");

            if (link.getAttribute("href") === `#${entry.target.id}`) {
              link.classList.add("active");
            }
          });
        }
      });
    }, {
      threshold: 0.4
    });

    sections.forEach(section => navObserver.observe(section));
  }


  // ---------- 9. ONLINE / OFFLINE STATUS ----------
  function updateConnectionStatus() {
    document.body.dataset.connection = navigator.onLine ? "online" : "offline";
  }

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);

  updateConnectionStatus();


  // ---------- 10. INITIALIZATION ----------
  console.log("EduPortal JavaScript loaded successfully!");
  console.log("Current language:", currentLanguage);
  console.log("Connection:", navigator.onLine ? "Online" : "Offline");

});
              
