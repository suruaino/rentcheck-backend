import pool from '../config/db.js';
import { AppError } from '../utils/AppError.js';

function getUserId(req) {
  return req.user?.id ?? req.user?.userId;
}

export async function checkPropertyAccess(req, res, next) {
  try {
    const userId = getUserId(req);
    const role = req.user?.role;
    const propertyId =
      req.params?.propertyId ?? req.body?.propertyId ?? req.body?.property_id;

    if (!propertyId) {
      return next(new AppError('Property ID is required', 400));
    }

    if (!userId) {
      return next(new AppError('Unauthorized user context', 401));
    }

    const [props] = await pool.execute(
      'SELECT id, owner_id FROM properties WHERE id = ?',
      [propertyId]
    );

    if (props.length === 0) {
      return next(new AppError('Property not found', 404));
    }

    if (Number(props[0].owner_id) === Number(userId)) {
      req.propertyAccess = {
        accessType: 'owner',
        propertyId: Number(propertyId),
      };
      return next();
    }

    if (role === 'caretaker') {
      const [caretakers] = await pool.execute(
        `SELECT id, can_manage_maintenance, can_record_cash_payments
         FROM property_caretakers
         WHERE property_id = ? AND caretaker_id = ? AND status = 'active'`,
        [propertyId, userId]
      );

      if (caretakers.length > 0) {
        req.propertyAccess = {
          accessType: 'caretaker',
          propertyId: Number(propertyId),
          canManageMaintenance: Boolean(caretakers[0].can_manage_maintenance),
          canRecordCashPayments: Boolean(
            caretakers[0].can_record_cash_payments
          ),
        };
        return next();
      }
    }

    if (role === 'tenant') {
      const [tenancies] = await pool.execute(
        `SELECT id, unit_id
         FROM tenancies
         WHERE property_id = ? AND tenant_id = ? AND status = 'active'`,
        [propertyId, userId]
      );

      if (tenancies.length > 0) {
        req.propertyAccess = {
          accessType: 'tenant',
          propertyId: Number(propertyId),
          unitId: tenancies[0].unit_id,
        };
        return next();
      }
    }

    return next(
      new AppError('You do not have access to this property', 403)
    );
  } catch (error) {
    next(error);
  }
}