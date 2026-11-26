import crypto from 'crypto';
import pool from '../config/db.js';
import { AppError } from '../utils/AppError.js';

function getUserId(req) {
  return req.user?.id ?? req.user?.userId;
}

function buildInviteUrl(role, token) {
  const baseUrl = (
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    'https://rentcheck.app'
  ).replace(/\/+$/, '');
  const pathRole = role === 'caretaker' ? 'caretaker' : 'tenant';
  return `${baseUrl}/invite/${pathRole}/${token}`;
}

export async function createInvitation(req, res, next) {
  try {
    const userId = getUserId(req);
    const {
      property_id,
      propertyId,
      unit_id,
      unitId,
      invitee_email,
      inviteeEmail,
      invitee_phone,
      inviteePhone,
      role,
      agreed_rent,
      agreedRent,
      caution_deposit,
      cautionDeposit,
      can_manage_maintenance,
      canManageMaintenance,
      can_record_cash_payments,
      canRecordCashPayments,
      expires_in_days,
      expiresInDays,
    } = req.body;

    const resolvedPropertyId = property_id ?? propertyId ?? req.params.propertyId;
    const resolvedUnitId = unit_id ?? unitId ?? null;
    const resolvedEmail =
      (invitee_email ?? inviteeEmail)?.trim().toLowerCase() || null;
    const resolvedPhone = (invitee_phone ?? inviteePhone)?.trim() || null;
    const resolvedRole = role?.trim();

    if (!resolvedPropertyId) {
      throw new AppError('property_id is required', 400);
    }

    if (!['tenant', 'caretaker'].includes(resolvedRole)) {
      throw new AppError('role must be either tenant or caretaker', 400);
    }

    if (!resolvedEmail && !resolvedPhone) {
      throw new AppError('Provide at least invitee_email or invitee_phone', 400);
    }

    const [props] = await pool.execute(
      'SELECT id, owner_id, rent_per_unit FROM properties WHERE id = ?',
      [resolvedPropertyId]
    );

    if (props.length === 0) {
      throw new AppError('Property not found', 404);
    }

    if (Number(props[0].owner_id) !== Number(userId)) {
      throw new AppError('Only the property owner can send invitations', 403);
    }

    let unitRent = Number(props[0].rent_per_unit ?? 0);

    if (resolvedUnitId) {
      const [units] = await pool.execute(
        'SELECT id, property_id, rent_amount, occupancy_status FROM units WHERE id = ?',
        [resolvedUnitId]
      );

      if (
        units.length === 0 ||
        Number(units[0].property_id) !== Number(resolvedPropertyId)
      ) {
        throw new AppError('Unit does not belong to the specified property', 400);
      }

      if (resolvedRole === 'tenant' && units[0].occupancy_status === 'occupied') {
        throw new AppError('Unit is already occupied', 409);
      }

      unitRent = Number(units[0].rent_amount ?? unitRent);
    } else if (resolvedRole === 'tenant') {
      throw new AppError('unit_id is required when inviting a tenant', 400);
    }

    const resolvedAgreedRent =
      resolvedRole === 'tenant'
        ? Number(agreed_rent ?? agreedRent ?? unitRent)
        : null;

    const rawCaution = caution_deposit ?? cautionDeposit;
    const resolvedCautionDeposit =
      resolvedRole === 'tenant'
        ? rawCaution !== undefined && rawCaution !== null && rawCaution !== ''
          ? Number(rawCaution)
          : Number((resolvedAgreedRent * 0.1).toFixed(2))
        : null;

    if (
      resolvedRole === 'tenant' &&
      (Number.isNaN(resolvedAgreedRent) || resolvedAgreedRent < 0)
    ) {
      throw new AppError('agreed_rent must be a non-negative number', 400);
    }

    if (
      resolvedRole === 'tenant' &&
      (Number.isNaN(resolvedCautionDeposit) || resolvedCautionDeposit < 0)
    ) {
      throw new AppError('caution_deposit must be a non-negative number', 400);
    }

    const [existingPending] = await pool.execute(
      `SELECT id FROM invitations
       WHERE property_id = ?
         AND role = ?
         AND status = 'pending'
         AND expires_at > NOW()
         AND ((? IS NOT NULL AND LOWER(invitee_email) = ?)
           OR (? IS NOT NULL AND invitee_phone = ?))
         AND (? IS NULL OR unit_id = ?)`,
      [
        resolvedPropertyId,
        resolvedRole,
        resolvedEmail,
        resolvedEmail,
        resolvedPhone,
        resolvedPhone,
        resolvedUnitId,
        resolvedUnitId,
      ]
    );

    if (existingPending.length > 0) {
      throw new AppError(
        'An active pending invitation already exists for this invitee',
        409
      );
    }

    const canManageMaint =
      resolvedRole === 'caretaker'
        ? Boolean(can_manage_maintenance ?? canManageMaintenance ?? false)
          ? 1
          : 0
        : 0;
    const canRecordCash =
      resolvedRole === 'caretaker'
        ? Boolean(can_record_cash_payments ?? canRecordCashPayments ?? false)
          ? 1
          : 0
        : 0;

    const daysValid = Number(expires_in_days ?? expiresInDays ?? 7);
    const safeDays = Number.isFinite(daysValid) && daysValid > 0 ? daysValid : 7;
    const expiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
    const token = crypto.randomBytes(24).toString('hex');

    const [result] = await pool.execute(
      `INSERT INTO invitations
        (property_id, unit_id, invited_by, invitee_email, invitee_phone, role,
         agreed_rent, caution_deposit, can_manage_maintenance, can_record_cash_payments,
         token, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        resolvedPropertyId,
        resolvedUnitId,
        userId,
        resolvedEmail,
        resolvedPhone,
        resolvedRole,
        resolvedAgreedRent,
        resolvedCautionDeposit,
        canManageMaint,
        canRecordCash,
        token,
        expiresAt,
      ]
    );

    const [created] = await pool.execute('SELECT * FROM invitations WHERE id = ?', [
      result.insertId,
    ]);

    const invitation = created[0];

    res.status(201).json({
      status: 'success',
      data: {
        invitation: {
          ...invitation,
          invite_url: buildInviteUrl(invitation.role, invitation.token),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPropertyInvitations(req, res, next) {
  try {
    const userId = getUserId(req);
    const { propertyId } = req.params;

    const [props] = await pool.execute(
      'SELECT id, owner_id FROM properties WHERE id = ?',
      [propertyId]
    );

    if (props.length === 0) {
      throw new AppError('Property not found', 404);
    }

    if (Number(props[0].owner_id) !== Number(userId)) {
      throw new AppError(
        'Only the property owner can view property invitations',
        403
      );
    }

    const [rows] = await pool.execute(
      `SELECT i.*, u.unit_number
       FROM invitations i
       LEFT JOIN units u ON u.id = i.unit_id
       WHERE i.property_id = ?
       ORDER BY i.created_at DESC`,
      [propertyId]
    );

    const invitations = rows.map((row) => ({
      ...row,
      invite_url: buildInviteUrl(row.role, row.token),
    }));

    res.status(200).json({
      status: 'success',
      results: invitations.length,
      data: { invitations },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyInvitations(req, res, next) {
  try {
    const userId = getUserId(req);

    const [users] = await pool.execute(
      'SELECT id, email, phone FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new AppError('User not found', 404);
    }

    const userEmail = users[0].email?.trim().toLowerCase() || null;
    const userPhone = users[0].phone?.trim() || null;

    if (!userEmail && !userPhone) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: { invitations: [] },
      });
    }

    const [rows] = await pool.execute(
      `SELECT i.*, p.name AS property_name, p.address AS property_address, u.unit_number
       FROM invitations i
       INNER JOIN properties p ON p.id = i.property_id
       LEFT JOIN units u ON u.id = i.unit_id
       WHERE i.status = 'pending'
         AND i.expires_at > NOW()
         AND ((? IS NOT NULL AND LOWER(i.invitee_email) = ?)
           OR (? IS NOT NULL AND i.invitee_phone = ?))
       ORDER BY i.created_at DESC`,
      [userEmail, userEmail, userPhone, userPhone]
    );

    const invitations = rows.map((row) => ({
      ...row,
      invite_url: buildInviteUrl(row.role, row.token),
    }));

    res.status(200).json({
      status: 'success',
      results: invitations.length,
      data: { invitations },
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptInvitation(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const userId = getUserId(req);
    const token = (req.body.token || req.params.token)?.trim();

    if (!token) {
      throw new AppError('Invitation token is required', 400);
    }

    await connection.beginTransaction();

    const [invites] = await connection.execute(
      'SELECT * FROM invitations WHERE token = ? FOR UPDATE',
      [token]
    );

    if (invites.length === 0) {
      throw new AppError('Invalid invitation token', 404);
    }

    const invite = invites[0];

    if (invite.status !== 'pending') {
      throw new AppError(`Invitation has already been ${invite.status}`, 400);
    }

    if (new Date(invite.expires_at) <= new Date()) {
      await connection.execute(
        "UPDATE invitations SET status = 'expired' WHERE id = ?",
        [invite.id]
      );
      await connection.commit();
      throw new AppError('Invitation has expired', 400);
    }

    const [users] = await connection.execute(
      'SELECT id, email, phone, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new AppError('User account not found', 404);
    }

    const emailMatches =
      invite.invitee_email &&
      users[0].email &&
      invite.invitee_email.toLowerCase() === users[0].email.toLowerCase();
    const phoneMatches =
      invite.invitee_phone &&
      users[0].phone &&
      invite.invitee_phone.trim() === users[0].phone.trim();

    if (!emailMatches && !phoneMatches) {
      throw new AppError(
        'This invitation does not match your account email or phone number',
        403
      );
    }

    let createdTenancy = null;

    if (invite.role === 'caretaker') {
      const [existingCaretaker] = await connection.execute(
        'SELECT id FROM property_caretakers WHERE property_id = ? AND caretaker_id = ?',
        [invite.property_id, userId]
      );

      if (existingCaretaker.length > 0) {
        await connection.execute(
          `UPDATE property_caretakers
           SET status = 'active',
               can_manage_maintenance = ?,
               can_record_cash_payments = ?
           WHERE id = ?`,
          [
            invite.can_manage_maintenance,
            invite.can_record_cash_payments,
            existingCaretaker[0].id,
          ]
        );
      } else {
        await connection.execute(
          `INSERT INTO property_caretakers
            (property_id, caretaker_id, status, can_manage_maintenance, can_record_cash_payments)
           VALUES (?, ?, 'active', ?, ?)`,
          [
            invite.property_id,
            userId,
            invite.can_manage_maintenance,
            invite.can_record_cash_payments,
          ]
        );
      }

      if (users[0].role !== 'landlord') {
        await connection.execute(
          "UPDATE users SET role = 'caretaker' WHERE id = ?",
          [userId]
        );
      }
    } else if (invite.role === 'tenant') {
      if (!invite.unit_id) {
        throw new AppError('Tenant invitation is missing unit_id', 400);
      }

      const [units] = await connection.execute(
        'SELECT id, rent_amount, occupancy_status FROM units WHERE id = ? FOR UPDATE',
        [invite.unit_id]
      );

      if (units.length === 0) {
        throw new AppError('Assigned unit not found', 404);
      }

      if (units[0].occupancy_status === 'occupied') {
        throw new AppError('Assigned unit is already occupied', 409);
      }

      const rentAmount = Number(invite.agreed_rent ?? units[0].rent_amount ?? 0);
      const cautionDeposit = Number(invite.caution_deposit ?? 0);
      const startDate =
        req.body.start_date ||
        req.body.startDate ||
        new Date().toISOString().slice(0, 10);
      const paymentFrequency =
        req.body.payment_frequency || req.body.paymentFrequency || 'annually';

      const [tenancyResult] = await connection.execute(
        `INSERT INTO tenancies
          (tenant_id, property_id, unit_id, rent_amount, caution_deposit, payment_frequency, start_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          userId,
          invite.property_id,
          invite.unit_id,
          rentAmount,
          cautionDeposit,
          paymentFrequency,
          startDate,
        ]
      );

      await connection.execute(
        "UPDATE units SET occupancy_status = 'occupied' WHERE id = ?",
        [invite.unit_id]
      );

      if (users[0].role !== 'landlord' && users[0].role !== 'caretaker') {
        await connection.execute(
          "UPDATE users SET role = 'tenant' WHERE id = ?",
          [userId]
        );
      }

      const [tenancyRows] = await connection.execute(
        'SELECT * FROM tenancies WHERE id = ?',
        [tenancyResult.insertId]
      );
      createdTenancy = tenancyRows[0] || null;
    }

    await connection.execute(
      "UPDATE invitations SET status = 'accepted' WHERE id = ?",
      [invite.id]
    );

    await connection.commit();

    const [updatedInvite] = await pool.execute(
      'SELECT * FROM invitations WHERE id = ?',
      [invite.id]
    );

    res.status(200).json({
      status: 'success',
      message: 'Invitation accepted successfully',
      data: {
        invitation: updatedInvite[0],
        ...(createdTenancy ? { tenancy: createdTenancy } : {}),
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function revokeInvitation(req, res, next) {
  try {
    const userId = getUserId(req);
    const { invitationId } = req.params;

    const [rows] = await pool.execute(
      `SELECT i.*, p.owner_id
       FROM invitations i
       INNER JOIN properties p ON p.id = i.property_id
       WHERE i.id = ?`,
      [invitationId]
    );

    if (rows.length === 0) {
      throw new AppError('Invitation not found', 404);
    }

    if (Number(rows[0].owner_id) !== Number(userId)) {
      throw new AppError(
        'Only the property owner can revoke this invitation',
        403
      );
    }

    if (rows[0].status !== 'pending') {
      throw new AppError(
        `Cannot revoke an invitation with status '${rows[0].status}'`,
        400
      );
    }

    await pool.execute(
      "UPDATE invitations SET status = 'revoked' WHERE id = ?",
      [invitationId]
    );

    const [updated] = await pool.execute(
      'SELECT * FROM invitations WHERE id = ?',
      [invitationId]
    );

    res.status(200).json({
      status: 'success',
      data: { invitation: updated[0] },
    });
  } catch (error) {
    next(error);
  }
}