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
    finance.ts
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
- Laporan transaksi keuangan, antrean pembayaran, riwayat pencairan, dan pengaturan keuangan bersama
- Upload file dokumen perjalanan secara nyata

## Role yang tersedia

Role mengatur fitur yang dapat diakses pengguna pada API:

- **Karyawan** — membuat pengajuan perjalanan dinas, melihat status dan detail pengajuan miliknya, melengkapi LPJ setelah perjalanan, mengajukan uang muka, serta mengirim rincian dan bukti reimbursement.
- **Atasan** — memeriksa antrean perjalanan berstatus `PENDING` milik karyawan yang ditugaskan kepadanya, lalu menyetujui atau menolak pengajuan. Atasan juga dapat melihat riwayat keputusan dan dashboard statistik timnya.
- **Admin Travel** — menangani perjalanan yang telah disetujui Atasan, memeriksa kebutuhan perjalanan dan mengelola fulfillment, termasuk detail transportasi serta akomodasi. Admin Travel juga dapat melihat dashboard perjalanan dan pengeluaran.
- **Tim Keuangan** — memproses pencairan uang muka, memverifikasi dan memperbarui status reimbursement, serta mengelola proses pembayaran. Tim Keuangan dapat melihat dashboard pengeluaran.
- **Super Admin** — mengelola akun pengguna dan memiliki akses administratif ke proses persetujuan, fulfillment, dan keuangan. Dashboard kebijakan perjalanan/master data khusus belum tersedia sebagai endpoint tersendiri.

Hak akses tersebut diterapkan oleh endpoint API. Role tidak otomatis berarti semua data telah dibatasi berdasarkan perusahaan; pembatasan akses lintas perusahaan perlu diterapkan terpisah jika dibutuhkan.

## Alur pengajuan perjalanan dinas

Seluruh endpoint perjalanan di bawah memerlukan token login pada header `Authorization: Bearer <token>`.

1. **Karyawan mengajukan perjalanan** — Karyawan yang sudah login mengirim `POST /api/travels` dengan tujuan, tanggal, keperluan, dan dokumen pendukung bila ada. Sistem mengaitkan pengajuan ke akun dari token dan memberi status awal `PENDING`. Role lain yang mencoba membuat pengajuan akan menerima `403 Forbidden`.
2. **Atasan memeriksa dan memutuskan** — Atasan melihat antrean `PENDING` karyawan yang ditugaskan kepadanya melalui `GET /api/approvals`, lalu menyetujui atau menolak melalui `POST /api/approvals/:id/action`. Status berubah menjadi `APPROVED` atau `REJECTED`. Super Admin dapat melihat seluruh antrean dan mengambil tindakan.
3. **Admin Travel memverifikasi kebutuhan dan mengelola perjalanan** — untuk pengajuan berstatus `APPROVED`, Admin Travel melihat antrean melalui `GET /api/fulfillment/pending`, kemudian mencatat detail transportasi dan akomodasi melalui `POST /api/fulfillment/:travelId`. Status berubah menjadi `FULFILLED`.
4. **Tim Keuangan mencairkan uang muka** — setelah perjalanan berstatus `FULFILLED`, pemilik dapat meminta uang muka melalui `POST /api/cash-advances`. Status uang muka dimulai dari `WAITING_PAYMENT`; Tim Keuangan atau Super Admin memproses antrean lewat API keuangan, lalu status menjadi `DISBURSED` beserta referensi dan waktu pencairan.
5. **Karyawan menyelesaikan perjalanan** — setelah tanggal perjalanan berakhir, pemilik mengirim LPJ melalui `POST /api/travels/:id/lpj`. Status perjalanan menjadi `COMPLETED` jika tidak ada uang muka yang masih menunggu pencairan. Jika LPJ dikirim lebih dahulu sementara uang muka masih `WAITING_PAYMENT`, LPJ tersimpan dan status perjalanan tetap `FULFILLED`; perjalanan otomatis berubah menjadi `COMPLETED` setelah Tim Keuangan mencairkan seluruh uang muka yang menunggu.
6. **Tim Keuangan memproses reimbursement** — pemilik perjalanan mengirim item biaya dan bukti melalui `POST /api/reimbursements/:travelId`; Tim Keuangan atau Super Admin meninjau dan memperbarui status/pembayarannya.
7. **Melihat perkembangan** — Karyawan melihat pengajuan miliknya melalui `GET /api/travels/my-requests`. Atasan dan Super Admin melihat antrean persetujuan; Admin Travel dan Super Admin melihat antrean fulfillment. Detail perjalanan dapat dilihat pemilik, Atasan, Admin Travel, Tim Keuangan, dan Super Admin melalui `GET /api/travels/:id`.

