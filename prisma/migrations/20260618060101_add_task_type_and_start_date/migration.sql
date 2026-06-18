-- AlterTable
ALTER TABLE "content_package_line_items" ADD COLUMN     "eligible_for_partial_regeneration" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "content_packages" ADD COLUMN     "current_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "task_type_id" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "current_session_token" TEXT;

-- CreateTable
CREATE TABLE "task_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_package_versions" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "change_type" TEXT NOT NULL,
    "change_summary" JSONB,
    "edited_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_package_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_package_version_line_items" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "source_line_item_id" TEXT,
    "content_type_id" INTEGER NOT NULL,
    "platform_id" INTEGER NOT NULL,
    "billing_cycle_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "change_kind" TEXT NOT NULL,
    "eligible_for_partial_regeneration" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "content_package_version_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_knowledge" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "sheet_name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionRule" (
    "id" SERIAL NOT NULL,
    "package_id" TEXT NOT NULL,
    "formatSequence" JSONB NOT NULL,
    "peakDays" JSONB NOT NULL,
    "maxConsecutiveSameFormat" INTEGER NOT NULL DEFAULT 1,
    "regenerationMode" TEXT NOT NULL DEFAULT 'ALL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPost" (
    "id" SERIAL NOT NULL,
    "package_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "format" TEXT NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleId" INTEGER,

    CONSTRAINT "ScheduledPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blackout_dates" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blackout_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "reference_id" INTEGER,
    "reference_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_types_name_key" ON "task_types"("name");

-- CreateIndex
CREATE INDEX "content_package_versions_package_id_idx" ON "content_package_versions"("package_id");

-- CreateIndex
CREATE INDEX "content_package_versions_created_at_idx" ON "content_package_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_package_versions_package_id_version_number_key" ON "content_package_versions"("package_id", "version_number");

-- CreateIndex
CREATE INDEX "content_package_version_line_items_version_id_idx" ON "content_package_version_line_items"("version_id");

-- CreateIndex
CREATE INDEX "client_knowledge_client_id_idx" ON "client_knowledge"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionRule_package_id_key" ON "DistributionRule"("package_id");

-- CreateIndex
CREATE INDEX "ScheduledPost_package_id_idx" ON "ScheduledPost"("package_id");

-- CreateIndex
CREATE INDEX "ScheduledPost_scheduled_at_idx" ON "ScheduledPost"("scheduled_at");

-- CreateIndex
CREATE INDEX "ScheduledPost_is_locked_idx" ON "ScheduledPost"("is_locked");

-- CreateIndex
CREATE UNIQUE INDEX "blackout_dates_date_key" ON "blackout_dates"("date");

-- CreateIndex
CREATE INDEX "blackout_dates_date_idx" ON "blackout_dates"("date");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "invitations_role_id_idx" ON "invitations"("role_id");

-- CreateIndex
CREATE INDEX "tasks_task_type_id_idx" ON "tasks"("task_type_id");

-- CreateIndex
CREATE INDEX "tasks_created_by_manager_id_idx" ON "tasks"("created_by_manager_id");

-- AddForeignKey
ALTER TABLE "content_package_versions" ADD CONSTRAINT "content_package_versions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_package_versions" ADD CONSTRAINT "content_package_versions_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_package_version_line_items" ADD CONSTRAINT "content_package_version_line_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "content_package_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_package_version_line_items" ADD CONSTRAINT "content_package_version_line_items_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "content_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_package_version_line_items" ADD CONSTRAINT "content_package_version_line_items_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "social_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_package_version_line_items" ADD CONSTRAINT "content_package_version_line_items_billing_cycle_id_fkey" FOREIGN KEY ("billing_cycle_id") REFERENCES "billing_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_knowledge" ADD CONSTRAINT "client_knowledge_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "task_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionRule" ADD CONSTRAINT "DistributionRule_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "content_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DistributionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
