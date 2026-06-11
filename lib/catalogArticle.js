const ARTICLE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/;

function normalizeArticle(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase();
}

function validateArticleFormat(article) {
  if (!article) return "Укажите артикул";
  if (article.length < 2 || article.length > 32) return "Артикул: от 2 до 32 символов";
  if (!ARTICLE_RE.test(article)) {
    return "Артикул: латиница, цифры, точка, дефис, подчёркивание";
  }
  return null;
}

function articlePrefix(type) {
  return type === "product" ? "P" : "W";
}

function formatSuggestedArticle(type, seq) {
  return `${articlePrefix(type)}-${String(seq).padStart(5, "0")}`;
}

async function findArticleConflict(db, article, excludeId = null) {
  const norm = normalizeArticle(article);
  if (!norm) return null;
  const params = [norm];
  let sql = `
    SELECT id, type, category, name, article
    FROM catalog_items
    WHERE upper(trim(article)) = ?
  `;
  if (excludeId != null && Number.isFinite(Number(excludeId))) {
    sql += " AND id != ?";
    params.push(Number(excludeId));
  }
  sql += " LIMIT 1";
  const rows = await db.query(sql, params);
  return rows[0] || null;
}

async function suggestNextArticle(db, type) {
  const prefix = articlePrefix(type);
  const pattern = `${prefix}-%`;
  const rows = await db.query(
    `
    SELECT article FROM catalog_items
    WHERE upper(article) LIKE ?
    ORDER BY article DESC
    LIMIT 1
  `,
    [`${prefix}-%`]
  );
  let next = 1;
  if (rows.length) {
    const m = String(rows[0].article).match(/(\d+)\s*$/);
    if (m) next = Number(m[1]) + 1;
  }
  let candidate = formatSuggestedArticle(type, next);
  for (let i = 0; i < 1000; i++) {
    const conflict = await findArticleConflict(db, candidate);
    if (!conflict) return candidate;
    next += 1;
    candidate = formatSuggestedArticle(type, next);
  }
  return formatSuggestedArticle(type, Date.now() % 100000);
}

module.exports = {
  normalizeArticle,
  validateArticleFormat,
  findArticleConflict,
  suggestNextArticle,
  formatSuggestedArticle
};
