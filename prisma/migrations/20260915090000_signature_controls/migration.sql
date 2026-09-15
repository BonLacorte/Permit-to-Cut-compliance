CREATE TYPE "SignatureStatus" AS ENUM ('Signed', 'Blank', 'For');

ALTER TYPE "ApplicationCheckType" ADD VALUE IF NOT EXISTS 'Signature';
ALTER TYPE "PttCheckType" ADD VALUE IF NOT EXISTS 'Signature';

ALTER TABLE "application_records"
  ADD COLUMN "recommendingApprovalSignatureStatus" "SignatureStatus",
  ADD COLUMN "recommendingApprovalSignatureForName" TEXT,
  ADD COLUMN "approvedSignatureStatus" "SignatureStatus",
  ADD COLUMN "approvedSignatureForName" TEXT;

ALTER TABLE "ptt_application_records"
  ADD COLUMN "validatedInspectedBySignatureStatus" "SignatureStatus",
  ADD COLUMN "validatedInspectedBySignatureForName" TEXT,
  ADD COLUMN "issuedBySignatureStatus" "SignatureStatus",
  ADD COLUMN "issuedBySignatureForName" TEXT;
