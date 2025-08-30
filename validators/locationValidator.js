exports.validateLocationInput = (field, req) => {
  return (value) => {
    if (!Object.keys(value).length) {
      throw new Error(`${field} location is required`);
    }
    if (!value.address) {
      throw new Error(`${field} address is required`);
    }
    if (value.address && !isNaN(value.address)) {
      throw new Error(`Invalid ${field} address`);
    }
    if (!value.coordinates) {
      throw new Error(`${field} coordinates are required`);
    }
    if (typeof value.coordinates !== "object") {
      throw new Error(`Invalid format of ${field} coordinates`);
    }
    if (!Object.keys(value.coordinates).length) {
      throw new Error(`${field} coordinates are required`);
    }
    if (!value.coordinates.latitude) {
      throw new Error(`${field} latitude is required`);
    }
    if (typeof value.coordinates.latitude !== "number") {
      throw new Error(`Invalid ${field} latitude`);
    }
    if (!value.coordinates.longitude) {
      throw new Error(`${field} longitude is required`);
    }
    if (typeof value.coordinates.longitude !== "number") {
      throw new Error(`Invalid ${field} longitude`);
    }
    return true;
  };
};
