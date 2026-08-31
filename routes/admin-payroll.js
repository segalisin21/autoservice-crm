const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const payrollController = require("../controllers/payrollController");

const router = express.Router();

router.get("/", requirePermission("payroll:view"), asyncRoute(payrollController.index));
router.post("/rules", requirePermission("payroll:mutate"), asyncRoute(payrollController.saveRule));
router.delete("/rules/:id", requirePermission("payroll:mutate"), asyncRoute(payrollController.deleteRule));
router.post("/overrides", requirePermission("payroll:mutate"), asyncRoute(payrollController.saveOverride));
router.delete("/overrides/:id", requirePermission("payroll:mutate"), asyncRoute(payrollController.deleteOverride));
router.post("/default", requirePermission("payroll:mutate"), asyncRoute(payrollController.saveDefault));
router.post("/payouts", requirePermission("payroll:mutate"), asyncRoute(payrollController.savePayout));
router.post("/recalculate", requirePermission("payroll:mutate"), asyncRoute(payrollController.recalculate));

module.exports = router;
