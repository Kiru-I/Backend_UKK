# Backend Corporate Travel Management System

Dokumentasi ini berisi panduan penggunaan API backend untuk aplikasi Corporate Travel Management System. Dokumentasi ditulis dalam bahasa Indonesia agar memudahkan integrasi frontend, QA, dan tim terkait.

## 1. Ringkasan Proyek

Backend ini dibangun dengan:

- Runtime: Bun
- Framework: Hono.js
- Database: MySQL
- ORM: Drizzle ORM
- Autentikasi: JWT + bcrypt
- Arsitektur: modular dengan routes, middleware, services, dan schema database

## 2. Struktur Aplikasi

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
    auth.ts
    users.ts
    travel.ts
    approval.ts
    fulfillment.ts
    reimbursement.ts
    dashboard.ts
  index.ts
  seed.ts
```

## 3. Setup Awal

### Install dependency

```bash
bun install
```

### Konfigurasi environment

Buat file `.env` berdasarkan template `.env.example`:

```env
DATABASE_URL=mysql://root:password@localhost:3306/travel_db
JWT_SECRET=travel-management-secret
PORT=3000
```

### Menjalankan server

```bash
bun run dev
```

Server akan berjalan di:

```text
http://localhost:3000
```

## 4. Role / RBAC

Role yang tersedia:

- Karyawan
- Atasan
- Admin Travel
- Tim Keuangan
- Super Admin

Hak akses utama:

- Karyawan: submit travel, lihat request sendiri, submit reimbursement
- Atasan: review dan approve/reject request
- Admin Travel: proses fulfillment booking
- Tim Keuangan: verifikasi reimbursement dan proses pembayaran
- Super Admin: full access untuk user management, monitoring, dashboard

## 5. Autentikasi

Semua endpoint yang membutuhkan login memakai header berikut:

```http
Authorization: Bearer <jwt_token>
```

### Endpoint login

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

Response contoh:

```json
{
  "token": "eyJ...",
  "user": {
    "id": 1,
    "name": "Super Administrator",
    "email": "superadmin@travel.local",
    "role": "Super Admin",
    "department": "IT"
  }
}
```

### Endpoint profile user

```http
GET /api/auth/me
```

Header:

```http
Authorization: Bearer <jwt_token>
```

## 6. Base URL

Untuk frontend, gunakan base URL seperti berikut:

```text
http://localhost:3000
```

## 7. Format Response Umum

### Response sukses

```json
{
  "message": "Operasi berhasil",
  "data": {}
}
```

### Response error

```json
{
  "error": "Bad Request",
  "message": "Request body is required."
}
```

### Status HTTP yang umum digunakan

- 200 OK
- 201 Created
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 500 Internal Server Error

## 8. Endpoint API

### 8.1 Auth & User Management

#### Login

```http
POST /api/auth/login
```

#### Profile user login

```http
GET /api/auth/me
```

#### List semua user (Super Admin)

```http
GET /api/users
```

#### Create user baru (Super Admin)

```http
POST /api/users
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

#### Update user (Super Admin)

```http
PUT /api/users/:id
```

Request body contoh:

```json
{
  "name": "Dewi Kusuma",
  "department": "Operations",
  "role": "Atasan"
}
```

---

### 8.2 Pengajuan Travel (Karyawan)

#### Submit travel request

```http
POST /api/travels
```

Request body:

```json
{
  "destination": "Singapore",
  "start_date": "2026-10-10",
  "end_date": "2026-10-15",
  "purpose": "Meeting bisnis dengan mitra regional",
  "document_url": "https://example.com/tor.pdf"
}
```

Response contoh:

```json
{
  "message": "Travel request submitted successfully.",
  "travelRequest": {
    "id": 1,
    "user_id": 2,
    "destination": "Singapore",
    "start_date": "2026-10-10",
    "end_date": "2026-10-15",
    "purpose": "Meeting bisnis dengan mitra regional",
    "document_url": "https://example.com/tor.pdf",
    "status": "PENDING"
  }
}
```

#### List request milik user login

```http
GET /api/travels/my-requests
```

#### Detail request travel tertentu

```http
GET /api/travels/:id
```

---

### 8.3 Persetujuan Travel (Atasan)

#### List request pending

```http
GET /api/approvals
```

#### Approve / Reject request

```http
POST /api/approvals/:id/action
```

Request body:

```json
{
  "action": "APPROVE",
  "notes": "Disetujui sesuai kebutuhan operasional."
}
```

Atau:

```json
{
  "action": "REJECT",
  "notes": "Dokumen belum lengkap."
}
```

---

### 8.4 Booking & Fulfillment (Admin Travel)

#### List approved travel yang butuh fulfillment

```http
GET /api/fulfillment/pending
```

#### Simpan detail transport & akomodasi

```http
POST /api/fulfillment/:travelId
```

Request body:

```json
{
  "transport_details": "Pesawat GA 456, seat 12A, kota tujuan Singapore",
  "accommodation_details": "Hotel Mercure Singapore, check-in 10 Okt 2026, 2 kamar deluxe"
}
```

Response contoh:

```json
{
  "message": "Travel fulfillment recorded successfully.",
  "fulfillment": {
    "id": 1,
    "travel_request_id": 1,
    "transport_details": "Pesawat GA 456, seat 12A, kota tujuan Singapore",
    "accommodation_details": "Hotel Mercure Singapore, check-in 10 Okt 2026, 2 kamar deluxe",
    "admin_id": 7
  }
}
```

---

### 8.5 Reimbursement (Karyawan & Tim Keuangan)

#### Submit reimbursement

```http
POST /api/reimbursements/:travelId
```

Request body:

```json
{
  "items": [
    {
      "category": "Transport",
      "amount": 250000,
      "receipt_url": "https://example.com/receipt-transport.jpg",
      "description": "Ticket pesawat"
    },
    {
      "category": "Accommodation",
      "amount": 700000,
      "receipt_url": "https://example.com/receipt-hotel.jpg",
      "description": "Hotel selama 3 malam"
    }
  ]
}
```

#### List reimbursement pending

```http
GET /api/reimbursements/pending
```

#### Proses reimbursement

```http
POST /api/reimbursements/:id/process
```

Request body:

```json
{
  "status": "VERIFIED",
  "notes": "Data lengkap dan sesuai bukti pengeluaran."
}
```

Status yang valid:

- VERIFIED
- PAID
- REJECTED

---

### 8.6 Dashboard & Reports

#### Statistik dashboard

```http
GET /api/dashboard/stats
```

Response contoh:

```json
{
  "upcoming": 12,
  "ongoing": 3,
  "completed": 28
}
```

#### Ringkasan pengeluaran

```http
GET /api/dashboard/expenses
```

Response contoh:

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
