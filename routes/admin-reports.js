const express = require("express");
const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const analyticsController = require("../controllers/analyticsController");
const marketAnalysisController = require("../controllers/marketAnalysisController");

const router = express.Router();

router.get("/reports/api/data", requirePermission("admin:reports"), asyncRoute(analyticsController.apiData));
router.get("/reports/export", requirePermission("admin:reports"), asyncRoute(analyticsController.exportCsv));
router.get("/reports", requirePermission("admin:reports"), asyncRoute(analyticsController.index));

router.get("/market/api/data", requirePermission("admin:reports"), asyncRoute(marketAnalysisController.apiData));
router.get("/market", requirePermission("admin:reports"), asyncRoute(marketAnalysisController.index));

module.exports = router;
