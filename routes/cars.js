const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const carController = require("../controllers/carController");

const router = express.Router();

router.get("/", requirePermission("cars:view"), asyncRoute(carController.list));
router.get("/new", requirePermission("cars:mutate"), asyncRoute(carController.showNew));
router.post("/", requirePermission("cars:mutate"), asyncRoute(carController.create));
router.get("/:id", requirePermission("cars:view"), asyncRoute(carController.show));
router.get("/:id/edit", requirePermission("cars:mutate"), asyncRoute(carController.showEdit));
router.put("/:id", requirePermission("cars:mutate"), asyncRoute(carController.update));
router.delete("/:id", requirePermission("cars:mutate"), asyncRoute(carController.remove));

router.post("/:id/reminders", requirePermission("cars:mutate"), asyncRoute(carController.addReminder));
router.post("/reminders/:rid/toggle", requirePermission("cars:mutate"), asyncRoute(carController.toggleReminder));
router.delete("/reminders/:rid", requirePermission("cars:mutate"), asyncRoute(carController.deleteReminder));

module.exports = router;
