ALTER TYPE "FeatureKey" ADD VALUE IF NOT EXISTS 'PTT_FEES_CHECKER';
ALTER TYPE "FeatureKey" ADD VALUE IF NOT EXISTS 'PTT_VALIDITY_CHECKER';
ALTER TYPE "FeatureKey" ADD VALUE IF NOT EXISTS 'PTT_VEHICLE_CAPACITY_CHECKER';

CREATE TYPE "PttCheckType" AS ENUM ('Fee', 'Validity', 'Vehicle');
CREATE TYPE "PttValidityBasis" AS ENUM ('WithinMunicipality', 'WithinProvince', 'WithinRegion', 'OutsideRegionInterIsland');
CREATE TYPE "PttVehicleCapacityCategory" AS ENUM ('SmallerThanJeep', 'Jeep', 'ElfOrSixWheelerTruck', 'ForwardTruck', 'TenWheelerTruck', 'TwelveWheelerAndAbove');

ALTER TABLE "ptt_application_records" ADD COLUMN "actualFee" DECIMAL(12,2);
ALTER TABLE "ptt_application_records" ADD COLUMN "validityBasis" "PttValidityBasis";
ALTER TABLE "ptt_transport_types" ADD COLUMN "capacityCategory" "PttVehicleCapacityCategory";
ALTER TABLE "ptt_transport_types" ADD COLUMN "maxBoardFeet" DECIMAL(12,2);

CREATE TABLE "ptt_application_check_runs" (
  "id" TEXT NOT NULL,
  "pttApplicationRecordId" TEXT NOT NULL,
  "checkType" "PttCheckType" NOT NULL,
  "appliedById" TEXT NOT NULL,
  "inputSnapshot" JSONB NOT NULL,
  "ruleSnapshot" JSONB NOT NULL,
  "outputSnapshot" JSONB NOT NULL,
  "comparisonSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ptt_application_check_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ptt_application_check_findings" (
  "id" TEXT NOT NULL,
  "pttApplicationRecordId" TEXT NOT NULL,
  "checkType" "PttCheckType" NOT NULL,
  "message" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "comparisonSnapshot" JSONB NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ptt_application_check_findings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ptt_application_check_runs_pttApplicationRecordId_createdAt_idx" ON "ptt_application_check_runs"("pttApplicationRecordId", "createdAt");
CREATE INDEX "ptt_application_check_runs_appliedById_idx" ON "ptt_application_check_runs"("appliedById");
CREATE UNIQUE INDEX "ptt_application_check_findings_pttApplicationRecordId_checkType_key" ON "ptt_application_check_findings"("pttApplicationRecordId", "checkType");
CREATE INDEX "ptt_application_check_findings_pttApplicationRecordId_active_idx" ON "ptt_application_check_findings"("pttApplicationRecordId", "active");

ALTER TABLE "ptt_application_check_runs" ADD CONSTRAINT "ptt_application_check_runs_pttApplicationRecordId_fkey" FOREIGN KEY ("pttApplicationRecordId") REFERENCES "ptt_application_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ptt_application_check_runs" ADD CONSTRAINT "ptt_application_check_runs_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ptt_application_check_findings" ADD CONSTRAINT "ptt_application_check_findings_pttApplicationRecordId_fkey" FOREIGN KEY ("pttApplicationRecordId") REFERENCES "ptt_application_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;