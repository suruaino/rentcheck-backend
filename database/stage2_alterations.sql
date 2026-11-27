USE rentcheck_db;

-- 1. Properties table additions
ALTER TABLE properties
    ADD COLUMN property_type VARCHAR(100) NULL AFTER name,
    ADD COLUMN total_units INT UNSIGNED NOT NULL DEFAULT 0 AFTER property_type,
    ADD COLUMN rent_per_unit DECIMAL(14, 2) NOT NULL DEFAULT 0.00 AFTER total_units;

-- 2. Units table addition
ALTER TABLE units
    ADD COLUMN rent_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00 AFTER unit_type;

-- 3. Invitations table additions
ALTER TABLE invitations
    ADD COLUMN agreed_rent DECIMAL(14, 2) NULL AFTER role,
    ADD COLUMN caution_deposit DECIMAL(14, 2) NULL AFTER agreed_rent,
    ADD COLUMN can_manage_maintenance TINYINT(1) NOT NULL DEFAULT 0 AFTER caution_deposit,
    ADD COLUMN can_record_cash_payments TINYINT(1) NOT NULL DEFAULT 0 AFTER can_manage_maintenance,
    MODIFY COLUMN status ENUM('pending', 'accepted', 'revoked', 'expired') NOT NULL DEFAULT 'pending';

-- 4. Property caretakers table additions
ALTER TABLE property_caretakers
    ADD COLUMN status ENUM('pending', 'active', 'revoked') NOT NULL DEFAULT 'pending' AFTER caretaker_id,
    ADD COLUMN can_manage_maintenance TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
    ADD COLUMN can_record_cash_payments TINYINT(1) NOT NULL DEFAULT 0 AFTER can_manage_maintenance,
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER can_record_cash_payments;

-- 5. Tenancies table additions
ALTER TABLE tenancies
    MODIFY COLUMN rent_amount DECIMAL(14, 2) NOT NULL,
    ADD COLUMN caution_deposit DECIMAL(14, 2) NOT NULL DEFAULT 0.00 AFTER rent_amount,
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER status;