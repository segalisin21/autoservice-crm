const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const financeController = require("../controllers/financeController");
const orderEconomicsController = require("../controllers/orderEconomicsController");
const receivablesController = require("../controllers/receivablesController");

const router = express.Router();

router.get("/orders-economics", requirePermission("admin:reports"), asyncRoute(orderEconomicsController.index));
router.get("/finance", requirePermission("admin:reports"), asyncRoute(financeController.finance));
router.get("/finance/export", requirePermission("admin:reports"), asyncRoute(financeController.exportCsv));
router.get("/receivables", requirePermission("admin:reports"), asyncRoute(receivablesController.index));
router.get("/receivables/export.csv", requirePermission("admin:reports"), asyncRoute(receivablesController.exportCsv));

module.exports = router;
