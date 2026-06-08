(function () {
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(null, args);
      }, ms);
    };
  }

  function closeAllDropdowns(except) {
    document.querySelectorAll(".ac-dropdown").forEach(function (el) {
      if (el !== except) el.hidden = true;
    });
  }

  function createDropdown(input) {
    var wrap = input.closest(".ac-wrap") || input.parentElement;
    if (!wrap.classList.contains("ac-wrap")) {
      var container = document.createElement("div");
      container.className = "ac-wrap";
      input.parentNode.insertBefore(container, input);
      container.appendChild(input);
      wrap = container;
    }
    var list = wrap.querySelector(".ac-dropdown");
    if (!list) {
      list = document.createElement("ul");
      list.className = "ac-dropdown";
      list.hidden = true;
      wrap.appendChild(list);
    }
    return list;
  }

  function bindAutocomplete(input, fetchItems, onPick) {
    if (!input || input.dataset.acInit) return;
    input.dataset.acInit = "1";
    input.setAttribute("autocomplete", "off");
    var list = createDropdown(input);

    function render(items) {
      list.innerHTML = "";
      if (!items.length) {
        list.hidden = true;
        return;
      }
      items.forEach(function (item) {
        var li = document.createElement("li");
        li.className = "ac-item";
        li.textContent = item.label;
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          onPick(item);
          list.hidden = true;
        });
        list.appendChild(li);
      });
      list.hidden = false;
    }

    var runSearch = debounce(function () {
      fetchItems(input.value.trim(), render);
    }, 300);

    input.addEventListener("input", runSearch);
    input.addEventListener("focus", runSearch);
    input.addEventListener("blur", function () {
      setTimeout(function () {
        list.hidden = true;
      }, 150);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") list.hidden = true;
    });
  }

  function fetchJson(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (r) {
      return r.json();
    });
  }

  function initVehicleForm(form) {
    if (!form || form.dataset.vehicleAcInit) return;
    form.dataset.vehicleAcInit = "1";

    var makeInput = form.querySelector("[data-ac-mark]");
    var modelInput = form.querySelector("[data-ac-model]");
    var yearInput = form.querySelector("[data-ac-year]");
    var bodyInput = form.querySelector("[data-ac-body]");
    var modelIdInput = form.querySelector("[name=vehicle_model_id]");
    var markId = null;

    if (!makeInput || !modelInput) return;

    bindAutocomplete(makeInput, function (q, render) {
      fetchJson("/api/vehicles/marks?q=" + encodeURIComponent(q)).then(function (data) {
        render(
          (data.items || []).map(function (m) {
            return { id: m.id, label: m.name_ru || m.name, raw: m };
          })
        );
      });
    }, function (item) {
      makeInput.value = item.label;
      markId = item.id;
      modelInput.value = "";
      if (modelIdInput) modelIdInput.value = "";
      if (yearInput) yearInput.value = "";
      if (bodyInput) bodyInput.value = "";
      modelInput.focus();
    });

    bindAutocomplete(modelInput, function (q, render) {
      if (!markId) {
        render([]);
        return;
      }
      fetchJson(
        "/api/vehicles/models?mark_id=" + encodeURIComponent(markId) + "&q=" + encodeURIComponent(q)
      ).then(function (data) {
        render(
          (data.items || []).map(function (m) {
            return { id: m.id, label: m.name_ru || m.name, raw: m };
          })
        );
      });
    }, function (item) {
      modelInput.value = item.label;
      if (modelIdInput) modelIdInput.value = String(item.id);
      var m = item.raw;
      if (yearInput && (m.year_from || m.year_to)) {
        var now = new Date().getFullYear();
        var y = m.year_to && m.year_to <= now ? m.year_to : m.year_from || now;
        yearInput.value = String(y);
      }
      fetchJson("/api/vehicles/generations?model_id=" + encodeURIComponent(item.id)).then(function (data) {
        var gens = data.items || [];
        if (bodyInput && gens[0]) bodyInput.value = gens[0].body_type || "";
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-vehicle-autocomplete]").forEach(initVehicleForm);
    document.addEventListener("click", function () {
      closeAllDropdowns();
    });
  });
})();
