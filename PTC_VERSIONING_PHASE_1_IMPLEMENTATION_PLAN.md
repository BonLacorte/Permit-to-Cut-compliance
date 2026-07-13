# PTC Versioning Phase 1 Implementation Plan

## Title

Phase 1: Core Versioning, Assignment, and Version-Scoped Audits

## Summary

Implement the core **Version** system so PTC application records can be audited against the correct version-specific Type of Application and document requirements. This phase prioritizes audit correctness and data safety for 2023/2024, 2025, and future rule versions.

Locked product decisions:

- UI label: **Version**.
- Documentation/admin meaning: Document Rule Version.
- **Uncategorized** appears on all PTC pages, not only Applications.
- Moving an application to an incompatible version will **reset and warn**.

## Goals

- Create reusable PTC Versions such as `2023 and 2024`, `2025`, or future labels.
- Assign each PTC application record to one Version, or leave it as Uncategorized.
- Scope Types of Application and Required Documents by Version.
- Ensure dashboard/reports calculate required, submitted, missing, and status using the selected Version rules.
- Add bulk Version assignment for existing applications.

## Data Model Changes

Add a new model for PTC Versions:

- `PtcVersion`
  - `id`
  - `group`, default `PTC`
  - `name`
  - `description`, nullable
  - `active`, default `true`
  - `sortOrder`, default `0`
  - `createdAt`
  - `updatedAt`

Update existing models:

- `ApplicationType`
  - Add `versionId` relation to `PtcVersion`.
  - Change uniqueness from global group/name to version/name, so the same Type of Application name can exist in different Versions.
  - Keep `group` for compatibility with existing PTC/PTT separation.
- `ApplicationRecord`
  - Add nullable `versionId` relation to `PtcVersion`.
  - Null means **Uncategorized**.
  - Add index on `versionId`.

Migration defaults:

- Create an initial active Version named `2023 and 2024`.
- Assign all existing active/inactive PTC Application Types to this initial Version.
- Leave existing Application Records as Uncategorized unless a separate reviewed bulk assignment is performed.
- Do not infer version from `dateIssued` in Phase 1.

## Admin Master Data Changes

Add a **Versions** section to Admin Master Data:

- Create Version with name and optional description.
- Rename Version.
- Deactivate/archive Version.
- Restore inactive Version from Deactivated Data.
- Permanently delete only if no Application Records and no Application Types are assigned.

Update Type of Application and Type of Document management:

- Admin must select a Version before managing Types of Application.
- Types of Application list only shows rows for the selected Version.
- Documents remain nested under their Type of Application.
- Optional document flag remains unchanged.
- Same Type of Application name is allowed in different Versions but blocked within the same Version.
- Same document name is allowed in different Versions but blocked within the same Type of Application.

## Application Form Changes

New/Edit Application flow:

1. Select Version.
2. Select Type of Application from that Version.
3. Select submitted documents for that Type of Application.

Behavior rules:

- If Version is Uncategorized, Type of Application should be blank/disabled and the record remains Pending.
- When Version changes and the current Type of Application does not belong to the new Version:
  - Clear Type of Application.
  - Clear submitted documents.
  - Show a warning message explaining that incompatible choices were reset.
- When Type of Application changes, keep existing behavior of resetting submitted document selections.

## Applications Page Changes

Add a Version dropdown beside the page title.

Dropdown options:

- Active Versions.
- Uncategorized.

Filtering behavior:

- Selecting a Version shows only applications assigned to that Version.
- Selecting Uncategorized shows applications where `versionId` is null.
- If no query parameter is provided, default to the latest active Version by sort order/name, unless no active Version exists.

Table changes:

- Add a visible **Version** column.
- Keep existing application columns and actions.

Bulk Edit:

- Add bulk action: **Assign Version**.
- User selects target Version or Uncategorized.
- If all selected records have no Type of Application, assign directly.
- If any selected records have Type/Application documents that do not belong to the target Version, show a confirmation warning.
- On confirm, assign Version and reset incompatible Type of Application/documents.
- Recompute affected statuses from the new Version context.

## Reports and Dashboard Changes

Add a Version dropdown beside the PTC page title on:

- Dashboard
- Applications
- Missing Documents
- Document Summary
- Application Summary
- Completion Summary
- Document Combinations

Dropdown options:

- Active Versions.
- Uncategorized.

URL behavior:

- Use `?version=<versionId>` for real Versions.
- Use `?version=uncategorized` for Uncategorized.
- Do not use client-only state; links must be shareable.

Report behavior:

- Selected Version filters application records to that Version.
- Uncategorized filters application records where `versionId` is null.
- Required document rules come from the selected Version only.
- Missing/submitted/complete counts use active non-optional documents in the selected Version.
- Optional documents remain selectable and visible in selected document lists but do not count toward requirements.

## Existing Data Handling

Recommended rollout sequence:

1. Deploy schema and UI changes.
2. Initial `2023 and 2024` Version exists with current master data.
3. Admin creates `2025` Version manually in Phase 1, or waits for Phase 2 Clone Version.
4. Admin bulk assigns application records after reviewing the correct target Version.

Do not automatically assign records by date in Phase 1.

## Test Plan

Unit tests:

- Uncategorized application has Pending status and zero required/missing documents.
- Application assigned to Version A uses Version A required documents.
- Application assigned to Version B ignores Version A documents, even when names overlap.
- Optional documents are still excluded from required/missing counts inside a Version.
- Duplicate Type of Application names are allowed across Versions but blocked within one Version.

Integration/build checks:

- `npx prisma migrate dev` locally.
- `npm run test`.
- `npm run build`.

Manual browser checks:

- Admin creates/renames/deactivates/restores Version.
- Admin creates same Type of Application name in two Versions.
- New Application only shows Types/Documents for selected Version.
- Bulk assign applications to a Version.
- Dashboard and reports update when changing Version dropdown.
- Uncategorized records appear on all PTC pages.

## Acceptance Criteria

- The system can represent separate `2023 and 2024` and `2025` document rule sets.
- Existing records can be assigned to a Version without direct SQL.
- Reports no longer mix document requirements from different Versions.
- Uncategorized records remain visible and actionable.
- Changing to an incompatible Version resets Type/Documents with a warning.

## Assumptions

- UI uses the label **Version**.
- Version names are flexible labels and are not automatically tied to Date Issued.
- Uncategorized means `ApplicationRecord.versionId` is null.
- Hard delete of Versions is blocked when application records or master data are attached.