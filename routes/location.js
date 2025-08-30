const express = require("express");
const router = express.Router();
const { placeSearch } = require("../controllers/location.js");

router.get("/search-place", placeSearch);

module.exports = router;
