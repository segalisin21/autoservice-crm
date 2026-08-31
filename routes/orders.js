const express = require("express");

const { requirePermission, requireAnyPermission } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/asyncRoute");
const orderController = require("../controllers/orderController");
const { uploadPhotos } = require("../lib/upload");

const router = express.Router();

router.get("/", requirePermission("orders:view"), asyncRoute(orderController.list));
router.get("/new", requirePermission("orders:mutate"), asyncRoute(orderController.showNew));
router.post("/", requirePermission("orders:mutate"), asyncRoute(orderController.create));
router.get("/:id/print", requirePermission("orders:view"), asyncRoute(orderController.printView));
router.post("/:id/print", requirePermission("orders:view"), asyncRoute(orderController.savePrintView));
router.post("/:id/print/reset", requirePermission("orders:view"), asyncRoute(orderController.resetPrintView));
router.get("/:id/act-acceptance", requirePermission("orders:view"), asyncRoute(orderController.actAcceptance));
router.get("/:id/act-completion", requirePermission("orders:view"), asyncRoute(orderController.actCompletion));
router.get("/:id", requirePermission("orders:view"), asyncRoute(orderController.show));
router.put("/:id", requirePermission("orders:mutate"), asyncRoute(orderController.update));
router.patch("/:id/schedule", requirePermission("orders:mutate"), asyncRoute(orderController.patchSchedule));
router.delete("/:id", requirePermission("orders:mutate"), asyncRoute(orderController.remove));
router.post("/:id/car", requirePermission("orders:mutate"), asyncRoute(orderController.assignCar));
router.post(
  "/:id/mileage",
  requireAnyPermission("orders:mutate", "orders:annotate"),
  asyncRoute(orderController.updateCarMileage)
);
router.post("/:id/notes", requirePermission("orders:annotate"), asyncRoute(orderController.updateNotes));
router.post("/:id/status", requirePermission("orders:mutate"), asyncRoute(orderController.changeStatus));
router.post("/:id/lines", requirePermission("orders:mutate"), asyncRoute(orderController.addLine));
router.put("/lines/:lineId", requirePermission("orders:mutate"), asyncRoute(orderController.updateLine));
router.delete("/lines/:lineId", requirePermission("orders:mutate"), asyncRoute(orderController.removeLine));
router.post("/:id/payments", requirePermission("orders:mutate"), asyncRoute(orderController.addPayment));
router.post(
  "/:id/photos",
  requireAnyPermission("orders:mutate", "orders:annotate"),
  uploadPhotos.array("photo", 10),
  asyncRoute(orderController.uploadPhotos)
);
router.get("/:id/photos/:photoId/file", requirePermission("orders:view"), asyncRoute(orderController.servePhoto));
router.delete("/:id/photos/:photoId", requirePermission("orders:mutate"), asyncRoute(orderController.deletePhoto));

module.exports = router;