Alur status perjalanan: `PENDING` → `APPROVED` → `FULFILLED` → `COMPLETED`, atau `PENDING` → `REJECTED`. Status uang muka terpisah: `WAITING_PAYMENT` → `DISBURSED`. Perjalanan hanya dapat diajukan uang mukanya setelah fulfillment. Untuk menyelesaikan perjalanan, tanggal akhir harus sudah lewat dan LPJ harus selesai; setiap uang muka yang diajukan harus sudah dicairkan. Jika tidak ada uang muka, LPJ dapat langsung mengubah perjalanan menjadi `COMPLETED`.

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

Seeder menghapus data tabel aplikasi sebelum mengisinya kembali, lalu membuat 2 perusahaan, 10 pengguna per perusahaan (20 pengguna), dan 5 perjalanan berpasangan dengan uang muka serta reimbursement untuk setiap pengguna. Data transaksi mencakup 100 perjalanan keuangan, 100 uang muka, 100 reimbursement, dan 300 item reimbursement. Kondisi reimbursement mencakup `SUBMITTED`, `VERIFIED`, `PAID`, dan `NEEDS_DOCUMENTS`; uang muka mencakup `WAITING_PAYMENT` dan `DISBURSED`. Seeder juga menambahkan 12 pengajuan `PENDING`, satu pengajuan `REJECTED`, relasi Atasan–Karyawan, persetujuan/fulfillment, serta tanggal dan referensi transaksi untuk pembayaran yang telah diproses. Gunakan akun dummy di bawah untuk pengujian; kata sandi ini hanya untuk lingkungan development.

### Akun dummy untuk pengujian

