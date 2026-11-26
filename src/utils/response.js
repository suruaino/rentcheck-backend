
export function successResponse(res, message, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    status: "success",
    message,
    data,
  });
}
