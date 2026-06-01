const express = require("express");

const { requirePermission } = require("../middleware/auth");
const orderController = require("../controllers/orderController");
const { uploadPhotos } = require("../lib/upload");

const router = express.Router();

router.get("/", requirePermission("orders:view"), orderController.list);
router.get("/new", requirePermission("orders:mutate"), orderController.showNew);
router.post("/", requirePermission("orders:mutate"), orderController.create);
router.get("/:id/print", requirePermission("orders:view"), orderController.printView);
router.get("/:id/act-acceptance", requirePermission("orders:view"), orderController.actAcceptance);
router.get("/:id/act-completion", requirePermission("orders:view"), orderController.actCompletion);
router.get("/:id", requirePermission("orders:view"), orderController.show);
router.put("/:id", requirePermission("orders:mutate"), orderController.update);
router.post("/:id/status", requirePermission("orders:mutate"), orderController.changeStatus);
router.post("/:id/lines", requirePermission("orders:mutate"), orderController.addLine);
router.put("/lines/:lineId", requirePermission("orders:mutate"), orderController.updateLine);
router.delete("/lines/:lineId", requirePermission("orders:mutate"), orderController.removeLine);
router.post("/:id/payments", requirePermission("orders:mutate"), orderController.addPayment);
router.post(
  "/:id/photos",
  requirePermission("orders:mutate"),
  uploadPhotos.array("photo", 10),
  orderController.uploadPhotos
);
router.get("/:id/photos/:photoId/file", requirePermission("orders:view"), orderController.servePhoto);
router.delete("/:id/photos/:photoId", requirePermission("orders:mutate"), orderController.deletePhoto);

module.exports = router;
