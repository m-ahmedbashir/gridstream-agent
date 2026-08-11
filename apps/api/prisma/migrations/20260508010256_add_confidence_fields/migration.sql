-- AlterTable
ALTER TABLE "ExtractionLog" ADD COLUMN     "avgConfidence" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "avgConfidence" DOUBLE PRECISION,
ADD COLUMN     "fieldConfidence" JSONB;
