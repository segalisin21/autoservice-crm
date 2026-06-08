const { sqlNow } = require("../config/sqlDialect");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const CATALOG_ROOT = "https://auto.ru/catalog/cars/";
const REQUEST_DELAY_MS = Number(process.env.AUTORU_SYNC_DELAY_MS || 350);

const MARK_NAME_OVERRIDES = {
  vaz: "LADA (ВАЗ)",
  uaz: "УАЗ",
  gaz: "ГАЗ"
};

const BODY_TYPE_LABELS = {
  SEDAN: "Седан",
  HATCHBACK_3_DOORS: "Хэтчбек 3 дв.",
  HATCHBACK_5_DOORS: "Хэтчбек 5 дв.",
  WAGON_5_DOORS: "Универсал",
  LIFTBACK: "Лифтбек",
  COUPE: "Купе",
  CABRIO: "Кабриолет",
  SUV: "Внедорожник",
  SUV_3_DOORS: "Внедорожник 3 дв.",
  SUV_5_DOORS: "Внедорожник 5 дв.",
  MINIVAN: "Минивэн",
  PICKUP: "Пикап",
  VAN: "Фургон"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugToTitle(slug) {
  if (MARK_NAME_OVERRIDES[slug]) return MARK_NAME_OVERRIDES[slug];
  return String(slug)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseTitleName(html, fallback) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m) return fallback;
  const title = m[1].replace(/\s*[-–|].*$/u, "").trim();
  return title || fallback;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml"
    }
  });
  if (!res.ok) throw new Error(`Auto.ru HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseSlugsFromHtml(html, prefix) {
  const re = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([a-z0-9_]+)/`, "gi");
  const slugs = new Set();
  let m;
  while ((m = re.exec(html))) slugs.add(m[1].toLowerCase());
  return [...slugs];
}

function parseYearsFromHtml(html) {
  const years = [];
  const re = /"year_from"\s*:\s*(\d{4})/g;
  let m;
  while ((m = re.exec(html))) years.push(Number(m[1]));
  if (!years.length) return { year_from: null, year_to: null };
  return { year_from: Math.min(...years), year_to: Math.max(...years) };
}

function parseBodyTypesFromHtml(html) {
  const bodies = new Set();
  const re = /"body_type"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) bodies.add(m[1]);
  return [...bodies];
}

function parseGenerationIds(html, markSlug, modelSlug) {
  const prefix = `/catalog/cars/${markSlug}/${modelSlug}/`;
  const slugs = parseSlugsFromHtml(html, prefix);
  return slugs.filter((s) => s !== "specifications" && /^\d+$/.test(s));
}

async function upsertMark(db, slug, nameRu) {
  const nowExpr = sqlNow(db.dialect || "sqlite");
  const existing = await db.query("SELECT id FROM vehicle_marks WHERE autoru_id = ?", [slug]);
  if (existing[0]) {
    await db.query("UPDATE vehicle_marks SET name = ?, name_ru = ?, synced_at = " + nowExpr + " WHERE id = ?", [
      slug,
      nameRu,
      existing[0].id
    ]);
    return existing[0].id;
  }
  await db.query(
    "INSERT INTO vehicle_marks(autoru_id, name, name_ru, synced_at) VALUES (?, ?, ?, " + nowExpr + ")",
    [slug, slug, nameRu]
  );
  const row = await db.query("SELECT id FROM vehicle_marks WHERE autoru_id = ?", [slug]);
  return row[0].id;
}

async function upsertModel(db, markId, slug, nameRu, years) {
  const nowExpr = sqlNow(db.dialect || "sqlite");
  const existing = await db.query("SELECT id FROM vehicle_models WHERE mark_id = ? AND autoru_id = ?", [markId, slug]);
  if (existing[0]) {
    await db.query(
      "UPDATE vehicle_models SET name = ?, name_ru = ?, year_from = ?, year_to = ?, synced_at = " +
        nowExpr +
        " WHERE id = ?",
      [slug, nameRu, years.year_from, years.year_to, existing[0].id]
    );
    return existing[0].id;
  }
  await db.query(
    "INSERT INTO vehicle_models(mark_id, autoru_id, name, name_ru, year_from, year_to, synced_at) VALUES (?, ?, ?, ?, ?, ?, " +
      nowExpr +
      ")",
    [markId, slug, slug, nameRu, years.year_from, years.year_to]
  );
  const row = await db.query("SELECT id FROM vehicle_models WHERE mark_id = ? AND autoru_id = ?", [markId, slug]);
  return row[0].id;
}

