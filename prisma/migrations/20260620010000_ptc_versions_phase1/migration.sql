CREATE TABLE "ptc_versions" (
  "id" TEXT NOT NULL,
  "group" TEXT NOT NULL DEFAULT 'PTC',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ptc_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ptc_versions_group_name_key" ON "ptc_versions"("group", "name");

INSERT INTO "ptc_versions" ("id", "group", "name", "description", "active", "sortOrder")
VALUES ('ptc-version-2023-2024', 'PTC', '2023 and 2024', 'Initial version for existing 2023 and 2024 PTC document rules.', true, 1);

ALTER TABLE "application_types" ADD COLUMN "versionId" TEXT;

UPDATE "application_types"
SET "versionId" = 'ptc-version-2023-2024'
WHERE "group" = 'PTC';

UPDATE "application_types"
SET "versionId" = 'ptc-version-2023-2024'
WHERE "versionId" IS NULL;

DROP INDEX IF EXISTS "application_types_group_name_key";
DROP INDEX IF EXISTS "application_types_name_key";

ALTER TABLE "application_types" ALTER COLUMN "versionId" SET NOT NULL;

CREATE UNIQUE INDEX "application_types_versionId_name_key" ON "application_types"("versionId", "name");
CREATE INDEX "application_types_group_idx" ON "application_types"("group");

ALTER TABLE "application_types"
ADD CONSTRAINT "application_types_versionId_fkey"
FOREIGN KEY ("versionId") REFERENCES "ptc_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "application_records" ADD COLUMN "versionId" TEXT;

UPDATE "application_records"
SET "versionId" = 'ptc-version-2023-2024'
WHERE "group" = 'PTC'
  AND "versionId" IS NULL;

CREATE INDEX "application_records_versionId_idx" ON "application_records"("versionId");

ALTER TABLE "application_records"
ADD CONSTRAINT "application_records_versionId_fkey"
FOREIGN KEY ("versionId") REFERENCES "ptc_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;