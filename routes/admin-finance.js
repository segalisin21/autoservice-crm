const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const financeController = require("../controllers/financeController");
const orderEconomicsController = require("../controllers/orderEconomicsController");

const router = express.Router();

router.get("/orders-economics", requirePermission("admin:reports"), asyncRoute(orderEconomicsController.index));
router.get("/finance", requirePermission("admin:reports"), asyncRoute(financeController.finance));
router.get("/finance/export", requirePermission("admin:reports"), asyncRoute(financeController.exportCsv));

module.exports = router;
