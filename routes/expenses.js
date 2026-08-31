const express = require("express");

const { requirePermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const expenseController = require("../controllers/expenseController");

const router = express.Router();

router.get("/", requirePermission("expenses:view"), asyncRoute(expenseController.list));
router.post("/", requirePermission("expenses:mutate"), asyncRoute(expenseController.create));
router.delete("/:id", requirePermission("expenses:mutate"), asyncRoute(expenseController.remove));

module.exports = router;
