CREATE TABLE "ptt_validity_rules" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "withinMunicipalityDays" INTEGER NOT NULL DEFAULT 1,
  "withinProvinceDays" INTEGER NOT NULL DEFAULT 2,
  "withinRegionDays" INTEGER NOT NULL DEFAULT 3,
  "outsideRegionAllowedDays" JSONB NOT NULL DEFAULT '[5,6,7]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ptt_validity_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ptt_validity_rules_versionId_key" ON "ptt_validity_rules"("versionId");
CREATE INDEX "ptt_validity_rules_versionId_idx" ON "ptt_validity_rules"("versionId");

ALTER TABLE "ptt_validity_rules"
  ADD CONSTRAINT "ptt_validity_rules_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ptc_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ptt_validity_rules" (
  "id",
  "versionId",
  "withinMunicipalityDays",
  "withinProvinceDays",
  "withinRegionDays",
  "outsideRegionAllowedDays",
  "createdAt",
  "updatedAt"
)
SELECT
  'ptt-validity-rule-' || "id",
  "id",
  1,
  2,
  3,
  '[5,6,7]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ptc_versions"
WHERE "group" = 'PTT'
ON CONFLICT ("versionId") DO NOTHING;