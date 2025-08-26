const { Client } = require("@googlemaps/google-maps-services-js")

const client = new Client({})

class GoogleMapsService {
  // Search places using Google Places API
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

      const response = await client.textSearch({ params })

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
      console.error("Google Places API Error:", error)
      throw new Error("Failed to search places")
    }
  }

  // Convert address to coordinates
  static async geocodeAddress(address) {
    try {
      const response = await client.geocode({
        params: {
          address: address,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      })

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
      }
    } catch (error) {
      console.error("Geocoding API Error:", error)
      throw new Error("Failed to geocode address")
    }
  }

  // Calculate distance and duration between two points
  static async calculateDistance(origin, destination) {
    try {
      const response = await client.distancematrix({
        params: {
          origins: [`${origin.lat},${origin.lng}`],
          destinations: [`${destination.lat},${destination.lng}`],
          key: process.env.GOOGLE_MAPS_API_KEY,
          units: "metric",
        },
      })

      const element = response.data.rows[0].elements[0]

      if (element.status !== "OK") {
        throw new Error("Unable to calculate distance")
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
      }
    } catch (error) {
      console.error("Distance Matrix API Error:", error)
      throw new Error("Failed to calculate distance")
    }
  }

  // Get place details by place ID
  static async getPlaceDetails(placeId) {
    try {
      const response = await client.placeDetails({
        params: {
          place_id: placeId,
          key: process.env.GOOGLE_MAPS_API_KEY,
          fields: ["name", "formatted_address", "geometry", "rating", "formatted_phone_number"],
        },
      })

      const place = response.data.result
      return {
        name: place.name,
        address: place.formatted_address,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        rating: place.rating || 0,
        phoneNumber: place.formatted_phone_number,
      }
    } catch (error) {
      console.error("Place Details API Error:", error)
      throw new Error("Failed to get place details")
    }
  }
}

module.exports = GoogleMapsService
