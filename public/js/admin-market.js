(function () {
  "use strict";

  var C = {
    primary: "#1b4332",
    accent: "#e07a2f",
    gray600: "#4b5563",
    muted: "rgba(27,67,50,0.55)",
    below: "#15803d",
    in: "#6b7280",
    above: "#b45309",
    unknown: "#9ca3af"
  };

  var CHART_META = {
    compare: {
      title: "Наша цена против рынка",
      desc: "Наша цена (каталог или факт по заказам) и середина типичного рыночного диапазона, ₽."
    },
    delta: {
      title: "Отклонение от рынка",
      desc: "Процент относительно середины типичного диапазона конкурентов. Зелёный — ниже рынка, оранжевый — выше."
    },
    distribution: {
      title: "Распределение позиций",
      desc: "Сколько услуг с ценой ниже, внутри или выше типичного рыночного диапазона."
    }
  };

  var positionChart = null;
  var boot = window.MARKET_BOOTSTRAP || {};
  var lastPayload = null;
  var focusedName = null;
  var tableSort = { key: null, dir: "asc" };

  function escapeHtml(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(v) {
    if (v === null || v === undefined || v === "") return "—";
    return Number(v).toLocaleString("ru-RU") + " ₽";
  }

  function deltaLabel(d) {
    if (d === null || d === undefined) return "—";
    return (d > 0 ? "+" : "") + d + "%";
  }

  function positionLabel(p) {
    if (p === "below") return "Ниже рынка";
    if (p === "above") return "Выше рынка";
    if (p === "in") return "В рынке";
    return "Нет цены";
  }

  function marketTypical(row) {
    return (Number(row.typicalLow) + Number(row.typicalHigh)) / 2;
  }

  function truncateLabel(text, maxLen) {
    var s = String(text || "");
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen - 1) + "…";
  }

  function chartHeightForRows(count, chartType) {
    if (chartType === "distribution") return 280;
    var rows = Math.max(1, count || 1);
    return Math.min(640, Math.max(220, rows * 34 + 88));
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function readChartOptions() {
    var typeEl = getEl("market-chart-type");
    var sortEl = getEl("market-chart-sort");
    var limitEl = getEl("market-chart-limit");
    var posEl = getEl("market-chart-position");
    return {
      type: typeEl ? typeEl.value : "compare",
      sort: sortEl ? sortEl.value : "deviation_desc",
      limit: limitEl ? limitEl.value : "12",
      position: posEl ? posEl.value : "all"
    };
  }

  function setChartOptions(opts) {
    var typeEl = getEl("market-chart-type");
    var sortEl = getEl("market-chart-sort");
    var limitEl = getEl("market-chart-limit");
    var posEl = getEl("market-chart-position");
    if (typeEl && opts.type) typeEl.value = opts.type;
    if (sortEl && opts.sort) sortEl.value = opts.sort;
    if (limitEl && opts.limit) limitEl.value = opts.limit;
    if (posEl && opts.position) posEl.value = opts.position;
  }

  function parseUrlChartOptions() {
    var params = new URLSearchParams(window.location.search);
    return {
      type: params.get("chart") || "compare",
      sort: params.get("sort") || "deviation_desc",
      limit: params.get("limit") || "12",
      position: params.get("position") || "all"
    };
  }

  function syncUrlChartOptions(opts) {
    if (!window.history || !window.history.replaceState) return;
    var params = new URLSearchParams(window.location.search);
    params.set("chart", opts.type);
    params.set("sort", opts.sort);
    params.set("limit", opts.limit);
    params.set("position", opts.position);
    window.history.replaceState(null, "", "/admin/market?" + params.toString());
  }

  function sortRows(list, sortKey) {
    var sorted = list.slice();
    sorted.sort(function (a, b) {
      if (sortKey === "name") {
        return String(a.name).localeCompare(String(b.name), "ru");
      }
      if (sortKey === "price_desc") {
        return (b.effectivePrice || 0) - (a.effectivePrice || 0);
      }
      if (sortKey === "deviation_asc") {
        var da = Number.isFinite(a.deltaPct) ? a.deltaPct : Infinity;
        var db = Number.isFinite(b.deltaPct) ? b.deltaPct : Infinity;
        return da - db;
      }
      var absA = Number.isFinite(a.deltaPct) ? Math.abs(a.deltaPct) : -1;
      var absB = Number.isFinite(b.deltaPct) ? Math.abs(b.deltaPct) : -1;
      if (absB !== absA) return absB - absA;
      return (b.effectivePrice || 0) - (a.effectivePrice || 0);
    });
    return sorted;
  }

  function filterChartRows(rows, opts) {
    var list = (rows || []).filter(function (r) {
      return Number.isFinite(r.effectivePrice) && r.effectivePrice > 0;
    });
    if (opts.position && opts.position !== "all") {
      list = list.filter(function (r) {
        return r.position === opts.position;
      });
    }
    if (focusedName) {
      var focus = list.filter(function (r) {
        return r.name === focusedName;
      });
      if (focus.length) return focus;
      focusedName = null;
    }
    list = sortRows(list, opts.sort);
    if (opts.limit !== "all") {
      var n = parseInt(opts.limit, 10);
      if (Number.isFinite(n) && n > 0) list = list.slice(0, n);
    }
    return list;
  }

  function countWithPrice(rows) {
    return (rows || []).filter(function (r) {
      return Number.isFinite(r.effectivePrice) && r.effectivePrice > 0;
    }).length;
  }

  function fillTbody(table, rowsHtml) {
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (tbody) tbody.innerHTML = rowsHtml;
  }

  function priceCell(row) {
    var html = money(row.effectivePrice);
    if (row.priceSource === "orders") {
      html += ' <span class="muted market-price-src">факт</span>';
    } else if (row.priceSource === "none") {
      html += ' <span class="muted market-price-src">нет услуги</span>';
    } else if (row.ourPriceMax && row.ourPriceMax > row.ourPrice) {
      html += ' <span class="muted market-price-src">до ' + Number(row.ourPriceMax).toLocaleString("ru-RU") + "</span>";
    }
    return html;
  }

  function sortTableRows(rows) {
    if (!tableSort.key) return rows;
    var key = tableSort.key;
    var dir = tableSort.dir === "desc" ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var av;
      var bv;
      if (key === "name") {
        av = String(a.name);
        bv = String(b.name);
        return av.localeCompare(bv, "ru") * dir;
      }
      if (key === "effectivePrice") {
        av = a.effectivePrice == null ? -Infinity : a.effectivePrice;
        bv = b.effectivePrice == null ? -Infinity : b.effectivePrice;
      } else if (key === "deltaPct") {
        av = a.deltaPct == null ? -Infinity : a.deltaPct;
        bv = b.deltaPct == null ? -Infinity : b.deltaPct;
      } else {
        av = a[key];
        bv = b[key];
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function renderPriceRows(rows) {
    var opts = readChartOptions();
    var filtered = rows;
    if (opts.position !== "all") {
      filtered = rows.filter(function (r) {
        return r.position === opts.position;
      });
    }
    filtered = sortTableRows(filtered);
    if (!filtered.length) {
      return '<tr><td colspan="8">Нет строк для выбранных фильтров</td></tr>';
    }
    return filtered
      .map(function (row) {
        var selected = focusedName && row.name === focusedName ? " market-table-row--selected" : "";
        return (
          '<tr class="market-table-row' +
          selected +
          '" data-service-name="' +
          escapeHtml(row.name) +
          '" tabindex="0">' +
          "<td>" +
          escapeHtml(row.name) +
          "</td>" +
          "<td>" +
          escapeHtml(row.unit) +
          "</td>" +
          '<td class="num">' +
          priceCell(row) +
          "</td>" +
          "<td>" +
          money(row.min) +
          " – " +
          money(row.typicalLow) +
          "…" +
          money(row.typicalHigh) +
          " – " +
          money(row.high) +
          "</td>" +
          '<td class="num">' +
          deltaLabel(row.deltaPct) +
          "</td>" +
          "<td>" +
          '<span class="market-pos market-pos--' +
          escapeHtml(row.position) +
          '">' +
          positionLabel(row.position) +
          "</span>" +
          "</td>" +
          '<td class="muted">' +
          escapeHtml(row.competitors) +
          "</td>" +
          '<td class="muted">' +
          escapeHtml(row.note) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderGapRows(rows) {
    if (!rows.length) {
      return '<tr><td colspan="5">Все услуги этого фильтра есть в каталоге</td></tr>';
    }
    return rows
      .map(function (row) {
        var f = row.fact || {};
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(row.name) +
          "</td>" +
          '<td class="num">' +
          money(f.min) +
          "</td>" +
          '<td class="num">' +
          money(f.avg) +
          "</td>" +
          '<td class="num">' +
          money(f.max) +
          "</td>" +
          '<td class="num">' +
          (f.count || 0) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function updateKpi(kpi) {
    var map = {
      matchedLabel: kpi.matchedLabel,
      below: kpi.below,
      above: kpi.above,
      notInCatalog: kpi.notInCatalog,
      medianDeltaPct: deltaLabel(kpi.medianDeltaPct)
    };
    Object.keys(map).forEach(function (key) {
      var el = document.querySelector('[data-kpi="' + key + '"]');
      if (el) el.textContent = map[key];
    });
  }

  function updateKpiActiveState(position) {
    document.querySelectorAll(".market-kpi-card").forEach(function (card) {
      var filter = card.getAttribute("data-position-filter");
      card.classList.toggle("market-kpi-card--active", filter === position);
    });
  }

  function updateChartMeta(chartType) {
    var meta = CHART_META[chartType] || CHART_META.compare;
    var titleEl = getEl("market-chart-title");
    var descEl = getEl("market-chart-desc");
    if (titleEl) titleEl.textContent = meta.title;
    if (descEl) descEl.textContent = meta.desc;
    document.querySelectorAll("[data-chart-opt='bar']").forEach(function (el) {
      el.hidden = chartType === "distribution";
    });
  }

  function updateChartNote(opts, slice, total) {
    var noteEl = getEl("market-chart-note");
    if (!noteEl) return;
    if (opts.type === "distribution") {
      noteEl.textContent = "Доля услуг с ценой среди " + total + " позиций для выбранных фильтров.";
      noteEl.hidden = false;
      return;
    }
    if (!slice.length) {
      noteEl.textContent = "Нет услуг с ценой для выбранных фильтров графика.";
      noteEl.hidden = false;
      return;
    }
    if (focusedName) {
      noteEl.textContent = "Фокус на услуге «" + focusedName + "». Нажмите «Сброс» или другую строку таблицы.";
      noteEl.hidden = false;
      return;
    }
    var posHint =
      opts.position !== "all" ? " · фильтр: " + positionLabel(opts.position).toLowerCase() : "";
    if (slice.length < total) {
      noteEl.textContent =
        "На графике " + slice.length + " из " + total + " услуг с ценой" + posHint + ". Полный список — в таблице.";
    } else {
      noteEl.textContent = "Все " + total + " услуг с ценой" + posHint + ".";
    }
    noteEl.hidden = false;
  }

  function deltaBarColor(delta) {
    if (!Number.isFinite(delta)) return C.unknown;
    if (delta < -5) return "rgba(21,128,61,0.75)";
    if (delta > 5) return "rgba(224,122,47,0.75)";
    return "rgba(107,114,128,0.65)";
  }

  function destroyChart() {
    if (positionChart) {
      positionChart.destroy();
      positionChart = null;
    }
  }

  function buildCompareChart(canvas, slice, fullLabels) {
    var labels = slice.map(function (r) {
      return truncateLabel(r.name, 38);
    });
    return {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Наша цена, ₽",
            data: slice.map(function (r) {
              return r.effectivePrice;
            }),
            backgroundColor: C.muted,
            borderColor: C.primary,
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 14,
            maxBarThickness: 18
          },
          {
            label: "Рынок, типично, ₽",
            data: slice.map(function (r) {
              return marketTypical(r);
            }),
            backgroundColor: "rgba(224,122,47,0.35)",
            borderColor: C.accent,
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 14,
            maxBarThickness: 18
          }
        ]
      },
      options: barOptions(fullLabels, "₽", function (v) {
        return Number(v).toLocaleString("ru-RU");
      })
    };
  }

  function buildDeltaChart(canvas, slice, fullLabels) {
    var labels = slice.map(function (r) {
      return truncateLabel(r.name, 38);
    });
    return {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Отклонение, %",
            data: slice.map(function (r) {
              return r.deltaPct;
            }),
            backgroundColor: slice.map(function (r) {
              return deltaBarColor(r.deltaPct);
            }),
            borderWidth: 0,
            borderRadius: 4,
            barThickness: 16,
            maxBarThickness: 20
          }
        ]
      },
      options: barOptions(fullLabels, "%", function (v) {
        return (v > 0 ? "+" : "") + v + "%";
      }, true)
    };
  }

  function buildDistributionChart(rows) {
    var counts = { below: 0, in: 0, above: 0, unknown: 0 };
    rows.forEach(function (r) {
      if (counts[r.position] != null) counts[r.position] += 1;
    });
    return {
      type: "doughnut",
      data: {
        labels: ["Ниже рынка", "В рынке", "Выше рынка", "Нет цены"],
        datasets: [
          {
            data: [counts.below, counts.in, counts.above, counts.unknown],
            backgroundColor: [
              "rgba(21,128,61,0.85)",
              "rgba(107,114,128,0.75)",
              "rgba(224,122,47,0.85)",
              "rgba(156,163,175,0.6)"
            ],
            borderWidth: 2,
            borderColor: "#fff"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (a, b) {
                  return a + b;
                }, 0);
                var val = ctx.raw || 0;
                var pct = total ? Math.round((val / total) * 100) : 0;
                return ctx.label + ": " + val + " (" + pct + "%)";
              }
            }
          }
        },
        onClick: function (_evt, elements) {
          if (!elements.length) return;
          var map = ["below", "in", "above", "unknown"];
          var pos = map[elements[0].index];
          if (pos === "unknown") return;
          setChartOptions({ position: pos, type: "compare" });
          focusedName = null;
          renderChart();
        }
      }
    };
  }

  function barOptions(fullLabels, axisTitle, tickFormat, isDelta) {
    return {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 4, right: 8 } },
      plugins: {
        legend: { display: !isDelta, position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            title: function (items) {
              if (!items.length) return "";
              var idx = items[0].dataIndex;
              return fullLabels[idx] || items[0].label;
            },
            label: function (ctx) {
              if (isDelta) return "Отклонение: " + tickFormat(Number(ctx.raw));
              return ctx.dataset.label + ": " + Number(ctx.raw).toLocaleString("ru-RU") + " ₽";
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: !isDelta,
          title: {
            display: true,
            text: axisTitle,
            color: C.primary,
            font: { size: 11, weight: "600" }
          },
          ticks: {
            color: C.gray600,
            callback: function (v) {
              return tickFormat(Number(v));
            }
          },
          grid: { color: "rgba(0,0,0,0.06)" }
        },
        y: {
          grid: { display: false },
          ticks: {
            color: C.gray600,
            font: { size: 11 },
            autoSkip: false,
            padding: 6
          }
        }
      },
      onClick: function (_evt, elements) {
        if (!elements.length || !lastPayload) return;
        var idx = elements[0].index;
        var opts = readChartOptions();
        var slice = filterChartRows(lastPayload.rows || [], opts);
        if (slice[idx]) {
          focusedName = focusedName === slice[idx].name ? null : slice[idx].name;
          renderChart();
          fillTbody(getEl("market-price-table"), renderPriceRows(lastPayload.rows || []));
        }
      }
    };
  }

  function renderChart() {
    var canvas = getEl("marketPositionChart");
    var wrap = getEl("market-chart-wrap");
    var card = getEl("market-chart-card");
    if (!canvas || typeof Chart === "undefined" || !lastPayload) return;

    var opts = readChartOptions();
    updateChartMeta(opts.type);
    updateKpiActiveState(opts.position);
    syncUrlChartOptions(opts);

    var allRows = lastPayload.rows || [];
    var total = countWithPrice(allRows);
    var slice = filterChartRows(allRows, opts);
    var fullLabels = slice.map(function (r) {
      return r.name;
    });

    var hasData = opts.type === "distribution" ? total > 0 : slice.length > 0;
    if (card) card.style.display = total > 0 || slice.length > 0 ? "" : "none";
    updateChartNote(opts, slice, total);

    if (!hasData) {
      if (wrap) wrap.style.height = "";
      destroyChart();
      return;
    }

    var rowCount = opts.type === "distribution" ? 1 : slice.length;
    if (wrap) wrap.style.height = chartHeightForRows(rowCount, opts.type) + "px";

    var cfg;
    if (opts.type === "delta") {
      cfg = buildDeltaChart(canvas, slice, fullLabels);
    } else if (opts.type === "distribution") {
      cfg = buildDistributionChart(allRows);
    } else {
      cfg = buildCompareChart(canvas, slice, fullLabels);
    }

    destroyChart();
    positionChart = new Chart(canvas.getContext("2d"), cfg);
  }

  function applyPayload(data) {
    lastPayload = data;
    updateKpi(data.kpi || {});
    fillTbody(getEl("market-price-table"), renderPriceRows(data.rows || []));
    fillTbody(getEl("market-gaps-table"), renderGapRows(data.gaps || []));
    renderChart();
  }

  function queryFromForm() {
    var serviceEl = getEl("market-service");
    var geoEl = getEl("market-geography");
    var params = new URLSearchParams(window.location.search);
    params.set("service", serviceEl ? serviceEl.value : "all");
    params.set("geography", geoEl ? geoEl.value : "all");
    var chartOpts = readChartOptions();
    params.set("chart", chartOpts.type);
    params.set("sort", chartOpts.sort);
    params.set("limit", chartOpts.limit);
    params.set("position", chartOpts.position);
    return params.toString();
  }

  function fetchAndApply() {
    focusedName = null;
    var qs = queryFromForm();
    fetch("/admin/market/api/data?" + qs, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("market api " + r.status);
        return r.json();
      })
      .then(function (data) {
        applyPayload(data);
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", "/admin/market?" + qs);
        }
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  function resetChartControls() {
    focusedName = null;
    setChartOptions({
      type: "compare",
      sort: "deviation_desc",
      limit: "12",
      position: "all"
    });
    renderChart();
    fillTbody(getEl("market-price-table"), renderPriceRows(lastPayload.rows || []));
  }

  function bindChartControls() {
    ["market-chart-type", "market-chart-sort", "market-chart-limit", "market-chart-position"].forEach(function (id) {
      var el = getEl(id);
      if (!el) return;
      el.addEventListener("change", function () {
        focusedName = null;
        renderChart();
        fillTbody(getEl("market-price-table"), renderPriceRows(lastPayload.rows || []));
      });
    });

    var resetBtn = getEl("market-chart-reset");
    if (resetBtn) resetBtn.addEventListener("click", resetChartControls);
  }

  function bindKpiCards() {
    document.querySelectorAll(".market-kpi-card").forEach(function (card) {
      function activate() {
        var pos = card.getAttribute("data-position-filter") || "all";
        setChartOptions({ position: pos });
        focusedName = null;
        renderChart();
        fillTbody(getEl("market-price-table"), renderPriceRows(lastPayload.rows || []));
        var wrap = getEl("market-chart-wrap");
        if (wrap && wrap.scrollIntoView) wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      card.addEventListener("click", activate);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  function bindTableInteractions() {
    var table = getEl("market-price-table");
    if (!table) return;

    table.addEventListener("click", function (e) {
      var row = e.target.closest(".market-table-row");
      if (!row) return;
      var name = row.getAttribute("data-service-name");
      focusedName = focusedName === name ? null : name;
      renderChart();
      fillTbody(table, renderPriceRows(lastPayload.rows || []));
      if (focusedName) {
        var wrap = getEl("market-chart-wrap");
        if (wrap && wrap.scrollIntoView) wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    table.querySelectorAll("thead th").forEach(function (th) {
      var key = th.getAttribute("data-sort");
      if (!key) return;
      th.classList.add("market-th-sortable");
      th.addEventListener("click", function () {
        if (tableSort.key === key) {
          tableSort.dir = tableSort.dir === "asc" ? "desc" : "asc";
        } else {
          tableSort.key = key;
          tableSort.dir = key === "name" ? "asc" : "desc";
        }
        table.querySelectorAll("thead th[data-sort]").forEach(function (h) {
          h.classList.remove("market-th-sortable--asc", "market-th-sortable--desc");
          if (h.getAttribute("data-sort") === tableSort.key) {
            h.classList.add(tableSort.dir === "asc" ? "market-th-sortable--asc" : "market-th-sortable--desc");
          }
        });
        fillTbody(table, renderPriceRows(lastPayload.rows || []));
      });
    });
  }

  function bindFilters() {
    var form = getEl("marketFilter");
    if (!form) return;
    form.addEventListener("change", function (e) {
      if (e.target && (e.target.id === "market-service" || e.target.id === "market-geography")) {
        fetchAndApply();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setChartOptions(parseUrlChartOptions());
    applyPayload(boot);
    bindChartControls();
    bindKpiCards();
    bindTableInteractions();
    bindFilters();
  });
})();
