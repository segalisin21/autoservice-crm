(function () {
  var form = document.getElementById("order-print-form");
  if (!form) return;

  var snapshotInput = document.getElementById("snapshot-json");
  var template = document.getElementById("line-row-template");
  var printBtn = document.getElementById("print-btn");
  var docDateField = document.getElementById("field-doc_date");
  var printDocDate = document.querySelector(".print-doc-date");

  function parseNum(v) {
    var n = parseFloat(String(v || "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function fieldValue(name) {
    var el = form.querySelector('[data-field="' + name + '"]');
    return el ? el.value : "";
  }

  function collectLines(tbody) {
    var lines = [];
    tbody.querySelectorAll(".line-row").forEach(function (row) {
      var name = (row.querySelector(".line-name") || {}).value || "";
      if (!String(name).trim()) return;
      lines.push({
        name: String(name).trim(),
        notes: String((row.querySelector(".line-notes") || {}).value || "").trim(),
        quantity: String((row.querySelector(".line-qty") || {}).value || "1"),
        unit_price: String((row.querySelector(".line-price") || {}).value || "0"),
        total: String((row.querySelector(".line-total") || {}).value || "0")
      });
    });
    return lines;
  }

  function sumLines(tbody) {
    var sum = 0;
    tbody.querySelectorAll(".line-row").forEach(function (row) {
      var name = (row.querySelector(".line-name") || {}).value || "";
      if (!String(name).trim()) return;
      sum += parseNum((row.querySelector(".line-total") || {}).value);
    });
    return sum;
  }

  function recalcRow(row, fromQtyPrice) {
    var qtyEl = row.querySelector(".line-qty");
    var priceEl = row.querySelector(".line-price");
    var totalEl = row.querySelector(".line-total");
    if (!qtyEl || !priceEl || !totalEl) return;
    if (fromQtyPrice) {
      totalEl.value = fmt(parseNum(qtyEl.value) * parseNum(priceEl.value));
    }
    recalcTotals();
  }

  function recalcTotals() {
    var worksBody = document.getElementById("works-body");
    var productsBody = document.getElementById("products-body");
    var subWorks = sumLines(worksBody);
    var subProducts = sumLines(productsBody);
    var discount = parseNum(fieldValue("discount_amount"));
    var total = Math.max(0, subWorks + subProducts - discount);

    var sw = document.getElementById("subtotal-works");
    var sp = document.getElementById("subtotal-products");
    var tp = document.getElementById("total-price");
    if (sw) sw.textContent = fmt(subWorks);
    if (sp) sp.textContent = fmt(subProducts);
    if (tp) tp.textContent = fmt(total);
  }

  function bindRow(row) {
    var qtyEl = row.querySelector(".line-qty");
    var priceEl = row.querySelector(".line-price");
    var totalEl = row.querySelector(".line-total");
    [qtyEl, priceEl].forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", function () {
        recalcRow(row, true);
      });
      el.addEventListener("blur", function () {
        recalcRow(row, true);
      });
    });
    if (totalEl) {
      totalEl.addEventListener("input", recalcTotals);
      totalEl.addEventListener("blur", recalcTotals);
    }
    var removeBtn = row.querySelector(".line-remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        row.remove();
        recalcTotals();
      });
    }
  }

  function addRow(kind) {
    var body = document.getElementById(kind === "works" ? "works-body" : "products-body");
    if (!body || !template) return;
    var row = template.content.firstElementChild.cloneNode(true);
    row.setAttribute("data-kind", kind);
    body.appendChild(row);
    bindRow(row);
    row.querySelector(".line-name").focus();
  }

  document.querySelectorAll("[data-add-line]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      addRow(btn.getAttribute("data-add-line"));
    });
  });

  form.querySelectorAll(".line-row").forEach(bindRow);

  var discountField = document.getElementById("field-discount");
  if (discountField) {
    discountField.addEventListener("input", recalcTotals);
    discountField.addEventListener("blur", recalcTotals);
  }

  function syncNotesForPrint() {
    form.querySelectorAll(".line-row").forEach(function (row) {
      var notesEl = row.querySelector(".line-notes");
      var printEl = row.querySelector(".line-notes-print");
      if (!notesEl || !printEl) return;
      var text = String(notesEl.value || "").trim();
      if (text) {
        printEl.textContent = text;
        printEl.removeAttribute("hidden");
      } else {
        printEl.textContent = "";
        printEl.setAttribute("hidden", "");
      }
    });
  }

  function collectSnapshot() {
    return {
      doc_date: docDateField ? docDateField.value : "",
      client_name: fieldValue("client_name"),
      client_phone: fieldValue("client_phone"),
      car_make: fieldValue("car_make"),
      car_model: fieldValue("car_model"),
      car_year: fieldValue("car_year"),
      license_plate: fieldValue("license_plate"),
      vin: fieldValue("vin"),
      mileage: fieldValue("mileage"),
      scheduled_date: fieldValue("scheduled_date"),
      scheduled_end_date: fieldValue("scheduled_end_date"),
      works: collectLines(document.getElementById("works-body")),
      products: collectLines(document.getElementById("products-body")),
      subtotal_works: document.getElementById("subtotal-works").textContent,
      subtotal_products: document.getElementById("subtotal-products").textContent,
      discount_amount: fieldValue("discount_amount"),
      total_price: document.getElementById("total-price").textContent
    };
  }

  form.addEventListener("submit", function () {
    recalcTotals();
    if (snapshotInput) snapshotInput.value = JSON.stringify(collectSnapshot());
  });

  if (printBtn) {
    printBtn.addEventListener("click", function () {
      recalcTotals();
      if (printDocDate && docDateField) printDocDate.textContent = docDateField.value;
      syncNotesForPrint();
      window.print();
    });
  }

  syncNotesForPrint();
  recalcTotals();
})();
