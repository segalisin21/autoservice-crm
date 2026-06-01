const ORDER_STATUS_LABELS = {
  scheduled: "Запись",
  in_progress: "В работе",
  ready: "Готов",
  completed: "Завершён",
  cancelled: "Отменён"
};

function statusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status;
}

module.exports = { ORDER_STATUS_LABELS, statusLabel };
