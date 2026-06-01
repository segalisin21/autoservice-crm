async function logActivity(db, { user_id, action, entity_type, entity_id, details }) {
  if (!user_id || !action || !entity_type) return;
  let detailsJson = null;
  if (details != null) {
    try {
      detailsJson = JSON.stringify(details);
    } catch {
      detailsJson = String(details);
    }
  }
  await db.query(
    `INSERT INTO activity_logs(user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
    [user_id, action, entity_type, entity_id ?? null, detailsJson]
  );
}

module.exports = { logActivity };
