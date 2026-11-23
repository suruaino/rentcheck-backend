// to be handled by: 
// DO NOT EDIT: Guys please do not touch this file, the whole team depends on it. If you need a change here or you intend on making any change to the file, please let's talk about it together first. That's why I added comments where necessary, for easy understanding Thank you :).


export function errorHandler(err, req, res, next) {
  // Invalid JSON sent by the client
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Your JSON is not valid',
    });
  }

  // Errors with an HTTP status below 500
  const statusCode = err.statusCode || err.status;

  if (statusCode && statusCode < 500) {
    return res.status(statusCode).json({
      error: err.message,
    });
  }

  // Unexpected server errors
  console.error(err);

  return res.status(500).json({
    error: 'Something went wrong on the server',
  });
}
