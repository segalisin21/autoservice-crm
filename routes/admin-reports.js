const express = require("express");
const { requirePermission } = require("../middleware/auth");
const analyticsController = require("../controllers/analyticsController");

const router = express.Router();

router.get("/reports/api/data", requirePermission("admin:reports"), analyticsController.apiData);
router.get("/reports/export", requirePermission("admin:reports"), analyticsController.exportCsv);
router.get("/reports", requirePermission("admin:reports"), analyticsController.index);

module.exports = router;
