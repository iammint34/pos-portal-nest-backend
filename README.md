# POS Portal NestJS Backend

Backend Service for POS Portal / Back Office Management System.

## Tech Stack

- **Framework**: NestJS 11
- **HTTP Server**: Fastify
- **Database**: MySQL
- **ORM**: Prisma
- **Authentication**: JWT (Access & Refresh Tokens)
- **Authorization**: Dynamic RBAC
- **API Documentation**: Swagger/OpenAPI

## Features (Phase 1)

- User Authentication (JWT with access/refresh tokens)
- Dynamic Role-Based Access Control (RBAC)
- Multi-Store (Multi-Tenant) Support
- Branch Management
- Item Management with Versioning
- POS Device Registration & Management
- POS Synchronization (Config, Items, Status)
- Audit Logging

## Prerequisites

- Node.js 20+
- MySQL 8.0+
- npm or yarn

## Getting Started

### 1. Clone and Install

```bash
cd pos-portal-nest-backend
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your configuration:

```env
DATABASE_URL="mysql://user:password@localhost:3310/pos_portal"
JWT_SECRET=your-secret-key
```

### 3. Database Setup

Start MySQL (using Docker for development):

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Run migrations and seed:

```bash
# Run migrations
npm run prisma:migrate

# Seed permissions
npm run prisma:seed

# Seed with demo data (optional)
npm run prisma:seed:demo
```

### 4. Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

Swagger documentation: `http://localhost:3000/api/docs`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/login | User login |
| POST | /api/v1/auth/refresh | Refresh tokens |
| POST | /api/v1/auth/logout | User logout |
| POST | /api/v1/auth/switch-store | Switch store context |

### Stores

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/stores | Create store |
| GET | /api/v1/stores | List stores |
| GET | /api/v1/stores/:id | Get store details |
| PATCH | /api/v1/stores/:id | Update store |
| DELETE | /api/v1/stores/:id | Delete store |

### Branches

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/branches | Create branch |
| GET | /api/v1/branches | List branches |
| GET | /api/v1/branches/:id | Get branch details |
| PATCH | /api/v1/branches/:id | Update branch |
| DELETE | /api/v1/branches/:id | Delete branch |

### Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/items | Create item |
| GET | /api/v1/items | List items |
| GET | /api/v1/items/:id | Get item details |
| PATCH | /api/v1/items/:id | Update item |
| DELETE | /api/v1/items/:id | Delete item |
| GET | /api/v1/items/:id/versions | Get item version history |
| POST | /api/v1/items/categories | Create category |
| GET | /api/v1/items/categories/list | List categories |

### POS Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/pos/register | Register POS device |
| POST | /api/v1/pos/authenticate | Authenticate POS device |
| GET | /api/v1/pos/devices | List POS devices |
| GET | /api/v1/pos/devices/:id | Get device details |
| PATCH | /api/v1/pos/devices/:id | Update device |
| DELETE | /api/v1/pos/devices/:id | Delete device |

### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/sync | Sync configuration to POS |
| POST | /api/v1/sync/heartbeat | POS heartbeat |
| GET | /api/v1/sync/logs | Get sync logs |
| GET | /api/v1/sync/stats | Get sync statistics |

### RBAC

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/rbac/permissions | List all permissions |
| POST | /api/v1/rbac/roles | Create role |
| GET | /api/v1/rbac/roles | List roles |
| PATCH | /api/v1/rbac/roles/:id | Update role |
| DELETE | /api/v1/rbac/roles/:id | Delete role |

## Docker Deployment

### Development

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Production

```bash
docker-compose up -d
```

## Demo Credentials

When seeded with demo data:

- **Email**: admin@demo.com
- **Password**: admin123
- **Store**: Demo Restaurant

## Project Structure

```
src/
├── auth/           # Authentication module
├── rbac/           # Role-based access control
├── users/          # User management
├── stores/         # Store management
├── branches/       # Branch management
├── items/          # Item & category management
├── pos/            # POS device management
├── sync/           # POS synchronization
├── audit/          # Audit logging
├── prisma/         # Database service
└── common/         # Shared utilities
    ├── decorators/
    ├── guards/
    ├── filters/
    └── dto/
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production server |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:seed` | Seed permissions |
| `npm run prisma:seed:demo` | Seed with demo data |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run test` | Run tests |
| `npm run lint` | Lint code |

## License

UNLICENSED
