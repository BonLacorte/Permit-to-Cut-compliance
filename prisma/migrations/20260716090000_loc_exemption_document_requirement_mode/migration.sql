CREATE TYPE "LocExemption" AS ENUM ('Owner', 'Others');
CREATE TYPE "DocumentRequirementMode" AS ENUM ('Required', 'Optional', 'LocConditional');

ALTER TABLE "application_records" ADD COLUMN "locExemption" "LocExemption";

ALTER TABLE "required_documents" ADD COLUMN "requirementMode" "DocumentRequirementMode" NOT NULL DEFAULT 'Required';
UPDATE "required_documents"
SET "requirementMode" = CASE
  WHEN "optional" = true THEN 'Optional'::"DocumentRequirementMode"
  ELSE 'Required'::"DocumentRequirementMode"
END;
ALTER TABLE "required_documents" DROP COLUMN "optional";