async function upsertGeneration(db, modelId, genId, name, bodyType, years) {
  const existing = await db.query("SELECT id FROM vehicle_generations WHERE model_id = ? AND autoru_id = ?", [
    modelId,
    genId
  ]);
  const label = BODY_TYPE_LABELS[bodyType] || bodyType || name;
  if (existing[0]) {
    await db.query(
      "UPDATE vehicle_generations SET name = ?, body_type = ?, year_from = ?, year_to = ? WHERE id = ?",
      [name || label, label, years.year_from, years.year_to, existing[0].id]
    );
    return existing[0].id;
  }
  await db.query(
    "INSERT INTO vehicle_generations(model_id, autoru_id, name, body_type, year_from, year_to) VALUES (?, ?, ?, ?, ?, ?)",
    [modelId, genId, name || label, label, years.year_from, years.year_to]
  );
  return null;
}

async function syncMarks(db, log) {
  const html = await fetchHtml(CATALOG_ROOT);
  const slugs = parseSlugsFromHtml(html, "/catalog/cars/");
  let count = 0;
  for (const slug of slugs) {
    const nameRu = slugToTitle(slug);
    await upsertMark(db, slug, nameRu);
    count += 1;
  }
  if (log) log(`Марки: ${count}`);
  return count;
}

async function syncModelsForMark(db, markRow, log) {
  const slug = markRow.autoru_id;
  const url = `${CATALOG_ROOT}${slug}/`;
  const html = await fetchHtml(url);
  const markName = parseTitleName(html, slugToTitle(slug));
  await upsertMark(db, slug, markName);

  const modelSlugs = parseSlugsFromHtml(html, `/catalog/cars/${slug}/`).filter((s) => s !== slug);
  let count = 0;
  for (const modelSlug of modelSlugs) {
    const modelName = slugToTitle(modelSlug);
    const years = parseYearsFromHtml(html);
    await upsertModel(db, markRow.id, modelSlug, modelName, years);
    count += 1;
  }
  if (log) log(`  ${markName}: ${count} моделей`);
  return count;
}

async function syncGenerationsForModel(db, markSlug, modelRow, log) {
  const url = `${CATALOG_ROOT}${markSlug}/${modelRow.autoru_id}/`;
  const html = await fetchHtml(url);
  const genIds = parseGenerationIds(html, markSlug, modelRow.autoru_id);
  const bodyTypes = parseBodyTypesFromHtml(html);
  const years = parseYearsFromHtml(html);
  let count = 0;

  if (genIds.length) {
    for (const genId of genIds.slice(0, 12)) {
      const bodyType = bodyTypes[count % bodyTypes.length] || "";
      await upsertGeneration(db, modelRow.id, genId, `Поколение ${genId}`, bodyType, years);
      count += 1;
    }
  } else if (bodyTypes.length) {
    for (const bodyType of bodyTypes) {
      await upsertGeneration(db, modelRow.id, bodyType.toLowerCase(), slugToTitle(bodyType), bodyType, years);
      count += 1;
    }
  }
  if (log) log(`    ${modelRow.name_ru}: ${count} кузовов`);
  return count;
}

async function syncAll(db, options = {}) {
  const maxMarks = options.maxMarks || 0;
  const includeGenerations = Boolean(options.includeGenerations);
  const log = options.log || (() => {});

  const marksCount = await syncMarks(db, log);
  const marks = await db.query("SELECT id, autoru_id, name_ru FROM vehicle_marks ORDER BY name_ru");
  const slice = maxMarks > 0 ? marks.slice(0, maxMarks) : marks;

  let modelsTotal = 0;
  for (const mark of slice) {
    modelsTotal += await syncModelsForMark(db, mark, log);
    await sleep(REQUEST_DELAY_MS);

    if (includeGenerations) {
      const models = await db.query("SELECT id, autoru_id, name_ru FROM vehicle_models WHERE mark_id = ? LIMIT 30", [
        mark.id
      ]);
      for (const model of models) {
        await syncGenerationsForModel(db, mark.autoru_id, model, log);
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  return { marks: marksCount, models: modelsTotal };
}

module.exports = {
  syncAll,
  syncMarks,
  syncModelsForMark,
  syncGenerationsForModel,
  slugToTitle,
  BODY_TYPE_LABELS
};
