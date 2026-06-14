(function () {
  function initPicker(root) {
    var hidden = root.querySelector('input[type="hidden"][name="work_type"]');
    var boxes = root.querySelectorAll('input[type="checkbox"][data-work-type]');
    if (!hidden || !boxes.length) return;

    function syncHidden() {
      var selected = [];
      boxes.forEach(function (cb) {
        if (cb.checked) selected.push(cb.getAttribute("data-work-type"));
      });
      hidden.value = selected.join(", ");
    }

    boxes.forEach(function (cb) {
      cb.addEventListener("change", syncHidden);
    });

    var form = root.closest("form");
    if (form) {
      form.addEventListener("submit", function (e) {
        syncHidden();
        if (root.hasAttribute("data-work-type-required") && !hidden.value.trim()) {
          e.preventDefault();
          alert("Выберите хотя бы один тип работ");
        }
      });
    }

    syncHidden();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-work-type-picker]").forEach(initPicker);
  });
})();
