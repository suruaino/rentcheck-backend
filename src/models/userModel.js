
import pool from "../config/db.js";

// Find a user using their email address
export async function findByEmail(email) {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  return rows[0];
}

// Find a user using their phone number
export async function findByPhone(phone) {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE phone = ?",
    [phone]
  );

  return rows[0];
}

// Find a user using their ID
export async function findById(id) {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE id = ?",
    [id]
  );

  return rows[0];
}

// Create a new user

export async function createUser(user) {
  const {
    firstName,
    lastName,
    email,
    phone,
    passwordHash,
    role,
    estateTitle,
    title
  } = user;

  const [result] = await pool.execute(
    `INSERT INTO users
    (
      first_name,
      last_name,
      email,
      phone,
      password_hash,
      role,
      estate_title,
      title
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      firstName,
      lastName,
      email || null,
      phone || null,
      passwordHash,
      role,
      estateTitle || null,
      title || null
    ]
  );

  return result.insertId;
}
