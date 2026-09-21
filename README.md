# Backend Sistem Manajemen Perjalanan Dinas

API backend untuk sistem pengelolaan pengajuan perjalanan dinas karyawan, proses persetujuan, fulfillment booking, dan reimburse biaya perjalanan.

Proyek ini dibuat dengan Bun, Hono, MySQL, dan Drizzle ORM.

## Teknologi yang dipakai

- Runtime: Bun
- Framework: Hono
- Database: MySQL
- ORM: Drizzle ORM
- Autentikasi: JWT + bcryptjs
- Validasi: Zod

## Struktur project

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

## Fitur utama

- Autentikasi user dan pembagian akses berdasarkan role
- Pengajuan perjalanan dinas
- Persetujuan atau penolakan pengajuan oleh atasan
- Pencatatan fulfillment travel oleh admin travel
- Pengajuan reimburse dan proses verifikasi pembayaran
- Dashboard statistik dan ringkasan pengeluaran
- Upload file dokumen perjalanan secara nyata

## Role yang tersedia

- Karyawan
- Atasan
- Admin Travel
- Tim Keuangan
- Super Admin

## Persyaratan sebelum menjalankan

Pastikan kamu sudah menyiapkan:

- Bun terinstal
- MySQL sedang berjalan lokal atau di container
- Database sudah dibuat untuk aplikasi ini

## Variabel environment

Buat file `.env` di folder root project:

```env
DATABASE_URL=mysql://root:password@localhost:3306/travel_db
JWT_SECRET=travel-management-secret
PORT=3000
APP_URL=http://localhost:3000
```

Catatan:

- `DATABASE_URL` harus sesuai dengan konfigurasi MySQL lokal kamu
- `APP_URL` dipakai saat membuat URL file yang diupload

## Setup awal

Install dependency:

```bash
bun install
```

Buat database MySQL:

```sql
CREATE DATABASE travel_db;
```

Generate dan jalankan migrasi database:

```bash
bun run db:generate
bun run db:migrate
```

Isi data contoh / seeder:

```bash
bun run seed
```

Jalankan server:

```bash
bun run dev
```

Server akan berjalan di:

```text
http://localhost:3000
```

## Autentikasi

Semua endpoint yang dilindungi perlu membawa token bearer di header request:

```http
Authorization: Bearer <jwt_token>
```

### Login

```http
POST /api/auth/login
```

Body request:

```json
{
  "email": "superadmin@travel.local",
  "password": "superadmin123"
}
```

Contoh response:

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

### Ambil data user login

```http
GET /api/auth/me
```

## Base URL API

```text
http://localhost:3000/api
```

## Upload file dokumen perjalanan

Pada fitur pengajuan perjalanan, kamu bisa mengirim file dokumen secara langsung lewat form-data.

### Upload dengan form-data

```http
POST /api/travels
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Field yang bisa dikirim:

- `destination`
- `start_date`
- `end_date`
- `purpose`
- `document` (file)

Contoh lewat curl:

```bash
curl -X POST http://localhost:3000/api/travels \
  -H "Authorization: Bearer <token>" \
  -F "destination=Jakarta" \
  -F "start_date=2026-09-12" \
  -F "end_date=2026-09-14" \
  -F "purpose=Rapat bisnis dengan tim regional" \
  -F "document=@/path/to/tor.pdf"
