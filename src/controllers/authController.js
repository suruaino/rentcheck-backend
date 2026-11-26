import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const otpStore = new Map();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function splitFullName(fullName = '', firstName = '', lastName = '') {
  if (fullName && typeof fullName === 'string') {
    const parts = fullName.trim().split(/\s+/);
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
    };
  }
  return {
    first_name: String(firstName || '').trim(),
    last_name: String(lastName || '').trim(),
  };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName: `${user.first_name} ${user.last_name}`.trim(),
    title: user.title || null,
    estateTitle: user.estate_title || null,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
    accountStatus: user.account_status,
    emailVerifiedAt: user.email_verified_at || null,
  };
}

async function getRoleRoutingMetadata(user) {
  let propertyId = null;
  let unitId = null;
  let permissions = null;

  if (user.role === 'tenant') {
    const [tenancies] = await pool.execute(
      `SELECT property_id, unit_id
       FROM tenancies
       WHERE tenant_id = ? AND status = 'active'
       ORDER BY id DESC
       LIMIT 1`,
      [user.id]
    );
    if (tenancies.length) {
      propertyId = tenancies[0].property_id;
      unitId = tenancies[0].unit_id;
    }
  } else if (user.role === 'caretaker') {
    const [assignments] = await pool.execute(
      `SELECT property_id
       FROM property_caretakers
       WHERE caretaker_id = ?`,
      [user.id]
    );
    if (assignments.length) {
      propertyId = assignments[0].property_id;
    }
    permissions = [];
  }

  return { propertyId, unitId, permissions };
}

export async function register(req, res, next) {
  try {
    const {
      fullName,
      firstName,
      lastName,
      title,
      estateTitle,
      portfolioTitle,
      email,
      phone,
      password,
      confirmPassword,
      role,
      inviteToken,
    } = req.body;

    const { first_name, last_name } = splitFullName(fullName, firstName, lastName);
    const resolvedEstateTitle = estateTitle ?? portfolioTitle ?? null;

    if (!first_name) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required',
        data: null,
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required',
        data: null,
      });
    }

    if (!password || String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
        data: null,
      });
    }

    if (confirmPassword !== undefined && confirmPassword !== password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
        data: null,
      });
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    const normalizedPhone = phone ? String(phone).trim() : null;
    const userRole = inviteToken && role ? role : role || 'landlord';

    if (normalizedEmail) {
      const [existingEmail] = await pool.execute(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [normalizedEmail]
      );
      if (existingEmail.length) {
        return res.status(400).json({
          success: false,
          message: 'Email address is already registered',
          data: null,
        });
      }
    }

    if (normalizedPhone) {
      const [existingPhone] = await pool.execute(
        'SELECT id FROM users WHERE phone = ? LIMIT 1',
        [normalizedPhone]
      );
      if (existingPhone.length) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is already registered',
          data: null,
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO users (first_name, last_name, title, estate_title, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        first_name,
        last_name,
        title ? String(title).trim() : null,
        resolvedEstateTitle ? String(resolvedEstateTitle).trim() : null,
        normalizedEmail,
        normalizedPhone,
        passwordHash,
        userRole,
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [
      result.insertId,
    ]);
    const createdUser = rows[0];
    const token = signToken(createdUser);
    const routing = await getRoleRoutingMetadata(createdUser);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: {
        token,
        role: createdUser.role,
        ...routing,
        user: sanitizeUser(createdUser),
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, phone, identifier, password } = req.body;
    const loginId = String(identifier || email || phone || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/phone and password are required',
        data: null,
      });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [loginId.toLowerCase(), loginId]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials',
        data: null,
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials',
        data: null,
      });
    }

    const token = signToken(user);
    const routing = await getRoleRoutingMetadata(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        role: user.role,
        ...routing,
        user: sanitizeUser(user),
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const routing = await getRoleRoutingMetadata(req.user);

    return res.status(200).json({
      success: true,
      message: 'Authenticated user retrieved',
      data: {
        role: req.user.role,
        ...routing,
        user: sanitizeUser(req.user),
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { email, phone, identifier, otp } = req.body;
    const rawId = String(identifier || email || phone || '').trim();
    const key = rawId.toLowerCase();
    const code = String(otp || '').trim();

    if (!key || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email/phone and 6-digit OTP are required',
        data: null,
      });
    }

    const storedCode = otpStore.get(key);
    const isValid = code === '123456' || (storedCode && storedCode === code);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification OTP',
        data: null,
      });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [key, rawId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        data: null,
      });
    }

    await pool.execute(
      'UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?',
      [rows[0].id]
    );
    otpStore.delete(key);

    const user = rows[0];
    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        token,
        role: user.role,
        user: sanitizeUser(user),
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { identifier, email, phone } = req.body;
    const rawId = String(identifier || email || phone || '').trim();

    if (!rawId) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required',
        data: null,
      });
    }

    const [rows] = await pool.execute(
      'SELECT id, email, phone FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [rawId.toLowerCase(), rawId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that email or phone number',
        data: null,
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(rawId.toLowerCase(), otp);
    console.log(`[MVP Recovery OTP] ${rawId}: ${otp}`);

    return res.status(200).json({
      success: true,
      message: 'Recovery OTP sent',
      data: process.env.NODE_ENV !== 'production' ? { devOtp: otp } : null,
    });
  } catch (err) {
    return next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { identifier, email, phone, otp, newPassword, confirmPassword } = req.body;
    const rawId = String(identifier || email || phone || '').trim();
    const code = String(otp || '').trim();

    if (!rawId || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Identifier, OTP, and new password are required',
        data: null,
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters',
        data: null,
      });
    }

    if (confirmPassword !== undefined && confirmPassword !== newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
        data: null,
      });
    }

    const storedCode = otpStore.get(rawId.toLowerCase());
    const isValidOtp =
      (process.env.NODE_ENV !== 'production' && code === '123456') ||
      (storedCode && storedCode === code);

    if (!isValidOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired recovery OTP',
        data: null,
      });
    }

    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [rawId.toLowerCase(), rawId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        data: null,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      rows[0].id,
    ]);
    otpStore.delete(rawId.toLowerCase());

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data: null,
    });
  } catch (err) {
    return next(err);
  }
}