const express = require("express");
const { requirePermission } = require("../middleware/auth");
const scheduleController = require("../controllers/scheduleController");

const router = express.Router();

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.get("/absences", requirePermission("dashboard:view"), asyncRoute(scheduleController.listAbsences));
router.post("/absences", requirePermission("dashboard:view"), scheduleController.createAbsence);
router.delete("/absences/:id", requirePermission("dashboard:view"), scheduleController.deleteAbsence);
router.post("/columns/reorder", requirePermission("orders:mutate"), scheduleController.reorderColumns);

module.exports = router;
