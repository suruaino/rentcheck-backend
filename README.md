
# RENTCHECK Backend

Backend API for RENTCHECK, a residential property and tenancy management platform.

## Technology Stack

- Node.js
- Express.js
- MySQL 8
- mysql2
- JavaScript ES Modules

## Features

The backend will support:

- User authentication and authorization
- Property and unit management
- Tenancy management
- Rent schedules and payment tracking
- Payment verification and receipts
- Maintenance requests
- Notices and notifications
- Audit logging

## Project Structure

```text
rentcheck-backend/
├── database/
│   └── schema.sql
├── docs/
│   ├── API.md
│   ├── CONTRIBUTING.md
│   └── DATABASE.md
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   ├── app.js
│   └── server.js
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Requirements

Install the following:

- Node.js
- MySQL 8
- Git

## Installation

Clone the repository:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd rentcheck-backend
```

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Update `.env` with your local MySQL credentials.

## Database Setup

Create a database named:

```sql
CREATE DATABASE rentcheck_db;
```

Execute the database schema in `database/schema.sql` using MySQL Workbench or the MySQL command-line client.

## Running the Application

Start the development server:

```bash
npm run dev
```

The API will run on the configured port.

Health check:

```text
http://localhost:5000/api/health
```

## API Documentation

See `docs/API.md`.

## Database Documentation

See `docs/DATABASE.md`.

## Contribution Guidelines

See `docs/CONTRIBUTING.md`.

## Security

- Never commit `.env`.
- Never store plain-text passwords.
- Do not expose sensitive database credentials.
