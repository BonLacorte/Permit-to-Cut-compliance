"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession, requireAdmin, requireUser, setSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parseGroundsWorkbook, parsePtcRecordsWorkbook } from "@/lib/excel";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import { prisma } from "@/lib/prisma";

const createRecordSchema = z.object({
  applicantName: z.string().trim().optional(),
  applicationTypeId: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([])
});

const updateRecordSchema = z.object({
  id: z.string().min(1),
  applicantName: z.string().trim().optional(),
  applicationTypeId: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([]),
  returnTo: z.string().optional()
});

const progressSchema = z.object({
  applicationRecordId: z.string().min(1),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([])
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
  returnTo: z.string().optional()
});

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || undefined;
}

function nullableString(value: FormDataEntryValue | null) {
  return optionalString(value) || null;
}

function nullableInt(value: FormDataEntryValue | null) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function nullableDate(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ptcRecordData(formData: FormData) {
  return {
    ptcNumber: nullableString(formData.get("ptcNumber")),
    dateIssued: nullableDate(formData.get("dateIssued")),
    regionalOffice: nullableString(formData.get("regionalOffice")),
    provincialOffice: nullableString(formData.get("provincialOffice")),
    municipality: nullableString(formData.get("municipality")),
    barangay: nullableString(formData.get("barangay")),
    treesApplied: nullableInt(formData.get("treesApplied")),
    treesApproved: nullableInt(formData.get("treesApproved")),
    seedlingsReplacement: nullableInt(formData.get("seedlingsReplacement"))
  };
}

function safeReturnTo(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value || fallback);
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function withToast(path: string, type: "success" | "error", message: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("toast", type);
  params.set("message", message);
  return `${base}?${params.toString()}`;
}

function redirectWithToast(path: string, type: "success" | "error", message: string): never {
  redirect(withToast(path, type, message));
}

function revalidateReports() {
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/reports/missing-documents");
  revalidatePath("/reports/document-summary");
  revalidatePath("/reports/application-summary");
  revalidatePath("/reports/completion-summary");
  revalidatePath("/reports/document-combinations");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirectWithToast("/login", "error", "Invalid email or password.");
  }

  await setSession(user.id);
  redirectWithToast("/dashboard", "success", "Signed in successfully.");
}

export async function logoutAction() {
  clearSession();
  redirectWithToast("/login", "success", "Signed out successfully.");
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/dashboard");
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
    returnTo
  });

  if (!parsed.success) redirectWithToast(returnTo, "error", "Password must be at least 6 characters.");
  const input = parsed.data;
  if (input.newPassword !== input.confirmPassword) redirectWithToast(returnTo, "error", "New passwords do not match.");

  const account = await prisma.user.findUnique({ where: { id: user.id } });
  if (!account || !(await verifyPassword(input.currentPassword, account.passwordHash))) {
    redirectWithToast(returnTo, "error", "Current password is incorrect.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) }
  });

  clearSession();
  redirectWithToast("/login", "success", "Password changed. Please sign in again.");
}

export async function createRecordAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createRecordSchema.safeParse({
    applicantName: formData.get("applicantName") || undefined,
    applicationTypeId: formData.get("applicationTypeId") || undefined,
    remarks: formData.get("remarks") || undefined,
    documentIds: formData.getAll("documentIds").map(String)
  });
  if (!parsed.success) redirectWithToast("/applications/new", "error", "Could not read the application form.");
  const input = parsed.data;
  const applicationTypeId = input.applicationTypeId || null;

  if (!applicationTypeId && input.documentIds.length > 0) {
    redirectWithToast("/applications/new", "error", "Choose a type of application before selecting documents.");
  }

  let recordId = "";
  try {
    const allowedDocuments = applicationTypeId
      ? await prisma.requiredDocument.findMany({
          where: { applicationTypeId, id: { in: input.documentIds }, active: true, applicationType: { group: PERMIT_GROUP_PTC } }
        })
      : [];

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.applicationRecord.create({
        data: {
          group: PERMIT_GROUP_PTC,
          applicantName: input.applicantName || null,
          applicationTypeId,
          remarks: input.remarks || null,
          ...ptcRecordData(formData),
          createdById: user.id
        }
      });

      if (allowedDocuments.length > 0 || input.remarks) {
        const entry = await tx.progressEntry.create({
          data: { applicationRecordId: created.id, userId: user.id, remarks: input.remarks }
        });
        if (allowedDocuments.length > 0) {
          await tx.progressDocument.createMany({
            data: allowedDocuments.map((doc) => ({
              progressEntryId: entry.id,
              applicationRecordId: created.id,
              requiredDocumentId: doc.id
            })),
            skipDuplicates: true
          });
        }
      }

      await tx.activityLog.create({
        data: { userId: user.id, action: "CREATE_RECORD", targetType: "application_record", targetId: created.id }
      });

      return created;
    });
    recordId = record.id;
  } catch {
    redirectWithToast("/applications/new", "error", "Could not create the application record.");
  }

  revalidateReports();
  redirectWithToast(`/applications/${recordId}`, "success", "Application created.");
}

