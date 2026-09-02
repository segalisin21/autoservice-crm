const { getDB } = require("../config/database");
const { loadMarketComparison } = require("../lib/marketBenchmark");

const jsonForScript = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

function resolveMarketFilters(query) {
  return {
    service: query.service,
    geography: query.geography
  };
}

async function index(req, res) {
  const db = await getDB();
  const data = await loadMarketComparison(db, resolveMarketFilters(req.query));

  res.render("admin/market", {
    user: req.session.user,
    category: "market",
    adminSection: "market",
    snapshotDate: data.snapshotDate,
    service: data.service,
    geography: data.geography,
    serviceGroups: data.serviceGroups,
    geographies: data.geographies,
    kpi: data.kpi,
    rows: data.rows,
    gaps: data.gaps,
    missing: data.missing,
    niches: data.niches,
    priceAdvice: data.priceAdvice,
    sources: data.sources,
    tips: data.tips,
    marketBootstrap: jsonForScript(data)
  });
}

async function apiData(req, res) {
  const db = await getDB();
  const data = await loadMarketComparison(db, resolveMarketFilters(req.query));
  res.json(data);
}

module.exports = { index, apiData };
