const { parseMoney, round2 } = require("./money");
const { filterMarketData } = require("./marketAnalysis");

const FACT_LOOKBACK_LIMIT = 500;

function median(numbers) {
  const sorted = numbers.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round2((sorted[mid - 1] + sorted[mid]) / 2);
}

async function loadCatalogByArticle(db) {
  const rows = await db.query(
    `SELECT article, name, category, default_price, price_tier_2, price_tier_3, is_active
     FROM catalog_items`
  );
  const byArticle = new Map();
  for (const row of rows) {
    if (!row.article) continue;
    byArticle.set(String(row.article).toUpperCase(), {
      article: row.article,
      name: row.name,
      category: row.category,
      defaultPrice: parseMoney(row.default_price),
      tier2: row.price_tier_2 == null ? null : parseMoney(row.price_tier_2),
      tier3: row.price_tier_3 == null ? null : parseMoney(row.price_tier_3),
      isActive: Number(row.is_active) === 1
    });
  }
  return byArticle;
}

/**
 * Average / min / max unit price actually charged for lines matching any of the
 * LIKE patterns. Used for directions that live only in order_lines.
 */
async function loadFactPrice(db, patterns) {
  if (!Array.isArray(patterns) || !patterns.length) return null;

  const where = patterns.map(() => "ol.name_lc LIKE ?").join(" OR ");
  const rows = await db.query(
    `SELECT ol.unit_price, ol.name
     FROM order_lines ol
     WHERE ol.line_type = 'work'
       AND ol.unit_price > 0
       AND (${where})
     ORDER BY ol.id DESC
     LIMIT ?`,
    [...patterns, FACT_LOOKBACK_LIMIT]
  );

  const prices = rows.map((r) => parseMoney(r.unit_price)).filter((n) => n > 0);
  if (!prices.length) return null;

  return {
    count: prices.length,
    min: round2(Math.min(...prices)),
    max: round2(Math.max(...prices)),
    avg: round2(prices.reduce((sum, n) => sum + n, 0) / prices.length),
    sampleName: rows[0]?.name || null
  };
}

function resolveOurPrice(row, catalogByArticle) {
  const matched = (row.crmArticles || [])
    .map((article) => catalogByArticle.get(String(article).toUpperCase()))
    .filter(Boolean);

  if (!matched.length) return { ourPrice: null, ourPriceMax: null, matchedItems: [] };

  const active = matched.filter((item) => item.isActive);
  const pool = active.length ? active : matched;

  const basePrices = pool.map((item) => item.defaultPrice).filter((n) => n > 0);
  const topPrices = pool
    .flatMap((item) => [item.tier3, item.tier2, item.defaultPrice])
    .filter((n) => Number.isFinite(n) && n > 0);

  return {
    ourPrice: basePrices.length ? round2(Math.min(...basePrices)) : null,
    ourPriceMax: topPrices.length ? round2(Math.max(...topPrices)) : null,
    matchedItems: pool.map((item) => ({
      article: item.article,
      name: item.name,
      price: item.defaultPrice,
      isActive: item.isActive
    }))
  };
}

/**
 * Where our price sits relative to the typical market band.
 * @returns {"below"|"in"|"above"|"unknown"}
 */
function resolvePosition(price, row) {
  if (!Number.isFinite(price) || price <= 0) return "unknown";
  if (price < row.typicalLow) return "below";
  if (price > row.typicalHigh) return "above";
  return "in";
}

function resolveDeltaPct(price, row) {
  if (!Number.isFinite(price) || price <= 0) return null;
  const mid = (Number(row.typicalLow) + Number(row.typicalHigh)) / 2;
  if (!mid) return null;
  return Math.round(((price - mid) / mid) * 100);
}

/**
 * Joins the static market snapshot with our catalog and order history.
 *
 * @param {import("../config/database")} db
 * @param {{ service?: string, geography?: string }} filters
 */
async function loadMarketComparison(db, filters = {}) {
  const data = filterMarketData(filters);
  const catalogByArticle = await loadCatalogByArticle(db);

  const factCache = new Map();
  const rows = [];
  for (const row of data.rows) {
    const { ourPrice, ourPriceMax, matchedItems } = resolveOurPrice(row, catalogByArticle);

    const factKey = Array.isArray(row.factMatch) ? row.factMatch.join("|") : "";
    if (factKey && !factCache.has(factKey)) {
      factCache.set(factKey, await loadFactPrice(db, row.factMatch));
    }
    const fact = factKey ? factCache.get(factKey) : null;
    const effectivePrice = ourPrice != null ? ourPrice : fact?.avg ?? null;
    const priceSource = ourPrice != null ? "catalog" : fact ? "orders" : "none";

    rows.push({
      group: row.group,
      geography: row.geography,
      name: row.name,
      unit: row.unit,
      min: row.min,
      typicalLow: row.typicalLow,
      typicalHigh: row.typicalHigh,
      high: row.high,
      competitors: row.competitors,
      note: row.note,
      inCatalog: matchedItems.length > 0,
      matchedItems,
      ourPrice,
      ourPriceMax,
      fact,
      effectivePrice,
      priceSource,
      position: resolvePosition(effectivePrice, row),
      deltaPct: resolveDeltaPct(effectivePrice, row)
    });
  }

  const comparable = rows.filter((r) => r.position !== "unknown");
  const below = comparable.filter((r) => r.position === "below");
  const above = comparable.filter((r) => r.position === "above");
  const gaps = rows.filter((r) => !r.inCatalog && r.priceSource === "orders");
  const missing = rows.filter((r) => !r.inCatalog && r.priceSource === "none");

  const kpi = {
    matched: comparable.length,
    total: rows.length,
    matchedLabel: `${comparable.length} из ${rows.length}`,
    below: below.length,
    above: above.length,
    notInCatalog: gaps.length,
    medianDeltaPct: median(comparable.map((r) => r.deltaPct))
  };

  const chart = buildChart(rows);

  return { ...data, rows, kpi, chart, gaps, missing };
}

function buildChart(rows) {
  const withPrice = rows.filter((r) => Number.isFinite(r.effectivePrice) && r.effectivePrice > 0);
  return {
    labels: withPrice.map((r) => r.name),
    ourPrices: withPrice.map((r) => r.effectivePrice),
    marketTypical: withPrice.map((r) => round2((r.typicalLow + r.typicalHigh) / 2)),
    marketMin: withPrice.map((r) => r.min),
    marketHigh: withPrice.map((r) => r.high)
  };
}

module.exports = {
  loadMarketComparison,
  resolvePosition,
  resolveDeltaPct,
  loadFactPrice,
  loadCatalogByArticle
};
