
// class GoogleMapsService {
//   // 1. PLACES API - Mock autocomplete suggestions
//   static async getAutocomplete(input, sessionToken = null, userLocation = null) {
//     try {
//       // Simulate API delay
//       await new Promise(resolve => setTimeout(resolve, 300))

//       const mockSuggestions = [
//         {
//           placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
//           text: `${input} Railway Station, New Delhi`,
//           mainText: `${input} Railway Station`,
//           secondaryText: "New Delhi, Delhi, India",
//           types: ["transit_station", "establishment"]
//         },
//         {
//           placeId: "ChIJN1t_tDeuEmsRUsoyG83frY5",
//           text: `${input} Mall, Connaught Place`,
//           mainText: `${input} Mall`,
//           secondaryText: "Connaught Place, New Delhi, Delhi, India",
//           types: ["shopping_mall", "establishment"]
//         },
//         {
//           placeId: "ChIJN1t_tDeuEmsRUsoyG83frY6",
//           text: `${input} Hospital, Saket`,
//           mainText: `${input} Hospital`,
//           secondaryText: "Saket, New Delhi, Delhi, India",
//           types: ["hospital", "health", "establishment"]
//         },
//         {
//           placeId: "ChIJN1t_tDeuEmsRUsoyG83frY7",
//           text: `${input} Airport Terminal`,
//           mainText: `${input} Airport Terminal`,
//           secondaryText: "Indira Gandhi International Airport, Delhi, India",
//           types: ["airport", "establishment"]
//         }
//       ]

//       // Filter suggestions based on input
//       const filteredSuggestions = mockSuggestions.filter(suggestion => 
//         suggestion.text.toLowerCase().includes(input.toLowerCase())
//       )

//       console.log(`Mock Autocomplete for "${input}":`, filteredSuggestions.length, "suggestions")
//       return filteredSuggestions
//     } catch (error) {
//       console.error("Mock Autocomplete Error:", error.message)
//       throw new Error("Failed to get autocomplete suggestions")
//     }
//   }

//   // 1. PLACES API - Mock text search for places
//   static async searchPlaces(query, location = null) {
//     try {
//       await new Promise(resolve => setTimeout(resolve, 200))

//       const mockPlaces = [
//         {
//           name: `${query} Main Location`,
//           address: `${query}, Connaught Place, New Delhi, Delhi, India`,
//           latitude: 28.6139 + (Math.random() - 0.5) * 0.01,
//           longitude: 77.2090 + (Math.random() - 0.5) * 0.01,
//           placeId: `mock_place_${Date.now()}_1`,
//           rating: 4.2,
//           types: ["establishment", "point_of_interest"]
//         },
//         {
//           name: `${query} Secondary Location`,
//           address: `Near ${query}, Karol Bagh, New Delhi, Delhi, India`,
//           latitude: 28.6519 + (Math.random() - 0.5) * 0.01,
//           longitude: 77.1909 + (Math.random() - 0.5) * 0.01,
//           placeId: `mock_place_${Date.now()}_2`,
//           rating: 3.8,
//           types: ["establishment"]
//         }
//       ]

//       console.log(`🔍 Mock Search for "${query}":`, mockPlaces.length, "places found")
//       return mockPlaces
//     } catch (error) {
//       console.error("Mock Search Error:", error.message)
//       throw new Error("Failed to search places")
//     }
//   }

//   // 2. GEOCODING API - Mock address to coordinates
//   static async geocodeAddress(address) {
//     try {
//       await new Promise(resolve => setTimeout(resolve, 250))

//       // Generate mock coordinates based on address hash for consistency
//       const hash = address.split('').reduce((a, b) => {
//         a = ((a << 5) - a) + b.charCodeAt(0)
//         return a & a
//       }, 0)
      
//       const latOffset = (hash % 1000) / 100000 // Small random offset
//       const lngOffset = (hash % 1500) / 100000

//       const mockResult = {
//         address: `${address}, New Delhi, Delhi, India`,
//         latitude: 28.6139 + latOffset,
//         longitude: 77.2090 + lngOffset,
//         placeId: `mock_geocode_${Date.now()}`,
//         addressComponents: [
//           { long_name: "New Delhi", types: ["locality"] },
//           { long_name: "Delhi", types: ["administrative_area_level_1"] },
//           { long_name: "India", types: ["country"] }
//         ],
//         locationType: "APPROXIMATE"
//       }

