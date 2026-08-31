const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const userController = require("../controllers/userController");

const router = express.Router();

router.get("/", requirePermission("admin:users"), asyncRoute(userController.list));
router.post("/", requirePermission("admin:users"), asyncRoute(userController.create));
router.get("/:id/edit", requirePermission("admin:users"), asyncRoute(userController.showEdit));
router.put("/:id", requirePermission("admin:users"), asyncRoute(userController.update));
router.post("/:id/toggle", requirePermission("admin:users"), asyncRoute(userController.toggleActive));
router.delete("/:id", requirePermission("admin:users"), asyncRoute(userController.remove));

module.exports = router;
