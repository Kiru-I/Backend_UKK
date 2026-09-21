# Corporate Travel Management Backend

Backend API for employee travel request management, approval workflow, booking fulfillment, and reimbursement processing.

This project is built with Bun, Hono, MySQL, and Drizzle ORM.

## Tech stack

- Runtime: Bun
- Framework: Hono
- Database: MySQL
- ORM: Drizzle ORM
- Auth: JWT + bcryptjs
- Validation: Zod

## Project structure

```bash
src/
  db/
    index.ts
    schema.ts
  lib/
    auth.ts
  middleware/
    auth.ts
  routes/
    approval.ts
    auth.ts
    dashboard.ts
    fulfillment.ts
    reimbursement.ts
    travel.ts
    users.ts
  index.ts
  seed.ts
```

## Features

- User authentication and role-based access
- Travel request submission
- Travel approval and rejection by manager
- Travel fulfillment recording by admin travel
- Reimbursement submission and processing
- Dashboard statistics and expense summary
- Real file upload for travel documents

## Roles

- Karyawan
- Atasan
- Admin Travel
- Tim Keuangan
- Super Admin

## Prerequisites

Before running the project, make sure you have:

- Bun installed
- MySQL running locally or in a container
- A database created for the app

## Environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=mysql://root:password@localhost:3306/travel_db
JWT_SECRET=travel-management-secret
PORT=3000
APP_URL=http://localhost:3000
```

Notes:

- `DATABASE_URL` should match your local MySQL credentials
- `APP_URL` is used when generating uploaded file URLs

## Setup

Install dependencies:

```bash
bun install
```

Create the database in MySQL:

```sql
CREATE DATABASE travel_db;
```

Generate and apply migrations:

```bash
bun run db:generate
bun run db:migrate
```

Seed sample data:

```bash
bun run seed
```

Run the server:

```bash
bun run dev
```

The app runs at:

```text
http://localhost:3000
```

## Authentication

All protected routes require a bearer token in the request header:

```http
Authorization: Bearer <jwt_token>
```

### Login

```http
POST /api/auth/login
```

Request body:

```json
{
  "email": "superadmin@travel.local",
  "password": "superadmin123"
}
```

Example response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Super Administrator",
    "email": "superadmin@travel.local",
    "role": "Super Admin",
    "department": "IT"
  }
}
```

### Get current user

```http
GET /api/auth/me
```

## Base API URL

```text
http://localhost:3000/api
```

## Travel file upload

Travel submission supports real multipart upload for document attachments.

### Upload via form-data

```http
POST /api/travels
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Form fields:

- `destination`
- `start_date`
- `end_date`
- `purpose`
- `document` (file)

Example using curl:

```bash
curl -X POST http://localhost:3000/api/travels \
  -H "Authorization: Bearer <token>" \
  -F "destination=Jakarta" \
  -F "start_date=2026-09-12" \
  -F "end_date=2026-09-14" \
  -F "purpose=Rapat bisnis dengan tim regional" \
  -F "document=@/path/to/tor.pdf"
