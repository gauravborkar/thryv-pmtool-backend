-- AlterTable
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_onboard" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clients_is_onboard_idx" ON "clients"("is_onboard");
