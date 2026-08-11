-- CreateTable
CREATE TABLE "MachineReading" (
    "id" TEXT NOT NULL,
    "machineProfileId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MachineReading_machineProfileId_recordedAt_idx" ON "MachineReading"("machineProfileId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MachineReading_machineProfileId_externalId_key" ON "MachineReading"("machineProfileId", "externalId");

-- AddForeignKey
ALTER TABLE "MachineReading" ADD CONSTRAINT "MachineReading_machineProfileId_fkey" FOREIGN KEY ("machineProfileId") REFERENCES "MachineProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
