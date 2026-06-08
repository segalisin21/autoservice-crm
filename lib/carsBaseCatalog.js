const CARS_BASE_URL = process.env.CARS_BASE_URL || "https://api.cars-base.ru/full";
const FETCH_TIMEOUT_MS = Number(process.env.CARS_BASE_TIMEOUT_MS || 120000);

function normalizeCarsBasePayload(apiMarks) {
  return (apiMarks || []).map(function (mark) {
    return {
      autoru_id: String(mark.id || mark.name || "").toLowerCase(),
      name: String(mark.name || mark.id || ""),
      name_ru: String(mark.cyrillic_name || "").trim(),
      models: (mark.models || []).map(function (model) {
        return {
          autoru_id: String(model.id || model.name || ""),
          name: String(model.name || model.id || ""),
          name_ru: String(model.cyrillic_name || "").trim(),
          year_from: model.year_from ?? null,
          year_to: model.year_to ?? null
        };
      })
    };
  });
}

async function fetchCarsBaseMarks() {
  const res = await fetch(CARS_BASE_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`cars-base HTTP ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

async function syncFromCarsBase(db, log) {
  let apiMarks;
  try {
    if (log) log("Загрузка справочника с api.cars-base.ru…");
    apiMarks = await fetchCarsBaseMarks();
  } catch (err) {
    if (log) log(`cars-base: ${err.message}`);
    return { marks: 0, models: 0 };
  }

  const { syncPayload } = require("./autoruCatalog");
  const payload = normalizeCarsBasePayload(apiMarks);
  const stats = await syncPayload(db, payload);
  if (log) log(`cars-base: ${stats.marks} марок, ${stats.models} моделей`);
  return stats;
}

module.exports = {
  CARS_BASE_URL,
  fetchCarsBaseMarks,
  normalizeCarsBasePayload,
  syncFromCarsBase
};
