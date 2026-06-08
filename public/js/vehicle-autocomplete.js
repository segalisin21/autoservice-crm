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
      if (el !== except) {
        el.hidden = true;
        el.classList.remove("is-open");
      }
    });
  }

  function positionDropdown(input, list) {
    var rect = input.getBoundingClientRect();
    list.style.position = "fixed";
    list.style.left = Math.max(8, rect.left) + "px";
    list.style.top = rect.bottom + 4 + "px";
    list.style.width = Math.min(rect.width, window.innerWidth - 16) + "px";
    list.style.right = "auto";
    list.style.zIndex = "1200";
  }

  function createDropdown(input) {
    var wrap = input.closest(".ac-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "ac-wrap ac-wrap--vehicle";
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    var list = wrap.querySelector(".ac-dropdown");
    if (!list) {
      list = document.createElement("ul");
      list.className = "ac-dropdown ac-dropdown--vehicle";
      list.hidden = true;
      list.setAttribute("role", "listbox");
      document.body.appendChild(list);
      list.dataset.acFor = input.name || input.id || "ac";
    }
    wrap.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    return list;
  }

  function bindAutocomplete(input, options) {
    if (!input || input.dataset.acInit) return;
    input.dataset.acInit = "1";
    input.setAttribute("autocomplete", "off");
    input.classList.add("ac-input");
    var list = createDropdown(input);
    var fetchItems = options.fetchItems;
    var onPick = options.onPick;
    var emptyText = options.emptyText || "Ничего не найдено";

    function render(state) {
      list.innerHTML = "";
      if (state.loading) {
        var loading = document.createElement("li");
        loading.className = "ac-status";
        loading.textContent = "Загрузка…";
        list.appendChild(loading);
        positionDropdown(input, list);
        list.hidden = false;
        list.classList.add("is-open");
        return;
      }
      if (state.hint) {
        var hint = document.createElement("li");
        hint.className = "ac-status ac-status--hint";
        hint.textContent = state.hint;
        list.appendChild(hint);
        positionDropdown(input, list);
        list.hidden = false;
        list.classList.add("is-open");
        return;
      }
      if (!state.items || !state.items.length) {
        var empty = document.createElement("li");
        empty.className = "ac-status";
        empty.textContent = emptyText;
        list.appendChild(empty);
        positionDropdown(input, list);
        list.hidden = false;
        list.classList.add("is-open");
        return;
      }
      state.items.forEach(function (item) {
        var li = document.createElement("li");
        li.className = "ac-item";
        li.setAttribute("role", "option");
        var title = document.createElement("span");
        title.className = "ac-item__title";
        title.textContent = item.label;
        li.appendChild(title);
        if (item.meta) {
          var meta = document.createElement("span");
          meta.className = "ac-item__meta";
          meta.textContent = item.meta;
          li.appendChild(meta);
        }
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          onPick(item);
          list.hidden = true;
          list.classList.remove("is-open");
        });
        list.appendChild(li);
      });
      positionDropdown(input, list);
      list.hidden = false;
      list.classList.add("is-open");
    }

    var runSearch = debounce(function () {
      fetchItems(input.value.trim(), render);
    }, 220);

    input.addEventListener("input", runSearch);
    input.addEventListener("focus", runSearch);
    input.addEventListener("blur", function () {
      setTimeout(function () {
        list.hidden = true;
        list.classList.remove("is-open");
      }, 180);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        list.hidden = true;
        list.classList.remove("is-open");
      }
    });

    window.addEventListener(
      "scroll",
      function () {
        if (!list.hidden) positionDropdown(input, list);
      },
      true
    );
    window.addEventListener("resize", function () {
      if (!list.hidden) positionDropdown(input, list);
    });

    return { refresh: runSearch, hide: function () {
      list.hidden = true;
      list.classList.remove("is-open");
    } };
  }

  function fetchJson(url) {
    return fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function formatYearRange(m) {
    if (!m.year_from && !m.year_to) return "";
    if (m.year_from && m.year_to) return m.year_from + "–" + m.year_to;
    if (m.year_from) return "с " + m.year_from;
    return "до " + m.year_to;
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
    var lastPickedMake = "";

    if (!makeInput || !modelInput) return;

    function resolveMarkId(callback) {
      if (markId && makeInput.value.trim() === lastPickedMake) {
        callback(markId);
        return;
      }
      var q = makeInput.value.trim();
      if (!q) {
        callback(null);
        return;
      }
      fetchJson("/api/vehicles/marks?q=" + encodeURIComponent(q))
        .then(function (data) {
          var items = data.items || [];
          var lower = q.toLowerCase();
          var exact = items.find(function (m) {
            var label = (m.name_ru || m.name || "").toLowerCase();
            return label === lower || (m.autoru_id || "").toLowerCase() === lower;
          });
          var hit = exact || (items.length === 1 ? items[0] : null);
          markId = hit ? hit.id : null;
          if (hit) lastPickedMake = makeInput.value.trim();
          callback(markId);
        })
        .catch(function () {
          callback(null);
        });
    }

    var modelAc = bindAutocomplete(modelInput, {
      emptyText: "Модели не найдены",
      fetchItems: function (q, render) {
        render({ loading: true });
        resolveMarkId(function (id) {
          if (!id) {
            render({ hint: "Сначала выберите марку из списка" });
            return;
          }
          fetchJson(
            "/api/vehicles/models?mark_id=" + encodeURIComponent(id) + "&q=" + encodeURIComponent(q)
          )
            .then(function (data) {
              render({
                items: (data.items || []).map(function (m) {
                  return {
                    id: m.id,
                    label: m.name_ru || m.name,
                    meta: formatYearRange(m),
                    raw: m
                  };
                })
              });
            })
            .catch(function () {
              render({ items: [] });
            });
        });
      },
      onPick: function (item) {
        modelInput.value = item.label;
        if (modelIdInput) modelIdInput.value = String(item.id);
        var m = item.raw;
        if (yearInput && (m.year_from || m.year_to)) {
          var now = new Date().getFullYear();
          var y = m.year_to && m.year_to <= now ? m.year_to : m.year_from || now;
          yearInput.value = String(y);
        }
        fetchJson("/api/vehicles/generations?model_id=" + encodeURIComponent(item.id))
          .then(function (data) {
            var gens = data.items || [];
            if (bodyInput && gens[0]) bodyInput.value = gens[0].body_type || "";
          })
          .catch(function () {});
      }
    });

    bindAutocomplete(makeInput, {
      emptyText: "Марки не найдены",
      fetchItems: function (q, render) {
        render({ loading: true });
        fetchJson("/api/vehicles/marks?q=" + encodeURIComponent(q))
          .then(function (data) {
            render({
              items: (data.items || []).map(function (m) {
                return { id: m.id, label: m.name_ru || m.name, raw: m };
              })
            });
          })
          .catch(function () {
            render({ items: [] });
          });
      },
      onPick: function (item) {
        makeInput.value = item.label;
        markId = item.id;
        lastPickedMake = item.label;
        modelInput.value = "";
        if (modelIdInput) modelIdInput.value = "";
        if (yearInput) yearInput.value = "";
        if (bodyInput) bodyInput.value = "";
        modelInput.focus();
        if (modelAc) modelAc.refresh();
      }
    });

    makeInput.addEventListener("input", function () {
      if (makeInput.value.trim() !== lastPickedMake) {
        markId = null;
      }
    });

    if (makeInput.value.trim()) {
      resolveMarkId(function () {});
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-vehicle-autocomplete]").forEach(initVehicleForm);
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".ac-wrap") && !e.target.closest(".ac-dropdown")) {
        closeAllDropdowns();
      }
    });
  });
})();