```

File yang diupload akan disimpan di folder:

```text
./uploads/travel-documents/
```

Lalu URL filenya akan dikembalikan seperti ini:

```text
http://localhost:3000/uploads/travel-documents/<filename>
```

Kamu juga masih bisa mengirim URL file secara langsung seperti ini:

```json
{
  "destination": "Jakarta",
  "start_date": "2026-09-12",
  "end_date": "2026-09-14",
  "purpose": "Rapat bisnis",
  "document_url": "https://example.com/file.pdf"
}
```

## Daftar route API

### Auth

```http
POST /api/auth/login
GET /api/auth/me
```

### User

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

Contoh body approval:

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

Contoh body fulfillment:

```json
{
  "transport_details": "Pesawat GA 301, seat 2A",
  "accommodation_details": "Hotel Grand Indonesia, 3 malam"
}
```

### Reimbursement

```http
POST /api/reimbursements/:travelId
GET /api/reimbursements/pending
POST /api/reimbursements/:id/process
```

Contoh item reimbursement:

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

## Contoh format response

### Response sukses

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

### Response error

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

## Dokumentasi API lebih lengkap

### Login

```http
POST /api/auth/login
```

Body:

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

### Ambil data user saat ini

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

### Ambil semua user

```http
GET /api/users
Authorization: Bearer <token>
```

### Buat user baru

```http
POST /api/users
Authorization: Bearer <token>
```

Body:

```json
{
  "name": "Dewi Kusuma",
  "email": "dewi@company.com",
  "password": "password123",
  "role": "Karyawan",
  "department": "Finance"
}
```

### Update user

```http
PUT /api/users/:id
Authorization: Bearer <token>
```

### Hapus user

```http
DELETE /api/users/:id
Authorization: Bearer <token>
```

### Buat pengajuan travel

```http
POST /api/travels
Authorization: Bearer <token>
```

Pilihan form-data:

```bash
curl -X POST http://localhost:3000/api/travels \
  -H "Authorization: Bearer <token>" \
  -F "destination=Jakarta" \
  -F "start_date=2026-09-12" \
  -F "end_date=2026-09-14" \
  -F "purpose=Rapat bisnis" \
  -F "document=@/path/to/file.pdf"
```

Pilihan JSON:

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

### Lihat pengajuan travel saya

```http
GET /api/travels/my-requests
Authorization: Bearer <token>
```

### Lihat detail pengajuan travel

```http
GET /api/travels/:id
Authorization: Bearer <token>
```

### Lihat approval yang menunggu

```http
GET /api/approvals
Authorization: Bearer <token>
```

### Approve atau reject pengajuan

```http
POST /api/approvals/:id/action
Authorization: Bearer <token>
```

Body:

```json
{
  "action": "APPROVE",
  "notes": "Disetujui sesuai kebutuhan operasional."
}
```

atau

```json
{
  "action": "REJECT",
  "notes": "Dokumen belum lengkap."
}
```

### Lihat pengajuan yang siap di-fulfillment

```http
GET /api/fulfillment/pending
Authorization: Bearer <token>
```

### Simpan data fulfillment

```http
POST /api/fulfillment/:travelId
Authorization: Bearer <token>
```

Body:

```json
{
  "transport_details": "Pesawat GA 301, seat 2A",
  "accommodation_details": "Hotel Grand Indonesia, 3 malam"
}
```

### Submit reimbursement

```http
POST /api/reimbursements/:travelId
Authorization: Bearer <token>
```

Body:

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

### Lihat reimbursement yang menunggu

```http
GET /api/reimbursements/pending
Authorization: Bearer <token>
```

### Proses reimbursement

```http
POST /api/reimbursements/:id/process
Authorization: Bearer <token>
```

Body:

```json
{
  "status": "VERIFIED",
  "notes": "Data sudah lengkap."
}
```

Nilai status yang valid:

- VERIFIED
- PAID
- REJECTED

### Dashboard statistik

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

### Ringkasan pengeluaran

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

## Catatan penting

- Data seeder dibuat agar realistis untuk testing alur approval, reimbursement, dan fulfillment.
- File yang diupload disimpan di folder `uploads/` untuk kebutuhan development.
- Untuk production, sebaiknya file dipindahkan ke penyimpanan cloud seperti S3, Cloudinary, atau Supabase Storage.

## Perintah yang sering dipakai

```bash
bun install
bun run db:generate
bun run db:migrate
bun run seed
bun run dev
```
