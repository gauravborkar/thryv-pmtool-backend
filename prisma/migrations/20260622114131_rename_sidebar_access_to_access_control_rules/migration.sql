-- CreateTable
CREATE TABLE "access_control_rules" (
    "id" SERIAL NOT NULL,
    "section" TEXT NOT NULL,
    "roles" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_control_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_control_rules_section_key" ON "access_control_rules"("section");
