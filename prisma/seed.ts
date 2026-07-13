import fs from "node:fs";
import path from "node:path";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { parseGroundsWorkbook } from "../lib/excel";
import { DEFAULT_PROVINCIAL_OFFICES_BY_REGION, PERMIT_GROUP_PTC } from "../lib/ptc";

const DEFAULT_PTC_VERSION_ID = "ptc-version-2023-2024";

async function main() {
  const workbookPath =
    process.env.MASTER_DATA_XLSX || "C:/Users/loueg/Downloads/Grounds_for_Cutting_Documents.xlsx";
  const resolved = path.resolve(workbookPath);
  const buffer = fs.readFileSync(resolved);
  const applicationTypes = parseGroundsWorkbook(buffer);

  const adminPassword = await hashPassword("admin123");
  const staffPassword = await hashPassword("staff123");

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { name: "Admin User", role: Role.ADMIN },
    create: { name: "Admin User", email: "admin@example.com", passwordHash: adminPassword, role: Role.ADMIN }
  });

  await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: { name: "Staff User", role: Role.STAFF },
    create: { name: "Staff User", email: "staff@example.com", passwordHash: staffPassword, role: Role.STAFF }
  });

  const defaultVersion = await prisma.ptcVersion.upsert({
    where: { group_name: { group: PERMIT_GROUP_PTC, name: "2023 and 2024" } },
    update: { active: true, sortOrder: 1 },
    create: {
      id: DEFAULT_PTC_VERSION_ID,
      group: PERMIT_GROUP_PTC,
      name: "2023 and 2024",
      description: "Default PTC document set for 2023 and 2024 records.",
      active: true,
      sortOrder: 1
    }
  });

  for (const app of applicationTypes) {
    const applicationType = await prisma.applicationType.upsert({
      where: { versionId_name: { versionId: defaultVersion.id, name: app.name } },
      update: { active: true, sortOrder: app.sortOrder },
      create: { group: PERMIT_GROUP_PTC, versionId: defaultVersion.id, name: app.name, active: true, sortOrder: app.sortOrder }
    });

    for (const document of app.documents) {
      await prisma.requiredDocument.upsert({
        where: { applicationTypeId_name: { applicationTypeId: applicationType.id, name: document.name } },
        update: { active: true, sortOrder: document.sortOrder },
        create: {
          applicationTypeId: applicationType.id,
          name: document.name,
          active: true,
          sortOrder: document.sortOrder
        }
      });
    }
  }

  for (const [regionName, provincialOffices] of Object.entries(DEFAULT_PROVINCIAL_OFFICES_BY_REGION)) {
    const regionalOffice = await prisma.regionalOffice.upsert({
      where: { group_name: { group: PERMIT_GROUP_PTC, name: regionName } },
      update: { active: true },
      create: { group: PERMIT_GROUP_PTC, name: regionName, active: true, sortOrder: 1 }
    });

    for (const [index, provincialOfficeName] of provincialOffices.entries()) {
      await prisma.provincialOffice.upsert({
        where: { regionalOfficeId_name: { regionalOfficeId: regionalOffice.id, name: provincialOfficeName } },
        update: { active: true, sortOrder: index + 1 },
        create: {
          regionalOfficeId: regionalOffice.id,
          name: provincialOfficeName,
          active: true,
          sortOrder: index + 1
        }
      });
    }
  }
  console.log(`Seeded ${applicationTypes.length} application types and ${applicationTypes.reduce((sum, app) => sum + app.documents.length, 0)} documents into Version: ${defaultVersion.name}.`);
  console.log("Default users: admin@example.com / admin123 and staff@example.com / staff123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
