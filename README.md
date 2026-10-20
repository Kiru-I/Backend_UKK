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
    cash-advance.ts
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
- Pengajuan dan pencairan uang muka perjalanan dinas
- Tracking LPJ, pengembalian sisa uang muka, dan kuota dinas tahunan
- Dashboard statistik, ringkasan pengeluaran, dan ringkasan pribadi karyawan
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

Seeder mengosongkan data tabel aplikasi sebelum mengisinya kembali. Data uang muka contoh mencakup tiga pengajuan: dua berstatus `DISBURSED` (satu dengan pengembalian sebagian) dan satu berstatus `WAITING_PAYMENT`.

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

### Register

```http
POST /api/auth/register
```

Body request:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "department": "IT",
  "role": "Karyawan"
}
```

Contoh response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Karyawan",
    "department": "IT"
  }
}
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

### Ganti password

```http
POST /api/auth/change-password
Authorization: Bearer <token>
```

Body:

```json
{
  "password_saat_ini": "superadmin123",
  "password_baru": "newsecret123",
  "konfirmasi_password_baru": "newsecret123"
}
```

Password saat ini harus benar. Password baru minimal 6 karakter, berbeda dari password saat ini, dan harus cocok dengan konfirmasinya.

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
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
POST /api/auth/change-password
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
POST /api/travels/:id/lpj
```

Pilihan `transportation_mode`: `Pesawat`, `Kereta Api`, `Travel`, atau `Mobil Kantor`. Field ini opsional untuk menjaga kompatibilitas request lama.

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
GET /api/reimbursements/my
GET /api/reimbursements
GET /api/reimbursements/pending
POST /api/reimbursements/:id/process
```

`GET /api/reimbursements` hanya dapat diakses oleh Tim Keuangan dan Super Admin. Endpoint mengembalikan semua reimbursement tanpa memfilter status, beserta data user (tanpa hash password), perjalanan, item, dan `status_label`. Status yang dikembalikan mencakup `SUBMITTED` (Menunggu Verifikasi), `NEEDS_DOCUMENTS` (Bukti Kurang), `VERIFIED` (Terverifikasi), `PAID` (Selesai), dan `REJECTED` (Dikembalikan).

Contoh ringkas bentuk respons:

```json
{
  "reimbursements": [
    {
      "id": 1,
      "user_id": 2,
      "travel_request_id": 1,
      "total_amount": "7250000.00",
      "status": "PAID",
      "status_label": "Selesai",
      "user": {
        "id": 2,
        "name": "Alicia Putri",
        "email": "alicia.putri@travel.local",
        "role": "Karyawan",
        "department": "Sales"
      },
      "travelRequest": {
        "id": 1,
        "destination": "Jakarta",
        "status": "COMPLETED"
      },
      "items": [
        {
          "id": 1,
          "category": "Transportasi",
          "amount": "2400000.00",
          "receipt_url": "https://example.com/receipts/flight-jakarta.pdf"
        }
      ]
    }
  ]
}
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

### Uang muka

```http
POST /api/cash-advances
GET /api/cash-advances/my
GET /api/cash-advances/pending
POST /api/cash-advances/:id/process
POST /api/cash-advances/:id/settlement
```

Pengajuan uang muka hanya dapat dibuat untuk perjalanan yang sudah disetujui, dan jumlah yang diminta tidak boleh melebihi estimasi biaya. Finance atau Super Admin dapat mencairkan uang muka. Setelah perjalanan selesai, karyawan dapat melaporkan jumlah sisa yang dikembalikan.

Body pengajuan:

```json
{
  "travel_id": 1,
  "estimated_cost": 8500000,
  "requested_amount": 8000000
}
```

Status uang muka: `WAITING_PAYMENT` (Menunggu Pembayaran) dan `DISBURSED` (Dicairkan).

### Dashboard

```http
GET /api/dashboard/stats
GET /api/dashboard/expenses
GET /api/dashboard/my-summary
```

`GET /api/dashboard/my-summary` menampilkan uang muka berjalan, total sisa uang muka yang dikembalikan, kuota perjalanan tahun berjalan (kuota tahunan 12 perjalanan), dan reminder LPJ/pengembalian. LPJ menjadi terlambat setelah lewat 7 hari kalender dari tanggal selesai perjalanan. Daftar `GET /api/travels/my-requests` juga memuat `lpj_status`, `lpj_due_date`, dan reminder.

Untuk menandai LPJ selesai, karyawan pemilik perjalanan dapat memanggil `POST /api/travels/:id/lpj`.

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

### Register

```http
POST /api/auth/register
```

Body:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "department": "IT",
  "role": "Karyawan"
}
```

Response:

```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Karyawan",
    "department": "IT"
  }
}
```

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

### Ganti password

```http
POST /api/auth/change-password
Authorization: ******
```

Body:

```json
{
  "password_saat_ini": "superadmin123",
  "password_baru": "newsecret123",
  "konfirmasi_password_baru": "newsecret123"
}
```

Password saat ini wajib cocok dengan akun yang sedang login. Password baru minimal 6 karakter, tidak boleh sama dengan password saat ini, dan harus cocok dengan konfirmasinya. Jika berhasil, endpoint mengembalikan:

```json
{
  "message": "Password changed successfully."
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
  "transportation_mode": "Pesawat",
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
    "transportation_mode": "Pesawat",
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

Daftar perjalanan saya menyertakan `lpj_status`, `lpj_due_date`, dan reminder. Setelah perjalanan berakhir, karyawan pemilik perjalanan menandai LPJ selesai menggunakan `POST /api/travels/:id/lpj`.

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

### Lihat seluruh riwayat reimbursement (Tim Keuangan / Super Admin)

```http
GET /api/reimbursements
Authorization: ******
```

Response berisi seluruh status reimbursement, data user, detail perjalanan, item bukti, dan `status_label` berbahasa Indonesia. Data user tidak mencakup hash password.

### Riwayat reimbursement saya

```http
GET /api/reimbursements/my
Authorization: ******
```

Response berisi item, detail perjalanan, status internal, dan `status_label` berbahasa Indonesia. Endpoint hanya mengembalikan reimbursement milik pengguna yang sedang login. Label status: `SUBMITTED` (Menunggu Verifikasi), `NEEDS_DOCUMENTS` (Bukti Kurang), `VERIFIED` (Terverifikasi), `PAID` (Selesai), dan `REJECTED` (Dikembalikan).

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
- NEEDS_DOCUMENTS
- PAID
- REJECTED

### Ajukan dan lihat uang muka

```http
POST /api/cash-advances
GET /api/cash-advances/my
Authorization: ******
```

Body pengajuan:

```json
{
  "travel_id": 1,
  "estimated_cost": 8500000,
  "requested_amount": 8000000
}
```

Finance mencairkan uang muka dengan `POST /api/cash-advances/:id/process`. Setelah perjalanan berakhir, karyawan dapat melaporkan pengembalian dengan `POST /api/cash-advances/:id/settlement` dan body `{"returned_amount": 750000}`.

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

### Ringkasan pribadi karyawan

```http
GET /api/dashboard/my-summary
Authorization: ******
```

Response mencakup `cash_advance_running`, `cash_advance_returned`, kuota `travel_quota` tahun berjalan (maksimal 12 perjalanan), dan daftar `reminders`.

## Catatan penting

- Seeder mengisi seluruh tabel aplikasi, termasuk users, travel requests, approvals, fulfillments, reimbursements, reimbursement items, dan cash advances. Seeder menghapus data tabel tersebut terlebih dahulu, lalu membuat tiga contoh uang muka dengan status pencairan yang berbeda.
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
