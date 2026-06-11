const express = require("express");

const { requirePermission } = require("../middleware/auth");
const userController = require("../controllers/userController");

const router = express.Router();

router.get("/", requirePermission("admin:users"), userController.list);
router.post("/", requirePermission("admin:users"), userController.create);
router.get("/:id/edit", requirePermission("admin:users"), userController.showEdit);
router.put("/:id", requirePermission("admin:users"), userController.update);
router.post("/:id/toggle", requirePermission("admin:users"), userController.toggleActive);
router.delete("/:id", requirePermission("admin:users"), userController.remove);

module.exports = router;
