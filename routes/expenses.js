const express = require("express");

const { requirePermission } = require("../middleware/auth");
const expenseController = require("../controllers/expenseController");

const router = express.Router();

router.get("/", requirePermission("expenses:view"), expenseController.list);
router.post("/", requirePermission("expenses:mutate"), expenseController.create);
router.delete("/:id", requirePermission("expenses:mutate"), expenseController.remove);

module.exports = router;
