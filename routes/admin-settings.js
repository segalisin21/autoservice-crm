const express = require("express");

const { getDB } = require("../config/database");
const { requirePermission } = require("../middleware/auth");
const settingsController = require("../controllers/settingsController");

const router = express.Router();

router.get("/settings", requirePermission("admin:settings"), settingsController.show);
router.post("/settings", requirePermission("admin:settings"), settingsController.save);

module.exports = router;
