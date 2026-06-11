document.addEventListener("DOMContentLoaded", function () {
  initDateDisplay();
  initMobileNav();
  registerServiceWorker();
});

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
    });
  }
}

function initDateDisplay() {
  const el = document.getElementById("current-date");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function closeMobileNav() {
  document.body.classList.remove("layout-nav-open");
  const overlay = document.getElementById("layout-overlay");
  if (overlay) overlay.setAttribute("aria-hidden", "true");
}

function openMobileNav() {
  document.body.classList.add("layout-nav-open");
  const overlay = document.getElementById("layout-overlay");
  if (overlay) overlay.setAttribute("aria-hidden", "false");
}

function initMobileNav() {
  const openBtn = document.getElementById("btn-nav-open");
  const closeBtn = document.getElementById("btn-nav-close");
  const overlay = document.getElementById("layout-overlay");
  const sidebar = document.getElementById("app-sidebar");

  if (openBtn) openBtn.addEventListener("click", openMobileNav);
  if (closeBtn) closeBtn.addEventListener("click", closeMobileNav);
  if (overlay) overlay.addEventListener("click", closeMobileNav);
  if (sidebar) {
    sidebar.querySelectorAll("a.nav-item").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 1279px)").matches) closeMobileNav();
      });
    });
  }
}
