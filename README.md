# RENTCHECK — Backend API

**One tenancy. One shared record.**

RENTCHECK is a residential property and tenancy management platform designed to connect landlords, property managers, caretakers, and tenants through a centralized digital system.

The backend provides the foundation for managing property records, tenancy information, rental payments, maintenance requests, notices, user accounts, and access permissions.

**Project status:** In Development  
**Product type:** Residential Property Management  
**Target market:** Nigeria  
**Primary platforms:** Web Dashboard and Mobile Application

---

## 1. Project Overview

RENTCHECK aims to simplify residential property management by replacing scattered rental records, paper receipts, and informal follow-ups with structured digital workflows.

The platform enables:

- Landlords and property managers to manage properties and residential units.
- Landlords to create tenancy records and invite tenants.
- Tenants to view tenancy information and rent obligations.
- Tenants to submit payment evidence.
- Authorized landlords or managers to verify payments.
- Users to manage and track maintenance requests.
- Landlords to issue notices and track tenant acknowledgements.
- Authorized users to access reliable records of important activities.

The core principle is:

> Every important tenancy activity should have a record, an owner, a status and a clear history.

## 2. Project Objectives

The RENTCHECK MVP aims to:

1. Digitize residential property, unit, and tenancy records.
2. Provide reliable rent tracking and payment acknowledgement.
3. Reduce manual payment follow-ups.
4. Make maintenance requests traceable.
5. Improve communication through structured notices.
6. Support landlords managing multiple properties and units.
7. Give tenants self-service access to their own tenancy records.
8. Maintain an auditable history of critical activities.

## 3. User Roles

The platform supports the following user categories:

| Role | Responsibilities |
|---|---|
| Landlord | Manages properties, units, tenants, payments, and maintenance. |
| Property Manager | Performs authorized property management activities. |
| Tenant | Views tenancy information, submits payment evidence, and reports maintenance issues. |
| Caretaker | Handles assigned property activities within permitted permissions. |
| Artisan | Participates in assigned maintenance jobs. |
| Administrator | Performs authorized administrative functions. |

Access to platform resources must be restricted according to user roles and property assignments.

## 4. Core Features

### Authentication and Account Management
- User registration and login.
- Account verification.
- Secure password handling.
- JWT-based authentication.
- User profile and settings management.
- Session handling.

### Role-Based Access Control (RBAC)
- Role-based permissions.
- Protected backend routes.
- Property-level authorization.
- Tenant access restricted to authorized tenancy records.
- Caretaker access restricted to assigned properties.
- Administrative access restricted to authorized functions.

### Property and Tenancy Management
- Property registration and management.
- Residential unit management.
- Tenancy record creation.
- Tenant invitations and acceptance.
- Rent schedule management.

### Payment Management
- Payment evidence submission.
- Payment recording and verification.
- Partial payment tracking.
- Outstanding balance management.
- Digital receipt generation after payment confirmation.

### Maintenance Management
- Maintenance request submission.
- Request assignment.
- Maintenance status updates.
- Request history.
- Resolution tracking.

### Notice Management
- Notice creation and delivery.
- Tenant acknowledgement.
- Notice history and status tracking.

### Audit Logging
- Recording critical user activities.
- Tracking payment verification.
- Recording maintenance status changes.
- Recording tenancy changes and notice acknowledgements.
- Identifying the actor and timestamp for each recorded action.
- Protecting historical audit records from modification by ordinary users.

## 5. Business Rules

The backend must enforce the following business rules:

- One active tenancy per residential unit at a time.
- One active tenancy per tenant account, as specified in the project brief.
- A landlord may manage multiple properties.
- Every residential unit belongs to one property.
- Rent schedules are generated using tenancy dates and payment frequency.
- A payment is not confirmed until authorized verification.
- Partial payments reduce outstanding balances.
- The oldest outstanding amount is settled first.
- Receipts are generated only after payment confirmation.
- Caretakers may record cash payments, but landlords approve them.
- Every maintenance request must have a status and history.
- Tenants may reopen unresolved maintenance requests.
- Notice delivery and acknowledgement are separate states.
- Users may only access records authorized for their roles.
- Critical audit records must be protected from ordinary-user modification.

