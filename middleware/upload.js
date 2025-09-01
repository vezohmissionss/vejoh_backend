const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Optional: organize uploads by driver ID
    const driverDir = req.user ? path.join(uploadDir, req.user._id.toString()) : uploadDir;
    if (!fs.existsSync(driverDir)) {
      fs.mkdirSync(driverDir, { recursive: true });
    }
    cb(null, driverDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, PDF allowed."), false);
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // optional: max 10MB per file
});

// Upload fields for all driver documents
const allDocuments = upload.fields([
  { name: "drivingLicenseFront", maxCount: 1 },
  { name: "drivingLicenseBack", maxCount: 1 },
  { name: "vehicleRegistrationImage", maxCount: 1 },
  { name: "insuranceImage", maxCount: 1 },
  { name: "aadharFront", maxCount: 1 },
  { name: "aadharBack", maxCount: 1 },
]);

// Optional: handle multer errors in JSON format
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.includes("Invalid file type")) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
};

module.exports = {
  upload,
  allDocuments,
  handleUploadErrors
};
