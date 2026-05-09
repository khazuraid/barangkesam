# Barang Kesam (Apps Barang)

Sistem manajemen inventaris barang dan alat kesehatan (Alkes) berbasis monorepo.

## 🚀 Tech Stack

- **Monorepo**: [Turborepo](https://turbo.build/)
- **Frontend**: [Next.js 15+](https://nextjs.org/) (App Router, Standalone mode)
- **Backend**: [Express.js](https://expressjs.com/) with [Prisma ORM](https://www.prisma.io/)
- **Database**: PostgreSQL
- **Cache & Queue**: Redis
- **Storage**: Cloudinary (Image uploads)
- **Styling**: Tailwind CSS & Shadcn UI
- **Package Manager**: npm

## 📦 Struktur Folder

```text
.
├── apps/
│   ├── web/        # Frontend Next.js
│   └── server/     # Backend API Express
├── packages/
│   ├── types/      # Shared TypeScript types
│   ├── utils/      # Shared utility functions
│   └── validators/ # Shared Zod schemas
└── docker-compose.yml
```

## 🛠️ Persiapan Lokal

1. **Clone Repository**
   ```bash
   git clone https://github.com/khazuraid/barangkesam.git
   cd barangkesam
   ```

2. **Install Dependensi**
   ```bash
   npm install
   ```

3. **Environment Variables**
   - Copy `.env.example` di `apps/server` menjadi `.env` dan isi nilai yang diperlukan.
   - Copy `.env.local.example` di `apps/web` menjadi `.env.local`.

4. **Database Migration**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. **Jalankan Development Mode**
   ```bash
   npm run dev
   ```

## 🐳 Deployment (Coolify / Docker)

Aplikasi ini sudah siap di-deploy menggunakan Docker. 

### Persiapan Docker
Build menggunakan Turborepo pruning untuk meminimalkan ukuran image:
- **Server**: `apps/server/Dockerfile`
- **Web**: `apps/web/Dockerfile` (Standalone output)

### Environment Variables Penting
| Key | Keterangan |
| :--- | :--- |
| `DATABASE_URL` | Koneksi PostgreSQL |
| `REDIS_URL` | Koneksi Redis |
| `CLOUDINARY_*` | Kredensial Cloudinary |
| `NEXT_PUBLIC_API_URL` | URL Endpoint API Backend |

## 📄 Lisensi
[MIT](LICENSE)
