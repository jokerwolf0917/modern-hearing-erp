# 🦻 Modern Hearing ERP

[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61dafb?style=for-the-badge&logo=react&logoColor=061a23)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2B%20SQLAlchemy-05998b?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20Asyncpg-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![DevOps](https://img.shields.io/badge/DevOps-Docker%20%2B%20Compose-2496ed?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![UI](https://img.shields.io/badge/UI-Ant%20Design%20v5-1677ff?style=for-the-badge&logo=antdesign&logoColor=white)](https://ant.design/)
[![i18n](https://img.shields.io/badge/i18n-react--i18next-26a69a?style=for-the-badge&logo=i18next&logoColor=white)](https://react.i18next.com/)

## Overview

**Modern Hearing ERP** is a full-stack **B2B SaaS ERP & POS system** built for offline hearing-aid retail chains and second-class medical-device operations.

It is designed to replace legacy desktop software with a modern, bilingual, concurrency-aware web platform that combines:

- real-world retail workflows,
- strict medical-device traceability,
- clean SaaS-grade UI,
- and transaction-safe backend logic.

The project focuses on the operational realities of hearing-aid businesses: multi-store inventory, serial-number lifecycle tracking, POS checkout, CRM scheduling, audiogram records, and AI-powered intake.

## Core Features

### ⚡ Concurrency-Safe POS

The sales flow is built with **transactional stock deduction** and **pessimistic locking** (`with_for_update`) to prevent overselling under concurrent checkout scenarios across multiple stores.

- Inventory rows are locked before quantity deduction.
- SN-tracked items lock specific serial records instead of only aggregate quantity.
- Sales, returns, and stock rollback are all handled inside atomic database transactions.

### 🔎 Item-Level SN Tracking

This system supports **item-level serial number tracking** for regulated medical devices.

- Every high-value hearing aid can be tracked by unique SN.
- Stock-in, sales, return, and warranty state are tied to the actual physical unit.
- A global SN trace page reconstructs store ownership, order linkage, customer relationship, and warranty validity.

### 🤖 Multimodal AI Intake

The project integrates **Vision AI** to parse paper audiograms and hearing records into structured data.

- Image upload + AI extraction pipeline
- Structured JSON output for audiogram thresholds
- Human-in-the-loop review before persistence
- A solid base for future MLOps-style clinical workflows

### 🏢 Multi-tenant RBAC

The platform enforces **role-based access control** and **store-level data isolation**.

- `ADMIN` users can access cross-store operational data.
- `STORE_MANAGER` and staff accounts are automatically scoped to their own store.
- Sensitive inventory, order, and appointment queries are filtered server-side, not just hidden in the UI.

### 🌍 Modern i18n UI

The frontend provides a frictionless **Chinese / English bilingual interface** powered by `react-i18next`.

- Seamless runtime language switch
- Business-facing dashboards and CRUD screens translated for open-source showcase
- Clean SaaS-style interface built with React 18 + Ant Design v5

## Tech Stack

### Frontend

- React 18
- TypeScript
- Ant Design v5
- React Router DOM
- TanStack React Query
- Axios
- react-i18next
- Recharts

### Backend

- FastAPI
- Python
- SQLAlchemy (async)
- JWT Authentication
- Pydantic

### Database

- PostgreSQL
- Asyncpg

### DevOps

- Docker
- Docker Compose
- Nginx

## Quick Start

### 1. Start everything with Docker

```bash
docker compose up -d --build
```

### 2. Load the demo seed dataset

```bash
docker compose exec backend python seed.py --reset
```

### 3. Open the services

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- PostgreSQL: `localhost:5432`

## What You Can Demo

- Create and manage customers, products, stores, employees, and appointments
- Run multi-store stock-in and transfer workflows
- Perform POS checkout with transaction-safe stock deduction
- Print order receipts
- Track medical devices by serial number and warranty lifecycle
- Explore dashboard analytics with seeded revenue trends
- Switch the UI between English and Chinese instantly

## Project Structure

```text
.
├── app/                  # FastAPI backend
├── frontend/             # React + TypeScript frontend
├── Dockerfile            # Backend container image
├── docker-compose.yml    # Full-stack orchestration
└── seed.py               # Open-source demo seed script
```

## Disclaimer

> For open-source compliance, **all real patient/customer data and production API secrets have been strictly removed**.
>
> This repository contains **seeded dummy data only** for demonstration purposes.

## Why This Project Matters

This is not a toy CRUD demo.

It is a domain-specific ERP/POS system that demonstrates how to combine:

- business-critical transaction safety,
- regulated-device traceability,
- role-based SaaS architecture,
- multimodal AI workflows,
- and production-friendly Docker delivery

inside a compact but realistic full-stack product.
