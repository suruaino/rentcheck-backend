import pool from '../config/db.js';
import { AppError } from '../utils/AppError.js';

function getUserId(req) {
  return req.user?.id ?? req.user?.userId;
}

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
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

    const rawPropertyList = assigned_property_ids ?? assignedProperties;
    if (Array.isArray(rawPropertyList)) {
      const normalizedIds = [
        ...new Set(
          rawPropertyList
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
        ),
      ];

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

        for (const targetPropId of normalizedIds) {
          await connection.execute(
            `INSERT INTO property_caretakers
              (property_id, caretaker_id, assigned_by, status, can_manage_maintenance, can_record_cash_payments)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               assigned_by = VALUES(assigned_by),
               status = VALUES(status),
               can_manage_maintenance = VALUES(can_manage_maintenance),
               can_record_cash_payments = VALUES(can_record_cash_payments)`,
            [
              targetPropId,
              caretakerId,
              userId,
              nextStatus,
              nextManageMaint,
              nextRecordCash,
            ]
          );
        }
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
       ORDER BY t.created_at DESC`,
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
       ORDER BY t.created_at DESC`,
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