const express = require("express");

const { requirePermission } = require("../middleware/auth");
const payrollController = require("../controllers/payrollController");

const router = express.Router();

router.get("/", requirePermission("payroll:view"), payrollController.index);
router.post("/rules", requirePermission("payroll:mutate"), payrollController.saveRule);
router.post("/overrides", requirePermission("payroll:mutate"), payrollController.saveOverride);
router.delete("/overrides/:id", requirePermission("payroll:mutate"), payrollController.deleteOverride);
router.post("/default", requirePermission("payroll:mutate"), payrollController.saveDefault);
router.post("/payouts", requirePermission("payroll:mutate"), payrollController.savePayout);

module.exports = router;
