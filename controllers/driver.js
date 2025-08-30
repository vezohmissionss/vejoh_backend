let Ride = require("../models/ride.js");

exports.createRide = async (req, res) => {
  try {
    // req.body.seatsAvailable = 4; // default
    // req.body.driver = req.user._id;
    const createdRide = await Ride.create(req.body);
    return res.status(201).json({
      success: true,
      message: "Ride Created Successfully",
      data: createdRide,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err?.message,
    });
  }
};
