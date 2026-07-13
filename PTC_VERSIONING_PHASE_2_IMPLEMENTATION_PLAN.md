# PTC Versioning Phase 2 Implementation Plan

## Title

Phase 2: Admin Efficiency, Cloning, Imports, and Archived Version Management

## Summary

Build on Phase 1 by making Version management efficient and safer for real operations. Add Clone Version, import-time Version selection, stronger archived Version workflows, and review warnings for records whose selected Type/Documents no longer match their assigned Version.

Locked product decisions inherited from Phase 1:

- UI label: **Version**.
- Uncategorized appears on all PTC pages.
- Incompatible Version moves reset Type/Documents with a warning.

## Goals

- Let admins quickly create future Versions by cloning an existing Version.
- Ensure imported records are assigned to the correct Version at import time.
- Improve archived/deactivated Version management.
- Add review signals for records needing Version cleanup.

## Clone Version Feature

Add **Clone Version** action in Admin Master Data.

Clone form fields:

- Source Version.
- New Version name.
- Optional description.

Clone behavior:

- Creates a new active Version.
- Copies active Types of Application from source Version.
- Copies active Required Documents under each copied Type of Application.
- Preserves document `optional` values.
- Preserves sort order.
- Does not copy Application Records.
- Does not copy inactive/deactivated Types or Documents.

Validation:

- New Version name must be unique within group `PTC`.
- Source Version must exist.
- Clone should be transactional: if any copy fails, no partial Version remains.

Recommended first production use:

- Clone `2023 and 2024` into `2025`.
- Admin edits only the changed 2025 Types/Documents.

## Import Version Selector

Update PTC Excel import UI in Admin Master Data:

- Add a Version dropdown above the import file input.
- Options include active Versions and Uncategorized.
- Default should be Uncategorized unless a Version is explicitly selected.

Import behavior:

- All imported records receive the selected Version.
- If Version is Uncategorized, imported records have `versionId = null`.
- Type of Application matching should only search inside the selected Version.
- If imported Type of Application is not found inside selected Version, store the record as Pending/blank Type of Application and preserve raw metadata fields.
- Do not guess Version from Date Issued.

Post-import feedback:

- Show count imported.
- Show count assigned to selected Version.
- Show count with unmatched Type of Application.
- Show count left Uncategorized.

## Archived Version Management

Strengthen Deactivated Data behavior for Versions:

- Deactivated Versions appear in Deactivated Data.
- Restore sets `active: true`.
- Permanent delete is allowed only when:
  - no Application Records are assigned;
  - no Application Types remain under the Version;
  - or the delete flow explicitly deletes unused copied master data first.

Archived Version behavior:

- Existing records assigned to archived Versions still render correctly in application detail pages and reports.
- Archived Versions are hidden from new application defaults.
- Archived Versions are still available as historical report filters under a separate `Archived Versions` group in the dropdown.

## Version Review Warnings

Add a lightweight review signal for records whose data does not match their assigned Version.

A record needs review when:

- It has a Version but no Type of Application.
- It has a Type of Application that belongs to a different Version.
- It has submitted document ids that do not belong to its assigned Version/Type.

UI behavior:

- Applications table shows a **Needs Version Review** badge.
- Application detail page shows a warning panel with a short explanation.
- Edit form guides the user to select a valid Version and Type of Application.

No new status value is required in Phase 2; keep existing `Pending`, `Incomplete`, and `Complete` status rules.

## Bulk Assignment Improvements

Enhance Phase 1 bulk Version assignment:

- Show preview counts before applying:
  - selected records;
  - records already compatible;
  - records that will reset Type/Documents;
  - records that will become Uncategorized.
- Require confirmation when any reset will occur.
- After assignment, show a success toast with reset count.

## Test Plan

Unit tests:

- Clone Version copies active Types/Documents and optional flags.
- Clone Version does not copy inactive Types/Documents.
- Clone Version does not copy Application Records.
- Import assigns selected Version to all imported records.
- Import as Uncategorized leaves `versionId` null.
- Version review detection flags mismatched Type/Documents.

Integration/build checks:

- `npx prisma migrate dev` if schema changes are needed.
- `npm run test`.
- `npm run build`.

Manual browser checks:

- Clone `2023 and 2024` into a test Version.
- Edit cloned documents without changing source Version.
- Import a test workbook into a selected Version.
- Archive and restore a Version.
- Verify archived Version records still display and report correctly.
- Bulk assign records and confirm reset warning appears when needed.

## Acceptance Criteria

- Admins can create a new Version from an existing Version in one workflow.
- Imports no longer create large Uncategorized batches accidentally when the correct Version is known.
- Archived Versions remain usable for history but do not clutter new entry defaults.
- Mismatched records are visible for cleanup.

## Assumptions

- Clone Version is an admin-only action.
- Import should not auto-detect Version from Date Issued.
- Archived Versions should remain reportable for historical audit review.
- Version review warnings are informational and do not add a new application status.