export async function appendProgressAction(formData: FormData) {
  const user = await requireUser();
  const input = progressSchema.parse({
    applicationRecordId: formData.get("applicationRecordId"),
    remarks: formData.get("remarks") || undefined,
    documentIds: formData.getAll("documentIds").map(String)
  });

  const record = await prisma.applicationRecord.findUnique({
    where: { id: input.applicationRecordId },
    include: { progressDocuments: true }
  });
  if (!record) redirectWithToast("/applications", "error", "Application record was not found.");
  if (!record.applicationTypeId) redirectWithToast(`/applications/${input.applicationRecordId}`, "error", "Choose a type of application before adding progress documents.");

  const existing = new Set(record.progressDocuments.map((doc) => doc.requiredDocumentId));
  const allowedDocuments = await prisma.requiredDocument.findMany({
    where: {
      applicationTypeId: record.applicationTypeId,
      id: { in: input.documentIds },
      active: true
    }
  });
  const newDocumentIds = allowedDocuments.map((doc) => doc.id).filter((id) => !existing.has(id));

  await prisma.$transaction(async (tx) => {
    const entry = await tx.progressEntry.create({
      data: {
        applicationRecordId: input.applicationRecordId,
        userId: user.id,
        remarks: input.remarks
      }
    });

    if (newDocumentIds.length > 0) {
      await tx.progressDocument.createMany({
        data: newDocumentIds.map((requiredDocumentId) => ({
          progressEntryId: entry.id,
          applicationRecordId: input.applicationRecordId,
          requiredDocumentId
        })),
        skipDuplicates: true
      });
    }

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "APPEND_PROGRESS",
        targetType: "application_record",
        targetId: input.applicationRecordId,
        metadata: { documentCount: newDocumentIds.length, ignoredDuplicateCount: input.documentIds.length - newDocumentIds.length }
      }
    });
  });

  revalidateReports();
  revalidatePath(`/applications/${input.applicationRecordId}`);
  redirectWithToast(`/applications/${input.applicationRecordId}`, "success", "Progress saved.");
}

export async function updateApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/applications");
  const parsed = updateRecordSchema.safeParse({
    id: formData.get("id"),
    applicantName: formData.get("applicantName") || undefined,
    applicationTypeId: formData.get("applicationTypeId") || undefined,
    remarks: formData.get("remarks") || undefined,
    documentIds: formData.getAll("documentIds").map(String),
    returnTo
  });
  if (!parsed.success) redirectWithToast(returnTo, "error", "Could not read the application form.");
  const input = parsed.data;
  const applicationTypeId = input.applicationTypeId || null;

  const current = await prisma.applicationRecord.findUnique({ where: { id: input.id } });
  if (!current) redirectWithToast("/applications", "error", "Application record was not found.");
  if (!applicationTypeId && input.documentIds.length > 0) {
    redirectWithToast(returnTo, "error", "Choose a type of application before selecting documents.");
  }

  const requestedDocumentIds = [...new Set(input.documentIds)];
  const allowedDocuments = applicationTypeId
    ? await prisma.requiredDocument.findMany({
        where: {
          applicationTypeId,
          id: { in: requestedDocumentIds },
          active: true,
          applicationType: { group: PERMIT_GROUP_PTC }
        },
        orderBy: { sortOrder: "asc" }
      })
    : [];
  const allowedDocumentIds = new Set(allowedDocuments.map((document) => document.id));
  const invalidDocumentIds = requestedDocumentIds.filter((documentId) => !allowedDocumentIds.has(documentId));
  if (invalidDocumentIds.length > 0) {
    redirectWithToast(returnTo, "error", "One or more submitted files do not belong to the selected application type.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.progressEntry.deleteMany({ where: { applicationRecordId: input.id } });

      await tx.applicationRecord.update({
        where: { id: input.id },
        data: {
          applicantName: input.applicantName || null,
          applicationTypeId,
          remarks: input.remarks || null,
          ...ptcRecordData(formData)
        }
      });

      const entry = await tx.progressEntry.create({
        data: {
          applicationRecordId: input.id,
          userId: user.id,
          remarks: "Submitted files replaced from edit modal"
        }
      });

      if (allowedDocuments.length > 0) {
        await tx.progressDocument.createMany({
          data: allowedDocuments.map((document) => ({
            progressEntryId: entry.id,
            applicationRecordId: input.id,
            requiredDocumentId: document.id
          }))
        });
      }

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_RECORD",
          targetType: "application_record",
          targetId: input.id,
          metadata: {
            applicationTypeChanged: current.applicationTypeId !== applicationTypeId,
            submittedDocumentCount: allowedDocuments.length,
            source: "EDIT_MODAL"
          }
        }
      });
    });
  } catch {
    redirectWithToast(returnTo, "error", "Could not update the application record.");
  }

  revalidateReports();
  revalidatePath(`/applications/${input.id}`);
  redirectWithToast(returnTo, "success", "Application updated.");
}

