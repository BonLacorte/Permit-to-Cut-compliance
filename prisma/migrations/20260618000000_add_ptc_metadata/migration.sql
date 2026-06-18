-- Add permit grouping support.
ALTER TABLE "application_types" ADD COLUMN "group" TEXT NOT NULL DEFAULT 'PTC';
ALTER TABLE "application_records" ADD COLUMN "group" TEXT NOT NULL DEFAULT 'PTC';

-- Allow blank/incomplete PTC records.
ALTER TABLE "application_records" ALTER COLUMN "applicantName" DROP NOT NULL;
ALTER TABLE "application_records" ALTER COLUMN "applicationTypeId" DROP NOT NULL;

-- Add optional PTC metadata fields.
ALTER TABLE "application_records" ADD COLUMN "dateIssued" TIMESTAMP(3);
ALTER TABLE "application_records" ADD COLUMN "ptcNumber" TEXT;
ALTER TABLE "application_records" ADD COLUMN "regionalOffice" TEXT;
ALTER TABLE "application_records" ADD COLUMN "provincialOffice" TEXT;
ALTER TABLE "application_records" ADD COLUMN "municipality" TEXT;
ALTER TABLE "application_records" ADD COLUMN "barangay" TEXT;
ALTER TABLE "application_records" ADD COLUMN "treesApplied" INTEGER;
ALTER TABLE "application_records" ADD COLUMN "treesApproved" INTEGER;
ALTER TABLE "application_records" ADD COLUMN "seedlingsReplacement" INTEGER;

-- Permit future groups to reuse application type names without colliding with PTC.
ALTER TABLE "application_types" DROP CONSTRAINT IF EXISTS "application_types_name_key";
CREATE UNIQUE INDEX "application_types_group_name_key" ON "application_types"("group", "name");

CREATE INDEX "application_records_group_idx" ON "application_records"("group");
CREATE INDEX "application_records_ptcNumber_idx" ON "application_records"("ptcNumber");