const express = require("express");
const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const scheduleController = require("../controllers/scheduleController");

const router = express.Router();

router.get("/absences", requirePermission("dashboard:view"), asyncRoute(scheduleController.listAbsences));
router.post("/absences", requirePermission("dashboard:view"), asyncRoute(scheduleController.createAbsence));
router.delete("/absences/:id", requirePermission("dashboard:view"), asyncRoute(scheduleController.deleteAbsence));
router.post("/columns/reorder", requirePermission("orders:mutate"), asyncRoute(scheduleController.reorderColumns));

module.exports = router;