export async function deleteApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/applications", "error", "Application record id is required.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicationRecord.delete({ where: { id } });
      await tx.activityLog.create({
        data: { userId: user.id, action: "DELETE_RECORD", targetType: "application_record", targetId: id }
      });
    });
  } catch {
    redirectWithToast("/applications", "error", "Could not delete the application record.");
  }

  revalidateReports();
  redirectWithToast("/applications", "success", "Application deleted.");
}

export async function bulkDeleteApplicationRecordsAction(formData: FormData) {
  const admin = await requireAdmin();
  const ids = [...new Set(formData.getAll("applicationRecordIds").map(String).filter(Boolean))];
  if (ids.length === 0) redirectWithToast("/applications", "error", "Select at least one application to delete.");

  const records = await prisma.applicationRecord.findMany({
    where: { id: { in: ids }, group: PERMIT_GROUP_PTC },
    select: { id: true }
  });
  if (records.length !== ids.length) {
    redirectWithToast("/applications", "error", "Some selected applications were already deleted or are not PTC records.");
  }

  const recordIds = records.map((record) => record.id);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicationRecord.deleteMany({ where: { id: { in: recordIds }, group: PERMIT_GROUP_PTC } });
      await tx.activityLog.create({
        data: {
          userId: admin.id,
          action: "BULK_DELETE_RECORDS",
          targetType: "application_record",
          metadata: { deletedCount: recordIds.length, recordIds }
        }
      });
    });
  } catch {
    redirectWithToast("/applications", "error", "Could not delete the selected applications.");
  }

  revalidateReports();
  redirectWithToast("/applications", "success", `Deleted ${recordIds.length} application${recordIds.length === 1 ? "" : "s"}.`);
}

export async function deleteAllApplicationRecordsAction(formData: FormData) {
  const admin = await requireAdmin();
  const confirmation = String(formData.get("confirmation") || "").trim();
  if (confirmation !== "DELETE ALL PTC") {
    redirectWithToast("/applications", "error", "Type DELETE ALL PTC to confirm deleting all applications.");
  }

  let deletedCount = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.applicationRecord.deleteMany({ where: { group: PERMIT_GROUP_PTC } });
      deletedCount = result.count;
      await tx.activityLog.create({
        data: {
          userId: admin.id,
          action: "DELETE_ALL_RECORDS",
          targetType: "application_record",
          metadata: { deletedCount, group: PERMIT_GROUP_PTC }
        }
      });
    });
  } catch {
    redirectWithToast("/applications", "error", "Could not delete all applications.");
  }

  revalidateReports();
  redirectWithToast("/applications", "success", `Deleted all PTC applications (${deletedCount} record${deletedCount === 1 ? "" : "s"}).`);
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "STAFF") === "ADMIN" ? Role.ADMIN : Role.STAFF;
  if (!name || !email || password.length < 6) {
    redirectWithToast("/admin/users", "error", "Name, email, and a 6-character password are required.");
  }

  try {
    await prisma.user.create({
      data: { name, email, role, passwordHash: await hashPassword(password) }
    });
  } catch {
    redirectWithToast("/admin/users", "error", "Could not create the user. The email may already exist.");
  }

  revalidatePath("/admin/users");
  redirectWithToast("/admin/users", "success", "User created.");
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/users", "error", "User id is required.");
  if (id === admin.id) redirectWithToast("/admin/users", "error", "You cannot delete your own account.");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) redirectWithToast("/admin/users", "error", "User was not found.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicationRecord.updateMany({ where: { createdById: id }, data: { createdById: admin.id } });
      await tx.progressEntry.updateMany({ where: { userId: id }, data: { userId: admin.id } });
      await tx.activityLog.updateMany({ where: { userId: id }, data: { userId: admin.id } });
      await tx.user.delete({ where: { id } });
      await tx.activityLog.create({
        data: { userId: admin.id, action: "DELETE_USER", targetType: "user", targetId: id, metadata: { email: target.email } }
      });
    });
  } catch {
    redirectWithToast("/admin/users", "error", "Could not delete the user.");
  }

  revalidatePath("/admin/users");
  revalidateReports();
  redirectWithToast("/admin/users", "success", "User deleted.");
}

