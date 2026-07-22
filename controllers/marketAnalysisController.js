const { filterMarketData } = require("../lib/marketAnalysis");

const jsonForScript = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

function resolveMarketFilters(query) {
  return {
    service: query.service,
    geography: query.geography
  };
}

function index(req, res) {
  const data = filterMarketData(resolveMarketFilters(req.query));
  res.render("admin/market", {
    user: req.session.user,
    category: "market",
    adminSection: "market",
    snapshotDate: data.snapshotDate,
    service: data.service,
    geography: data.geography,
    kpi: data.kpi,
    priceRows: data.priceRows,
    beltOffers: data.beltOffers,
    localCompetition: data.localCompetition,
    launchPrices: data.launchPrices,
    tips: data.tips,
    marketBootstrap: jsonForScript(data)
  });
}

function apiData(req, res) {
  const data = filterMarketData(resolveMarketFilters(req.query));
  res.json(data);
}

module.exports = { index, apiData };