```

The uploaded file is saved to:

```text
./uploads/travel-documents/
```

and the saved URL is returned as:

```text
http://localhost:3000/uploads/travel-documents/<filename>
```

You can also still send a URL directly:

```json
{
  "destination": "Jakarta",
  "start_date": "2026-09-12",
  "end_date": "2026-09-14",
  "purpose": "Rapat bisnis",
  "document_url": "https://example.com/file.pdf"
}
```

## Routes

### Auth

```http
POST /api/auth/login
GET /api/auth/me
```

### Users

```http
GET /api/users
POST /api/users
PUT /api/users/:id
DELETE /api/users/:id
```

### Travel

```http
POST /api/travels
GET /api/travels/my-requests
GET /api/travels/:id
```

### Approval

```http
GET /api/approvals
POST /api/approvals/:id/action
```

Request body for approval:

```json
{
  "action": "APPROVE",
  "notes": "Dokumen sudah lengkap."
}
```

### Fulfillment

```http
GET /api/fulfillment/pending
POST /api/fulfillment/:travelId
```

Request body:

```json
{
  "transport_details": "Pesawat GA 301, seat 2A",
  "accommodation_details": "Hotel Grand Indonesia, 3 malam"
}
```

### Reimbursements

```http
POST /api/reimbursements/:travelId
GET /api/reimbursements/pending
POST /api/reimbursements/:id/process
```

Example reimbursement item:

```json
{
  "items": [
    {
      "category": "Transportasi",
      "amount": 2500000,
      "receipt_url": "https://example.com/receipt.pdf",
      "description": "Tiket pesawat pulang pergi"
    }
  ]
}
```

### Dashboard

```http
GET /api/dashboard/stats
GET /api/dashboard/expenses
```

## Example response format

Success response:

```json
{
  "message": "Travel request submitted successfully.",
  "travelRequest": {
    "id": 1,
    "user_id": 2,
    "destination": "Jakarta",
    "start_date": "2026-09-12",
    "end_date": "2026-09-14",
    "purpose": "Rapat dengan tim sales",
    "document_url": "http://localhost:3000/uploads/travel-documents/1726800000000-uuid.pdf",
    "status": "PENDING"
  }
}
```

Error response:

```json
{
  "error": "Validation Error",
  "details": {
    "fieldErrors": {
      "destination": ["String must contain at least 2 character(s)"]
    }
  }
}
```

## API Documentation

### Authentication

#### Login

```http
POST /api/auth/login
```

Request body:

```json
{
  "email": "superadmin@travel.local",
  "password": "superadmin123"
}
```

Response:

```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "name": "Super Administrator",
    "email": "superadmin@travel.local",
    "role": "Super Admin",
    "department": "IT"
  }
}
```

#### Get current user

```http
GET /api/auth/me
Authorization: Bearer <token>
```

Response:

```json
{
  "id": 1,
  "name": "Super Administrator",
  "email": "superadmin@travel.local",
  "role": "Super Admin",
  "department": "IT"
}
```

### Users

#### Get all users

```http
GET /api/users
Authorization: Bearer <token>
```

#### Create user

```http
POST /api/users
Authorization: Bearer <token>
```

Request body:

```json
{
  "name": "Dewi Kusuma",
  "email": "dewi@company.com",
  "password": "password123",
  "role": "Karyawan",
  "department": "Finance"
}
```

#### Update user

```http
PUT /api/users/:id
Authorization: Bearer <token>
```

#### Delete user

```http
DELETE /api/users/:id
Authorization: Bearer <token>
```

### Travel requests

#### Create travel request

```http
POST /api/travels
Authorization: Bearer <token>
```

Multipart form-data option:

```bash
curl -X POST http://localhost:3000/api/travels \
  -H "Authorization: Bearer <token>" \
  -F "destination=Jakarta" \
  -F "start_date=2026-09-12" \
  -F "end_date=2026-09-14" \
  -F "purpose=Rapat bisnis" \
  -F "document=@/path/to/file.pdf"
