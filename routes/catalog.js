const express = require("express");

const { requirePermission } = require("../middleware/auth");
const catalogController = require("../controllers/catalogController");

const router = express.Router();

router.get("/", requirePermission("catalog:view"), catalogController.list);
router.get("/products/new", requirePermission("catalog:manage"), catalogController.showProductNew);
router.post("/products", requirePermission("catalog:manage"), catalogController.createProduct);
router.get("/products/:id/edit", requirePermission("catalog:manage"), catalogController.showProductEdit);
router.put("/products/:id", requirePermission("catalog:manage"), catalogController.updateProduct);
router.get("/new", requirePermission("catalog:manage"), catalogController.showNew);
router.post("/", requirePermission("catalog:manage"), catalogController.create);
router.get("/:id/edit", requirePermission("catalog:manage"), catalogController.showEdit);
router.put("/:id", requirePermission("catalog:manage"), catalogController.update);
router.post("/:id/toggle", requirePermission("catalog:manage"), catalogController.toggle);
router.delete("/:id", requirePermission("catalog:manage"), catalogController.remove);

module.exports = router;
