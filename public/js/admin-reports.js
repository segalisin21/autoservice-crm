(function () {
  "use strict";

  var C = {
    primary: "#1b4332",
    accent: "#e07a2f",
    success: "#10b981",
    purple: "#8b5cf6",
    muted: "#e5e7eb",
    gray600: "#4b5563"
  };
  var DOUGHNUT_BG = [
    "rgba(27,67,50,0.85)",
    "rgba(64,145,108,0.85)",
    "rgba(224,122,47,0.9)",
    "rgba(59,130,246,0.85)",
    "rgba(139,92,246,0.85)",
    "rgba(16,185,129,0.85)",
    "rgba(245,158,11,0.9)",
    "rgba(220,38,38,0.75)"
  ];

  var revenueChart;
  var monthlyChart;
  var categoryChart;
  var topServicesChart;

  var boot = window.REPORT_BOOTSTRAP || {};

  function formatRuDayLabel(iso) {
    var s = String(iso);
    var t = s.indexOf("T");
    if (t !== -1) s = s.slice(0, t);
    var p = s.split("-");
    if (p.length !== 3) return s;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  }

  function formatRuMonthLabel(ym) {
    var p = String(ym).split("-");
    if (p.length !== 2) return ym;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, 1);
    if (Number.isNaN(d.getTime())) return ym;
    return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }

  function chartScalesDual() {
    return {
      x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0 } },
      y: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        title: { display: true, text: "₽", color: C.primary, font: { size: 11, weight: "600" } },
        ticks: { color: C.gray600 }
      },
      y1: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Заказы", color: C.accent, font: { size: 11, weight: "600" } },
        ticks: { color: C.gray600 }
      }
    };
  }

  function commonChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 16, font: { size: 12 } }
        }
      }
    };
  }

  function buildRevenueDayChart(ctx, dayRows) {
    return new Chart(ctx, {
      type: "bar",
      data: {
        labels: dayRows.map(function (d) {
          return formatRuDayLabel(d.date);
        }),
        datasets: [
          {
            type: "bar",
            label: "Выручка, ₽",
            data: dayRows.map(function (d) {
              return d.revenue;
            }),
            backgroundColor: "rgba(27,67,50,0.55)",
            borderColor: C.primary,
            borderWidth: 1,
            borderRadius: 6,
            yAxisID: "y",
            order: 2
          },
          {
            type: "line",
            label: "Заказов, шт.",
            data: dayRows.map(function (d) {
              return d.count;
            }),
            borderColor: C.accent,
            backgroundColor: "rgba(224,122,47,0.15)",
            tension: 0.35,
            fill: false,
            pointRadius: 3,
            yAxisID: "y1",
            order: 1
          }
        ]
      },
      options: Object.assign({}, commonChartOptions(), { scales: chartScalesDual() })
    });
  }

  function buildMonthlyMixChart(ctx, monthRows) {
    return new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthRows.map(function (d) {
          return formatRuMonthLabel(d.month);
        }),
        datasets: [
          {
            type: "bar",
            label: "Выручка, ₽",
            data: monthRows.map(function (d) {
              return d.revenue;
            }),
            backgroundColor: "rgba(16,185,129,0.45)",
            borderColor: C.success,
            borderWidth: 1,
            borderRadius: 6,
            yAxisID: "y",
            order: 2
          },
          {
            type: "line",
            label: "Заказов, шт.",
            data: monthRows.map(function (d) {
              return d.bookings;
            }),
            borderColor: C.purple,
            tension: 0.35,
            fill: true,
            pointRadius: 3,
            yAxisID: "y1",
            order: 1
          }
        ]
      },
      options: Object.assign({}, commonChartOptions(), { scales: chartScalesDual() })
    });
  }

  function buildCategoryDoughnut(ctx, rows) {
    var labels = [];
    var data = [];
    var colors = [];
    if (!rows || !rows.length) {
      labels = ["Нет данных"];
      data = [1];
      colors = [C.muted];
    } else {
      rows.forEach(function (r, i) {
        labels.push(String(r.category || "—"));
        data.push(r.revenue);
        colors.push(DOUGHNUT_BG[i % DOUGHNUT_BG.length]);
      });
    }
    return new Chart(ctx, {
      type: "doughnut",
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  function buildTopServicesHBar(ctx, rows) {
    var slice = (rows || []).slice(0, 8);
    var labels = [];
    var data = [];
    if (!slice.length) {
      labels = ["Нет данных"];
      data = [0];
    } else {
      slice.forEach(function (r) {
        var name = String(r.name || "");
        if (name.length > 36) name = name.slice(0, 34) + "…";
        labels.push(name);
        data.push(parseFloat(r.revenue) || 0);
      });
    }
    return new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Выручка",
            data: data,
            backgroundColor: "rgba(45,106,79,0.75)",
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    });
  }

  function updateDualAxisChart(chart, rows, revenueKey, countKey, labelFormatter) {
    if (!chart) return;
    chart.data.labels = rows.map(function (d) {
      var raw = d.date !== undefined ? d.date : d.month;
      return labelFormatter ? labelFormatter(raw) : raw;
    });
    chart.data.datasets[0].data = rows.map(function (d) {
      return d[revenueKey];
    });
    chart.data.datasets[1].data = rows.map(function (d) {
      return d[countKey];
    });
    chart.update();
  }

  function fetchData() {
    var periodEl = document.querySelector("#report-period");
    var period = periodEl ? periodEl.value : "30";
    var params = new URLSearchParams();
    if (period === "custom") {
      params.set("period", "custom");
      var sd = document.querySelector('#reportFilter input[name="start_date"]');
      var ed = document.querySelector('#reportFilter input[name="end_date"]');
      if (sd && sd.value) params.set("start_date", sd.value);
      if (ed && ed.value) params.set("end_date", ed.value);
    } else {
      params.set("period", period);
    }

    fetch("/admin/reports/api/data?" + params.toString())
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var o = data.overview;
        var el;
        el = document.querySelector(".stat-card.stat-blue .stat-value");
        if (el) el.textContent = o.totalOrders;
        el = document.querySelector(".stat-card.stat-green .stat-value");
        if (el) el.textContent = o.totalRevenue.toLocaleString("ru-RU") + " ₽";
        el = document.querySelector(".stat-card.stat-purple .stat-value");
        if (el) el.textContent = o.avgBookingValue.toLocaleString("ru-RU") + " ₽";
        el = document.querySelector(".stat-card.stat-orange .stat-value");
        if (el) el.textContent = o.completedBookings;
        el = document.querySelector(".stat-analytics-retained .stat-value");
        if (el) el.textContent = o.cancelledBookings;
        el = document.querySelector(".stat-analytics-retained-sum .stat-value");
        if (el) el.textContent = o.cashIn.toLocaleString("ru-RU") + " ₽";

        if (data.range) {
          var sdi = document.querySelector('#reportFilter input[name="start_date"]');
          var edi = document.querySelector('#reportFilter input[name="end_date"]');
          if (sdi) sdi.value = data.range.startDate;
          if (edi) edi.value = data.range.endDate;
        }

        updateDualAxisChart(revenueChart, data.revenueByDay, "revenue", "count", formatRuDayLabel);
        updateDualAxisChart(monthlyChart, data.monthlyComparison, "revenue", "bookings", formatRuMonthLabel);
        if (categoryChart && data.revenueByCategory) {
          categoryChart.data.labels = data.revenueByCategory.map(function (r) {
            return r.category;
          });
          categoryChart.data.datasets[0].data = data.revenueByCategory.map(function (r) {
            return r.revenue;
          });
          categoryChart.update();
        }
        if (topServicesChart) {
          topServicesChart.destroy();
          topServicesChart = buildTopServicesHBar(document.getElementById("topServicesChart"), data.topServices);
        }
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof Chart === "undefined") return;

    Chart.defaults.font.family =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    Chart.defaults.color = "#4b5563";

    revenueChart = buildRevenueDayChart(document.getElementById("revenueChart"), boot.revenueByDay || []);
    monthlyChart = buildMonthlyMixChart(document.getElementById("monthlyChart"), boot.monthlyComparison || []);
    categoryChart = buildCategoryDoughnut(document.getElementById("categoryChart"), boot.revenueByCategory || []);
    topServicesChart = buildTopServicesHBar(document.getElementById("topServicesChart"), boot.topServices || []);

    var periodSel = document.getElementById("report-period");
    if (periodSel) {
      periodSel.addEventListener("change", function () {
        if (periodSel.value !== "custom") fetchData();
      });
    }
    var btnApply = document.getElementById("btn-apply-range");
    if (btnApply) {
      btnApply.addEventListener("click", function () {
        if (periodSel) periodSel.value = "custom";
        fetchData();
      });
    }
  });
})();