| Nama | Email | Kata sandi | Role | Perusahaan | Departemen |
|---|---|---|---|---|---|
| Ayu Santoso | `user011@nuvixalpha2026.local` | `Password1!1` | Super Admin | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | Engineering |
| Budi Wijaya | `user021@nuvixalpha2026.local` | `Password1!2` | Atasan | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | Finance |
| Citra Rahmadani | `user031@nuvixalpha2026.local` | `Password1!3` | Atasan | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | HR |
| Dimas Pratama | `user041@nuvixalpha2026.local` | `Password1!4` | Admin Travel | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | Sales |
| Eka Nugraha | `user051@nuvixalpha2026.local` | `Password1!5` | Admin Travel | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | Operations |
| Fajar Lestari | `user061@nuvixalpha2026.local` | `Password1!6` | Tim Keuangan | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | Logistik |
| Gita Hidayat | `user071@nuvixalpha2026.local` | `Password1!7` | Tim Keuangan | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | Marketing |
| Hendra Permata | `user081@nuvixalpha2026.local` | `Password1!8` | Karyawan | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | Product |
| Indra Ramadhan | `user091@nuvixalpha2026.local` | `Password1!9` | Karyawan | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | IT |
| Jasmine Gunawan | `user101@nuvixalpha2026.local` | `Password1!10` | Karyawan | PT Nuvix Sentosa (`NUVIX-ALPHA-2026`) | Legal |
| Ayu Wijaya | `user012@nuvixbeta2026.local` | `Password2!1` | Super Admin | PT Nuvix Global (`NUVIX-BETA-2026`) | Finance |
| Budi Rahmadani | `user022@nuvixbeta2026.local` | `Password2!2` | Atasan | PT Nuvix Global (`NUVIX-BETA-2026`) | HR |
| Citra Pratama | `user032@nuvixbeta2026.local` | `Password2!3` | Atasan | PT Nuvix Global (`NUVIX-BETA-2026`) | Sales |
| Dimas Nugraha | `user042@nuvixbeta2026.local` | `Password2!4` | Admin Travel | PT Nuvix Global (`NUVIX-BETA-2026`) | Operations |
| Eka Lestari | `user052@nuvixbeta2026.local` | `Password2!5` | Admin Travel | PT Nuvix Global (`NUVIX-BETA-2026`) | Logistik |
| Fajar Hidayat | `user062@nuvixbeta2026.local` | `Password2!6` | Tim Keuangan | PT Nuvix Global (`NUVIX-BETA-2026`) | Marketing |
| Gita Permata | `user072@nuvixbeta2026.local` | `Password2!7` | Tim Keuangan | PT Nuvix Global (`NUVIX-BETA-2026`) | Product |
| Hendra Ramadhan | `user082@nuvixbeta2026.local` | `Password2!8` | Karyawan | PT Nuvix Global (`NUVIX-BETA-2026`) | IT |
| Indra Gunawan | `user092@nuvixbeta2026.local` | `Password2!9` | Karyawan | PT Nuvix Global (`NUVIX-BETA-2026`) | Legal |
| Jasmine Santoso | `user102@nuvixbeta2026.local` | `Password2!10` | Karyawan | PT Nuvix Global (`NUVIX-BETA-2026`) | Engineering |

Login dengan `POST /api/auth/login` menggunakan email dan kata sandi pada tabel. Kode perusahaan tersebut juga dapat digunakan untuk menguji registrasi.

Seluruh akun dummy pada tabel berstatus `ACTIVE`.

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
POST /api/v1/auth/register
Content-Type: application/json
```

Body request:

```json
{
  "nama_lengkap": "Budi Santoso",
  "nik": "1234567890",
  "email_kantor": "budi@perusahaan.co.id",
  "kode_perusahaan": "NUVIX-ALPHA-2026",
  "departemen": "Engineering",
  "kata_sandi": "Password123",
  "konfirmasi_kata_sandi": "Password123",
  "persetujuan_syarat": true
}
```

Response sukses registrasi:

```json
{
  "success": true,
  "message": "Pendaftaran berhasil. Akun Anda sedang menunggu verifikasi oleh admin perusahaan.",
  "data": {
    "user_id": "usr_21",
    "nama_lengkap": "Budi Santoso",
    "email_kantor": "budi@perusahaan.co.id",
    "company_name": "PT Nuvix Sentosa",
    "status": "PENDING_VERIFICATION"
  }
}
```

Kode perusahaan harus aktif dan dicocokkan tanpa membedakan huruf besar/kecil. Kata sandi minimal 8 karakter serta mengandung huruf dan angka. Email dan NIK diperiksa agar tidak terdaftar pada perusahaan tersebut. Akun baru berstatus `PENDING_VERIFICATION`; registrasi tidak langsung memberikan token. Saat ini endpoint login belum memeriksa status akun, sehingga status `PENDING_VERIFICATION` belum mencegah pengguna memperoleh token jika kredensialnya benar. Path kompatibilitas `POST /api/auth/register` juga tersedia.

### Login

```http
POST /api/auth/login
```

Body request:

```json
{
  "email": "user011@nuvixalpha2026.local",
  "password": "Password1!1"
}
```

Contoh response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Ayu Santoso",
    "email": "user011@nuvixalpha2026.local",
    "role": "Super Admin",
    "department": "Engineering"
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
  "password_saat_ini": "Password1!1",
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
POST /api/v1/auth/register
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
```

