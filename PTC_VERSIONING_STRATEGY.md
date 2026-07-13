# PTC Versioning Strategy Notes

## Context

The current audit scope covers 2023, 2024, and 2025. The issue is that 2025 uses a different set of required documents for each Type of Application compared with the current master data, which fits 2023 and 2024 only.

This means the system needs a reusable way to separate master-data rules by version, not just by year. A version can represent `2023 and 2024`, `2025`, `2026 to 2028`, or any future naming the office chooses.

## Overall Recommendation

Your version idea is strong. I would implement it as a formal **PTC Master Data Version** system.

Each version should own its own active list of:

- Types of Application
- Required / optional documents under each Type of Application

Each application record should be assigned to exactly one version once categorized. Applications that are not assigned yet should appear under **Uncategorized**.

The biggest recommendation is this: do not make versions only a dashboard/report filter. Make the selected version part of the application record itself. That way, a 2025 application can always be audited against the 2025 document rules even if the current default version later becomes 2026 or 2028.

## What I Like About Your Plan

- It solves the root problem instead of forcing all years into one master-data set.
- It is reusable for future audit periods without changing code every time document requirements change.
- It gives admins control over future versions through the UI.
- It keeps 2023/2024 and 2025 rules from mixing together in reports.
- The **Uncategorized** bucket is important because imported records may not be cleanly assigned yet.
- Bulk assigning versions from the Applications page is the right workflow for already-imported records.

## Main Blind Spots and How To Address Them

### 1. Application records need a saved version, not only a page filter

If the version dropdown only filters reports, the app still does not know which document rules apply to each application.

Recommendation:

- Add a `version` field to each application record.
- Existing records start as Uncategorized or are bulk-assigned.
- When editing an application, the Type of Application dropdown should only show choices for that record's selected version.
- Submitted/missing/complete counts should use the record's saved version.

### 2. Version names should not be treated as actual year rules

A version named `2023 and 2024` might imply dates, but your plan says the name is only a label. That is good.

Recommendation:

- Store version name as a flexible label.
- Optionally add description/notes, such as `Used for 2023-2024 audit records`.
- Do not automatically assign version based on Date Issued unless we later decide to add an optional helper.

### 3. Deleting versions can be risky

If deleting a version deactivates all Types of Application and documents inside it, existing assigned records may become hard to audit or understand.

Recommendation:

- Use **Archive/Deactivate Version** instead of normal delete.
- Archived versions should disappear from new-entry defaults but remain available for existing records and historical reports.
- Only allow permanent delete when no application records are assigned to that version.

### 4. Duplicating master data will be tedious

If 2025 is similar to 2023/2024 but with changed documents, admins should not need to rebuild everything manually.

Recommendation:

- Add **Duplicate Version** or **Clone Version** later.
- Admin can clone `2023 and 2024` into `2025`, then edit only the changed application/document requirements.
- This is safer and faster than manually recreating dozens of rows.

### 5. Reports need clear version context

Every report can become confusing if users forget which version is selected.

Recommendation:

- Put the Version dropdown beside each PTC page title as planned.
- Make the selected version visually obvious.
- For Applications page only, include `Uncategorized` as an option.
- For summary/report pages, decide whether to show Uncategorized or only real versions. I recommend showing Uncategorized too, because uncategorized records are audit work that still needs cleanup.

### 6. Imports need a version assignment strategy

Future Excel imports may include records from different periods.

Recommendation:

- Add a version selector to the import form.
- Imported rows should be assigned to the selected version by default.
- If no version is selected, import as Uncategorized.
- Do not guess version from dates unless a reviewed date-to-version mapping exists.

### 7. Type names might repeat across versions

The same Type of Application name may exist in multiple versions, but with different documents.

Recommendation:

- Allow duplicate Type of Application names across different versions.
- Prevent duplicate Type of Application names inside the same version.
- Required document names should be unique per Type of Application inside a version, but can repeat in other versions.

### 8. Submitted documents from the wrong version need careful handling

If an application changes from one version to another, its selected documents may no longer match the new version's document list.

Recommendation:

