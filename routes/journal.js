const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const journalController = require("../controllers/journalController");

const router = express.Router();

router.get("/", requirePermission("admin:reports"), asyncRoute(journalController.index));

module.exports = router;
