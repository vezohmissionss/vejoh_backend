// let Ride = require("../models/ride.js");
let Driver = require("../models/driver.js");

exports.statusUpdate = async (req, res) => {
  try {
    const { action, lat, lon } = req.body;

    let status;
    switch (+action) {
      case 0:
        status = "offline";
        break;
      case 1:
        status = "online";
        break;
    }

    const updateLocation = await Driver.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "location.coordinates": {
            latitude: lat,
            longitude: lon,
          },
          status: status,
        },
      },
      { new: true }
    );
    return res.status(201).json({
      success: true,
      message: "Status updated successfully",
      // data: updateLocation,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err?.message,
    });
  }
};
