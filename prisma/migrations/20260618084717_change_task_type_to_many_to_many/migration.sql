-- CreateTable
CREATE TABLE "_TaskToTaskTypes" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TaskToTaskTypes_AB_unique" ON "_TaskToTaskTypes"("A", "B");

-- CreateIndex
CREATE INDEX "_TaskToTaskTypes_B_index" ON "_TaskToTaskTypes"("B");

-- AddForeignKey
ALTER TABLE "_TaskToTaskTypes" ADD CONSTRAINT "_TaskToTaskTypes_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskToTaskTypes" ADD CONSTRAINT "_TaskToTaskTypes_B_fkey" FOREIGN KEY ("B") REFERENCES "task_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
