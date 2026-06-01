const express = require("express");

const { requirePermission } = require("../middleware/auth");
const journalController = require("../controllers/journalController");

const router = express.Router();

router.get("/", requirePermission("orders:view"), journalController.index);

module.exports = router;
