const express = require("express");

const { requirePermission } = require("../middleware/auth");
const financeController = require("../controllers/financeController");
const orderEconomicsController = require("../controllers/orderEconomicsController");

const router = express.Router();

router.get("/orders-economics", requirePermission("admin:reports"), orderEconomicsController.index);
router.get("/finance", requirePermission("admin:reports"), financeController.finance);
router.get("/finance/export", requirePermission("admin:reports"), financeController.exportCsv);

module.exports = router;
