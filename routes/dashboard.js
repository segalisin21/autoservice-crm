const express = require("express");
const { index } = require("../controllers/dashboardController");

const router = express.Router();

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.get("/", asyncRoute(index));

module.exports = router;

