-- Drop legacy column no longer present in the Prisma schema
ALTER TABLE "User" DROP COLUMN "extractionMode";

-- Drop legacy column from ExtractionLog
ALTER TABLE "ExtractionLog" DROP COLUMN "invoiceId";

-- Drop legacy Document table no longer present in the Prisma schema
DROP TABLE "Document";
