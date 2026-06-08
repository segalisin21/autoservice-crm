const express = require("express");

const { getDB } = require("../config/database");

const router = express.Router();

router.get("/search", async (req, res, next) => {
  try {
    const db = await getDB();
    const q = String(req.query.q ?? "").trim();
    const type = String(req.query.type ?? "").trim();
    const category = String(req.query.category ?? "").trim();
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 15));

    if (!q) {
      return res.json({ items: [] });
    }

    const like = `%${q}%`;
    const params = [like];
    let sql = `
      SELECT id, type, category, name, default_price, unit
      FROM catalog_items
      WHERE is_active = 1 AND name LIKE ?
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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
