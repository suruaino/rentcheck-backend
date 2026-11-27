CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('landlord', 'caretaker', 'tenant', 'admin') NOT NULL DEFAULT 'landlord',
  estate_title VARCHAR(255) NULL,
  title VARCHAR(100) NULL,
  account_status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS properties (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  landlord_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  property_type VARCHAR(100) NULL,
  status ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_properties_landlord (landlord_id),
  CONSTRAINT fk_properties_landlord
    FOREIGN KEY (landlord_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS units (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id BIGINT UNSIGNED NOT NULL,
  unit_number VARCHAR(100) NOT NULL,
  rent_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  occupancy_status ENUM('vacant', 'occupied', 'maintenance') NOT NULL DEFAULT 'vacant',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_units_property_unit_number (property_id, unit_number),
  KEY idx_units_property_status (property_id, occupancy_status),
  CONSTRAINT fk_units_property
    FOREIGN KEY (property_id) REFERENCES properties (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS property_caretakers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id BIGINT UNSIGNED NOT NULL,
  caretaker_id BIGINT UNSIGNED NOT NULL,
  can_manage_maintenance TINYINT(1) NOT NULL DEFAULT 1,
  can_record_cash_payments TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive', 'revoked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_property_caretakers_pair (property_id, caretaker_id),
  KEY idx_property_caretakers_caretaker_status (caretaker_id, status),
  CONSTRAINT fk_property_caretakers_property
    FOREIGN KEY (property_id) REFERENCES properties (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_property_caretakers_user
    FOREIGN KEY (caretaker_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invitations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id BIGINT UNSIGNED NOT NULL,
  unit_id BIGINT UNSIGNED NULL,
  invited_by BIGINT UNSIGNED NULL,
  invitee_email VARCHAR(255) NULL,
  invitee_phone VARCHAR(50) NULL,
  role ENUM('tenant', 'caretaker') NOT NULL,
  agreed_rent DECIMAL(12, 2) NULL,
  token VARCHAR(255) NOT NULL,
  status ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invitations_token (token),
  KEY idx_invitations_property (property_id),
  KEY idx_invitations_unit (unit_id),
  KEY idx_invitations_status (status),
  CONSTRAINT fk_invitations_property
    FOREIGN KEY (property_id) REFERENCES properties (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_invitations_unit
    FOREIGN KEY (unit_id) REFERENCES units (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_invitations_inviter
    FOREIGN KEY (invited_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenancies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  unit_id BIGINT UNSIGNED NOT NULL,
  rent_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status ENUM('active', 'ended', 'terminated', 'pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tenancies_tenant_status (tenant_id, status),
  KEY idx_tenancies_property_unit (
