

const express = require("express")
const router = express.Router()
const { auth } = require("../middleware/auth")
const User = require("../models/user")
const Driver = require("../models/driver")
const Ride = require("../models/ride")
const GoogleMapsService = require("../utils/googleMapsService")


router.get("/locations/autocomplete", auth, async (req, res) => {
  try {
    const { input, sessionToken, lat, lng } = req.query

    if (!input) {
      return res.status(400).json({
        success: false,
        message: "Input is required",
      })
    }

    const userLocation = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null
    const suggestions = await GoogleMapsService.getAutocomplete(input, sessionToken, userLocation)

    res.json({
      success: true,
      data: suggestions,
      meta: {
        query: input,
        userLocation: userLocation,
        resultCount: suggestions.length
      }
    })
  } catch (error) {
    console.error("Autocomplete error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get autocomplete suggestions",
    })
  }
})


router.post("/locations/geocode", auth, async (req, res) => {
  try {
    const { address, latitude, longitude } = req.body

    // Forward geocoding: address → coordinates
    if (address) {
      console.log(`Forward geocoding: "${address}"`)
      const geocodeResult = await GoogleMapsService.geocodeAddress(address)
      return res.json({
        success: true,
        data: geocodeResult,
        type: "forward_geocoding",
        input: address
      })
    }

    // Reverse geocoding: coordinates → address
    if (latitude && longitude) {
      console.log(`Reverse geocoding: (${latitude}, ${longitude})`)
      const reverseGeocodeResult = await GoogleMapsService.reverseGeocode(latitude, longitude)
      return res.json({
        success: true,
        data: reverseGeocodeResult,
        type: "reverse_geocoding",
        input: { latitude, longitude }
      })
    }

    return res.status(400).json({
      success: false,
      message: "Either address or coordinates (latitude & longitude) are required",
    })
  } catch (error) {
    console.error("Geocoding error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to process geocoding request",
    })
  }
})


router.post("/locations/distance", auth, async (req, res) => {
  try {
    const { origin, destination, mode = "driving" } = req.body

    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return res.status(400).json({
        success: false,
        message: "Origin and destination coordinates are required",
      })
    }

    console.log(`Distance calculation (${mode}): (${origin.lat}, ${origin.lng}) → (${destination.lat}, ${destination.lng})`)

    const distanceResult = await GoogleMapsService.calculateDistance(origin, destination, mode)

    res.json({
      success: true,
      data: distanceResult,
      meta: {
        origin: origin,
        destination: destination,
        mode: mode
      }
    })
  } catch (error) {
    console.error("Distance calculation error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to calculate distance",
    })
  }
})


router.get("/locations/search", auth, async (req, res) => {
  try {
    const { query, lat, lng } = req.query

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      })
    }

    console.log(`Text search: "${query}" ${lat && lng ? `near (${lat}, ${lng})` : '(no location)'}`)

    const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null
    const results = await GoogleMapsService.searchPlaces(query, location)

    res.json({
      success: true,
      data: results,
      meta: {
        query: query,
        location: location,
        resultCount: results.length
      }
    })
  } catch (error) {
    console.error("Location search error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to search locations",
    })
  }
})


