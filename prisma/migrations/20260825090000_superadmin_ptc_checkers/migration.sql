ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPERADMIN';

CREATE TYPE "FeatureKey" AS ENUM ('PTC_FEES_CHECKER', 'PTC_VALIDITY_CHECKER');
CREATE TYPE "ApplicationCheckType" AS ENUM ('Fee', 'Validity');

CREATE TABLE "user_feature_access" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feature" "FeatureKey" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_feature_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ptc_calculation_rules" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "applicationTypeId" TEXT,
  "processingTiers" JSONB NOT NULL,
  "additionalProcessingStep" INTEGER NOT NULL DEFAULT 50,
  "additionalProcessingFee" DECIMAL(12,2) NOT NULL DEFAULT 200,
  "applicationFeePerTree" DECIMAL(12,2) NOT NULL DEFAULT 100,
  "replantingFeePerTree" DECIMAL(12,2) NOT NULL DEFAULT 100,
  "maxTreesPerPtc" INTEGER NOT NULL DEFAULT 100,
  "validityBrackets" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ptc_calculation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_check_runs" (
  "id" TEXT NOT NULL,
  "applicationRecordId" TEXT NOT NULL,
  "checkType" "ApplicationCheckType" NOT NULL,
  "appliedById" TEXT NOT NULL,
  "inputSnapshot" JSONB NOT NULL,
  "ruleSnapshot" JSONB NOT NULL,
  "outputSnapshot" JSONB NOT NULL,
  "comparisonSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_check_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_check_findings" (
  "id" TEXT NOT NULL,
  "applicationRecordId" TEXT NOT NULL,
  "checkType" "ApplicationCheckType" NOT NULL,
  "message" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "comparisonSnapshot" JSONB NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "application_check_findings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_feature_access_userId_feature_key" ON "user_feature_access"("userId", "feature");
CREATE UNIQUE INDEX "ptc_calculation_rules_versionId_applicationTypeId_key" ON "ptc_calculation_rules"("versionId", "applicationTypeId");
CREATE UNIQUE INDEX "ptc_calculation_rules_default_per_version_key" ON "ptc_calculation_rules"("versionId") WHERE "applicationTypeId" IS NULL;
CREATE UNIQUE INDEX "application_check_findings_applicationRecordId_checkType_key" ON "application_check_findings"("applicationRecordId", "checkType");

CREATE INDEX "ptc_calculation_rules_versionId_idx" ON "ptc_calculation_rules"("versionId");
CREATE INDEX "ptc_calculation_rules_applicationTypeId_idx" ON "ptc_calculation_rules"("applicationTypeId");
CREATE INDEX "application_check_runs_applicationRecordId_createdAt_idx" ON "application_check_runs"("applicationRecordId", "createdAt");
CREATE INDEX "application_check_runs_appliedById_idx" ON "application_check_runs"("appliedById");
CREATE INDEX "application_check_findings_applicationRecordId_active_idx" ON "application_check_findings"("applicationRecordId", "active");

ALTER TABLE "user_feature_access" ADD CONSTRAINT "user_feature_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ptc_calculation_rules" ADD CONSTRAINT "ptc_calculation_rules_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ptc_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ptc_calculation_rules" ADD CONSTRAINT "ptc_calculation_rules_applicationTypeId_fkey" FOREIGN KEY ("applicationTypeId") REFERENCES "application_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_check_runs" ADD CONSTRAINT "application_check_runs_applicationRecordId_fkey" FOREIGN KEY ("applicationRecordId") REFERENCES "application_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_check_runs" ADD CONSTRAINT "application_check_runs_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_check_findings" ADD CONSTRAINT "application_check_findings_applicationRecordId_fkey" FOREIGN KEY ("applicationRecordId") REFERENCES "application_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ptc_calculation_rules" (
  "id", "versionId", "processingTiers", "additionalProcessingStep", "additionalProcessingFee",
  "applicationFeePerTree", "replantingFeePerTree", "maxTreesPerPtc", "validityBrackets", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text),
  "id",
  '[{"upTo":5,"fee":100},{"upTo":50,"fee":200},{"upTo":100,"fee":500},{"upTo":500,"fee":1000},{"upTo":1000,"fee":2000}]'::jsonb,
  50,
  200,
  100,
  100,
  100,
  '[{"upTo":20,"days":3},{"upTo":50,"days":10},{"upTo":100,"days":15}]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ptc_versions"
WHERE "group" = 'PTC';
