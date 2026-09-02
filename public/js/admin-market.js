(function () {
  "use strict";

  var C = {
    primary: "#1b4332",
    accent: "#e07a2f",
    gray600: "#4b5563",
    muted: "rgba(27,67,50,0.55)"
  };

  var positionChart = null;
  var boot = window.MARKET_BOOTSTRAP || {};

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

  function renderPriceRows(rows) {
    if (!rows.length) {
      return '<tr><td colspan="8">Нет строк для выбранных фильтров</td></tr>';
    }
    return rows
      .map(function (row) {
        return (
          "<tr>" +
          "<td>" + escapeHtml(row.name) + "</td>" +
          "<td>" + escapeHtml(row.unit) + "</td>" +
          '<td class="num">' + priceCell(row) + "</td>" +
          "<td>" +
          money(row.min) + " – " + money(row.typicalLow) + "…" + money(row.typicalHigh) + " – " + money(row.high) +
          "</td>" +
          '<td class="num">' + deltaLabel(row.deltaPct) + "</td>" +
          "<td>" +
          '<span class="market-pos market-pos--' + escapeHtml(row.position) + '">' +
          positionLabel(row.position) +
          "</span>" +
          "</td>" +
          '<td class="muted">' + escapeHtml(row.competitors) + "</td>" +
          '<td class="muted">' + escapeHtml(row.note) + "</td>" +
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
          "<td>" + escapeHtml(row.name) + "</td>" +
          '<td class="num">' + money(f.min) + "</td>" +
          '<td class="num">' + money(f.avg) + "</td>" +
          '<td class="num">' + money(f.max) + "</td>" +
          '<td class="num">' + (f.count || 0) + "</td>" +
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

  function buildPositionChart(chartData) {
    var canvas = document.getElementById("marketPositionChart");
    var card = document.getElementById("market-chart-card");
    if (!canvas || typeof Chart === "undefined") return;

    var hasData = chartData && chartData.labels && chartData.labels.length;
    if (card) card.style.display = hasData ? "" : "none";
    if (!hasData) {
      if (positionChart) {
        positionChart.destroy();
        positionChart = null;
      }
      return;
    }

    var cfg = {
      type: "bar",
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: "Наша цена, ₽",
            data: chartData.ourPrices,
            backgroundColor: C.muted,
            borderColor: C.primary,
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: "Рынок, типично, ₽",
            data: chartData.marketTypical,
            backgroundColor: "rgba(224,122,47,0.35)",
            borderColor: C.accent,
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top", labels: { boxWidth: 12, font: { size: 11 } } }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: "₽", color: C.primary, font: { size: 11, weight: "600" } },
            ticks: { color: C.gray600 },
            grid: { color: "rgba(0,0,0,0.06)" }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 10 }, autoSkip: false }
          }
        }
      }
    };

    if (positionChart) {
      positionChart.data = cfg.data;
      positionChart.options.indexAxis = "y";
      positionChart.update();
    } else {
      positionChart = new Chart(canvas.getContext("2d"), cfg);
    }
  }

  function applyPayload(data) {
    updateKpi(data.kpi || {});
    fillTbody(document.getElementById("market-price-table"), renderPriceRows(data.rows || []));
    fillTbody(document.getElementById("market-gaps-table"), renderGapRows(data.gaps || []));
    buildPositionChart(data.chart || { labels: [] });
  }

  function queryFromForm() {
    var serviceEl = document.getElementById("market-service");
    var geoEl = document.getElementById("market-geography");
    var params = new URLSearchParams();
    params.set("service", serviceEl ? serviceEl.value : "all");
    params.set("geography", geoEl ? geoEl.value : "all");
    return params.toString();
  }

  function fetchAndApply() {
    var qs = queryFromForm();
    var url = "/admin/market/api/data?" + qs;
    fetch(url, { headers: { Accept: "application/json" } })
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

  function bindFilters() {
    var form = document.getElementById("marketFilter");
    if (!form) return;
    form.addEventListener("change", function (e) {
      if (e.target && (e.target.id === "market-service" || e.target.id === "market-geography")) {
        fetchAndApply();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyPayload(boot);
    bindFilters();
  });
})();
