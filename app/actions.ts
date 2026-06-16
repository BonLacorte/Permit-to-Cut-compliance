"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession, requireAdmin, requireUser, setSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parseGroundsWorkbook } from "@/lib/excel";
import { prisma } from "@/lib/prisma";

const createRecordSchema = z.object({
  applicantName: z.string().trim().min(1),
  applicationTypeId: z.string().min(1),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([])
});


const updateRecordSchema = z.object({
  id: z.string().min(1),
  applicantName: z.string().trim().min(1),
  applicationTypeId: z.string().min(1),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([])
});
const progressSchema = z.object({
  applicationRecordId: z.string().min(1),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([])
});

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=Invalid%20email%20or%20password");
  }

  await setSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  clearSession();
  redirect("/login");
}

export async function createRecordAction(formData: FormData) {
  const user = await requireUser();
  const input = createRecordSchema.parse({
    applicantName: formData.get("applicantName"),
    applicationTypeId: formData.get("applicationTypeId"),
    remarks: formData.get("remarks") || undefined,
    documentIds: formData.getAll("documentIds").map(String)
  });

  const allowedDocuments = await prisma.requiredDocument.findMany({
    where: { applicationTypeId: input.applicationTypeId, id: { in: input.documentIds }, active: true }
  });

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.applicationRecord.create({
      data: {
        applicantName: input.applicantName,
        applicationTypeId: input.applicationTypeId,
        remarks: input.remarks,
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

    return created;
  });

  await prisma.activityLog.create({
    data: { userId: user.id, action: "CREATE_RECORD", targetType: "application_record", targetId: record.id }
  });

  revalidatePath("/applications");
  redirect(`/applications/${record.id}`);
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
  if (!record) throw new Error("Application record not found.");

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

  revalidatePath(`/applications/${input.applicationRecordId}`);
  revalidatePath("/dashboard");
}


export async function updateApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const input = updateRecordSchema.parse({
    id: formData.get("id"),
    applicantName: formData.get("applicantName"),
    applicationTypeId: formData.get("applicationTypeId"),
    remarks: formData.get("remarks") || undefined,
    documentIds: formData.getAll("documentIds").map(String)
  });

  const current = await prisma.applicationRecord.findUnique({ where: { id: input.id } });
  if (!current) throw new Error("Application record not found.");

  const requestedDocumentIds = [...new Set(input.documentIds)];
  const allowedDocuments = await prisma.requiredDocument.findMany({
    where: {
      applicationTypeId: input.applicationTypeId,
      id: { in: requestedDocumentIds },
      active: true
    },
    orderBy: { sortOrder: "asc" }
  });
  const allowedDocumentIds = new Set(allowedDocuments.map((document) => document.id));
  const invalidDocumentIds = requestedDocumentIds.filter((documentId) => !allowedDocumentIds.has(documentId));
  if (invalidDocumentIds.length > 0) {
    throw new Error("One or more submitted files do not belong to the selected application type.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.progressEntry.deleteMany({ where: { applicationRecordId: input.id } });

    await tx.applicationRecord.update({
      where: { id: input.id },
      data: {
        applicantName: input.applicantName,
        applicationTypeId: input.applicationTypeId,
        remarks: input.remarks
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
          applicationTypeChanged: current.applicationTypeId !== input.applicationTypeId,
          submittedDocumentCount: allowedDocuments.length,
          source: "EDIT_MODAL"
        }
      }
    });
  });

  revalidatePath("/applications");
  revalidatePath(`/applications/${input.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/missing-documents");
  revalidatePath("/document-summary");
  revalidatePath("/application-summary");
  revalidatePath("/completion-summary");
  revalidatePath("/document-combinations");
}

export async function deleteApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Application record id is required.");

  await prisma.$transaction(async (tx) => {
    await tx.applicationRecord.delete({ where: { id } });
    await tx.activityLog.create({
      data: { userId: user.id, action: "DELETE_RECORD", targetType: "application_record", targetId: id }
    });
  });

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  redirect("/applications");
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "STAFF") === "ADMIN" ? Role.ADMIN : Role.STAFF;
  if (!name || !email || password.length < 6) throw new Error("Name, email, and a 6-character password are required.");

  await prisma.user.create({
    data: { name, email, role, passwordHash: await hashPassword(password) }
  });

  revalidatePath("/admin/users");
}

export async function createApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Application type name is required.");
  const count = await prisma.applicationType.count();
  await prisma.applicationType.create({ data: { name, sortOrder: count + 1 } });
  revalidatePath("/admin/master-data");
}

export async function createRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const applicationTypeId = String(formData.get("applicationTypeId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!applicationTypeId || !name) throw new Error("Application type and document name are required.");
  const count = await prisma.requiredDocument.count({ where: { applicationTypeId } });
  await prisma.requiredDocument.create({ data: { applicationTypeId, name, sortOrder: count + 1 } });
  revalidatePath("/admin/master-data");
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
        where: { name: app.name },
        update: { active: true, sortOrder: app.sortOrder },
        create: { name: app.name, sortOrder: app.sortOrder }
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