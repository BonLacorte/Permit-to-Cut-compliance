ALTER TABLE "ptt_application_records"
  ADD COLUMN "regionalOffice" TEXT,
  ADD COLUMN "provincialOffice" TEXT;

UPDATE "ptt_application_records"
SET "provincialOffice" = "province"
WHERE "provincialOffice" IS NULL
  AND "province" IS NOT NULL;

ALTER TABLE "ptt_application_records"
  DROP COLUMN "province",
  DROP COLUMN "validatedInspectedByDesignation",
  DROP COLUMN "issuedByDesignation";

CREATE TABLE "ptt_transport_types" (
  "id" TEXT NOT NULL,
  "group" TEXT NOT NULL DEFAULT 'PTT',
  "versionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ptt_transport_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ptt_transport_types_versionId_name_key" ON "ptt_transport_types"("versionId", "name");
CREATE INDEX "ptt_transport_types_group_idx" ON "ptt_transport_types"("group");
CREATE INDEX "ptt_transport_types_versionId_idx" ON "ptt_transport_types"("versionId");

ALTER TABLE "ptt_transport_types"
  ADD CONSTRAINT "ptt_transport_types_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ptc_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
