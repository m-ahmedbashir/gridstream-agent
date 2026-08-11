-- Add plan approval mode to User
ALTER TABLE "User" ADD COLUMN "planApprovalMode" TEXT NOT NULL DEFAULT 'MANUAL_REVIEW';

-- Create MachineProfile
CREATE TABLE "MachineProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "machineType" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "yearInstalled" INTEGER NOT NULL,
    "runtimeHours" INTEGER NOT NULL,
    "lastServiceDate" TIMESTAMP(3),
    "observedIssues" TEXT[],
    "energyConsumptionKwh" INTEGER,
    "criticality" TEXT NOT NULL,
    "location" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText" TEXT,

    CONSTRAINT "MachineProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MachineProfile_machineId_key" ON "MachineProfile"("machineId");
CREATE INDEX "MachineProfile_userId_idx" ON "MachineProfile"("userId");
CREATE INDEX "MachineProfile_machineType_idx" ON "MachineProfile"("machineType");

ALTER TABLE "MachineProfile" ADD CONSTRAINT "MachineProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Measure
CREATE TABLE "Measure" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleDe" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "applicableMachineTypes" TEXT[],
    "minRuntimeHours" INTEGER,
    "typicalInvestment" INTEGER NOT NULL,
    "typicalAnnualSavings" INTEGER NOT NULL,
    "paybackMonths" INTEGER NOT NULL,
    "co2ReductionKg" INTEGER,
    "tasks" JSONB NOT NULL,

    CONSTRAINT "Measure_pkey" PRIMARY KEY ("id")
);

-- Create Plan
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "machineProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "confidence" DOUBLE PRECISION NOT NULL,
    "totalInvestment" INTEGER NOT NULL,
    "totalAnnualSavings" INTEGER NOT NULL,
    "paybackMonths" INTEGER NOT NULL,
    "totalDowntimeHours" INTEGER,
    "totalCo2ReductionKg" INTEGER,
    "measures" JSONB NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "executiveSummaryEn" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Plan_machineProfileId_idx" ON "Plan"("machineProfileId");
CREATE INDEX "Plan_status_idx" ON "Plan"("status");

ALTER TABLE "Plan" ADD CONSTRAINT "Plan_machineProfileId_fkey" FOREIGN KEY ("machineProfileId") REFERENCES "MachineProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
