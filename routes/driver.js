const express = require("express");
const { body, query } = require("express-validator");
const { auth } = require("../middleware/auth");
const { createRide, statusUpdate } = require("../controllers/driver.js");
const { throwError } = require("../middleware/errorMiddleware.js");
const { validateLocationInput } = require("../validators/locationValidator.js");
const router = express.Router();

/*
router.post(
  "/create-ride",
  auth,
  body("pickup")
    .trim()
    .notEmpty()
    .withMessage("Pickup location is required")
    .bail()
    .isObject()
    .withMessage("Invalid format of pickup location")
    .bail()
    .custom((value, { req }) => validateLocationInput("pickup", req)(value)),
  body("destination")
    .trim()
    .notEmpty()
    .withMessage("Destination location is required")
    .bail()
    .isObject()
    .withMessage("Invalid format of destination location")
    .bail()
    .custom((value, { req }) =>
      validateLocationInput("destination", req)(value)
    ),
  throwError,
  createRide
);
 */

router.patch(
  "/status-update",
  auth,
  body("action")
    .trim()
    .notEmpty()
    .withMessage("action is required")
    .bail()
    .isInt({ min: 0, max: 1 })
    .withMessage("Invalid action")
    .bail(),
  body("lat")
    .trim()
    .notEmpty()
    .withMessage("latitude is required")
    .bail()
    .isFloat()
    .withMessage("Invalid latitude")
    .bail(),
  body("lon")
    .trim()
    .notEmpty()
    .withMessage("longitude is required")
    .bail()
    .isFloat()
    .withMessage("Invalid longitude")
    .bail(),
  throwError,
  statusUpdate
);

module.exports = router;
