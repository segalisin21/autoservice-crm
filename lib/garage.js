const BAY_COUNT = 4;

const BAY_LABELS = {
  1: "Место 1",
  2: "Место 2",
  3: "Место 3",
  4: "Место 4"
};

function listBays() {
  return Array.from({ length: BAY_COUNT }, (_, i) => {
    const id = i + 1;
    return { id, name: BAY_LABELS[id] };
  });
}

function normalizeBay(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > BAY_COUNT) return null;
  return n;
}

module.exports = { BAY_COUNT, BAY_LABELS, listBays, normalizeBay };
