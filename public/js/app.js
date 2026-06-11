document.addEventListener("DOMContentLoaded", function () {
  initDateDisplay();
  initMobileNav();
  registerServiceWorker();
});

window.addEventListener("pageshow", function (event) {
  document.body.classList.remove("layout-nav-open");
  var overlay = document.getElementById("layout-overlay");
  if (overlay) overlay.setAttribute("aria-hidden", "true");
  if (event.persisted || typeof event.persisted === "boolean") {
    restoreDesktopSidebarState();
  }
});

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  var reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  window.addEventListener("load", function () {
    var version = document.querySelector('script[src*="/js/app.js"]');
    var v = "";
    if (version && version.src) {
      var m = version.src.match(/[?&]v=([^&]+)/);
      if (m) v = "?v=" + m[1];
    }
    navigator.serviceWorker.register("/sw.js" + v, { scope: "/" }).then(function (reg) {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      reg.addEventListener("updatefound", function () {
        var worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", function () {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    }).catch(function () {});
  });
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
  if (isMobileNavMode()) {
    document.body.classList.remove("sidebar-collapsed");
    return;
  }
  try {
    document.body.classList.toggle(
      "sidebar-collapsed",
      localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
    );
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
