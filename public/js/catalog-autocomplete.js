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

  function hasTiers(item) {
    return (
      (item.price_tier_2 != null && Number(item.price_tier_2) > 0) ||
      (item.price_tier_3 != null && Number(item.price_tier_3) > 0)
    );
  }

  function tierPrice(item, tier) {
    var t = Number(tier) || 1;
    if (t === 2 && item.price_tier_2 != null && Number(item.price_tier_2) > 0) {
      return Number(item.price_tier_2);
    }
    if (t === 3 && item.price_tier_3 != null && Number(item.price_tier_3) > 0) {
      return Number(item.price_tier_3);
    }
    return Number(item.default_price) || 0;
  }

  function tierMaterial(item, tier) {
    var t = Number(tier) || 1;
    if (t === 2 && item.material_cost_tier_2 != null && item.material_cost_tier_2 !== "") {
      return Number(item.material_cost_tier_2) || 0;
    }
    if (t === 3 && item.material_cost_tier_3 != null && item.material_cost_tier_3 !== "") {
      return Number(item.material_cost_tier_3) || 0;
    }
    return Number(item.default_material_cost) || 0;
  }

  function applyMaterialCost(form, item, tier) {
    var materialCost = tierMaterial(item, tier);
    var materialInput = form.querySelector('input[name="material_cost"]');
    var costPriceInput = form.querySelector('input[name="cost_price"]');
    if (materialInput) materialInput.value = String(materialCost);
    if (costPriceInput) costPriceInput.value = String(materialCost);
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

  function ensureTierBlock(form) {
    var block = form.querySelector(".catalog-tier-block");
    if (!block) {
      block = document.createElement("div");
      block.className = "catalog-tier-block";
      block.hidden = true;
      block.innerHTML =
        '<label class="catalog-tier-label">Категория авто (внутр.) ' +
        '<select name="vehicle_tier">' +
        '<option value="1">1 кат. (седан)</option>' +
        '<option value="2">2 кат. (паркетник)</option>' +
        '<option value="3">3 кат. (внедорожник)</option>' +
        "</select></label>";
      var priceRow = form.querySelector(".form-row-2");
      if (priceRow) {
        priceRow.parentNode.insertBefore(block, priceRow);
      } else {
        form.appendChild(block);
      }
    }
    return block;
  }

  function initCatalogAutocomplete(form) {
    var nameInput = form.querySelector('input[name="name"]');
    var priceInput = form.querySelector('input[name="unit_price"]');
    var hiddenId = form.querySelector('input[name="catalog_item_id"]');
    if (!nameInput) return;

    var list = createDropdown(nameInput);
    var tierBlock = ensureTierBlock(form);
    var tierSelect = tierBlock.querySelector('select[name="vehicle_tier"]');
    var materialInput = form.querySelector('input[name="material_cost"]');
    var costPriceInput = form.querySelector('input[name="cost_price"]');
    var lineType = form.querySelector('input[name="line_type"]');
    var type = lineType ? lineType.value : "work";
    var categoryRaw = form.dataset.workCategory || "";
    var category = categoryRaw.indexOf(",") >= 0 ? "" : categoryRaw;
    var selectedItem = null;

    function applyItem(item) {
      selectedItem = item;
      nameInput.value = item.name;
      if (hiddenId) hiddenId.value = String(item.id);
      if (hasTiers(item)) {
        tierBlock.hidden = false;
        var tier = tierSelect ? tierSelect.value : "1";
        if (priceInput) priceInput.value = String(tierPrice(item, tier));
        applyMaterialCost(form, item, tier);
      } else {
        tierBlock.hidden = true;
        if (priceInput) priceInput.value = String(item.default_price);
        applyMaterialCost(form, item, 1);
      }
      list.hidden = true;
    }

    if (tierSelect) {
      tierSelect.addEventListener("change", function () {
        if (selectedItem && priceInput) {
          priceInput.value = String(tierPrice(selectedItem, tierSelect.value));
          applyMaterialCost(form, selectedItem, tierSelect.value);
        }
      });
    }

    function render(items) {
      list.innerHTML = "";
      if (!items.length) {
        list.hidden = true;
        return;
      }
      items.forEach(function (item) {
        var li = document.createElement("li");
        li.className = "ac-item";
        var priceLabel = Number(item.default_price).toLocaleString("ru-RU") + " ₽";
        if (hasTiers(item)) {
          priceLabel +=
            " (2/3: " +
            Number(item.price_tier_2 || 0).toLocaleString("ru-RU") +
            " / " +
            Number(item.price_tier_3 || 0).toLocaleString("ru-RU") +
            ")";
        }
        var materialCost = tierMaterial(item, 1);
        var label = item.name + " — " + priceLabel;
        if (materialCost > 0 || hasTiers(item)) {
          if (hasTiers(item)) {
            label +=
              ", расх. " +
              tierMaterial(item, 1).toLocaleString("ru-RU") +
              " / " +
              tierMaterial(item, 2).toLocaleString("ru-RU") +
              " / " +
              tierMaterial(item, 3).toLocaleString("ru-RU") +
              " ₽";
          } else if (materialCost > 0) {
            label += ", расх. " + materialCost.toLocaleString("ru-RU") + " ₽";
          }
        }
        li.textContent = label;
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          applyItem(item);
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
      selectedItem = null;
      tierBlock.hidden = true;
      if (materialInput) materialInput.value = "0";
      if (costPriceInput) costPriceInput.value = "0";
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
