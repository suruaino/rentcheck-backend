import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is missing or malformed',
        data: null,
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id ?? decoded.userId;

    const [rows] = await pool.execute(
      `SELECT id, first_name, last_name, title, estate_title, email, phone, role, account_status, email_verified_at, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'User account for this token no longer exists',
        data: null,
      });
    }

    const user = rows[0];
    if (user.account_status && user.account_status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'User account is not active',
        data: null,
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
      data: null,
    });
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
        data: null,
      });
    }
    return next();
  };
}