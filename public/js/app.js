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

var SIDEBAR_COLLAPSED_KEY = "crm-sidebar-collapsed";

function isMobileNavMode() {
  return window.matchMedia("(max-width: 1279px)").matches;
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

function setDesktopSidebarCollapsed(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch (e) {}
}

function restoreDesktopSidebarState() {
  if (isMobileNavMode()) return;
  try {
    if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
      document.body.classList.add("sidebar-collapsed");
    }
  } catch (e) {}
}

function toggleSidebar() {
  if (isMobileNavMode()) {
    if (document.body.classList.contains("layout-nav-open")) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
    return;
  }
  setDesktopSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed"));
}

function collapseSidebar() {
  if (isMobileNavMode()) {
    closeMobileNav();
    return;
  }
  setDesktopSidebarCollapsed(true);
}

function initMobileNav() {
  const openBtn = document.getElementById("btn-nav-open");
  const closeBtn = document.getElementById("btn-nav-close");
  const overlay = document.getElementById("layout-overlay");
  const sidebar = document.getElementById("app-sidebar");

  restoreDesktopSidebarState();

  if (openBtn) openBtn.addEventListener("click", toggleSidebar);
  if (closeBtn) closeBtn.addEventListener("click", collapseSidebar);
  if (overlay) overlay.addEventListener("click", closeMobileNav);
  if (sidebar) {
    sidebar.querySelectorAll("a.nav-item").forEach(function (link) {
      link.addEventListener("click", function () {
        if (isMobileNavMode()) closeMobileNav();
      });
    });
  }

  window.matchMedia("(max-width: 1279px)").addEventListener("change", function () {
    if (isMobileNavMode()) {
      document.body.classList.remove("sidebar-collapsed");
      closeMobileNav();
    } else {
      closeMobileNav();
      restoreDesktopSidebarState();
    }
  });
}