```

JSON option:

```json
{
  "destination": "Jakarta",
  "start_date": "2026-09-12",
  "end_date": "2026-09-14",
  "purpose": "Rapat bisnis dengan tim regional",
  "document_url": "https://example.com/document.pdf"
}
```

Response:

```json
{
  "message": "Travel request submitted successfully.",
  "travelRequest": {
    "id": 1,
    "user_id": 2,
    "destination": "Jakarta",
    "start_date": "2026-09-12",
    "end_date": "2026-09-14",
    "purpose": "Rapat bisnis dengan tim regional",
    "document_url": "http://localhost:3000/uploads/travel-documents/example.pdf",
    "status": "PENDING"
  }
}
```

#### Get my travel requests

```http
GET /api/travels/my-requests
Authorization: Bearer <token>
```

#### Get one travel request

```http
GET /api/travels/:id
Authorization: Bearer <token>
```

### Approvals

#### View pending approvals

```http
GET /api/approvals
Authorization: Bearer <token>
```

#### Approve or reject request

```http
POST /api/approvals/:id/action
Authorization: Bearer <token>
```

Request body:

```json
{
  "action": "APPROVE",
  "notes": "Disetujui sesuai kebutuhan operasional."
}
```

or:

```json
{
  "action": "REJECT",
  "notes": "Dokumen belum lengkap."
}
```

### Fulfillment

#### View approved requests for fulfillment

```http
GET /api/fulfillment/pending
Authorization: Bearer <token>
```

#### Store fulfillment data

```http
POST /api/fulfillment/:travelId
Authorization: Bearer <token>
```

Request body:

```json
{
  "transport_details": "Pesawat GA 301, seat 2A",
  "accommodation_details": "Hotel Grand Indonesia, 3 malam"
}
```

### Reimbursements

#### Submit reimbursement

```http
POST /api/reimbursements/:travelId
Authorization: Bearer <token>
```

Request body:

```json
{
  "items": [
    {
      "category": "Transportasi",
      "amount": 2500000,
      "receipt_url": "https://example.com/receipt.pdf",
      "description": "Tiket pesawat pulang pergi"
    },
    {
      "category": "Akomodasi",
      "amount": 3200000,
      "receipt_url": "https://example.com/hotel.pdf",
      "description": "Biaya hotel untuk 3 malam"
    }
  ]
}
```

#### View pending reimbursements

```http
GET /api/reimbursements/pending
Authorization: Bearer <token>
```

#### Process reimbursement

```http
POST /api/reimbursements/:id/process
Authorization: Bearer <token>
```

Request body:

```json
{
  "status": "VERIFIED",
  "notes": "Data sudah lengkap."
}
```

Valid values:

- VERIFIED
- PAID
- REJECTED

### Dashboard

#### Statistics

```http
GET /api/dashboard/stats
Authorization: Bearer <token>
```

Response:

```json
{
  "upcoming": 12,
  "ongoing": 3,
  "completed": 28
}
```

#### Expense summary

```http
GET /api/dashboard/expenses
Authorization: Bearer <token>
```

Response:

```json
{
  "expenses": [
    {
      "employee_name": "Dewi Kusuma",
      "department": "Finance",
      "total": 1500000
    }
  ]
}
```

## Notes

- The seed data is intentionally realistic for testing approvals, reimbursements, and fulfillment flows.
- Uploaded files are stored locally in the `uploads/` folder for development purposes.
- For production, it is recommended to move file storage to cloud object storage such as S3, Cloudinary, or Supabase Storage.

## Useful commands

```bash
bun install
bun run db:generate
bun run db:migrate
bun run seed
bun run dev
```


## 9. Data Model Inti

### Users

```json
{
  "id": 1,
  "name": "Nama User",
  "email": "user@email.com",
  "password_hash": "hashed_password",
  "role": "Karyawan",
  "department": "IT",
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:00.000Z"
}
```

### Travel Requests

```json
{
  "id": 1,
  "user_id": 2,
  "destination": "Tokyo",
  "start_date": "2026-09-20",
  "end_date": "2026-09-24",
  "purpose": "Training internasioanal",
  "document_url": "https://example.com/tor.pdf",
  "status": "PENDING",
  "created_at": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:00.000Z"
}
```

### Reimbursement

```json
{
  "id": 1,
  "travel_request_id": 1,
  "user_id": 2,
  "total_amount": "2500000.00",
  "status": "SUBMITTED",
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

## 10. Panduan Integrasi Frontend

### 10.1 Simpan token setelah login

```javascript
const token = response.token;
localStorage.setItem('token', token);
```

### 10.2 Tambahkan header Authorization di setiap request aman

```javascript
const token = localStorage.getItem('token');

fetch('http://localhost:3000/api/travels/my-requests', {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
});
```

### 10.3 Contoh Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
```

### 10.4 Handling error frontend

```javascript
try {
  const response = await api.post('/api/auth/login', {
    email: 'user@email.com',
    password: 'password123'
  });

  console.log(response.data);
} catch (error) {
  if (error.response?.status === 401) {
    console.error('Login gagal atau token invalid');
  }

  if (error.response?.status === 403) {
    console.error('Akses ditolak karena role tidak sesuai');
  }
}
```

## 11. Seed Data Awal

Untuk membuat user Super Admin default:

```bash
bun run seed
```

User default:

- Email: `superadmin@travel.local`
- Password: `superadmin123`

## 12. Catatan Penting

- Pastikan MySQL sudah aktif sebelum menjalankan migration.
- Gunakan JWT yang aman pada environment production.
- Jangan simpan password di frontend.
- Untuk production, ganti `JWT_SECRET` dan konfigurasi database sesuai environment.

## 13. Referensi Cepat

- Login: `POST /api/auth/login`
- Profile: `GET /api/auth/me`
- User list: `GET /api/users`
- Create user: `POST /api/users`
- Update user: `PUT /api/users/:id`
- Submit travel: `POST /api/travels`
- My requests: `GET /api/travels/my-requests`
- Travel detail: `GET /api/travels/:id`
- Approvals: `GET /api/approvals`
- Action approval: `POST /api/approvals/:id/action`
- Pending fulfillment: `GET /api/fulfillment/pending`
- Fulfillment: `POST /api/fulfillment/:travelId`
- Reimbursement submit: `POST /api/reimbursements/:travelId`
- Pending reimbursement: `GET /api/reimbursements/pending`
- Process reimbursement: `POST /api/reimbursements/:id/process`
- Dashboard stats: `GET /api/dashboard/stats`
- Dashboard expenses: `GET /api/dashboard/expenses`

Semua dokumentasi ini dapat digunakan sebagai acuan utama untuk integrasi frontend dan pengujian API.