export async function createApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirectWithToast("/admin/master-data", "error", "Application type name is required.");

  try {
    const count = await prisma.applicationType.count({ where: { group: PERMIT_GROUP_PTC } });
    await prisma.applicationType.create({ data: { group: PERMIT_GROUP_PTC, name, sortOrder: count + 1 } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not add the application type. It may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  redirectWithToast("/admin/master-data", "success", "Application type added.");
}

export async function createRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const applicationTypeId = String(formData.get("applicationTypeId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!applicationTypeId || !name) redirectWithToast("/admin/master-data", "error", "Application type and document name are required.");

  try {
    const applicationType = await prisma.applicationType.findFirst({ where: { id: applicationTypeId, group: PERMIT_GROUP_PTC } });
    if (!applicationType) redirectWithToast("/admin/master-data", "error", "Application type was not found.");
    const count = await prisma.requiredDocument.count({ where: { applicationTypeId } });
    await prisma.requiredDocument.create({ data: { applicationTypeId, name, sortOrder: count + 1 } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not add the required document. It may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Required document added.");
}

export async function importPtcRecordsAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) redirectWithToast("/admin/master-data", "error", "Upload a PTC Excel file.");

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parsePtcRecordsWorkbook(buffer);
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not read the PTC Excel file.");
  }

  if (parsed.length === 0) redirectWithToast("/admin/master-data", "error", "No PTC rows were found to import.");

  try {
    await prisma.applicationRecord.createMany({
      data: parsed.map((record) => ({
        group: PERMIT_GROUP_PTC,
        createdById: user.id,
        applicantName: record.applicantName || null,
        applicationTypeId: null,
        regionalOffice: record.regionalOffice || null,
        provincialOffice: record.provincialOffice || null,
        ptcNumber: record.ptcNumber || null,
        dateIssued: record.dateIssued || null,
        barangay: record.barangay || null,
        municipality: record.municipality || null,
        treesApplied: record.treesApplied ?? null,
        treesApproved: record.treesApproved ?? null,
        seedlingsReplacement: record.seedlingsReplacement ?? null
      }))
    });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not import the PTC records.");
  }

  revalidateReports();
  redirectWithToast("/admin/master-data", "success", `Imported ${parsed.length} PTC record${parsed.length === 1 ? "" : "s"}.`);
}

export async function importMasterDataAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Upload an Excel file.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseGroundsWorkbook(buffer);

  await prisma.$transaction(async (tx) => {
    for (const app of parsed) {
      const applicationType = await tx.applicationType.upsert({
        where: { group_name: { group: PERMIT_GROUP_PTC, name: app.name } },
        update: { active: true, sortOrder: app.sortOrder },
        create: { group: PERMIT_GROUP_PTC, name: app.name, sortOrder: app.sortOrder }
      });

      for (const doc of app.documents) {
        await tx.requiredDocument.upsert({
          where: { applicationTypeId_name: { applicationTypeId: applicationType.id, name: doc.name } },
          update: { active: true, sortOrder: doc.sortOrder },
          create: { applicationTypeId: applicationType.id, name: doc.name, sortOrder: doc.sortOrder }
        });
      }
    }
  });

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
}

