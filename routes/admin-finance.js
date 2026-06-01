const express = require("express");

const { requirePermission } = require("../middleware/auth");
const financeController = require("../controllers/financeController");

const router = express.Router();

router.get("/finance", requirePermission("admin:reports"), financeController.finance);
router.get("/reports", requirePermission("admin:reports"), financeController.reports);
router.get("/finance/export", requirePermission("admin:reports"), financeController.exportCsv);

module.exports = router;
