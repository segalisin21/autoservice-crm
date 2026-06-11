const express = require("express");

const { getDB } = require("../config/database");
const { searchMarks, searchModels, searchModelsGlobal, listGenerations, getModelById } = require("../lib/vehicleCatalog");
const { vehicleDisplayName, withVehicleDisplayNames } = require("../lib/vehicleNames");
const { loadVehicleCatalogSettings } = require("../lib/settings");
const { syncAll, syncGenerationsForModel } = require("../lib/autoruCatalog");
const { requirePermission } = require("../middleware/auth");

const router = express.Router();

async function vehicleNameMode(db) {
  const settings = await loadVehicleCatalogSettings(db);
  return settings.vehicle_catalog_names;
}

router.get("/marks", async (req, res, next) => {
  try {
    const db = await getDB();
    const q = String(req.query.q ?? "");
    const mode = await vehicleNameMode(db);
    const rows = await searchMarks(db, q, 15);
    res.json({ items: withVehicleDisplayNames(rows, mode), name_mode: mode });
  } catch (err) {
    next(err);
  }
});

function mapModelItems(rows, mode) {
  return (rows || []).map(function (row) {
    const item = Object.assign({}, row, { display_name: vehicleDisplayName(row, mode) });
    if (row.mark_name != null || row.mark_name_ru != null) {
      item.mark_display_name = vehicleDisplayName(
        { name: row.mark_name, name_ru: row.mark_name_ru },
        mode
      );
    }
    return item;
  });
}

router.get("/models", async (req, res, next) => {
  try {
    const db = await getDB();
    const markId = req.query.mark_id;
    const q = String(req.query.q ?? "");
    const mode = await vehicleNameMode(db);
    let rows;
    if (markId) {
      rows = await searchModels(db, markId, q, 15);
    } else if (q.trim()) {
      rows = await searchModelsGlobal(db, q, 15);
    } else {
      rows = [];
    }
    res.json({ items: mapModelItems(rows, mode), name_mode: mode });
  } catch (err) {
    next(err);
  }
});

router.get("/generations", async (req, res, next) => {
  try {
    const db = await getDB();
    const modelId = req.query.model_id;
    let rows = await listGenerations(db, modelId);
    if (!rows.length && modelId) {
      const model = await getModelById(db, modelId);
      if (model && model.mark_slug && model.model_slug) {
        await syncGenerationsForModel(
          db,
          model.mark_slug,
          { id: model.id, autoru_id: model.model_slug, name_ru: model.model_name },
          () => {}
        );
        rows = await listGenerations(db, modelId);
      }
    }
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/sync", requirePermission("catalog:manage"), async (req, res, next) => {
  try {
    const db = await getDB();
    const maxMarks = Number(req.body.max_marks) || 80;
    const includeGenerations = req.body.include_generations === "1" || req.body.include_generations === true;
    const stats = await syncAll(db, {
      maxMarks,
      includeGenerations,
      log: (msg) => {
        // eslint-disable-next-line no-console
        console.log("[sync-vehicles]", msg);
      }
    });
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.json({ ok: true, stats });
    }
    return res.redirect(`/catalog?synced=1&marks=${stats.marks}&models=${stats.models}&source=${stats.source || "autoru"}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
