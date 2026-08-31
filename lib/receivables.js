const { parseMoney, round2 } = require("./money");

const PAID_AMOUNT_SUBQUERY = `
  COALESCE((
    SELECT SUM(CASE WHEN p.kind = 'payment' THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END)
    FROM payments p WHERE p.order_id = o.id
  ), 0)
`;

const RECEIVABLES_WHERE = `
  o.status NOT IN ('cancelled')
  AND o.total_price > ${PAID_AMOUNT_SUBQUERY}
`;

const RECEIVABLES_SELECT = `
  SELECT o.id AS order_id, o.status, o.scheduled_date, o.opened_at, o.total_price,
         cl.full_name AS client_name, cl.phone_raw AS client_phone,
         c.license_plate_raw,
         ${PAID_AMOUNT_SUBQUERY} AS paid_amount
  FROM orders o
  LEFT JOIN cars c ON c.id = o.car_id
  LEFT JOIN clients cl ON cl.id = c.client_id
  WHERE ${RECEIVABLES_WHERE}
`;

function decorateReceivableRow(row) {
  const paid = parseMoney(row.paid_amount);
  const total = parseMoney(row.total_price);
  const due = round2(Math.max(0, total - paid));
  return {
    order_id: row.order_id,
    status: row.status,
    scheduled_date: row.scheduled_date,
    opened_at: row.opened_at,
    client_name: row.client_name,
    client_phone: row.client_phone,
    license_plate_raw: row.license_plate_raw,
    total_price: total,
    paid,
    due
  };
}

async function loadReceivablesPage(db, { page = 1, pageSize = 50 } = {}) {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;

  const countRows = await db.query(
    `
    SELECT COUNT(*) AS cnt
    FROM orders o
    WHERE ${RECEIVABLES_WHERE}
  `
  );
  const totalCount = Number(countRows[0]?.cnt) || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const rows = await db.query(
    `
    ${RECEIVABLES_SELECT}
    ORDER BY o.id DESC
    LIMIT ? OFFSET ?
  `,
    [pageSize, offset]
  );

  const items = rows.map(decorateReceivableRow);
  const totalDue = round2(items.reduce((sum, r) => sum + r.due, 0));

  const sumRows = await db.query(
    `
    SELECT COALESCE(SUM(
      CASE WHEN o.total_price > ${PAID_AMOUNT_SUBQUERY}
        THEN o.total_price - ${PAID_AMOUNT_SUBQUERY}
        ELSE 0 END
    ), 0) AS total_due
    FROM orders o
    WHERE ${RECEIVABLES_WHERE}
  `
  );
  const grandTotalDue = round2(Number(sumRows[0]?.total_due) || 0);

  return {
    items,
    page: Math.min(safePage, totalPages),
    totalPages,
    totalCount,
    pageSize,
    totalDueOnPage: totalDue,
    grandTotalDue
  };
}

async function loadAllReceivables(db, limit = 5000) {
  const rows = await db.query(
    `
    ${RECEIVABLES_SELECT}
    ORDER BY o.id DESC
    LIMIT ?
  `,
    [limit]
  );
  return rows.map(decorateReceivableRow);
}

module.exports = {
  PAID_AMOUNT_SUBQUERY,
  RECEIVABLES_WHERE,
  loadReceivablesPage,
  loadAllReceivables,
  decorateReceivableRow
};
