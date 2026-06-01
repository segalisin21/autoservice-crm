const express = require("express");

const { requirePermission } = require("../middleware/auth");
const carController = require("../controllers/carController");

const router = express.Router();

router.get("/", requirePermission("cars:view"), carController.list);
router.get("/new", requirePermission("cars:mutate"), carController.showNew);
router.post("/", requirePermission("cars:mutate"), carController.create);
router.get("/:id", requirePermission("cars:view"), carController.show);
router.get("/:id/edit", requirePermission("cars:mutate"), carController.showEdit);
router.put("/:id", requirePermission("cars:mutate"), carController.update);
router.delete("/:id", requirePermission("cars:mutate"), carController.remove);

router.post("/:id/reminders", requirePermission("cars:mutate"), carController.addReminder);
router.post("/reminders/:rid/toggle", requirePermission("cars:mutate"), carController.toggleReminder);
router.delete("/reminders/:rid", requirePermission("cars:mutate"), carController.deleteReminder);

module.exports = router;