Semua endpoint pengelolaan user hanya dapat digunakan Super Admin. Saat ini belum tersedia endpoint untuk menghapus user.
Saat membuat atau memperbarui Karyawan, `company_id` dan `supervisor_id` dapat dipakai untuk menentukan Atasan yang bertanggung jawab. Atasan harus berada di perusahaan yang sama. Antrean dan aksi Atasan dibatasi ke Karyawan yang memiliki `supervisor_id` tersebut.

### Travel

```http
POST /api/travels
GET /api/travels/my-requests
GET /api/travels/:id
POST /api/travels/:id/lpj
```

Pilihan `transportation_mode`: `Pesawat`, `Kereta Api`, `Travel`, atau `Mobil Kantor`. Field ini opsional untuk menjaga kompatibilitas request lama. Pengajuan dapat menyertakan `estimated_cost` sebagai estimasi biaya untuk antrean dan riwayat persetujuan.

### Approval

```http
GET /api/approvals
GET /api/approvals/history
POST /api/approvals/:id/action
```

Endpoint hanya dapat diakses Atasan dan Super Admin. Antrean memuat nama, role, departemen, estimasi biaya, dan rincian perjalanan; Atasan hanya melihat dan memproses pengajuan `PENDING` milik Karyawan yang ditugaskan kepadanya. Super Admin dapat melihat seluruh antrean dan riwayat. Aksi hanya berhasil jika status masih `PENDING`; keputusan tersimpan di riwayat beserta catatan, waktu, dan Atasan yang memproses.

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

`GET /api/reimbursements` hanya dapat diakses oleh Tim Keuangan dan Super Admin. Endpoint mengembalikan semua reimbursement tanpa memfilter status, beserta data pemohon yang relevan (ID, nama, role, departemen), perjalanan, item, dan `status_label`; data sensitif seperti email, NIK, dan hash kata sandi tidak disertakan. Status yang dikembalikan mencakup `SUBMITTED` (Menunggu Verifikasi), `NEEDS_DOCUMENTS` (Bukti Kurang), `VERIFIED` (Terverifikasi/menunggu pembayaran), `PAID` (Selesai), dan `REJECTED` (Dikembalikan).

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

Pengajuan uang muka hanya dapat dibuat oleh pemilik perjalanan setelah statusnya `FULFILLED`, dan jumlah yang diminta tidak boleh melebihi estimasi biaya. Tim Keuangan atau Super Admin dapat mencairkan uang muka. Setelah perjalanan berakhir, karyawan dapat melaporkan jumlah sisa yang dikembalikan. LPJ dapat dikirim sebelum pencairan selesai, tetapi perjalanan baru menjadi `COMPLETED` setelah semua uang muka berstatus `DISBURSED`.

Body pengajuan:

```json
{
  "travel_id": 1,
  "estimated_cost": 8500000,
  "requested_amount": 8000000
}
```

Status uang muka: `WAITING_PAYMENT` (Menunggu Pencairan) dan `DISBURSED` (Dicairkan). Untuk menyimpan referensi/metode transaksi yang eksplisit dan mematuhi metode pembayaran yang dikonfigurasi, gunakan endpoint pembayaran di `/api/finance`. Endpoint legacy `POST /api/cash-advances/:id/process` tetap tersedia; jika body tidak menyertakan metadata, sistem mencatat metode `MANUAL` dan referensi legacy yang dibuat otomatis.

### Dashboard

```http
GET /api/dashboard/stats
GET /api/dashboard/expenses
GET /api/dashboard/my-summary
```

