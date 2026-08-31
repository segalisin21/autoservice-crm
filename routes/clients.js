const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const clientController = require("../controllers/clientController");

const router = express.Router();

router.get("/", requirePermission("clients:view"), asyncRoute(clientController.list));
router.get("/search", requirePermission("clients:view"), asyncRoute(clientController.search));
router.get("/new", requirePermission("clients:mutate"), asyncRoute(clientController.showNew));
router.post("/", requirePermission("clients:mutate"), asyncRoute(clientController.create));
router.get("/:id", requirePermission("clients:view"), asyncRoute(clientController.show));
router.get("/:id/edit", requirePermission("clients:mutate"), asyncRoute(clientController.showEdit));
router.put("/:id", requirePermission("clients:mutate"), asyncRoute(clientController.update));
router.delete("/:id", requirePermission("clients:mutate"), asyncRoute(clientController.remove));

module.exports = router;
