const path = require("node:path");
const fs = require("node:fs");
const multer = require("multer");

const UPLOAD_ROOT = path.join(__dirname, "..", "data", "uploads", "orders");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const orderId = Number(req.params.id);
    const dir = path.join(UPLOAD_ROOT, String(orderId));
    try {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 10) || ".jpg";
    const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : ".jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
    cb(null, name);
  }
});

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  return cb(null, false);
}

const uploadPhotos = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 10 }
});

function relativePathFor(orderId, filename) {
  return path.posix.join("data/uploads/orders", String(orderId), filename);
}

function absolutePathFor(relPath) {
  return path.join(__dirname, "..", relPath.split("/").join(path.sep));
}

module.exports = { uploadPhotos, UPLOAD_ROOT, relativePathFor, absolutePathFor };
