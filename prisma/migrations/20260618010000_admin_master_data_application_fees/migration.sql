ALTER TABLE "application_records" ADD COLUMN "actualFee" DECIMAL(12,2);
ALTER TABLE "application_records" ADD COLUMN "recordedFee" DECIMAL(12,2);
ALTER TABLE "application_records" ADD COLUMN "replantedSeedlings" BOOLEAN;
ALTER TABLE "application_records" ADD COLUMN "editedById" TEXT;

CREATE TABLE "regional_offices" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'PTC',
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regional_offices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provincial_offices" (
    "id" TEXT NOT NULL,
    "regionalOfficeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provincial_offices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "regional_offices_group_name_key" ON "regional_offices"("group", "name");
CREATE UNIQUE INDEX "provincial_offices_regionalOfficeId_name_key" ON "provincial_offices"("regionalOfficeId", "name");
CREATE INDEX "application_records_editedById_idx" ON "application_records"("editedById");

ALTER TABLE "application_records" ADD CONSTRAINT "application_records_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provincial_offices" ADD CONSTRAINT "provincial_offices_regionalOfficeId_fkey" FOREIGN KEY ("regionalOfficeId") REFERENCES "regional_offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;