//       console.log(`Mock Geocode for "${address}":`, mockResult.latitude, mockResult.longitude)
//       return mockResult
//     } catch (error) {
//       console.error("Mock Geocoding Error:", error.message)
//       throw new Error("Failed to geocode address")
//     }
//   }

//   // 2. GEOCODING API - Mock coordinates to address
//   static async reverseGeocode(lat, lng) {
//     try {
//       await new Promise(resolve => setTimeout(resolve, 250))

//       // Generate consistent mock address based on coordinates
//       const streetNumber = Math.floor(Math.abs(lat * lng * 1000)) % 999 + 1
//       const streetNames = ["MG Road", "Ring Road", "Janpath", "CP Road", "Mall Road"]
//       const areas = ["Connaught Place", "Karol Bagh", "Saket", "Lajpat Nagar", "Nehru Place"]
      
//       const streetName = streetNames[Math.floor(Math.abs(lat * 1000)) % streetNames.length]
//       const area = areas[Math.floor(Math.abs(lng * 1000)) % areas.length]

//       const mockResult = {
//         address: `${streetNumber}, ${streetName}, ${area}, New Delhi, Delhi 110001, India`,
//         latitude: lat,
//         longitude: lng,
//         placeId: `mock_reverse_${Date.now()}`,
//         addressComponents: [
//           { long_name: streetNumber.toString(), types: ["street_number"] },
//           { long_name: streetName, types: ["route"] },
//           { long_name: area, types: ["sublocality"] },
//           { long_name: "New Delhi", types: ["locality"] },
//           { long_name: "Delhi", types: ["administrative_area_level_1"] },
//           { long_name: "India", types: ["country"] }
//         ]
//       }

//       console.log(`Mock Reverse Geocode for (${lat}, ${lng}):`, mockResult.address)
//       return mockResult
//     } catch (error) {
//       console.error("Mock Reverse Geocoding Error:", error.message)
//       throw new Error("Failed to reverse geocode coordinates")
//     }
//   }

//   // 3. DISTANCE MATRIX API - Mock distance and ETA calculation
//   static async calculateDistance(origin, destination, mode = "driving") {
//     try {
//       await new Promise(resolve => setTimeout(resolve, 400))

//       // Calculate straight-line distance using Haversine formula
//       const R = 6371 // Earth's radius in km
//       const dLat = ((destination.lat - origin.lat) * Math.PI) / 180
//       const dLng = ((destination.lng - origin.lng) * Math.PI) / 180
//       const a = 
//         Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//         Math.cos((origin.lat * Math.PI) / 180) *
//         Math.cos((destination.lat * Math.PI) / 180) *
//         Math.sin(dLng / 2) *
//         Math.sin(dLng / 2)
//       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
//       const straightDistance = R * c

//       // Add road factor (real roads are longer than straight line)
//       const roadFactor = mode === "walking" ? 1.2 : mode === "bicycling" ? 1.3 : 1.4
//       const roadDistance = straightDistance * roadFactor

//       // Calculate duration based on mode
//       const speedKmh = mode === "walking" ? 5 : mode === "bicycling" ? 15 : 25 // km/h
//       const durationMinutes = (roadDistance / speedKmh) * 60

//       const mockResult = {
//         distance: {
//           text: `${Math.round(roadDistance * 10) / 10} km`,
//           value: Math.round(roadDistance * 1000), // meters
//         },
//         duration: {
//           text: `${Math.ceil(durationMinutes)} mins`,
//           value: Math.ceil(durationMinutes * 60), // seconds
//         },
//         status: "OK"
//       }

//       console.log(`Mock Distance (${mode}):`, mockResult.distance.text, mockResult.duration.text)
//       return mockResult
//     } catch (error) {
//       console.error("Mock Distance Calculation Error:", error.message)
//       throw new Error("Failed to calculate distance")
//     }
//   }
// }

// module.exports = GoogleMapsService


const axios = require("axios")