## 6. Technology Stack

The planned backend technology stack includes:

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Backend web framework |
| MySQL | Relational database |
| JSON Web Token (JWT) | Authentication |
| bcrypt | Password hashing |
| dotenv | Environment variable management |
| Git and GitHub | Version control and collaboration |

The project will use JavaScript ES modules through `"type": "module"` in `package.json`.

## 7. Planned Backend Structure

The backend will follow a modular structure to make development, maintenance, and collaboration easier.

```text
rentcheck-backend/
│
├── database/
│   └── schema.sql
│
├── src/
│   ├── config/
│   │   └── db.js
│   │
│   ├── controllers/
│   │
│   ├── middleware/
│   │   ├── verifyToken.js
│   │   ├── checkRole.js
│   │   └── errorHandler.js
│   │
│   ├── models/
│   │
│   ├── routes/
│   │
│   ├── services/
│   │
│   ├── utils/
│   │   └── response.js
│   │
│   └── server.js
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

This is the planned structure and may expand as additional modules are implemented.

## 8. Security and Data Protection

Security is a key requirement of RENTCHECK.

The backend will implement:

- Secure password hashing.
- JWT authentication.
- Role-based authorization.
- Property-level access checks.
- Input validation.
- Protection against unauthorized access to other users' records.
- Environment-based configuration for sensitive credentials.
- Audit logging for critical activities.
- Database integrity constraints and validation.

Passwords, database credentials, JWT secrets, and other sensitive configuration values must never be committed to the public repository.

## 9. Getting Started

### Prerequisites

Before running the backend, install:

- Node.js (LTS version).
- npm (included with Node.js).
- Git.
- MySQL Server.

### Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/rentcheck-backend.git
```

Navigate into the project:

```bash
cd rentcheck-backend
```

### Install dependencies

Once the project dependencies have been configured:

```bash
npm install
```

### Configure environment variables

Create a `.env` file in the project root using `.env.example` as a reference.

Example configuration:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=rentcheck_db

JWT_SECRET=your_secure_secret
```

Use your own local credentials and a strong, private JWT secret. Do not commit `.env` to GitHub.

### Start the development server

The actual start command will be defined in `package.json` as the project is configured.

## 10. Development Workflow

The project uses Git branches to support collaborative development.

The main branch is:

```text
main
```

The assigned Member 1 development branch is:

```text
feature/auth-rbac
```

Basic workflow:

```bash
git switch main
git pull origin main

git switch -c feature/auth-rbac
```

After making changes:

```bash
git add .
git commit -m "feat: implement authentication and RBAC foundation"
git push -u origin feature/auth-rbac
```

Changes should be submitted through a Pull Request for review before merging into `main`.

Team members should branch from the updated `main` branch after the shared foundation has been merged.

## 11. Current Development Responsibilities

**Member 1 — Backend Foundation, Authentication and Authorization**

Primary responsibilities:

- Repository setup and configuration.
- Shared database schema.
- MySQL database connection.
- Express server foundation.
- User registration and login.
- Account verification.
- JWT authentication middleware.
- Role-based access control.
- Property-level authorization.
- Audit logging.
- Shared response utilities and error handling.

Other team members will build their assigned modules on top of the shared backend foundation.

## 12. MVP Scope

The first release prioritizes:

- Authentication and account management.
- Role-based access control.
- Property and unit management.
- Tenancy management and tenant invitations.
- Rent schedules.
- Payment recording and verification.
- Digital receipts.
- Maintenance requests and tracking.
- Notices and acknowledgements.
- Essential dashboards.
- Audit logs.

Features such as property discovery, rent financing, public ratings, and complex accounting are outside the MVP scope.

## 13. Project Vision

RENTCHECK aims to make every residential tenancy more transparent, organized, and accountable by giving landlords and tenants a reliable shared record of their rental relationship.

**One tenancy. One shared record.**

---

**Project:** RENTCHECK  
**Repository:** rentcheck-backend  
**Target Market:** Nigeria  
**Documentation:** README.md  
**Status:** Under Development