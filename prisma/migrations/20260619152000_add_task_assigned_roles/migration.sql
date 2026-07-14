-- CreateTable
CREATE TABLE IF NOT EXISTS "_TaskAssignedRoles" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_TaskAssignedRoles_AB_unique" ON "_TaskAssignedRoles"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_TaskAssignedRoles_B_index" ON "_TaskAssignedRoles"("B");

-- AddForeignKey
ALTER TABLE "_TaskAssignedRoles" ADD CONSTRAINT "_TaskAssignedRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignedRoles" ADD CONSTRAINT "_TaskAssignedRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "user_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