`GET /api/dashboard/stats?year=2026` untuk Atasan menghitung jumlah `PENDING`, `APPROVED`, dan `REJECTED` pada pengajuan timnya di tahun tersebut. Untuk role dashboard lain, statistik perjalanan yang sudah ada tetap dikembalikan. `GET /api/dashboard/expenses` hanya untuk Tim Keuangan dan Super Admin serta mengembalikan ringkasan pengeluaran aktual per pemohon dan detail transaksi; hanya reimbursement `PAID` dan uang muka `DISBURSED` dihitung sebagai pengeluaran aktual. `GET /api/dashboard/my-summary` menampilkan uang muka berjalan, total sisa uang muka yang dikembalikan, kuota perjalanan tahun berjalan (kuota tahunan 12 perjalanan), dan reminder LPJ/pengembalian. LPJ menjadi terlambat setelah lewat 7 hari kalender dari tanggal selesai perjalanan. Daftar `GET /api/travels/my-requests` juga memuat `lpj_status`, `lpj_due_date`, dan reminder.

### API Keuangan

Semua endpoint `/api/finance` hanya dapat diakses Tim Keuangan dan Super Admin. Transaksi yang ditampilkan memuat data pemohon minimum (nama, role, departemen), tujuan perjalanan, nominal, waktu pengajuan, status verifikasi/pembayaran, dan metadata pembayaran bila sudah diproses.

```http
GET /api/finance/transactions?year=2026
GET /api/finance/payments/queue
POST /api/finance/payments/reimbursement/:id/process
POST /api/finance/payments/cash-advance/:id/process
GET /api/finance/payments/history
GET /api/finance/settings
PUT /api/finance/settings
```

Status `VERIFIED` untuk reimbursement dan `WAITING_PAYMENT` untuk uang muka masuk antrean, bukan pengeluaran aktual. Pembayaran hanya bisa diproses untuk status siap tersebut; uang muka juga harus terkait perjalanan berstatus `FULFILLED`. Proses pembayaran menyimpan status final (`PAID` atau `DISBURSED`), tanggal, nomor referensi, metode, dan ID petugas.

Contoh body proses pembayaran:

```json
{
  "payment_reference": "TRX-2026-000123",
  "payment_method": "BANK_TRANSFER",
  "payment_date": "2026-10-20T09:00:00.000Z"
}
```

Metode harus sudah tersedia di pengaturan. Pengaturan anggaran tahunan dan daftar metode pembayaran beserta keterangannya disimpan bersama di database:

```json
{
  "annual_budget": 250000000,
  "payment_methods": [
    {
      "code": "BANK_TRANSFER",
      "label": "Transfer Bank",
      "description": "Pembayaran melalui transfer bank."
    }
  ]
}
```

