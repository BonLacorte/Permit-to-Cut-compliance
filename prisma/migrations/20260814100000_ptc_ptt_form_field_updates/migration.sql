ALTER TABLE "application_records" ADD COLUMN "officialReceiptNumber" TEXT;

ALTER TABLE "ptt_application_records" ADD COLUMN "recordedValidityDays" INTEGER;
ALTER TABLE "ptt_application_records" ADD COLUMN "actualValidityDays" INTEGER;
ALTER TABLE "ptt_application_records" ADD COLUMN "issuedByDate" TIMESTAMP(3);