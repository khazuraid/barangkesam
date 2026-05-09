-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'REVISED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('NEW_EQUIPMENT', 'REPLACEMENT', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'FULFILLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LogAction" ADD VALUE 'SUBMIT';
ALTER TYPE "LogAction" ADD VALUE 'APPROVE';
ALTER TYPE "LogAction" ADD VALUE 'REJECT';
ALTER TYPE "LogAction" ADD VALUE 'REQUEST_CREATE';
ALTER TYPE "LogAction" ADD VALUE 'REQUEST_SUBMIT';
ALTER TYPE "LogAction" ADD VALUE 'REQUEST_APPROVE';
ALTER TYPE "LogAction" ADD VALUE 'REQUEST_REJECT';
ALTER TYPE "LogAction" ADD VALUE 'REQUEST_FULFILL';

-- AlterTable
ALTER TABLE "alkes" ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "verification_status" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assigned_room_id" TEXT;

-- CreateTable
CREATE TABLE "equipment_requests" (
    "id" TEXT NOT NULL,
    "request_no" VARCHAR(30) NOT NULL,
    "faskes_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "nama_alat" VARCHAR(300) NOT NULL,
    "group_id" TEXT,
    "merk" VARCHAR(100),
    "type_alat" VARCHAR(100),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "estimated_price" DECIMAL(15,2),
    "pendanaan_usulan" "AlkesPendanaan",
    "justifikasi" TEXT NOT NULL,
    "spesifikasi" TEXT,
    "attachment_url" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "fulfilled_alkes_id" TEXT,
    "fulfilled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_logs" (
    "id" TEXT NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "from_status" VARCHAR(20) NOT NULL,
    "to_status" VARCHAR(20) NOT NULL,
    "actor_id" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_requests_request_no_key" ON "equipment_requests"("request_no");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_requests_fulfilled_alkes_id_key" ON "equipment_requests"("fulfilled_alkes_id");

-- CreateIndex
CREATE INDEX "equipment_requests_faskes_id_idx" ON "equipment_requests"("faskes_id");

-- CreateIndex
CREATE INDEX "equipment_requests_status_idx" ON "equipment_requests"("status");

-- CreateIndex
CREATE INDEX "equipment_requests_requested_by_idx" ON "equipment_requests"("requested_by");

-- CreateIndex
CREATE INDEX "verification_logs_entity_type_entity_id_idx" ON "verification_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "verification_logs_actor_id_idx" ON "verification_logs"("actor_id");

-- CreateIndex
CREATE INDEX "verification_logs_created_at_idx" ON "verification_logs"("created_at");

-- CreateIndex
CREATE INDEX "alkes_verification_status_idx" ON "alkes"("verification_status");

-- CreateIndex
CREATE INDEX "users_assigned_room_id_idx" ON "users"("assigned_room_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_room_id_fkey" FOREIGN KEY ("assigned_room_id") REFERENCES "alkes_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alkes" ADD CONSTRAINT "alkes_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_faskes_id_fkey" FOREIGN KEY ("faskes_id") REFERENCES "faskes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "alkes_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_fulfilled_alkes_id_fkey" FOREIGN KEY ("fulfilled_alkes_id") REFERENCES "alkes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "equipment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
