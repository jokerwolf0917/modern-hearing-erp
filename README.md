# HearFlow

[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61dafb?style=for-the-badge&logo=react&logoColor=061a23)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2B%20SQLAlchemy-05998b?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20Asyncpg-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![DevOps](https://img.shields.io/badge/DevOps-Docker%20%2B%20Compose-2496ed?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![UI](https://img.shields.io/badge/UI-Ant%20Design%20v5-1677ff?style=for-the-badge&logo=antdesign&logoColor=white)](https://ant.design/)
[![i18n](https://img.shields.io/badge/i18n-react--i18next-26a69a?style=for-the-badge&logo=i18next&logoColor=white)](https://react.i18next.com/)

## Overview

**HearFlow** is a full-stack ERP and POS system for offline hearing-aid stores and small multi-store retail operations.

It focuses on the workflows that matter in day-to-day store operations:

- customer and service management
- appointment scheduling
- repair tracking
- POS checkout
- inventory movement and stock overview
- product, store, and employee administration
- bilingual Chinese / English experience

The project is designed as a modern replacement for legacy desktop tools, with a cleaner UI, stronger data rules, and a deployable Docker setup.

## Core Features

### Customer 360

- Customer profiles with duplicate-prevention rules
- Unified customer drawer with profile, purchase history, repairs, and fitting records
- Manual backfill support for stores migrating from offline spreadsheets

### Repairs and Service

- Dedicated repair dashboard with fuzzy search
- Due-date-first ordering for faster staff follow-up
- Manual repair creation and export/import workflow
- Visual status highlighting for overdue and upcoming jobs

### POS and Inventory

- Sales POS with cart workflow and customer binding
- Inventory center for stock lookup, stock-in, and transfer operations
- Product and inventory structures aligned with real retail spreadsheet fields
- Store-scoped and all-store views for admins

### Multi-store Operations

- Store-level filtering across key modules
- Admin can switch between all stores and a single store
- Staff and store managers stay scoped to their assigned store

### Management and Onboarding

- Product, store, and employee management
- Built-in help center for first-time users
- Settings center for language, default store, and interface preferences

### Bilingual UI

- Runtime Chinese / English language switch
- Ant Design locale integration
- UI shell translated while business data remains intact

## Modules

The current application includes:

- Dashboard
- Customers
- Repairs
- Calendar
- Sales POS
- Orders
- Inventory Center
- Products
- Stores
- Employees
- Settings
- Help Center

## Tech Stack

### Frontend

- React 18
- TypeScript
- Ant Design v5
- React Router DOM
- TanStack React Query
- Axios
- react-i18next

### Backend

- FastAPI
- Python
- SQLAlchemy
- Pydantic
- JWT authentication

### Database

- PostgreSQL
- Asyncpg

### DevOps

- Docker
- Docker Compose
- Nginx

## Quick Start

### 1. Build and start the stack

```bash
docker compose up -d --build
```

### 2. Seed demo data

```bash
docker compose exec backend python seed.py --reset
```

### 3. Open the services

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- PostgreSQL: `localhost:5432`

## Demo Accounts

Default demo credentials after seeding:

- `admin / Demo123!`

## Docker Files

- Backend image: [Dockerfile](./Dockerfile)
- Frontend image: [frontend/Dockerfile](./frontend/Dockerfile)
- Compose stack: [docker-compose.yml](./docker-compose.yml)

## Repository Structure

```text
.
|- app/                FastAPI backend
|- frontend/           React + TypeScript frontend
|- Dockerfile          Backend container image
|- docker-compose.yml  Full-stack orchestration
`- seed.py             Demo seed script
```

## Notes

- The frontend is optimized for a modern desktop ERP workflow.
- Demo data is intentionally seeded to make dashboards and operational pages easier to review.
- The system supports both Chinese and English UI modes.

## Disclaimer

For open-source compliance:

- real customer and patient data has been removed
- production secrets are not included
- the repository is intended to run with seeded demo data only

## License

This repository is currently provided for portfolio and demonstration use unless a separate license is added.
