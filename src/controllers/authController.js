import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { findByEmail, findByPhone, createUser, findById } from '../models/userModel.js';
import { AppError } from '../utils/AppError.js';
import { successResponse } from "../utils/response.js";


export async function register(req, res, next) {
  try {
    const {
      fullName,
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword,
      role,
      estateTitle,
      title,
      inviteToken
    } = req.body;

    // Check required fields
    if (!password || (!email && !phone)) {
      throw new AppError(
        "Please provide a password and email or phone number",
        400
      );
    }

    // Check password confirmation if provided
    if (
      confirmPassword !== undefined &&
      confirmPassword !== password
    ) {
      throw new AppError("Passwords do not match", 400);
    }

    // Handle full name
    let userFirstName = firstName;
    let userLastName = lastName;

    if (fullName) {
      const nameParts = fullName.trim().split(/\s+/);

      userFirstName = nameParts[0];
      userLastName = nameParts.slice(1).join(" ");
    }

    if (!userFirstName || !userLastName && !fullName) {
      throw new AppError("Please provide your full name", 400);
    }

    if (!userFirstName) {
      throw new AppError("Please provide your full name", 400);
    }

    // Default direct registration to landlord
    const userRole = role || (inviteToken ? null : "landlord");

    const allowedRoles = ["landlord", "tenant", "caretaker"];

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new AppError("Invalid role", 400);
    }

    // Tenant and caretaker registration requires an invitation
    if (
      (userRole === "tenant" || userRole === "caretaker") &&
      !inviteToken
    ) {
      throw new AppError(
        "An invitation is required for this role",
        400
      );
    }

    // Check whether email already exists
    if (email) {
      const existingUser = await findByEmail(email);

      if (existingUser) {
        throw new AppError("Email is already registered", 409);
      }
    }

    // Check whether phone already exists
    if (phone) {
      const existingPhone = await findByPhone(phone);

      if (existingPhone) {
        throw new AppError("Phone number is already registered", 409);
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userId = await createUser({
      firstName: userFirstName,
      lastName: userLastName || "",
      email,
      phone,
      passwordHash,
      role: userRole,
      estateTitle,
      title
    });

    return successResponse(
      res,
      "Account created successfully",
      {
        user: {
          id: userId,
          firstName: userFirstName,
          lastName: userLastName || "",
          fullName: `${userFirstName} ${userLastName || ""}`.trim(),
          email: email || null,
          phone: phone || null,
          role: userRole,
          estateTitle: estateTitle || null,
          title: title || null
        }
      },
      201
    );

  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }

    // Find the user
    const user = await findByEmail(email);

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    // Create JWT token
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });

    return successResponse(res, 'Login successful', {
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
      },
      role: user.role,
      propertyId: null,
      unitId: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await findById(req.user.id);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return successResponse(res, "Profile retrieved successfully", {
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      role: user.role,
      propertyId: null,
      unitId: null
    });

  } catch (error) {
    next(error);
  }
}