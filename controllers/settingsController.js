const { getDB } = require("../config/database");
const { ensureDefaultSettings, loadVehicleCatalogSettings, setSetting } = require("../lib/settings");

async function show(req, res, next) {
  try {
    const db = await getDB();
    await ensureDefaultSettings(db);
    const vehicleCatalog = await loadVehicleCatalogSettings(db);
    res.render("admin/settings", {
      title: "Настройки",
      user: req.session.user,
      category: "settings",
      adminSection: "settings",
      vehicleCatalog,
      saved: req.query.success === "saved"
    });
  } catch (err) {
    next(err);
  }
}

async function save(req, res, next) {
  try {
    const db = await getDB();
    await ensureDefaultSettings(db);
    const mode = req.body.vehicle_catalog_names === "cyrillic" ? "cyrillic" : "original";
    await setSetting(db, "vehicle_catalog_names", mode);
    res.redirect("/admin/settings?success=saved");
  } catch (err) {
    next(err);
  }
}

module.exports = { show, save };