class GoogleMapsService {
  // 1. PLACES API - Autocomplete suggestions
  static async getAutocomplete(input, sessionToken = null, userLocation = null) {
    try {
      const requestBody = {
        input,
        includedRegionCodes: ["IN"], // limit to India
        sessionToken: sessionToken || `session-${Date.now()}-${Math.random()}`,
      }

      // Add location bias if user location is provided
      if (userLocation && userLocation.lat && userLocation.lng) {
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: userLocation.lat,
              longitude: userLocation.lng,
            },
            radius: 50000.0, // 50km radius
          },
        }
      }

      const response = await axios.post(
        "https://places.googleapis.com/v1/places:autocomplete",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
          },
        }
      )

      return response.data.suggestions?.map((suggestion) => ({
        placeId: suggestion.placePrediction.placeId,
        text: suggestion.placePrediction.text.text,
        mainText: suggestion.placePrediction.structuredFormat.mainText.text,
        secondaryText: suggestion.placePrediction.structuredFormat.secondaryText?.text || "",
        types: suggestion.placePrediction.types,
      })) || []
    } catch (error) {
      console.error("Google Places Autocomplete API Error:", error.response?.data || error.message)
      throw new Error("Failed to get autocomplete suggestions")
    }
  }

  // 1. PLACES API - Text search for places
  static async searchPlaces(query, location = null) {
    try {
      const params = {
        query: query,
        key: process.env.GOOGLE_MAPS_API_KEY,
      }

      if (location) {
        params.location = `${location.lat},${location.lng}`
        params.radius = 50000 // 50km radius
      }

      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        { params }
      )

      return response.data.results.map((place) => ({
        name: place.name,
        address: place.formatted_address,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        placeId: place.place_id,
        rating: place.rating || 0,
        types: place.types,
      }))
    } catch (error) {
      console.error("Google Places API Error:", error.response?.data || error.message)
      throw new Error("Failed to search places")
    }
  }

  // 2. GEOCODING API - Convert address to coordinates
  static async geocodeAddress(address) {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        {
          params: {
            address: address,
            key: process.env.GOOGLE_MAPS_API_KEY,
            region: "in", // Bias results to India
          },
        }
      )

      if (response.data.results.length === 0) {
        throw new Error("Address not found")
      }

      const result = response.data.results[0]
      return {
        address: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId: result.place_id,
        addressComponents: result.address_components,
        locationType: result.geometry.location_type,
      }
    } catch (error) {
      console.error("Geocoding API Error:", error.response?.data || error.message)
      throw new Error("Failed to geocode address")
    }
  }

  // 2. GEOCODING API - Convert coordinates to address
  static async reverseGeocode(lat, lng) {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        {
          params: {
            latlng: `${lat},${lng}`,
            key: process.env.GOOGLE_MAPS_API_KEY,
          },
        }
      )

      if (response.data.results.length === 0) {
        throw new Error("No address found for coordinates")
      }

      const result = response.data.results[0]
      return {
        address: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId: result.place_id,
        addressComponents: result.address_components,
      }
    } catch (error) {
      console.error("Reverse Geocoding API Error:", error.response?.data || error.message)
      throw new Error("Failed to reverse geocode coordinates")
    }
  }

  // 3. DISTANCE MATRIX API - Calculate distance and ETA
  static async calculateDistance(origin, destination, mode = "driving") {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        {
          params: {
            origins: `${origin.lat},${origin.lng}`,
            destinations: `${destination.lat},${destination.lng}`,
            key: process.env.GOOGLE_MAPS_API_KEY,
            units: "metric",
            mode: mode, // driving, walking, bicycling, transit
            avoid: "tolls",
          },
        }
      )

      const element = response.data.rows[0].elements[0]

      if (element.status !== "OK") {
        throw new Error(`Unable to calculate distance: ${element.status}`)
      }

      return {
        distance: {
          text: element.distance.text,
          value: element.distance.value, // in meters
        },
        duration: {
          text: element.duration.text,
          value: element.duration.value, // in seconds
        },
        status: element.status,
      }
    } catch (error) {
      console.error("Distance Matrix API Error:", error.response?.data || error.message)
      throw new Error("Failed to calculate distance")
    }
  }
}

module.exports = GoogleMapsService