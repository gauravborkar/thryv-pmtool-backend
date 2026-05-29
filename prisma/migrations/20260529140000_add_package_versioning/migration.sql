-- AlterTable
ALTER TABLE "content_packages" ADD COLUMN "current_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "content_package_line_items" ADD COLUMN "eligible_for_partial_regeneration" BOOLEAN NOT NULL DEFAULT false;

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

-- CreateIndex
CREATE INDEX "content_package_versions_package_id_idx" ON "content_package_versions"("package_id");

-- CreateIndex
CREATE INDEX "content_package_versions_created_at_idx" ON "content_package_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_package_versions_package_id_version_number_key" ON "content_package_versions"("package_id", "version_number");

-- CreateIndex
CREATE INDEX "content_package_version_line_items_version_id_idx" ON "content_package_version_line_items"("version_id");

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