router.post("/drivers/nearby", auth, async (req, res) => {
  try {
    const { latitude, longitude, vehicleType, serviceType = "ride", radius = 5000 } = req.body

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      })
    }

    console.log(`Finding nearby ${vehicleType || 'any'} drivers near (${latitude}, ${longitude})`)


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

    // Calculate MOCK distance for each driver using GoogleMapsService
    const driversWithDistance = await Promise.all(
      nearbyDrivers.map(async (driver, index) => {
        const driverLat = driver.location.coordinates.latitude
        const driverLng = driver.location.coordinates.longitude

        try {
          // Use MOCK GoogleMapsService for distance calculation
          const distanceData = await GoogleMapsService.calculateDistance(
            { lat: driverLat, lng: driverLng },
            { lat: latitude, lng: longitude },
            "driving"
          )

          console.log(`   Driver ${index + 1}: ${distanceData.distance.text}, ETA ${distanceData.duration.text}`)

          return {
            ...driver.toObject(),
            distance: {
              text: distanceData.distance.text, // "3.2 km"
              value: distanceData.distance.value, // 3200 meters
              km: Math.round(distanceData.distance.value / 10) / 100, // 3.2
            },
            estimatedArrival: {
              text: distanceData.duration.text, // "12 mins" 
              value: distanceData.duration.value, // 720 seconds
              minutes: Math.ceil(distanceData.duration.value / 60), // 12
            },
          }
        } catch (error) {
          console.warn(`Failed to get distance for driver ${driver._id}:`, error.message)
          
          // Additional fallback if mock also fails
          return {
            ...driver.toObject(),
            distance: {
              text: "2.5 km",
              value: 2500,
              km: 2.5,
            },
            estimatedArrival: {
              text: "5 mins",
              value: 300,
              minutes: 5,
            },
          }
        }
      })
    )

    // Sort by distance (closest drivers first)
    driversWithDistance.sort((a, b) => a.distance.value - b.distance.value)

    console.log(`Found ${driversWithDistance.length} nearby drivers`)

    res.json({
      success: true,
      data: {
        drivers: driversWithDistance,
        count: driversWithDistance.length,
      },
      meta: {
        searchLocation: { latitude, longitude },
        radius: radius,
        vehicleType: vehicleType,
        serviceType: serviceType
      }
    })
  } catch (error) {
    console.error("Find nearby drivers error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to find nearby drivers",
    })
  }
})


router.post("/rides/request", auth, async (req, res) => {
  try {
    const { pickup, destination, vehicleType, serviceType = "ride", offeredFare, paymentMethod = "cash" } = req.body

    if (!pickup || !destination || !vehicleType) {
      return res.status(400).json({
        success: false,
        message: "Pickup, destination, and vehicle type are required",
      })
    }

    console.log(`Ride request: ${pickup.address} → ${destination.address} (${vehicleType})`)

    let distanceData, estimatedFare, distance, duration

    try {
      // Calculate MOCK distance and duration using GoogleMapsService
      distanceData = await GoogleMapsService.calculateDistance(
        { lat: pickup.latitude, lng: pickup.longitude },
        { lat: destination.latitude, lng: destination.longitude },
        "driving"
      )

      distance = distanceData.distance.value / 1000 // Convert meters to km
      duration = distanceData.duration.value / 60 // Convert seconds to minutes

      // Calculate accurate fare based on vehicle type and MOCK distance
      const baseFare = vehicleType === "bike" ? 20 : vehicleType === "auto" ? 30 : 50
      const perKmRate = vehicleType === "bike" ? 8 : vehicleType === "auto" ? 12 : 15
      estimatedFare = Math.round(baseFare + distance * perKmRate)

      console.log(`Fare calculation: Base ₹${baseFare} + (${distance.toFixed(1)}km × ₹${perKmRate}) = ₹${estimatedFare}`)
    } catch (error) {
      console.warn("Failed to get mock distance, using basic fallback:", error.message)
      
      // Basic fallback calculation
      distance = 5.0 // Default 5km
      duration = 15 // Default 15 minutes
      const baseFare = vehicleType === "bike" ? 20 : vehicleType === "auto" ? 30 : 50
      estimatedFare = Math.round(baseFare + distance * 10)
    }

    // Create ride request with accurate mock data
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
        estimated: Math.round(distance * 100) / 100, // km
        text: distanceData?.distance.text || `${Math.round(distance * 100) / 100} km`,
        value: distanceData?.distance.value || Math.round(distance * 1000), // meters
      },
      duration: {
        estimated: Math.ceil(duration), // minutes
        text: distanceData?.duration.text || `${Math.ceil(duration)} min`,
        value: distanceData?.duration.value || Math.ceil(duration * 60), // seconds
      },
      paymentMethod,
    })

    await ride.save()

    console.log(`Ride created: ID ${ride._id}, Fare ₹${estimatedFare}`)

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


