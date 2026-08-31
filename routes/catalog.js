const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const catalogController = require("../controllers/catalogController");

const router = express.Router();

router.get("/", requirePermission("catalog:view"), asyncRoute(catalogController.list));
router.get("/products/new", requirePermission("catalog:manage"), asyncRoute(catalogController.showProductNew));
router.post("/products", requirePermission("catalog:manage"), asyncRoute(catalogController.createProduct));
router.get("/products/:id/edit", requirePermission("catalog:manage"), asyncRoute(catalogController.showProductEdit));
router.put("/products/:id", requirePermission("catalog:manage"), asyncRoute(catalogController.updateProduct));
router.get("/new", requirePermission("catalog:manage"), asyncRoute(catalogController.showNew));
router.post("/", requirePermission("catalog:manage"), asyncRoute(catalogController.create));
router.get("/:id/edit", requirePermission("catalog:manage"), asyncRoute(catalogController.showEdit));
router.put("/:id", requirePermission("catalog:manage"), asyncRoute(catalogController.update));
router.post("/:id/toggle", requirePermission("catalog:manage"), asyncRoute(catalogController.toggle));
router.delete("/:id", requirePermission("catalog:manage"), asyncRoute(catalogController.remove));

module.exports = router;
