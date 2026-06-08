const fs = require("node:fs");
const path = require("node:path");

const { fetchCarsBaseMarks, normalizeCarsBasePayload } = require("../lib/carsBaseCatalog");

const OUT = path.join(__dirname, "..", "seeds", "vehicle-catalog-seed.json");

async function main() {
  console.log("Fetching cars-base.ru…");
  const apiMarks = await fetchCarsBaseMarks();
  const marks = normalizeCarsBasePayload(apiMarks);
  let models = 0;
  marks.forEach(function (m) {
    models += (m.models || []).length;
  });

  const payload = {
    exported_at: new Date().toISOString(),
    source: "cars-base.ru",
    stats: { marks: marks.length, models },
    marks
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${marks.length} marks, ${models} models to ${OUT}`);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
