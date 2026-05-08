-- CreateTable
CREATE TABLE "ExtractionLog" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "originalFileName" TEXT,
    "fileSizeBytes" INTEGER,
    "piiDetected" BOOLEAN NOT NULL DEFAULT false,
    "processingTimeMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractionLog_createdAt_idx" ON "ExtractionLog"("createdAt");

-- CreateIndex
CREATE INDEX "ExtractionLog_sourceType_idx" ON "ExtractionLog"("sourceType");

-- CreateIndex
CREATE INDEX "ExtractionLog_success_idx" ON "ExtractionLog"("success");
