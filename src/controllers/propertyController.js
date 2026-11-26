import pool from '../config/db.js';
import { AppError } from '../utils/AppError.js';

function getUserId(req) {
  return req.user?.id ?? req.user?.userId;
}

function parseLocationFields({ address, city, state, location, district }) {
  const rawDistrict = (location ?? district ?? '').trim();
  let resolvedAddress = address?.trim() || '';
  let resolvedCity = city?.trim() || '';
  let resolvedState = state?.trim() || '';

  if (rawDistrict) {
    if (!resolvedAddress) resolvedAddress = rawDistrict;
    if (!resolvedCity || !resolvedState) {
      const parts = rawDistrict
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      if (!resolvedCity && parts.length > 0) {
        resolvedCity = parts[0];
      }
      if (!resolvedState && parts.length > 1) {
        resolvedState = parts[parts.length - 1];
      } else if (!resolvedState && parts.length === 1) {
        resolvedState = parts[0];
      }
    }
  }

  return {
    address: resolvedAddress,
    city: resolvedCity,
    state: resolvedState,
  };
}

export async function createProperty(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const userId = getUserId(req);
    const {
      name,
      property_name,
      propertyName,
      property_type,
      propertyType,
      total_units,
      totalUnits,
      rent_per_unit,
      rentPerUnit,
      description,
      address,
      city,
      state,
      location,
      district,
      country,
      caretaker_id,
      caretakerId,
      siteCaretaker,
    } = req.body;

    const resolvedName = (name ?? property_name ?? propertyName)?.trim();
    const loc = parseLocationFields({ address, city, state, location, district });

    if (!resolvedName || !loc.address || !loc.city || !loc.state) {
      throw new AppError(
        'name, address, city, and state (or location) are required',
        400
      );
    }

    const resolvedPropertyType = property_type ?? propertyType ?? null;
    const resolvedTotalUnits = Number(total_units ?? totalUnits ?? 0);
    const resolvedRentPerUnit = Number(rent_per_unit ?? rentPerUnit ?? 0);
    const resolvedCaretakerId =
      caretaker_id !== undefined && caretaker_id !== null && caretaker_id !== ''
        ? Number(caretaker_id)
        : caretakerId !== undefined && caretakerId !== null && caretakerId !== ''
          ? Number(caretakerId)
          : siteCaretaker !== undefined &&
              siteCaretaker !== null &&
              siteCaretaker !== '' &&
              siteCaretaker !== 'NONE'
            ? Number(siteCaretaker)
            : null;

    if (!Number.isInteger(resolvedTotalUnits) || resolvedTotalUnits < 0) {
      throw new AppError('total_units must be a non-negative integer', 400);
    }

    if (Number.isNaN(resolvedRentPerUnit) || resolvedRentPerUnit < 0) {
      throw new AppError('rent_per_unit must be a non-negative number', 400);
    }

    if (
      resolvedCaretakerId !== null &&
      (!Number.isInteger(resolvedCaretakerId) || resolvedCaretakerId <= 0)
    ) {
      throw new AppError('caretaker_id must be a valid positive integer', 400);
    }

    await connection.beginTransaction();

    if (resolvedCaretakerId !== null) {
      const [caretakerRows] = await connection.execute(
        "SELECT id FROM users WHERE id = ? AND role = 'caretaker'",
        [resolvedCaretakerId]
      );
      if (caretakerRows.length === 0) {
        throw new AppError('Assigned caretaker not found', 404);
      }
    }

    const [result] = await connection.execute(
      `INSERT INTO properties
        (owner_id, name, property_type, total_units, rent_per_unit, description, address, city, state, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        resolvedName,
        resolvedPropertyType,
        resolvedTotalUnits,
        resolvedRentPerUnit,
        description ?? null,
        loc.address,
        loc.city,
        loc.state,
        country?.trim() || 'Nigeria',
      ]
    );

    const propertyId = result.insertId;

    if (resolvedCaretakerId !== null) {
      await connection.execute(
        `INSERT INTO property_caretakers
          (property_id, caretaker_id, assigned_by, status)
         VALUES (?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE
           assigned_by = VALUES(assigned_by),
           status = 'active'`,
        [propertyId, resolvedCaretakerId, userId]
      );
    }

    await connection.commit();

    const [rows] = await pool.execute('SELECT * FROM properties WHERE id = ?', [
      propertyId,
    ]);

    res.status(201).json({
      status: 'success',
      data: { property: rows[0] },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function getProperties(req, res, next) {
  try {
    const userId = getUserId(req);
    const role = req.user?.role;

    let rows;

    if (role === 'landlord') {
      [rows] = await pool.execute(
        `SELECT p.*,
                COUNT(u.id) AS unit_count,
                SUM(CASE WHEN u.occupancy_status = 'occupied' THEN 1 ELSE 0 END) AS occupied_units,
                SUM(CASE WHEN u.occupancy_status = 'vacant' THEN 1 ELSE 0 END) AS vacant_units
         FROM properties p
         LEFT JOIN units u ON u.property_id = p.id
         WHERE p.owner_id = ?
         GROUP BY p.id
         ORDER BY p.created_at DESC`,
        [userId]
      );
    } else if (role === 'caretaker') {
      [rows] = await pool.execute(
        `SELECT p.*,
                pc.status AS caretaker_status,
                pc.can_manage_maintenance,
                pc.can_record_cash_payments,
                COUNT(u.id) AS unit_count,
                SUM(CASE WHEN u.occupancy_status = 'occupied' THEN 1 ELSE 0 END) AS occupied_units,
                SUM(CASE WHEN u.occupancy_status = 'vacant' THEN 1 ELSE 0 END) AS vacant_units
         FROM properties p
         INNER JOIN property_caretakers pc ON pc.property_id = p.id
         LEFT JOIN units u ON u.property_id = p.id
         WHERE pc.caretaker_id = ? AND pc.status = 'active'
         GROUP BY p.id, pc.status, pc.can_manage_maintenance, pc.can_record_cash_payments
         ORDER BY p.created_at DESC`,
        [userId]
      );
    } else if (role === 'tenant') {
      [rows] = await pool.execute(
        `SELECT DISTINCT p.*,
                         t.unit_id,
                         t.rent_amount AS tenancy_rent_amount,
                         t.status AS tenancy_status
         FROM properties p
         INNER JOIN tenancies t ON t.property_id = p.id
         WHERE t.tenant_id = ? AND t.status = 'active'
         ORDER BY p.created_at DESC`,
        [userId]
      );
    } else {
      throw new AppError('Unsupported user role', 403);
    }

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: { properties: rows },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPropertyById(req, res, next) {
  try {
    const { propertyId } = req.params;

    const [properties] = await pool.execute('SELECT * FROM properties WHERE id = ?', [
      propertyId,
    ]);

    if (properties.length === 0) {
      throw new AppError('Property not found', 404);
    }

    const [units] = await pool.execute(
      'SELECT * FROM units WHERE property_id = ? ORDER BY unit_number ASC',
      [propertyId]
    );

    res.status(200).json({
      status: 'success',
      data: {
        property: properties[0],
        units,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProperty(req, res, next) {
  try {
    const userId = getUserId(req);
    const { propertyId } = req.params;

    const [existing] = await pool.execute(
      'SELECT * FROM properties WHERE id = ?',
      [propertyId]
    );

    if (existing.length === 0) {
      throw new AppError('Property not found', 404);
    }

    if (Number(existing[0].owner_id) !== Number(userId)) {
      throw new AppError('Only the property owner can update this property', 403);
    }

    const {
      name,
      property_type,
      propertyType,
      total_units,
      totalUnits,
      rent_per_unit,
      rentPerUnit,
      description,
      address,
      city,
      state,
      country,
    } = req.body;

    const nextName = name !== undefined ? name.trim() : existing[0].name;
    const nextPropertyType =
      property_type !== undefined
        ? property_type
        : propertyType !== undefined
          ? propertyType
          : existing[0].property_type;
    const nextTotalUnits =
      total_units !== undefined
        ? Number(total_units)
        : totalUnits !== undefined
          ? Number(totalUnits)
          : existing[0].total_units;
    const nextRentPerUnit =
      rent_per_unit !== undefined
        ? Number(rent_per_unit)
        : rentPerUnit !== undefined
          ? Number(rentPerUnit)
          : existing[0].rent_per_unit;
    const nextDescription =
      description !== undefined ? description : existing[0].description;
    const nextAddress =
      address !== undefined ? address.trim() : existing[0].address;
    const nextCity = city !== undefined ? city.trim() : existing[0].city;
    const nextState = state !== undefined ? state.trim() : existing[0].state;
    const nextCountry =
      country !== undefined ? country.trim() : existing[0].country;

    if (!nextName || !nextAddress || !nextCity || !nextState) {
      throw new AppError('name, address, city, and state cannot be empty', 400);
    }

    if (!Number.isInteger(nextTotalUnits) || nextTotalUnits < 0) {
      throw new AppError('total_units must be a non-negative integer', 400);
    }

    if (Number.isNaN(nextRentPerUnit) || nextRentPerUnit < 0) {
      throw new AppError('rent_per_unit must be a non-negative number', 400);
    }

    await pool.execute(
      `UPDATE properties
       SET name = ?,
           property_type = ?,
           total_units = ?,
           rent_per_unit = ?,
           description = ?,
           address = ?,
           city = ?,
           state = ?,
           country = ?
       WHERE id = ?`,
      [
        nextName,
        nextPropertyType,
        nextTotalUnits,
        nextRentPerUnit,
        nextDescription,
        nextAddress,
        nextCity,
        nextState,
        nextCountry,
        propertyId,
      ]
    );

    const [updated] = await pool.execute('SELECT * FROM properties WHERE id = ?', [
      propertyId,
    ]);

    res.status(200).json({
      status: 'success',
      data: { property: updated[0] },
    });
  } catch (error) {
    next(error);
  }
}

export async function createUnit(req, res, next) {
  try {
    const userId = getUserId(req);
    const { propertyId } = req.params;
    const {
      unit_number,
      unitNumber,
      unit_type,
      unitType,
      rent_amount,
      rentAmount,
      bedrooms,
      bathrooms,
      status,
    } = req.body;

    const [props] = await pool.execute('SELECT * FROM properties WHERE id = ?', [
      propertyId,
    ]);

    if (props.length === 0) {
      throw new AppError('Property not found', 404);
    }

    if (Number(props[0].owner_id) !== Number(userId)) {
      throw new AppError('Only the property owner can add units to this property', 403);
    }

    const resolvedUnitNumber = (unit_number ?? unitNumber)?.trim();
    if (!resolvedUnitNumber) {
      throw new AppError('unit_number is required', 400);
    }

    const [duplicate] = await pool.execute(
      'SELECT id FROM units WHERE property_id = ? AND unit_number = ?',
      [propertyId, resolvedUnitNumber]
    );

    if (duplicate.length > 0) {
      throw new AppError('A unit with this unit_number already exists in this property', 409);
    }

    const resolvedUnitType = unit_type ?? unitType ?? props[0].property_type ?? null;
    const resolvedRentAmount = Number(
      rent_amount ?? rentAmount ?? props[0].rent_per_unit ?? 0
    );
    const resolvedBedrooms = bedrooms !== undefined ? Number(bedrooms) : 0;
    const resolvedBathrooms = bathrooms !== undefined ? Number(bathrooms) : 0.0;
    const resolvedStatus = status || 'active';

    if (Number.isNaN(resolvedRentAmount) || resolvedRentAmount < 0) {
      throw new AppError('rent_amount must be a non-negative number', 400);
    }

    if (!['active', 'inactive'].includes(resolvedStatus)) {
      throw new AppError('status must be active or inactive', 400);
    }

    const [result] = await pool.execute(
      `INSERT INTO units
        (property_id, unit_number, unit_type, rent_amount, bedrooms, bathrooms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId,
        resolvedUnitNumber,
        resolvedUnitType,
        resolvedRentAmount,
        resolvedBedrooms,
        resolvedBathrooms,
        resolvedStatus,
      ]
    );

    const [created] = await pool.execute('SELECT * FROM units WHERE id = ?', [
      result.insertId,
    ]);

    res.status(201).json({
      status: 'success',
      data: { unit: created[0] },
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnitsByProperty(req, res, next) {
  try {
    const { propertyId } = req.params;

    const [props] = await pool.execute('SELECT id FROM properties WHERE id = ?', [
      propertyId,
    ]);

    if (props.length === 0) {
      throw new AppError('Property not found', 404);
    }

    const [units] = await pool.execute(
      'SELECT * FROM units WHERE property_id = ? ORDER BY unit_number ASC',
      [propertyId]
    );

    res.status(200).json({
      status: 'success',
      results: units.length,
      data: { units },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUnit(req, res, next) {
  try {
    const userId = getUserId(req);
    const { unitId } = req.params;

    const [rows] = await pool.execute(
      `SELECT u.*, p.owner_id
       FROM units u
       INNER JOIN properties p ON p.id = u.property_id
       WHERE u.id = ?`,
      [unitId]
    );

    if (rows.length === 0) {
      throw new AppError('Unit not found', 404);
    }

    const unit = rows[0];

    if (Number(unit.owner_id) !== Number(userId)) {
      throw new AppError('Only the property owner can update this unit', 403);
    }

    const {
      unit_number,
      unitNumber,
      unit_type,
      unitType,
      rent_amount,
      rentAmount,
      bedrooms,
      bathrooms,
      status,
      occupancy_status,
      occupancyStatus,
    } = req.body;

    const nextUnitNumber =
      unit_number !== undefined
        ? unit_number.trim()
        : unitNumber !== undefined
          ? unitNumber.trim()
          : unit.unit_number;
    const nextUnitType =
      unit_type !== undefined
        ? unit_type
        : unitType !== undefined
          ? unitType
          : unit.unit_type;
    const nextRentAmount =
      rent_amount !== undefined
        ? Number(rent_amount)
        : rentAmount !== undefined
          ? Number(rentAmount)
          : unit.rent_amount;
    const nextBedrooms = bedrooms !== undefined ? Number(bedrooms) : unit.bedrooms;
    const nextBathrooms = bathrooms !== undefined ? Number(bathrooms) : unit.bathrooms;
    const nextStatus = status !== undefined ? status : unit.status;
    const nextOccupancyStatus =
      occupancy_status !== undefined
        ? occupancy_status
        : occupancyStatus !== undefined
          ? occupancyStatus
          : unit.occupancy_status;

    if (!nextUnitNumber) {
      throw new AppError('unit_number cannot be empty', 400);
    }

    const [duplicate] = await pool.execute(
      'SELECT id FROM units WHERE property_id = ? AND unit_number = ? AND id <> ?',
      [unit.property_id, nextUnitNumber, unitId]
    );

    if (duplicate.length > 0) {
      throw new AppError(
        'A unit with this unit_number already exists in this property',
        409
      );
    }

    if (Number.isNaN(nextRentAmount) || nextRentAmount < 0) {
      throw new AppError('rent_amount must be a non-negative number', 400);
    }

    if (!['active', 'inactive'].includes(nextStatus)) {
      throw new AppError('status must be active or inactive', 400);
    }

    if (!['vacant', 'occupied'].includes(nextOccupancyStatus)) {
      throw new AppError('occupancy_status must be vacant or occupied', 400);
    }

    await pool.execute(
      `UPDATE units
       SET unit_number = ?,
           unit_type = ?,
           rent_amount = ?,
           bedrooms = ?,
           bathrooms = ?,
           status = ?,
           occupancy_status = ?
       WHERE id = ?`,
      [
        nextUnitNumber,
        nextUnitType,
        nextRentAmount,
        nextBedrooms,
        nextBathrooms,
        nextStatus,
        nextOccupancyStatus,
        unitId,
      ]
    );

    const [updated] = await pool.execute('SELECT * FROM units WHERE id = ?', [unitId]);

    res.status(200).json({
      status: 'success',
      data: { unit: updated[0] },
    });
  } catch (error) {
    next(error);
  }
}