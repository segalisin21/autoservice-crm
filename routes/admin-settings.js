const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const settingsController = require("../controllers/settingsController");

const router = express.Router();

router.get("/settings", requirePermission("admin:settings"), asyncRoute(settingsController.show));
router.post("/settings", requirePermission("admin:settings"), asyncRoute(settingsController.save));

module.exports = router;
