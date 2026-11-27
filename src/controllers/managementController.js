import pool from '../config/db.js';
import { AppError } from '../utils/AppError.js';

function getUserId(req) {
  return req.user?.id ?? req.user?.userId;
}

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function normalizePropertyIds(rawList) {
  if (!Array.isArray(rawList)) return null;
  return [
    ...new Set(
      rawList
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
}

export async function getAllCaretakers(req, res, next) {
  try {
    const userId = getUserId(req);

    const [rows] = await pool.execute(
      `SELECT pc.id,
              pc.property_id,
              pc.caretaker_id,
              pc.status,
              pc.can_manage_maintenance,
              pc.can_record_cash_payments,
              pc.created_at,
              p.name AS property_name,
              p.city AS property_city,
              p.state AS property_state,
              u.first_name,
              u.last_name,
              u.email,
              u.phone
       FROM property_caretakers pc
       INNER JOIN properties p ON p.id = pc.property_id
       INNER JOIN users u ON u.id = pc.caretaker_id
       WHERE p.owner_id = ?
       ORDER BY u.first_name ASC, u.last_name ASC, pc.created_at DESC`,
      [userId]
    );

    const groupedMap = new Map();

    for (const row of rows) {
      const caretakerId = Number(row.caretaker_id);
      if (!groupedMap.has(caretakerId)) {
        groupedMap.set(caretakerId, {
          caretakerId,
          firstName: row.first_name,
          lastName: row.last_name,
          fullName: `${row.first_name} ${row.last_name}`.trim(),
          email: row.email,
          phone: row.phone,
          status: row.status,
          canManageMaintenance: Boolean(row.can_manage_maintenance),
          canRecordCashPayments: Boolean(row.can_record_cash_payments),
          assignedPropertyIds: [],
          assignedProperties: [],
        });
      }

      const entry = groupedMap.get(caretakerId);
      const propId = Number(row.property_id);

      if (!entry.assignedPropertyIds.includes(propId)) {
        entry.assignedPropertyIds.push(propId);
        entry.assignedProperties.push({
          id: propId,
          name: row.property_name,
          city: row.property_city,
          state: row.property_state,
          status: row.status,
          canManageMaintenance: Boolean(row.can_manage_maintenance),
          canRecordCashPayments: Boolean(row.can_record_cash_payments),
        });
      }

      if (row.status === 'active') {
        entry.status = 'active';
      } else if (entry.status !== 'active' && row.status === 'pending') {
        entry.status = 'pending';
      }

      if (row.can_manage_maintenance) entry.canManageMaintenance = true;
      if (row.can_record_cash_payments) entry.canRecordCashPayments = true;
    }

    const caretakers = Array.from(groupedMap.values());

    res.status(200).json({
      status: 'success',
      results: caretakers.length,
      data: {
        caretakers,
        assignments: rows,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCaretakerAccess(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const userId = getUserId(req);
    const { caretakerId } = req.params;
    const targetCaretakerId = Number(caretakerId);

    if (!Number.isInteger(targetCaretakerId) || targetCaretakerId <= 0) {
      throw new AppError('Invalid caretakerId', 400);
    }

    const [caretakerUsers] = await connection.execute(
      `SELECT id, first_name, last_name, email, phone, role
       FROM users
       WHERE id = ? AND role = 'caretaker'`,
      [targetCaretakerId]
    );

    if (caretakerUsers.length === 0) {
      throw new AppError('Caretaker not found', 404);
    }

    const [existingAssignments] = await connection.execute(
      `SELECT pc.*
       FROM property_caretakers pc
       INNER JOIN properties p ON p.id = pc.property_id
       WHERE pc.caretaker_id = ? AND p.owner_id = ?`,
      [targetCaretakerId, userId]
    );

    const sampleCurrent = existingAssignments[0] || {
      status: 'active',
      can_manage_maintenance: 1,
      can_record_cash_payments: 0,
    };

    const {
      status,
      can_manage_maintenance,
      canManageMaintenance,
      can_record_cash_payments,
      canRecordCashPayments,
      assigned_property_ids,
      assignedProperties,
      propertyIds,
    } = req.body;

    const nextStatus = status !== undefined ? String(status).trim() : sampleCurrent.status;
    if (!['pending', 'active', 'revoked'].includes(nextStatus)) {
      throw new AppError('status must be pending, active, or revoked', 400);
    }

    const nextManageMaint =
      can_manage_maintenance !== undefined
        ? Number(Boolean(can_manage_maintenance))
        : canManageMaintenance !== undefined
          ? Number(Boolean(canManageMaintenance))
          : Number(Boolean(sampleCurrent.can_manage_maintenance));

    const nextRecordCash =
      can_record_cash_payments !== undefined
        ? Number(Boolean(can_record_cash_payments))
        : canRecordCashPayments !== undefined
          ? Number(Boolean(canRecordCashPayments))
          : Number(Boolean(sampleCurrent.can_record_cash_payments));

    const rawPropertyList = assigned_property_ids ?? assignedProperties ?? propertyIds;
    const normalizedIds = normalizePropertyIds(rawPropertyList);

    await connection.beginTransaction();

    if (normalizedIds !== null) {
      if (normalizedIds.length > 0) {
        const placeholders = normalizedIds.map(() => '?').join(', ');
        const [ownedProps] = await connection.execute(
          `SELECT id FROM properties WHERE id IN (${placeholders}) AND owner_id = ?`,
          [...normalizedIds, userId]
        );

        if (ownedProps.length !== normalizedIds.length) {
          throw new AppError(
            'One or more assigned properties were not found or do not belong to you',
            403
          );
        }
      }

      const [allOwnedProps] = await connection.execute(
        'SELECT id FROM properties WHERE owner_id = ?',
        [userId]
      );
      const ownedPropIds = allOwnedProps.map((p) => Number(p.id));

      if (ownedPropIds.length > 0) {
        const ownedPlaceholders = ownedPropIds.map(() => '?').join(', ');
        await connection.execute(
          `DELETE FROM property_caretakers
           WHERE caretaker_id = ? AND property_id IN (${ownedPlaceholders})`,
          [targetCaretakerId, ...ownedPropIds]
        );
      }

      for (const targetPropId of normalizedIds) {
        await connection.execute(
          `INSERT INTO property_caretakers
            (property_id, caretaker_id, status, can_manage_maintenance, can_record_cash_payments)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             status = VALUES(status),
             can_manage_maintenance = VALUES(can_manage_maintenance),
             can_record_cash_payments = VALUES(can_record_cash_payments)`,
          [
            targetPropId,
            targetCaretakerId,
            nextStatus,
            nextManageMaint,
            nextRecordCash,
          ]
        );
      }
    } else if (existingAssignments.length > 0) {
      await connection.execute(
        `UPDATE property_caretakers pc
         INNER JOIN properties p ON p.id = pc.property_id
         SET pc.status = ?,
             pc.can_manage_maintenance = ?,
             pc.can_record_cash_payments = ?
         WHERE pc.caretaker_id = ? AND p.owner_id = ?`,
        [nextStatus, nextManageMaint, nextRecordCash, targetCaretakerId, userId]
      );
    } else {
      throw new AppError('No caretaker assignments found for this caretaker', 404);
    }

    await connection.commit();

    const [updatedRows] = await pool.execute(
      `SELECT pc.*, p.name AS property_name
       FROM property_caretakers pc
       INNER JOIN properties p ON p.id = pc.property_id
       WHERE pc.caretaker_id = ? AND p.owner_id = ?
       ORDER BY pc.property_id ASC`,
      [targetCaretakerId, userId]
    );

    res.status(200).json({
      status: 'success',
      data: {
        caretakerId: targetCaretakerId,
        status: nextStatus,
        canManageMaintenance: Boolean(nextManageMaint),
        canRecordCashPayments: Boolean(nextRecordCash),
        assignedPropertyIds: updatedRows.map((r) => Number(r.property_id)),
        assignments: updatedRows,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function getPropertyCaretakers(req, res, next) {
  try {
    const { propertyId } = req.params;

    const [rows] = await pool.execute(
      `SELECT pc.id,
              pc.property_id,
              pc.caretaker_id,
              pc.status,
              pc.can_manage_maintenance,
              pc.can_record_cash_payments,
              pc.created_at,
              u.first_name,
              u.last_name,
              u.email,
              u.phone
       FROM property_caretakers pc
       INNER JOIN users u ON u.id = pc.caretaker_id
       WHERE pc.property_id = ?
       ORDER BY pc.created_at DESC`,
      [propertyId]
    );

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: { caretakers: rows },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCaretakerPermissions(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const userId = getUserId(req);
    const { propertyId, caretakerId } = req.params;

    const [props] = await connection.execute(
      'SELECT id, owner_id FROM properties WHERE id = ?',
      [propertyId]
    );

    if (props.length === 0) {
      throw new AppError('Property not found', 404);
    }

    if (Number(props[0].owner_id) !== Number(userId)) {
      throw new AppError(
        'Only the property owner can update caretaker access',
        403
      );
    }

    const [existing] = await connection.execute(
      'SELECT * FROM property_caretakers WHERE property_id = ? AND caretaker_id = ?',
      [propertyId, caretakerId]
    );

    if (existing.length === 0) {
      throw new AppError(
        'Caretaker assignment not found for this property',
        404
      );
    }

    const current = existing[0];
    const {
      status,
      can_manage_maintenance,
      canManageMaintenance,
      can_record_cash_payments,
      canRecordCashPayments,
      assigned_property_ids,
      assignedProperties,
    } = req.body;

    const nextStatus = status !== undefined ? String(status).trim() : current.status;
    if (!['pending', 'active', 'revoked'].includes(nextStatus)) {
      throw new AppError('status must be pending, active, or revoked', 400);
    }

    const nextManageMaint =
      can_manage_maintenance !== undefined
        ? Number(Boolean(can_manage_maintenance))
        : canManageMaintenance !== undefined
          ? Number(Boolean(canManageMaintenance))
          : current.can_manage_maintenance;

    const nextRecordCash =
      can_record_cash_payments !== undefined
        ? Number(Boolean(can_record_cash_payments))
        : canRecordCashPayments !== undefined
          ? Number(Boolean(canRecordCashPayments))
          : current.can_record_cash_payments;

    await connection.beginTransaction();

    await connection.execute(
      `UPDATE property_caretakers
       SET status = ?,
           can_manage_maintenance = ?,
           can_record_cash_payments = ?
       WHERE property_id = ? AND caretaker_id = ?`,
      [nextStatus, nextManageMaint, nextRecordCash, propertyId, caretakerId]
    );

    const normalizedIds = normalizePropertyIds(assigned_property_ids ?? assignedProperties);
    if (normalizedIds && normalizedIds.length > 0) {
      const placeholders = normalizedIds.map(() => '?').join(', ');
      const [ownedProps] = await connection.execute(
        `SELECT id FROM properties WHERE id IN (${placeholders}) AND owner_id = ?`,
        [...normalizedIds, userId]
      );

      if (ownedProps.length !== normalizedIds.length) {
        throw new AppError(
          'One or more assigned properties were not found or do not belong to you',
          403
        );
      }

      for (const targetPropId of normalizedIds) {
        await connection.execute(
          `INSERT INTO property_caretakers
            (property_id, caretaker_id, status, can_manage_maintenance, can_record_cash_payments)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             status = VALUES(status),
             can_manage_maintenance = VALUES(can_manage_maintenance),
             can_record_cash_payments = VALUES(can_record_cash_payments)`,
          [
            targetPropId,
            caretakerId,
            nextStatus,
            nextManageMaint,
            nextRecordCash,
          ]
        );
      }
    }

    await connection.commit();

    const [updated] = await pool.execute(
      'SELECT * FROM property_caretakers WHERE property_id = ? AND caretaker_id = ?',
      [propertyId, caretakerId]
    );

    res.status(200).json({
      status: 'success',
      data: { caretaker: updated[0] },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function getPropertyTenancies(req, res, next) {
  try {
    const { propertyId } = req.params;

    const [rows] = await pool.execute(
      `SELECT t.*,
              u.unit_number,
              u.unit_type,
              usr.first_name AS tenant_first_name,
              usr.last_name AS tenant_last_name,
              usr.email AS tenant_email,
              usr.phone AS tenant_phone
       FROM tenancies t
       INNER JOIN units u ON u.id = t.unit_id
       INNER JOIN users usr ON usr.id = t.tenant_id
       WHERE t.property_id = ?
       ORDER BY t.id DESC`,
      [propertyId]
    );

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: { tenancies: rows },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyTenancies(req, res, next) {
  try {
    const userId = getUserId(req);

    const [rows] = await pool.execute(
      `SELECT t.*,
              p.name AS property_name,
              p.address AS property_address,
              u.unit_number,
              u.unit_type
       FROM tenancies t
       INNER JOIN properties p ON p.id = t.property_id
       INNER JOIN units u ON u.id = t.unit_id
       WHERE t.tenant_id = ?
       ORDER BY t.id DESC`,
      [userId]
    );

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: { tenancies: rows },
    });
  } catch (error) {
    next(error);
  }
}

export async function endTenancy(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const userId = getUserId(req);
    const { tenancyId } = req.params;

    await connection.beginTransaction();

    const [tenancyRows] = await connection.execute(
      'SELECT * FROM tenancies WHERE id = ? FOR UPDATE',
      [tenancyId]
    );

    if (tenancyRows.length === 0) {
      throw new AppError('Tenancy not found', 404);
    }

    const tenancy = tenancyRows[0];

    const [propRows] = await connection.execute(
      'SELECT id, owner_id FROM properties WHERE id = ?',
      [tenancy.property_id]
    );

    if (propRows.length === 0 || Number(propRows[0].owner_id) !== Number(userId)) {
      throw new AppError('Only the property owner can end this tenancy', 403);
    }

    if (tenancy.status === 'ended') {
      throw new AppError('Tenancy has already ended', 400);
    }

    const rawEndDate = req.body.end_date ?? req.body.endDate;
    const endDate = rawEndDate
      ? String(rawEndDate).trim()
      : new Date().toISOString().slice(0, 10);

    if (!isValidDateString(endDate)) {
      throw new AppError('end_date must be in YYYY-MM-DD format', 400);
    }

    await connection.execute(
      "UPDATE tenancies SET status = 'ended', end_date = ? WHERE id = ?",
      [endDate, tenancyId]
    );

    const [otherActiveTenancies] = await connection.execute(
      "SELECT id FROM tenancies WHERE unit_id = ? AND status = 'active'",
      [tenancy.unit_id]
    );

    if (otherActiveTenancies.length === 0) {
      await connection.execute(
        "UPDATE units SET occupancy_status = 'vacant' WHERE id = ?",
        [tenancy.unit_id]
      );
    }

    await connection.commit();

    const [updated] = await pool.execute('SELECT * FROM tenancies WHERE id = ?', [
      tenancyId,
    ]);

    res.status(200).json({
      status: 'success',
      message: 'Tenancy ended successfully',
      data: { tenancy: updated[0] },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}