
# RENTCHECK API Guidelines

## 1. API Base URL

During local development:

http://localhost:5000/api/v1

## 2. HTTP Methods

Use the appropriate HTTP method:

- GET: Retrieve data.
- POST: Create data.
- PUT: Replace or update data.
- PATCH: Partially update data.
- DELETE: Delete data.

## 3. Successful Responses

Use the successResponse() utility.

Example:

{
  "success": true,
  "message": "Users retrieved successfully",
  "data": []
}

## 4. Error Responses

Use AppError for expected application errors.

Example:

{
  "error": "User not found"
}

Use appropriate HTTP status codes:

- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 500: Internal Server Error

Pass errors to the centralized error handler using next(error).

## 5. Naming Conventions

- Use lowercase, plural names for resource routes.
- Use camelCase for JavaScript variables and functions.
- Use ES modules (import/export).
- Keep controllers, services, models and routes in their respective folders.

## 6. Important Rules

- Never return passwords or password hashes in API responses.
- Validate incoming request data.
- Protect routes that require authentication.
- Enforce role and property-level permissions.
- Never expose internal server errors to clients.
