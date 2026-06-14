/** Required fields for POST /orders after minimal new-order form. */
function minimalOrderPayload(ctx, overrides = {}) {
  return {
    scheduled_date: "2026-05-27",
    start_time: "10:00",
    assigned_user_id: String(ctx.users.master.id),
    ...overrides
  };
}

module.exports = { minimalOrderPayload };