- When changing an application's version, reset Type of Application and submitted documents unless the selected type has a clear matching equivalent.
- For bulk version edit, warn that document selections may need review.
- Safer first version: bulk assign version only for records with no Type of Application selected, or allow assignment but mark affected records for manual review.

## Suggested Behavior by Page

### Admin Master Data

Add a Versions section where admins can:

- Create version
- Rename version
- Archive/deactivate version
- Restore archived version
- Permanently delete only unused versions
- Manage Types of Application inside a selected version
- Manage documents inside each Type of Application for that version

Recommended extra feature:

- Clone an existing version into a new version.

### Applications Page

Add Version dropdown near the page title with:

- All versions
- Uncategorized

Add a visible Version column or at least make Version filter obvious.

Bulk Edit should allow selected applications to be assigned to a version.

Recommended bulk edit rules:

- If selected records have no Type of Application, version assignment is straightforward.
- If selected records already have Type of Application/documents, show a warning that the selected application type/documents may not match the new version.
- After version assignment, records whose Type of Application is not available in that version should become Pending or flagged for review.

### New/Edit Application

The form should require or strongly encourage selecting a version first.

Recommended flow:

1. Select Version.
2. Select Type of Application from that version.
3. Select submitted documents from that type/version.

For existing Uncategorized records, show `Uncategorized` until assigned.

### Reports and Dashboard

Add Version dropdown beside each PTC page title:

- Dashboard
- Applications
- Missing Documents
- Document Summary
- Application Summary
- Completion Summary
- Document Combinations

Reports should calculate required/missing/complete based only on the selected version's rules and records assigned to that version.

Recommended default:

- Use the latest active version as default, or remember the user's last selected version in the URL/query string.
- Prefer URL query string like `?version=...` so links are shareable.

## Better Idea: Versioned Rule Sets Instead of Only Versions

A slightly better mental model is **Rule Set Version**.

The name can still be `2023 and 2024` or `2025`, but internally it means:

> This is the set of application types and required/optional document rules used to audit records assigned to it.

This avoids confusion that versions are automatically tied to dates.

Recommended UI label can still be simple:

- `Version`
- or `Document Rule Version`

If users are non-technical, I recommend **Version** in the UI and **Document Rule Version** in documentation/admin help text.

## Recommended Implementation Direction

Phase 1 should focus on correctness and audit safety:

- Add versions.
- Assign application records to versions.
- Scope Type of Application and document choices by version.
- Add version filter to PTC pages.
- Add Uncategorized handling and bulk assignment.

Phase 2 can improve admin efficiency:

- Clone version.
- Import with version selector.
- Archived version management.
- Review warnings for records whose selected documents do not match their assigned version.

Phase 3 can improve reporting and cleanup:

- Version assignment progress dashboard.
- Uncategorized count by year/date issued.
- Optional helper to suggest version based on Date Issued.
- Audit trail for version changes.

## Things I Would Add

- **Clone Version**: very useful for 2025 and future rule changes.
- **Archived Versions**: safer than deleting.
- **Version assignment audit trail**: who changed the record's version and when.
- **Import Version Selector**: prevents future uncategorized cleanup work.
- **Uncategorized cleanup report**: shows records not yet assigned to a version.
- **Validation warning**: tells admin when an application's selected documents do not belong to its assigned version.

## Things I Would Avoid

- Do not merge all documents into one global list and just tag them by year. That will become confusing fast.
- Do not rely only on Date Issued to determine rules. Dates can be blank, wrong, or exceptions.
- Do not hard-delete versions with assigned application records.
- Do not silently change submitted documents when changing versions.
- Do not make version filtering only visual. The application record itself needs to know its version.

## Recommended Product Decision

Proceed with versioning, but define it as a reusable **Document Rule Version** system.

The safest model is:

- A version owns Types of Application.
- Each Type of Application owns its documents inside that version.
- Each application record belongs to one version or Uncategorized.
- Reports calculate status using the record's assigned version.
- Admins can archive old versions, clone versions, and bulk assign applications.

This will support 2023/2024, 2025, and future rule sets without mixing document requirements or rewriting the system each audit cycle.