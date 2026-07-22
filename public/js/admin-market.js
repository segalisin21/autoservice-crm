(function () {
  "use strict";

  var C = {
    primary: "#1b4332",
    accent: "#e07a2f",
    gray600: "#4b5563",
    muted: "rgba(27,67,50,0.55)"
  };

  var beltChart = null;
  var boot = window.MARKET_BOOTSTRAP || {};

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillTbody(table, rowsHtml) {
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (tbody) tbody.innerHTML = rowsHtml;
  }

  function renderPriceRows(rows) {
    if (!rows.length) {
      return '<tr><td colspan="7">Нет строк для выбранных фильтров</td></tr>';
    }
    return rows
      .map(function (row) {
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(row.name) +
          "</td>" +
          "<td>" +
          escapeHtml(row.unit) +
          "</td>" +
          "<td>" +
          escapeHtml(row.min) +
          "</td>" +
          "<td>" +
          escapeHtml(row.typical) +
          "</td>" +
          "<td>" +
          escapeHtml(row.high) +
          "</td>" +
          "<td>" +
          escapeHtml(row.competitors) +
          "</td>" +
          "<td>" +
          escapeHtml(row.note) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderLocalRows(rows) {
    if (!rows.length) {
      return '<tr><td colspan="4">Скрыто фильтром географии</td></tr>';
    }
    return rows
      .map(function (row) {
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(row.service) +
          "</td>" +
          "<td>" +
          escapeHtml(row.competitors) +
          "</td>" +
          "<td>" +
          escapeHtml(row.price) +
          "</td>" +
          "<td>" +
          escapeHtml(row.verdict) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderBeltRows(rows) {
    if (!rows.length) {
      return '<tr><td colspan="5">Скрыто фильтром услуги</td></tr>';
    }
    return rows
      .map(function (row) {
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(row.name) +
          "</td>" +
          "<td>" +
          escapeHtml(row.city) +
          "</td>" +
          "<td>" +
          escapeHtml(row.solid) +
          "</td>" +
          "<td>" +
          escapeHtml(row.print) +
          "</td>" +
          "<td>" +
          escapeHtml(row.note) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function updateKpi(kpi) {
    var map = {
      localLeads: kpi.localLeads,
      directBeltOffers: kpi.directBeltOffers,
      russiaBeltTypical: kpi.russiaBeltTypical,
      recommendedStart: kpi.recommendedStart
    };
    Object.keys(map).forEach(function (key) {
      var el = document.querySelector('[data-kpi="' + key + '"]');
      if (el) el.textContent = map[key];
    });
  }

  function buildBeltChart(chartData) {
    var canvas = document.getElementById("beltPriceChart");
    var card = document.getElementById("market-chart-card");
    if (!canvas || typeof Chart === "undefined") return;

    var hasData = chartData && chartData.labels && chartData.labels.length;
    if (card) card.style.display = hasData ? "" : "none";
    if (!hasData) {
      if (beltChart) {
        beltChart.destroy();
        beltChart = null;
      }
      return;
    }

    var median = chartData.medianRub || 7000;
    var cfg = {
      type: "bar",
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: "Цена за 1 ремень, ₽",
            data: chartData.prices,
            backgroundColor: C.muted,
            borderColor: C.primary,
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          annotation: undefined
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, minRotation: 0, font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "₽", color: C.primary, font: { size: 11, weight: "600" } },
            ticks: { color: C.gray600 },
            grid: {
              color: function (ctx) {
                return ctx.tick && ctx.tick.value === median ? "rgba(224,122,47,0.45)" : "rgba(0,0,0,0.06)";
              }
            }
          }
        }
      }
    };

    if (beltChart) {
      beltChart.data = cfg.data;
      beltChart.update();
    } else {
      beltChart = new Chart(canvas.getContext("2d"), cfg);
    }
  }

  function applyPayload(data) {
    updateKpi(data.kpi || {});
    fillTbody(document.getElementById("market-price-table"), renderPriceRows(data.priceRows || []));
    fillTbody(document.getElementById("market-local-table"), renderLocalRows(data.localCompetition || []));
    fillTbody(document.getElementById("market-belts-table"), renderBeltRows(data.beltOffers || []));

    var beltsSection = document.getElementById("market-belts-section");
    if (beltsSection) {
      beltsSection.style.display = data.beltOffers && data.beltOffers.length ? "" : "none";
    }
    var localCard = document.getElementById("market-local-card");
    if (localCard) {
      localCard.style.display = data.localCompetition && data.localCompetition.length ? "" : "none";
    }

    buildBeltChart(data.beltChart || { labels: [], prices: [] });
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
