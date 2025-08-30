const axios = require("axios");

exports.placeSearch = async (req, res) => {
  const { search } = req.query;
  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: search,
          format: "json",
          addressdetails: 1,
          limit: 5,
        },
        headers: {
          "User-Agent": "car_pulling_app@01 (er.nishantgautam0011@gmail.com)", // required by Nominatim
        },
      }
    );

    let location = response.data.map(
      ({ place_id, name, display_name, lat, lon }) => {
        return { place_id, name, display_name, lat, lon };
      }
    );

    return res.status(200).json({
      success: true,
      message: "Place Details",
      data: location,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err?.message,
    });
  }
};
