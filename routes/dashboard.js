const express = require("express");
const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const { index } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/", requirePermission("dashboard:view"), asyncRoute(index));

module.exports = router;
