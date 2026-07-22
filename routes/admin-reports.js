const express = require("express");
const { requirePermission } = require("../middleware/auth");
const analyticsController = require("../controllers/analyticsController");
const marketAnalysisController = require("../controllers/marketAnalysisController");

const router = express.Router();

router.get("/reports/api/data", requirePermission("admin:reports"), analyticsController.apiData);
router.get("/reports/export", requirePermission("admin:reports"), analyticsController.exportCsv);
router.get("/reports", requirePermission("admin:reports"), analyticsController.index);

router.get("/market/api/data", requirePermission("admin:reports"), marketAnalysisController.apiData);
router.get("/market", requirePermission("admin:reports"), marketAnalysisController.index);

module.exports = router;
