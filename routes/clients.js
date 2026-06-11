const express = require("express");

const { requirePermission } = require("../middleware/auth");
const clientController = require("../controllers/clientController");

const router = express.Router();

router.get("/", requirePermission("clients:view"), clientController.list);
router.get("/search", requirePermission("clients:view"), clientController.search);
router.get("/new", requirePermission("clients:mutate"), clientController.showNew);
router.post("/", requirePermission("clients:mutate"), clientController.create);
router.get("/:id", requirePermission("clients:view"), clientController.show);
router.get("/:id/edit", requirePermission("clients:mutate"), clientController.showEdit);
router.put("/:id", requirePermission("clients:mutate"), clientController.update);
router.delete("/:id", requirePermission("clients:mutate"), clientController.remove);

module.exports = router;
