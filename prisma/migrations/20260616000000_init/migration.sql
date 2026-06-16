CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'STAFF',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_types" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "application_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "required_documents" (
  "id" TEXT NOT NULL,
  "applicationTypeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "required_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_records" (
  "id" TEXT NOT NULL,
  "applicantName" TEXT NOT NULL,
  "applicationTypeId" TEXT NOT NULL,
  "remarks" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "application_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress_entries" (
  "id" TEXT NOT NULL,
  "applicationRecordId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "progress_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress_documents" (
  "id" TEXT NOT NULL,
  "progressEntryId" TEXT NOT NULL,
  "applicationRecordId" TEXT NOT NULL,
  "requiredDocumentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "progress_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_log" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "application_types_name_key" ON "application_types"("name");
CREATE UNIQUE INDEX "required_documents_applicationTypeId_name_key" ON "required_documents"("applicationTypeId", "name");
CREATE UNIQUE INDEX "progress_documents_applicationRecordId_requiredDocumentId_key" ON "progress_documents"("applicationRecordId", "requiredDocumentId");
CREATE INDEX "application_records_applicationTypeId_idx" ON "application_records"("applicationTypeId");
CREATE INDEX "progress_entries_applicationRecordId_idx" ON "progress_entries"("applicationRecordId");
CREATE INDEX "progress_entries_userId_idx" ON "progress_entries"("userId");
CREATE INDEX "progress_documents_requiredDocumentId_idx" ON "progress_documents"("requiredDocumentId");
CREATE INDEX "activity_log_action_idx" ON "activity_log"("action");
CREATE INDEX "activity_log_targetType_targetId_idx" ON "activity_log"("targetType", "targetId");

ALTER TABLE "required_documents" ADD CONSTRAINT "required_documents_applicationTypeId_fkey" FOREIGN KEY ("applicationTypeId") REFERENCES "application_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_records" ADD CONSTRAINT "application_records_applicationTypeId_fkey" FOREIGN KEY ("applicationTypeId") REFERENCES "application_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_records" ADD CONSTRAINT "application_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_applicationRecordId_fkey" FOREIGN KEY ("applicationRecordId") REFERENCES "application_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "progress_documents" ADD CONSTRAINT "progress_documents_progressEntryId_fkey" FOREIGN KEY ("progressEntryId") REFERENCES "progress_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress_documents" ADD CONSTRAINT "progress_documents_applicationRecordId_fkey" FOREIGN KEY ("applicationRecordId") REFERENCES "application_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress_documents" ADD CONSTRAINT "progress_documents_requiredDocumentId_fkey" FOREIGN KEY ("requiredDocumentId") REFERENCES "required_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
