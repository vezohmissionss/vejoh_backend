const express = require("express")
const router = express.Router()
const { auth } = require("../middleware/auth")
const User = require("../models/user")
const Driver = require("../models/driver")
const Ride = require("../models/ride")
const GoogleMapsService = require("../utils/googleMapsService")

// @route   GET /api/dashboard/locations/search
// @desc    Search locations using Google Places API
// @access  Private
router.get("/locations/search", auth, async (req, res) => {
  try {
    const { query, lat, lng } = req.query

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      })
    }

    // Mock response - Replace with actual Google Places API call
    const mockResults = [
      {
        place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
        formatted_address: `${query}, DB Mall Square, Bhopal, Madhya Pradesh, India`,
        geometry: {
          location: {
            lat: lat ? Number.parseFloat(lat) + Math.random() * 0.01 : 23.2599,
            lng: lng ? Number.parseFloat(lng) + Math.random() * 0.01 : 77.4126,
          },
        },
        name: query,
        types: ["establishment", "point_of_interest"],
      },
      {
        place_id: "ChIJN1t_tDeuEmsRUsoyG83frY5",
        formatted_address: `Near ${query}, New Market, Bhopal, Madhya Pradesh, India`,
        geometry: {
          location: {
            lat: lat ? Number.parseFloat(lat) + Math.random() * 0.02 : 23.2699,
            lng: lng ? Number.parseFloat(lng) + Math.random() * 0.02 : 77.4226,
          },
        },
        name: `Near ${query}`,
        types: ["establishment"],
      },
    ]

    res.json({
      success: true,
      data: mockResults,
    })
  } catch (error) {
    console.error("Location search error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to search locations",
    })
  }
})

// @route   POST /api/dashboard/locations/geocode
// @desc    Get coordinates from address
// @access  Private
router.post("/locations/geocode", auth, async (req, res) => {
  try {
    const { address } = req.body

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Address is required",
      })
    }

    // Mock geocoding response - Replace with actual Google Geocoding API
    const mockGeocode = {
      formatted_address: address,
      geometry: {
        location: {
          lat: 23.2599 + Math.random() * 0.1,
          lng: 77.4126 + Math.random() * 0.1,
        },
      },
      place_id: "mock_place_id_" + Date.now(),
    }

    res.json({
      success: true,
      data: mockGeocode,
    })
  } catch (error) {
    console.error("Geocoding error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to geocode address",
    })
  }
})

// @route   POST /api/dashboard/drivers/nearby
// @desc    Find nearby available drivers
// @access  Private
router.post("/drivers/nearby", auth, async (req, res) => {
  try {
    const { latitude, longitude, vehicleType, serviceType = "ride", radius = 5000 } = req.body

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      })
    }

    // Find nearby drivers using MongoDB geospatial query
    const nearbyDrivers = await Driver.find({
      "location.coordinates.latitude": { $exists: true },
      "location.coordinates.longitude": { $exists: true },
      status: "online",
      "availability.isAvailable": true,
      services: serviceType,
      ...(vehicleType && { "vehicle.type": vehicleType }),
      $expr: {
        $lte: [
          {
            $multiply: [
              6371000, // Earth's radius in meters
              {
                $acos: {
                  $add: [
                    {
                      $multiply: [
                        { $sin: { $degreesToRadians: "$location.coordinates.latitude" } },
                        { $sin: { $degreesToRadians: latitude } },
                      ],
                    },
                    {
                      $multiply: [
                        { $cos: { $degreesToRadians: "$location.coordinates.latitude" } },
                        { $cos: { $degreesToRadians: latitude } },
                        { $cos: { $degreesToRadians: { $subtract: ["$location.coordinates.longitude", longitude] } } },
                      ],
                    },
                  ],
                },
              },
            ],
          },
          radius,
        ],
      },
    })
      .select("name phone vehicle location rating stats")
      .limit(10)

    // Calculate distance for each driver
    const driversWithDistance = nearbyDrivers.map((driver) => {
      const driverLat = driver.location.coordinates.latitude
      const driverLng = driver.location.coordinates.longitude

      // Haversine formula for distance calculation
      const R = 6371 // Earth's radius in km
      const dLat = ((driverLat - latitude) * Math.PI) / 180
      const dLng = ((driverLng - longitude) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((latitude * Math.PI) / 180) *
          Math.cos((driverLat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = R * c

      return {
        ...driver.toObject(),
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        estimatedArrival: Math.ceil(distance * 2), // Rough estimate: 2 minutes per km
      }
    })

    // Sort by distance
    driversWithDistance.sort((a, b) => a.distance - b.distance)

    res.json({
      success: true,
      data: {
        drivers: driversWithDistance,
        count: driversWithDistance.length,
      },
    })
  } catch (error) {
    console.error("Find nearby drivers error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to find nearby drivers",
    })
  }
})

// @route   POST /api/dashboard/rides/request
// @desc    Request a ride
// @access  Private
router.post("/rides/request", auth, async (req, res) => {
  try {
    const { pickup, destination, vehicleType, serviceType = "ride", offeredFare, paymentMethod = "cash" } = req.body

    // Validate required fields
    if (!pickup || !destination || !vehicleType) {
      return res.status(400).json({
        success: false,
        message: "Pickup, destination, and vehicle type are required",
      })
    }

    // Calculate estimated fare and distance (mock calculation)
    const distance = Math.random() * 10 + 2 // 2-12 km
    const baseFare = vehicleType === "bike" ? 20 : vehicleType === "auto" ? 30 : 50
    const estimatedFare = Math.round(baseFare + distance * 8)

    // Create ride request
    const ride = new Ride({
      user: req.user.id,
      pickup,
      destination,
      serviceType,
      vehicleType,
      fare: {
        estimated: estimatedFare,
        offered: offeredFare || estimatedFare,
      },
      distance: {
        estimated: Math.round(distance * 100) / 100,
      },
      duration: {
        estimated: Math.ceil(distance * 3), // 3 minutes per km estimate
      },
      paymentMethod,
    })

    await ride.save()

    res.status(201).json({
      success: true,
      message: "Ride requested successfully",
      data: ride,
    })
  } catch (error) {
    console.error("Ride request error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to request ride",
    })
  }
})

// @route   GET /api/dashboard/rides/active
// @desc    Get user's active rides
// @access  Private
router.get("/rides/active", auth, async (req, res) => {
  try {
    const activeRides = await Ride.find({
      user: req.user.id,
      status: { $in: ["requested", "accepted", "driver_assigned", "pickup", "in_progress"] },
    })
      .populate("driver", "name phone vehicle location rating")
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: activeRides,
    })
  } catch (error) {
    console.error("Get active rides error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get active rides",
    })
  }
})

module.exports = router