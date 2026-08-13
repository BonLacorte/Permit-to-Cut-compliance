INSERT INTO "ptc_versions" ("id", "group", "name", "description", "active", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'ptt-version-default',
  'PTT',
  'Default PTT',
  'Default Permit-to-Transport version for initial PTT records.',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("group", "name") DO NOTHING;

CREATE TABLE "ptt_application_records" (
  "id" TEXT NOT NULL,
  "group" TEXT NOT NULL DEFAULT 'PTT',
  "versionId" TEXT,
  "pttNumber" TEXT,
  "dateIssued" TIMESTAMP(3),
  "province" TEXT,
  "transporterName" TEXT,
  "transporterAddress" TEXT,
  "ptcNumber" TEXT,
  "pcaRegistrationCertificateNumber" TEXT,
  "pcaRegistrationCertificateDate" TIMESTAMP(3),
  "businessAddress" TEXT,
  "boardFeetGranted" DECIMAL(12,2),
  "certificateOfQuantityVolumeAttached" BOOLEAN,
  "volumeBoardFeet" DECIMAL(12,2),
  "originOfLumber" TEXT,
  "destination" TEXT,
  "consigneeName" TEXT,
  "consigneePcaRegistration" TEXT,
  "transportType" TEXT,
  "vehiclePlateNumber" TEXT,
  "authorizedDriverName" TEXT,
  "authorizedDriverContact" TEXT,
  "amountPaid" DECIMAL(12,2),
  "officialReceiptNumber" TEXT,
  "validUntil" TIMESTAMP(3),
  "dateValidatedInspected" TIMESTAMP(3),
  "validatedInspectedBy" TEXT,
  "validatedInspectedByDesignation" TEXT,
  "issuedBy" TEXT,
  "issuedByDesignation" TEXT,
  "remarks" TEXT,
  "createdById" TEXT NOT NULL,
  "editedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ptt_application_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ptt_application_records_versionId_idx" ON "ptt_application_records"("versionId");
CREATE INDEX "ptt_application_records_group_idx" ON "ptt_application_records"("group");
CREATE INDEX "ptt_application_records_pttNumber_idx" ON "ptt_application_records"("pttNumber");
CREATE INDEX "ptt_application_records_ptcNumber_idx" ON "ptt_application_records"("ptcNumber");
CREATE INDEX "ptt_application_records_editedById_idx" ON "ptt_application_records"("editedById");

ALTER TABLE "ptt_application_records"
  ADD CONSTRAINT "ptt_application_records_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ptc_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ptt_application_records"
  ADD CONSTRAINT "ptt_application_records_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ptt_application_records"
  ADD CONSTRAINT "ptt_application_records_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
