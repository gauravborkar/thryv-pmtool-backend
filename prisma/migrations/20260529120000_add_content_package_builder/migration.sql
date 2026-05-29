-- CreateTable
CREATE TABLE "content_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_cycles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_platforms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_package_line_items" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "content_type_id" INTEGER NOT NULL,
    "platform_id" INTEGER NOT NULL,
    "billing_cycle_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_package_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_types_name_key" ON "content_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "billing_cycles_name_key" ON "billing_cycles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "social_platforms_name_key" ON "social_platforms"("name");

-- CreateIndex
CREATE INDEX "content_packages_created_by_id_idx" ON "content_packages"("created_by_id");

-- CreateIndex
CREATE INDEX "content_packages_created_at_idx" ON "content_packages"("created_at");

-- CreateIndex
CREATE INDEX "content_package_line_items_package_id_idx" ON "content_package_line_items"("package_id");

-- CreateIndex
CREATE INDEX "content_package_line_items_content_type_id_idx" ON "content_package_line_items"("content_type_id");

-- CreateIndex
CREATE INDEX "content_package_line_items_platform_id_idx" ON "content_package_line_items"("platform_id");

-- CreateIndex
CREATE INDEX "content_package_line_items_billing_cycle_id_idx" ON "content_package_line_items"("billing_cycle_id");

-- AddForeignKey
ALTER TABLE "content_packages" ADD CONSTRAINT "content_packages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_package_line_items" ADD CONSTRAINT "content_package_line_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_package_line_items" ADD CONSTRAINT "content_package_line_items_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "content_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_package_line_items" ADD CONSTRAINT "content_package_line_items_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "social_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_package_line_items" ADD CONSTRAINT "content_package_line_items_billing_cycle_id_fkey" FOREIGN KEY ("billing_cycle_id") REFERENCES "billing_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
