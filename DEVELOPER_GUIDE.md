# Luevora B2B Omnichannel CRM - Developer Guide

Selamat datang di repositori Luevora CRM! Panduan ini akan memandu Anda untuk mengatur environment lokal dan menjalankan sistem secara keseluruhan. Proyek ini menggunakan arsitektur **Single Database Multi-Tenant**.

## 1. Prasyarat Sistem

Sebelum memulai, pastikan perangkat Anda telah terinstal:
- **Node.js**: Versi 18.x atau terbaru.
- **MySQL**: Versi 8.x atau MariaDB (Bisa menggunakan XAMPP/Laragon).
- **Git**: Untuk manajemen versi kontrol.

## 2. Setup Database (Prisma ORM)

Sistem ini tidak lagi menggunakan beberapa database yang terpisah. Semua tenant menggunakan satu database dengan skema gabungan, dikendalikan oleh `tenant_id`.

### Langkah 1: Menjalankan MySQL via XAMPP

1. Buka aplikasi **XAMPP Control Panel**.
2. Pada baris **MySQL**, klik tombol **Start**. Pastikan statusnya berubah menjadi hijau (berjalan).
3. (Opsional) Jika Anda ingin menggunakan phpMyAdmin untuk mempermudah melihat database, klik juga tombol **Start** pada baris **Apache**.

### Langkah 2: Membuat Database Lokal

Anda dapat membuat database menggunakan phpMyAdmin atau Command Line. Berikut adalah panduan menggunakan phpMyAdmin:

1. Buka browser dan akses alamat: `http://localhost/phpmyadmin/`
2. Di panel sebelah kiri, klik menu **New** untuk membuat database baru.
3. Pada kolom **Database name**, ketikkan: `luevora`
4. Untuk dropdown *Collation* di sebelahnya, Anda bisa membiarkannya default atau memilih `utf8mb4_general_ci`.
5. Klik tombol **Create** (Buat).

*(Alternatif Command Line: `CREATE DATABASE luevora;`)*

### Langkah 3: Setup Konfigurasi `.env`

Sistem membutuhkan variabel environment untuk mengetahui cara koneksi ke database Anda.

1. Buka terminal, pastikan Anda berada di direktori `server`:
   ```bash
   cd _new-system-client/server
   ```
2. Buat file baru bernama `.env` (atau salin dari `.env.example` jika tersedia).
3. Buka file `.env` tersebut dan isi dengan baris berikut. Konfigurasi default XAMPP menggunakan user `root` dan tanpa password:

   ```env
   # Konfigurasi Port
   PORT=3001
   
   # Prisma Database Connection
   # Format URL: mysql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE_NAME]
   DATABASE_URL="mysql://root:@localhost:3306/luevora"
   
   # Konfigurasi Database Legacy (jika dibutuhkan)
   DB_MASTER_HOST="localhost"
   DB_MASTER_USER="root"
   DB_MASTER_PASSWORD=""
   DB_MASTER_NAME="luevora"
   ```

### Langkah 4: Sinkronisasi Skema (Prisma)

Setelah koneksi siap, Anda perlu membuat struktur tabel-tabelnya.

1. Masih di dalam terminal direktori `server`, install semua dependensi (jika belum):
   ```bash
   npm install
   ```
2. Jalankan perintah Prisma untuk membangun tabel di database MySQL Anda:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
3. **(Opsional)** Jalankan seeder untuk mengisi data awal:
   ```bash
   node prisma/seed.js
   ```
   *Catatan: Jika proses ini berhasil, Anda dapat mengecek phpMyAdmin dan melihat tabel-tabel (seperti users, tenants, leads, dll) sudah otomatis terbuat di dalam database `luevora`.*

## 3. Menjalankan Backend (Server)

Server dibangun menggunakan **Express.js** dengan arsitektur **Controller-Service**.

1. Masuk ke direktori server (jika belum).
   ```bash
   cd _new-system-client/server
   ```
2. Jalankan server dalam mode development:
   ```bash
   npm run dev
   ```
3. **Verifikasi:** Pastikan terminal menampilkan pesan:
   `[Server] Luevora Backend running on http://localhost:3001`
   Anda bisa mengetes endpoint di browser: `http://localhost:3001/`

## 4. Menjalankan Frontend (Dashboard)

Dashboard dibangun menggunakan **Vite** dan **React**.

1. Buka terminal baru dan masuk ke direktori dashboard.
   ```bash
   cd _new-system-client/dashboard
   ```
2. Install dependensi UI:
   ```bash
   npm install
   ```
3. Sesuaikan koneksi ke Backend (buat file `.env` jika ada konfigurasi khusus, atau pastikan URL backend menunjuk ke `http://localhost:3001/api`).
4. Jalankan dashboard:
   ```bash
   npm run dev
   ```
5. **Akses Dashboard:** Terminal akan memberikan link lokal, biasanya:
   `http://localhost:5173/`

## 5. Ringkasan Arsitektur & Aturan Dev

> [!IMPORTANT]
> **Aturan Controller-Service Pattern:**
> - **Routes (`routes/**/*.js`)**: Hanya boleh berisi routing dan memanggil controller. Dilarang keras menggunakan `req.db.query` atau logika bisnis di sini.
> - **Controller (`controllers/**/*.js`)**: Tempat mengekstrak `req` dan `res`. Ambil `tenantId` dari `req.tenant.id` lalu teruskan ke Service.
> - **Service (`services/**/*.js`)**: Berisi pure business logic menggunakan Prisma (`prisma.lead...`). Dilarang mengakses objek `req` atau `res`.

> [!TIP]
> **Cara Kerja Multi-Tenant:**
> Karena semua data digabung, **pastikan** Anda selalu mengirim parameter `tenantId` pada setiap query Prisma di layer Service.
> Contoh: `await prisma.lead.findMany({ where: { tenant_id: tenantId } })`
