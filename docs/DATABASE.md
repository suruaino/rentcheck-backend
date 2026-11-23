
# RENTCHECK Database Guidelines

## 1. Database

Database name: rentcheck_db

Database engine: MySQL 8

## 2. Naming Conventions

- Use lowercase table names.
- Use snake_case for table and column names.
- Every main table should have an `id` primary key.
- Use `created_at` and `updated_at` timestamps where appropriate.
- Use foreign keys to establish relationships between tables.

## 3. Existing Core Tables

### users

Stores all RENTCHECK user accounts.

Main fields:
- id
- first_name
- last_name
- email
- phone
- password_hash
- role
- account_status
- email_verified_at
- created_at
- updated_at

### properties

Stores properties managed on the platform.

Main fields:
- id
- owner_id
- name
- description
- address
- city
- state
- country
- created_at
- updated_at

### units

Stores individual units belonging to properties.

Main fields:
- id
- property_id
- unit_number
- unit_type
- bedrooms
- bathrooms
- status
- created_at
- updated_at

## 4. Database Rules

- A user can own multiple properties.
- A property can contain multiple units.
- Every property must reference an existing user.
- Every unit must reference an existing property.
- A unit number must be unique within its property.
- Do not store plain-text passwords.
- Do not delete important business records without considering their relationships and history.

## 5. Important

Before changing shared tables or adding major relationships, discuss the proposed changes with the team.

Keep `database/schema.sql` updated whenever the agreed database structure changes.
