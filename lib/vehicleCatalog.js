async function searchMarks(db, q, limit = 15) {
  const term = String(q ?? "").trim();
  if (!term) {
    return db.query(
      "SELECT id, autoru_id, name, name_ru FROM vehicle_marks ORDER BY name_ru LIMIT ?",
      [limit]
    );
  }
  const like = `%${term}%`;
  return db.query(
    `
    SELECT id, autoru_id, name, name_ru FROM vehicle_marks
    WHERE name_ru LIKE ? OR name LIKE ? OR autoru_id LIKE ?
    ORDER BY name_ru
    LIMIT ?
  `,
    [like, like, like, limit]
  );
}

async function searchModels(db, markId, q, limit = 15) {
  const id = Number(markId);
  if (!Number.isFinite(id) || id <= 0) return [];
  const term = String(q ?? "").trim();
  if (!term) {
    return db.query(
      `
      SELECT id, mark_id, autoru_id, name, name_ru, year_from, year_to
      FROM vehicle_models WHERE mark_id = ?
      ORDER BY name_ru LIMIT ?
    `,
      [id, limit]
    );
  }
  const like = `%${term}%`;
  return db.query(
    `
    SELECT id, mark_id, autoru_id, name, name_ru, year_from, year_to
    FROM vehicle_models
    WHERE mark_id = ? AND (name_ru LIKE ? OR name LIKE ? OR autoru_id LIKE ?)
    ORDER BY name_ru LIMIT ?
  `,
    [id, like, like, like, limit]
  );
}

async function listGenerations(db, modelId) {
  const id = Number(modelId);
  if (!Number.isFinite(id) || id <= 0) return [];
  return db.query(
    `
    SELECT id, model_id, autoru_id, name, body_type, year_from, year_to
    FROM vehicle_generations WHERE model_id = ?
    ORDER BY year_from DESC, name
  `,
    [id]
  );
}

async function getModelById(db, modelId) {
  const rows = await db.query(
    `
    SELECT m.id, m.mark_id, m.autoru_id AS model_slug, m.name_ru AS model_name, m.year_from, m.year_to,
           mk.name_ru AS mark_name, mk.autoru_id AS mark_slug
    FROM vehicle_models m
    JOIN vehicle_marks mk ON mk.id = m.mark_id
    WHERE m.id = ?
  `,
    [modelId]
  );
  return rows[0] || null;
}

module.exports = { searchMarks, searchModels, listGenerations, getModelById };
