-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "AlkesAda" AS ENUM ('Ya', 'Tidak');

-- CreateEnum
CREATE TYPE "AlkesBerfungsi" AS ENUM ('Baik', 'Rusak', 'tdk beroperasi', 'tdk berfungsi');

-- CreateEnum
CREATE TYPE "AlkesPendanaan" AS ENUM ('APBN', 'APBD', 'Hibah', 'KSO', 'BLU', 'JKLN');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('ALKES');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAIL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'ERROR', 'SUCCESS');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'IMPORT', 'EXPORT', 'UPLOAD', 'TOGGLE_ACTIVE', 'RESET_PASSWORD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "faskes_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faskes" (
    "id" TEXT NOT NULL,
    "kode_faskes" VARCHAR(20) NOT NULL,
    "nama" VARCHAR(200) NOT NULL,
    "alamat" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faskes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alkes_groups" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alkes_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alkes" (
    "id" TEXT NOT NULL,
    "faskes_id" TEXT NOT NULL,
    "group_id" TEXT,
    "mark" VARCHAR(20) NOT NULL DEFAULT '',
    "kode_alat" VARCHAR(50) NOT NULL,
    "nama_alat" VARCHAR(300) NOT NULL,
    "ada" "AlkesAda" NOT NULL DEFAULT 'Tidak',
    "no_seri" VARCHAR(100),
    "merk" VARCHAR(100),
    "type" VARCHAR(100),
    "thn_pengadaan" INTEGER,
    "berfungsi" "AlkesBerfungsi" NOT NULL DEFAULT 'Rusak',
    "harga" DECIMAL(15,2),
    "pendanaan" "AlkesPendanaan",
    "distributor" VARCHAR(200),
    "akl_akd" VARCHAR(100),
    "keterangan" TEXT,
    "image_url" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alkes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alkes_images" (
    "id" TEXT NOT NULL,
    "alkes_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" VARCHAR(200) NOT NULL,
    "caption" VARCHAR(200),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alkes_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" TEXT NOT NULL,
    "faskes_id" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "filename" VARCHAR(200) NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "error_detail" JSONB NOT NULL DEFAULT '[]',
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "LogAction" NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100),
    "description" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_faskes_id_idx" ON "users"("faskes_id");

-- CreateIndex
CREATE UNIQUE INDEX "faskes_kode_faskes_key" ON "faskes"("kode_faskes");

-- CreateIndex
CREATE INDEX "alkes_faskes_id_idx" ON "alkes"("faskes_id");

-- CreateIndex
CREATE INDEX "alkes_group_id_idx" ON "alkes"("group_id");

-- CreateIndex
CREATE INDEX "alkes_berfungsi_idx" ON "alkes"("berfungsi");

-- CreateIndex
CREATE INDEX "alkes_no_seri_idx" ON "alkes"("no_seri");

-- CreateIndex
CREATE UNIQUE INDEX "alkes_kode_alat_faskes_id_key" ON "alkes"("kode_alat", "faskes_id");

-- CreateIndex
CREATE INDEX "alkes_images_alkes_id_idx" ON "alkes_images"("alkes_id");

-- CreateIndex
CREATE INDEX "import_logs_faskes_id_idx" ON "import_logs"("faskes_id");

-- CreateIndex
CREATE INDEX "import_logs_status_idx" ON "import_logs"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_entity_entity_id_idx" ON "activity_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_faskes_id_fkey" FOREIGN KEY ("faskes_id") REFERENCES "faskes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alkes_groups" ADD CONSTRAINT "alkes_groups_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "alkes_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alkes" ADD CONSTRAINT "alkes_faskes_id_fkey" FOREIGN KEY ("faskes_id") REFERENCES "faskes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alkes" ADD CONSTRAINT "alkes_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "alkes_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alkes" ADD CONSTRAINT "alkes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alkes_images" ADD CONSTRAINT "alkes_images_alkes_id_fkey" FOREIGN KEY ("alkes_id") REFERENCES "alkes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alkes_images" ADD CONSTRAINT "alkes_images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_faskes_id_fkey" FOREIGN KEY ("faskes_id") REFERENCES "faskes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
