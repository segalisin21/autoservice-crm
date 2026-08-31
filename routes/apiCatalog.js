const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const { getDB } = require("../config/database");
const {
  normalizeArticle,
  validateArticleFormat,
  findArticleConflict,
  suggestNextArticle
} = require("../lib/catalogArticle");
const { likePatternFolded, lcLike } = require("../lib/sqlSearch");

const router = express.Router();

router.get(
  "/search",
  requirePermission("catalog:view"),
  asyncRoute(async (req, res) => {
    const db = await getDB();
    const q = String(req.query.q ?? "").trim();
    const type = String(req.query.type ?? "").trim();
    const category = String(req.query.category ?? "").trim();
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 15));

    if (!q) {
      return res.json({ items: [] });
    }

    const like = likePatternFolded(q);
    const articleLike = `%${q.toUpperCase()}%`;
    const params = [like, articleLike];
    let sql = `
      SELECT id, type, category, name, article, description, default_price, price_tier_2, price_tier_3,
             default_material_cost, material_cost_tier_2, material_cost_tier_3, unit
      FROM catalog_items
      WHERE is_active = 1 AND (${lcLike("name_lc")} OR article LIKE ?)
    `;
    if (type === "work" || type === "product") {
      sql += " AND type = ?";
      params.push(type);
    }
    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }
    sql += " ORDER BY sort_order, name LIMIT ?";
    params.push(limit);

    const rows = await db.query(sql, params);
    res.json({ items: rows });
  })
);

router.get(
  "/check-article",
  asyncRoute(async (req, res) => {
    const db = await getDB();
    const article = normalizeArticle(req.query.article);
    const excludeId = req.query.exclude_id != null ? Number(req.query.exclude_id) : null;

    const formatErr = validateArticleFormat(article);
    if (formatErr) {
      return res.json({ available: false, error: formatErr });
    }

    const existing = await findArticleConflict(db, article, excludeId);
    if (existing) {
      return res.json({
        available: false,
        existing: {
          id: existing.id,
          name: existing.name,
          type: existing.type,
          category: existing.category
        }
      });
    }
    return res.json({ available: true });
  })
);

router.get(
  "/suggest-article",
  asyncRoute(async (req, res) => {
    const db = await getDB();
    const type = req.query.type === "product" ? "product" : "work";
    const article = await suggestNextArticle(db, type);
    res.json({ article });
  })
);

module.exports = router;
