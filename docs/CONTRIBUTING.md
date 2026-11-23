
# RENTCHECK Contribution Guidelines

## 1. Getting Started

Clone the repository:

git clone YOUR_GITHUB_REPOSITORY_URL

Enter the project directory:

cd rentcheck-backend

Install dependencies:

npm install

Create your local environment file:

cp .env.example .env

Configure your MySQL credentials in `.env`.

## 2. Running the Project

Start the development server:

npm run dev

The API should run on the configured port.

Test the health endpoint:

http://localhost:5000/api/health

## 3. Git Workflow

The main branch contains the shared project foundation and stable integration code.

Create a feature branch before implementing assigned features:

git checkout main

git pull origin main

git checkout -b feature/your-feature-name

Examples:

- feature/authentication
- feature/property-management
- feature/tenancy
- feature/payments
- feature/maintenance

Push your branch:

git push -u origin feature/your-feature-name

Open a Pull Request into main when your work is ready.

## 4. Coding Guidelines

- Use JavaScript ES modules (import/export).
- Follow the existing folder structure.
- Use camelCase for variables and functions.
- Use meaningful file and function names.
- Reuse shared middleware and utilities.
- Keep controllers focused on handling HTTP requests.
- Put business logic in services.
- Put database queries in models.
- Validate incoming request data.
- Handle errors using AppError and the central error handler.

## 5. Team Rules

- Do not commit `.env` or other secrets.
- Do not commit `node_modules`.
- Do not modify shared middleware or configuration without discussing it with the team.
- Do not change shared database structures without team agreement.
- Pull the latest main branch before starting new work.
- Keep commits focused and descriptive.
