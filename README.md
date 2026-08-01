# Struktur Direktori \_new-system-client

Dokumen ini menjelaskan struktur folder dan fungsionalitas utama dari proyek `_new-system-client`.

## Batang Pohon Direktori (Tree Structure)

```text
_new-system-client/
├── dashboard/              # Aplikasi Frontend (React + Vite)
│   ├── public/             # Aset statis publik (favicon, icons)
│   └── src/                # Kode sumber aplikasi React
│       ├── assets/         # Aset gambar dan SVG
│       ├── components/     # Komponen UI reusable (Course, Rental, Shared)
│       ├── config/         # Konfigurasi aplikasi (Business Types)
│       ├── contexts/       # React Context untuk state management (Auth)
│       ├── hooks/          # Custom React hooks
│       ├── layouts/        # Komponen tata letak (Layouts) per domain
│       ├── lib/            # Library, utilitas, dan data mock
│       ├── pages/          # Komponen halaman utama berdasarkan rute
│       ├── services/       # Layanan komunikasi API
│       ├── App.jsx         # Komponen root aplikasi
│       ├── main.jsx        # Entry point React
│       └── router.jsx      # Definisi rute aplikasi
├── server/                 # Aplikasi Backend (Node.js + Express)
│   ├── config/             # Konfigurasi server (AI, DB, Session)
│   ├── middleware/         # Express middleware (Auth, Tenant, Error)
│   ├── routes/             # Definisi API endpoints per domain
│   ├── services/           # Logika bisnis dan layanan AI Agent
│   └── index.js            # Entry point server
└── migration_summary.md    # Ringkasan dokumentasi migrasi sistem
```

## Penjelasan Folder Utama

### 1. `dashboard/`

Folder ini berisi seluruh kode untuk antarmuka pengguna (Frontend). Dibangun menggunakan **React** dengan build tool **Vite**.

- **`src/components/`**: Berisi potongan UI yang dapat digunakan kembali. Terbagi menjadi sub-folder seperti `course` dan `rental` untuk modularitas.
- **`src/pages/`**: Berisi halaman utuh yang diakses melalui URL. Terorganisir berdasarkan jenis bisnis (Travel, Retail, Rental, Course).
- **`src/layouts/`**: Menyediakan kerangka tampilan (header, sidebar) yang membungkus konten halaman.

### 2. `server/`

Folder ini merupakan pusat logika belakang layar (Backend) menggunakan **Node.js** dan **Express**.

- **`routes/`**: Mengatur bagaimana server merespons permintaan dari frontend berdasarkan URL tertentu.
- **`services/`**: Berisi logika bisnis yang lebih kompleks, termasuk integrasi dengan AI untuk analisis leads.
- **`middleware/`**: Fungsi yang berjalan di tengah proses request, seperti pengecekan autentikasi atau penentuan tipe bisnis berdasarkan tenant.

### 3. `migration_summary.md`

File dokumentasi yang mencatat poin-poin penting selama proses migrasi atau pengembangan sistem baru ini.
