-- RENTCHECK database schema

USE rentcheck_db;

-- 1. Users table

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NULL UNIQUE,
    phone VARCHAR(20) NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM(
        'landlord',
        'property_manager',
        'tenant',
        'caretaker',
        'artisan',
        'admin'
    ) NOT NULL DEFAULT 'landlord',
    estate_title VARCHAR(150) NULL DEFAULT NULL,
    title VARCHAR(50) NULL DEFAULT NULL,
    account_status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    email_verified_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Properties table
CREATE TABLE IF NOT EXISTS properties (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_properties_owner
        FOREIGN KEY (owner_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_properties_owner (owner_id)
) ENGINE=InnoDB;


-- 3. Units table
CREATE TABLE IF NOT EXISTS units (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    unit_type VARCHAR(100),
    bedrooms TINYINT UNSIGNED DEFAULT 0,
    bathrooms DECIMAL(3,1) DEFAULT 0,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    occupancy_status ENUM('vacant', 'occupied') NOT NULL DEFAULT 'vacant',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_units_property
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT unique_property_unit
        UNIQUE (property_id, unit_number),

    INDEX idx_units_property (property_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. Invitations table
CREATE TABLE IF NOT EXISTS invitations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL,
    unit_id BIGINT UNSIGNED NULL,
    invited_by BIGINT UNSIGNED NOT NULL,
    invitee_email VARCHAR(255) NULL,
    invitee_phone VARCHAR(20) NULL,
    role ENUM('tenant', 'caretaker') NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    status ENUM('pending', 'accepted', 'expired') DEFAULT 'pending',
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (unit_id) REFERENCES units(id),
    FOREIGN KEY (invited_by) REFERENCES users(id)
) ENGINE=InnoDB;


-- 5. Property caretakers table
CREATE TABLE IF NOT EXISTS property_caretakers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_id BIGINT UNSIGNED NOT NULL,
    caretaker_id BIGINT UNSIGNED NOT NULL,

    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (caretaker_id) REFERENCES users(id),

    UNIQUE (property_id, caretaker_id)
) ENGINE=InnoDB;


-- 6. Tenancies table
CREATE TABLE IF NOT EXISTS tenancies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    property_id BIGINT UNSIGNED NOT NULL,
    unit_id BIGINT UNSIGNED NOT NULL,
    rent_amount DECIMAL(10, 2) NOT NULL,
    payment_frequency ENUM(
        'monthly',
        'quarterly',
        'biannually',
        'annually'
    ) DEFAULT 'monthly',
    start_date DATE NOT NULL,
    end_date DATE NULL,
    status ENUM('active', 'ended') DEFAULT 'active',

    FOREIGN KEY (tenant_id) REFERENCES users(id),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
) ENGINE=InnoDB;


-- 7. Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id VARCHAR(100) NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    INDEX idx_audit_logs_user (user_id),
    INDEX idx_audit_logs_entity (entity_type, entity_id)
) ENGINE=InnoDB;