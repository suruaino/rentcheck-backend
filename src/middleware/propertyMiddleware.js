import { AppError } from "../utils/AppError.js";

export function checkPropertyAccess(req, res, next) {
  const propertyId = req.params.propertyId || req.body.propertyId;

  if (!propertyId) {
    return next(new AppError("Property ID is required", 400));
  }

  // Property assignment checking will be connected
  // when the property tables are ready.
  next();
}