router.get("/rides/active", auth, async (req, res) => {
  try {
    console.log(`Getting active rides for user: ${req.user.id}`)

    const activeRides = await Ride.find({
      user: req.user.id,
      status: { $in: ["requested", "accepted", "driver_assigned", "pickup", "in_progress"] },
    })
      .populate("driver", "name phone vehicle location rating")
      .sort({ createdAt: -1 })

    console.log(`Found ${activeRides.length} active rides`)

    res.json({
      success: true,
      data: activeRides,
      meta: {
        userId: req.user.id,
        count: activeRides.length
      }
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



///////////////////////////////////////////////////////////////////////////////////////////


// const express = require("express")
// const router = express.Router()
// const { auth } = require("../middleware/auth")
// const User = require("../models/user")
// const Driver = require("../models/driver")
// const Ride = require("../models/ride")
// const GoogleMapsService = require("../utils/googleMapsService")

// //  Places API - Get autocomplete suggestions for places

// router.get("/locations/autocomplete", auth, async (req, res) => {
//   try {
//     const { input, sessionToken, lat, lng } = req.query

//     if (!input) {
//       return res.status(400).json({
//         success: false,
//         message: "Input is required",
//       })
//     }

//     // Pass user location for location-biased suggestions (dynamic)
//     const userLocation = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null
//     const suggestions = await GoogleMapsService.getAutocomplete(input, sessionToken, userLocation)

//     res.json({
//       success: true,
//       data: suggestions,
//     })
//   } catch (error) {
//     console.error("Autocomplete error:", error)
//     res.status(500).json({
//       success: false,
//       message: "Failed to get autocomplete suggestions",
//     })
//   }
// })

// //Geocoding API - Smart endpoint: address ↔ coordinates conversion

// router.post("/locations/geocode", auth, async (req, res) => {
//   try {
//     const { address, latitude, longitude } = req.body

//     // Forward geocoding: address → coordinates
//     if (address) {
//       const geocodeResult = await GoogleMapsService.geocodeAddress(address)
//       return res.json({
//         success: true,
//         data: geocodeResult,
//         type: "forward_geocoding"
//       })
//     }

//     // Reverse geocoding: coordinates → address
//     if (latitude && longitude) {
//       const reverseGeocodeResult = await GoogleMapsService.reverseGeocode(latitude, longitude)
//       return res.json({
//         success: true,
//         data: reverseGeocodeResult,
//         type: "reverse_geocoding"
//       })
//     }

//     return res.status(400).json({
//       success: false,
//       message: "Either address or coordinates (latitude & longitude) are required",
//     })
//   } catch (error) {
//     console.error("Geocoding error:", error)
//     res.status(500).json({
//       success: false,
//       message: "Failed to process geocoding request",
//     })
//   }
// })

// // Distance Matrix API - Calculate distance and ETA between points

// router.post("/locations/distance", auth, async (req, res) => {
//   try {
//     const { origin, destination, mode = "driving" } = req.body

//     if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
//       return res.status(400).json({
//         success: false,
//         message: "Origin and destination coordinates are required",
//       })
//     }

//     const distanceResult = await GoogleMapsService.calculateDistance(origin, destination, mode)

//     res.json({
//       success: true,
//       data: distanceResult,
//     })
//   } catch (error) {
//     console.error("Distance calculation error:", error)
//     res.status(500).json({
//       success: false,
//       message: "Failed to calculate distance",
//     })
//   }
// })

// // Find nearby available drivers with accurate Google Maps distance/ETA

// router.post("/drivers/nearby", auth, async (req, res) => {
//   try {
//     const { latitude, longitude, vehicleType, serviceType = "ride", radius = 5000 } = req.body

//     if (!latitude || !longitude) {
//       return res.status(400).json({
//         success: false,
//         message: "Latitude and longitude are required",
//       })
//     }

//     // Find nearby drivers using MongoDB geospatial query
//     const nearbyDrivers = await Driver.find({
//       "location.coordinates.latitude": { $exists: true },
//       "location.coordinates.longitude": { $exists: true },
//       status: "online",
//       "availability.isAvailable": true,
//       services: serviceType,
//       ...(vehicleType && { "vehicle.type": vehicleType }),
//       $expr: {
//         $lte: [
//           {
//             $multiply: [
//               6371000, // Earth's radius in meters
//               {
//                 $acos: {
//                   $add: [
//                     {
//                       $multiply: [
//                         { $sin: { $degreesToRadians: "$location.coordinates.latitude" } },
//                         { $sin: { $degreesToRadians: latitude } },
//                       ],
//                     },
//                     {
//                       $multiply: [
//                         { $cos: { $degreesToRadians: "$location.coordinates.latitude" } },
//                         { $cos: { $degreesToRadians: latitude } },
//                         { $cos: { $degreesToRadians: { $subtract: ["$location.coordinates.longitude", longitude] } } },
//                       ],
//                     },
//                   ],
//                 },
//               },
//             ],
//           },
//           radius,
//         ],
//       },
//     })
//       .select("name phone vehicle location rating stats")
//       .limit(10)

//     // Calculate REAL distance for each driver using Google Distance Matrix API
//     const driversWithDistance = await Promise.all(
//       nearbyDrivers.map(async (driver) => {
//         const driverLat = driver.location.coordinates.latitude
//         const driverLng = driver.location.coordinates.longitude

//         try {
//           // Use Google Distance Matrix API for accurate distance and time
//           const distanceData = await GoogleMapsService.calculateDistance(
//             { lat: driverLat, lng: driverLng },
//             { lat: latitude, lng: longitude },
//             "driving"
//           )

//           return {
//             ...driver.toObject(),
//             distance: {
//               text: distanceData.distance.text, // "3.2 km"
//               value: distanceData.distance.value, // 3200 meters
//               km: Math.round(distanceData.distance.value / 10) / 100, // 3.2
//             },
//             estimatedArrival: {
//               text: distanceData.duration.text, // "12 mins" 
//               value: distanceData.duration.value, // 720 seconds
//               minutes: Math.ceil(distanceData.duration.value / 60), // 12
//             },
//           }
//         } catch (error) {
//           console.warn(`Failed to get accurate distance for driver ${driver._id}, using fallback:`, error.message)
          
//           // Fallback to Haversine calculation if Google API fails
//           const R = 6371 // Earth's radius in km
//           const dLat = ((driverLat - latitude) * Math.PI) / 180
//           const dLng = ((driverLng - longitude) * Math.PI) / 180
//           const a =
//             Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//             Math.cos((latitude * Math.PI) / 180) *
//               Math.cos((driverLat * Math.PI) / 180) *
//               Math.sin(dLng / 2) *
//               Math.sin(dLng / 2)
//           const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
//           const distance = R * c

//           return {
//             ...driver.toObject(),
//             distance: {
//               text: `${Math.round(distance * 100) / 100} km`,
//               value: distance * 1000, // meters
//               km: Math.round(distance * 100) / 100,
//             },
//             estimatedArrival: {
//               text: `${Math.ceil(distance * 2)} min`,
//               value: Math.ceil(distance * 2) * 60, // seconds
//               minutes: Math.ceil(distance * 2),
//             },
//           }
//         }
//       })
//     )

//     // Sort by distance (closest drivers first)
//     driversWithDistance.sort((a, b) => a.distance.value - b.distance.value)

//     res.json({
//       success: true,
//       data: {
//         drivers: driversWithDistance,
//         count: driversWithDistance.length,
//       },
//     })
//   } catch (error) {
//     console.error("Find nearby drivers error:", error)
//     res.status(500).json({
//       success: false,
//       message: "Failed to find nearby drivers",
//     })
//   }
// })


// //Request a ride with REAL Google Maps distance and fare calculation

// router.post("/rides/request", auth, async (req, res) => {
//   try {
//     const { pickup, destination, vehicleType, serviceType = "ride", offeredFare, paymentMethod = "cash" } = req.body

//     // Validate required fields
//     if (!pickup || !destination || !vehicleType) {
//       return res.status(400).json({
//         success: false,
//         message: "Pickup, destination, and vehicle type are required",
//       })
//     }

//     let distanceData, estimatedFare, distance, duration

//     try {
//       // Calculate REAL distance and duration using Google Distance Matrix API
//       distanceData = await GoogleMapsService.calculateDistance(
//         { lat: pickup.latitude, lng: pickup.longitude },
//         { lat: destination.latitude, lng: destination.longitude },
//         "driving"
//       )

//       distance = distanceData.distance.value / 1000 // Convert meters to km
//       duration = distanceData.duration.value / 60 // Convert seconds to minutes

//       // Calculate accurate fare based on vehicle type and REAL distance
//       const baseFare = vehicleType === "bike" ? 20 : vehicleType === "auto" ? 30 : 50
//       const perKmRate = vehicleType === "bike" ? 8 : vehicleType === "auto" ? 12 : 15
//       estimatedFare = Math.round(baseFare + distance * perKmRate)
//     } catch (error) {
//       console.warn("Failed to get accurate distance from Google, using fallback calculation:", error.message)
      
//       // Fallback calculation if Google API fails
//       const R = 6371 // Earth's radius in km
//       const dLat = ((pickup.latitude - destination.latitude) * Math.PI) / 180
//       const dLng = ((pickup.longitude - destination.longitude) * Math.PI) / 180
//       const a =
//         Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//         Math.cos((pickup.latitude * Math.PI) / 180) *
//           Math.cos((destination.latitude * Math.PI) / 180) *
//           Math.sin(dLng / 2) *
//           Math.sin(dLng / 2)
//       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
//       distance = R * c
//       duration = distance * 3 // 3 minutes per km estimate
      
//       const baseFare = vehicleType === "bike" ? 20 : vehicleType === "auto" ? 30 : 50
//       estimatedFare = Math.round(baseFare + distance * 8)
//     }

//     // Create ride request with accurate data
//     const ride = new Ride({
//       user: req.user.id,
//       pickup,
//       destination,
//       serviceType,
//       vehicleType,
//       fare: {
//         estimated: estimatedFare,
//         offered: offeredFare || estimatedFare,
//       },
//       distance: {
//         estimated: Math.round(distance * 100) / 100, // km
//         text: distanceData?.distance.text || `${Math.round(distance * 100) / 100} km`,
//         value: distanceData?.distance.value || Math.round(distance * 1000), // meters
//       },
//       duration: {
//         estimated: Math.ceil(duration), // minutes
//         text: distanceData?.duration.text || `${Math.ceil(duration)} min`,
//         value: distanceData?.duration.value || Math.ceil(duration * 60), // seconds
//       },
//       paymentMethod,
//     })

//     await ride.save()

//     res.status(201).json({
//       success: true,
//       message: "Ride requested successfully",
//       data: ride,
//     })
//   } catch (error) {
//     console.error("Ride request error:", error)
//     res.status(500).json({
//       success: false,
//       message: "Failed to request ride",
//     })
//   }
// })

// // Get user's active rides

// router.get("/rides/active", auth, async (req, res) => {
//   try {
//     const activeRides = await Ride.find({
//       user: req.user.id,
//       status: { $in: ["requested", "accepted", "driver_assigned", "pickup", "in_progress"] },
//     })
//       .populate("driver", "name phone vehicle location rating")
//       .sort({ createdAt: -1 })

//     res.json({
//       success: true,
//       data: activeRides,
//     })
//   } catch (error) {
//     console.error("Get active rides error:", error)
//     res.status(500).json({
//       success: false,
//       message: "Failed to get active rides",
//     })
//   }
// })

// module.exports = router