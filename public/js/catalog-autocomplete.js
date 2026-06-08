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

  function initCatalogAutocomplete(form) {
    var nameInput = form.querySelector('input[name="name"]');
    var priceInput = form.querySelector('input[name="unit_price"]');
    var hiddenId = form.querySelector('input[name="catalog_item_id"]');
    if (!nameInput) return;

    var list = createDropdown(nameInput);
    var lineType = form.querySelector('input[name="line_type"]');
    var type = lineType ? lineType.value : "work";
    var category = form.dataset.workCategory || "";

    function render(items) {
      list.innerHTML = "";
      if (!items.length) {
        list.hidden = true;
        return;
      }
      items.forEach(function (item) {
        var li = document.createElement("li");
        li.className = "ac-item";
        li.textContent = item.name + " — " + Number(item.default_price).toLocaleString("ru-RU") + " ₽";
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          nameInput.value = item.name;
          if (priceInput) priceInput.value = String(item.default_price);
          if (hiddenId) hiddenId.value = String(item.id);
          list.hidden = true;
        });
        list.appendChild(li);
      });
      list.hidden = false;
    }

    var runSearch = debounce(function () {
      var q = nameInput.value.trim();
      if (q.length < 1) {
        list.hidden = true;
        return;
      }
      var url =
        "/api/catalog/search?q=" +
        encodeURIComponent(q) +
        "&type=" +
        encodeURIComponent(type) +
        (category ? "&category=" + encodeURIComponent(category) : "");
      fetch(url, { headers: { Accept: "application/json" } })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          render(data.items || []);
        });
    }, 300);

    nameInput.addEventListener("input", function () {
      if (hiddenId) hiddenId.value = "";
      runSearch();
    });
    nameInput.addEventListener("focus", runSearch);
    nameInput.addEventListener("blur", function () {
      setTimeout(function () {
        list.hidden = true;
      }, 150);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".order-add-line-form[data-catalog-ac]").forEach(initCatalogAutocomplete);
  });
})();