Untuk menandai LPJ selesai, karyawan pemilik perjalanan dapat memanggil `POST /api/travels/:id/lpj`. Jika semua uang muka sudah dicairkan (atau tidak ada uang muka), endpoint ini mengubah status perjalanan menjadi `COMPLETED`. Jika masih ada pencairan tertunda, status perjalanan tetap `FULFILLED` dan akan berubah menjadi `COMPLETED` saat Tim Keuangan memproses pencairan terakhir.

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
POST /api/v1/auth/register
Content-Type: application/json
```

Body:

```json
{
  "nama_lengkap": "Budi Santoso",
  "nik": "1234567890",
  "email_kantor": "budi@perusahaan.co.id",
  "kode_perusahaan": "NUVIX-ALPHA-2026",
  "departemen": "Engineering",
  "kata_sandi": "Password123",
  "konfirmasi_kata_sandi": "Password123",
  "persetujuan_syarat": true
}
```

Response:

```json
{
  "success": true,
  "message": "Pendaftaran berhasil. Akun Anda sedang menunggu verifikasi oleh admin perusahaan.",
  "data": {
    "user_id": "usr_21",
    "nama_lengkap": "Budi Santoso",
    "email_kantor": "budi@perusahaan.co.id",
    "company_name": "PT Nuvix Sentosa",
    "status": "PENDING_VERIFICATION"
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
  "email": "user011@nuvixalpha2026.local",
  "password": "Password1!1"
}
```

Response:

```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "name": "Ayu Santoso",
    "email": "user011@nuvixalpha2026.local",
    "role": "Super Admin",
    "department": "Engineering"
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
  "name": "Ayu Santoso",
  "email": "user011@nuvixalpha2026.local",
  "role": "Super Admin",
  "department": "Engineering"
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
  "password_saat_ini": "Password1!1",
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

### Penghapusan user

Saat ini belum tersedia endpoint untuk menghapus user.

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

Respons `GET /api/approvals` memuat nama, role, departemen, estimasi biaya, tujuan, dan tanggal perjalanan. Atasan hanya melihat antrean Karyawan yang memiliki `supervisor_id` sama dengan ID Atasan pada token.

Riwayat keputusan tersedia melalui `GET /api/approvals/history`. Riwayat menampilkan pemohon, tujuan, tanggal perjalanan, keputusan, catatan, waktu diproses, dan identitas Atasan. Atasan hanya melihat riwayat timnya; Super Admin melihat seluruh riwayat.

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
- REJECTED

`PAID` tidak dapat diset melalui endpoint verifikasi ini. Pembayaran hanya dapat dilakukan melalui API keuangan setelah reimbursement berstatus `VERIFIED`.

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

Finance mencairkan uang muka melalui `POST /api/finance/payments/cash-advance/:id/process`. Setelah perjalanan berakhir, karyawan dapat melaporkan pengembalian dengan `POST /api/cash-advances/:id/settlement` dan body `{"returned_amount": 750000}`.

### Laporan dan pembayaran keuangan

Hanya Tim Keuangan dan Super Admin yang dapat mengakses endpoint berikut.

```http
GET /api/finance/transactions?year=2026
GET /api/finance/payments/queue
GET /api/finance/payments/history
GET /api/finance/settings
PUT /api/finance/settings
POST /api/finance/payments/reimbursement/:id/process
POST /api/finance/payments/cash-advance/:id/process
```

Contoh body pembayaran:

```json
{
  "payment_reference": "TRX-2026-000123",
  "payment_method": "BANK_TRANSFER",
  "payment_date": "2026-10-20T09:00:00.000Z"
}
```

`payment_method` harus cocok dengan metode pada pengaturan keuangan. Body `PUT /api/finance/settings` menerima `annual_budget` dan array `payment_methods`, setiap item berisi `code`, `label`, dan `description`. Antrean menggabungkan reimbursement `VERIFIED` dan uang muka `WAITING_PAYMENT`; pengeluaran aktual hanya menghitung reimbursement `PAID` dan uang muka `DISBURSED`.

### Dashboard statistik

```http
GET /api/dashboard/stats
Authorization: Bearer <token>
```

Response role selain Atasan:

```json
{
  "upcoming": 12,
  "ongoing": 3,
  "completed": 28
}
```

Atasan dapat meminta `GET /api/dashboard/stats?year=2026` untuk mendapatkan `year`, `pending`, `approved`, dan `rejected` yang hanya dihitung dari pengajuan timnya.

### Ringkasan pengeluaran

```http
GET /api/dashboard/expenses
Authorization: Bearer <token>
```

Respons juga menyertakan array `transactions` berisi detail setiap reimbursement dan uang muka. Field `actual_expense` hanya berisi nominal apabila reimbursement `PAID` atau uang muka `DISBURSED`.

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

- Seeder menghapus data tabel aplikasi terkait sebelum mengisi ulang data: 2 perusahaan, 20 pengguna (10 per perusahaan), 100 travel request keuangan (5 per pengguna), 12 pengajuan `PENDING`, 1 pengajuan `REJECTED`, 100 uang muka (5 per pengguna), 100 reimbursement (5 per pengguna), dan 300 item reimbursement. Data mencakup relasi Atasan–Karyawan, keputusan persetujuan, seluruh kondisi verifikasi/pembayaran, serta referensi pembayaran untuk yang sudah diproses. Rincian item setiap reimbursement berjumlah sama dengan totalnya. Data ini hanya untuk development/pengujian; jalankan `bun run seed` hanya pada database yang boleh dikosongkan.
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
