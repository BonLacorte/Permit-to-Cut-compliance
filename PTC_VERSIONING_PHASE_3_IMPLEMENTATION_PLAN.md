# PTC Versioning Phase 3 Implementation Plan

## Title

Phase 3: Cleanup Analytics, Date-Based Suggestions, and Version Change Audit Trail

## Summary

Add higher-level cleanup and governance tools after the core Version system is stable. This phase helps admins find Uncategorized records, suggests Versions based on Date Issued without applying them automatically, and records an audit trail when Version assignments change.

Locked product decisions inherited from earlier phases:

- UI label: **Version**.
- Uncategorized appears on all PTC pages.
- Incompatible Version moves reset Type/Documents with a warning.
- Date Issued should not automatically determine Version without review.

## Goals

- Make Uncategorized cleanup measurable and easy to prioritize.
- Provide optional Date Issued-based Version suggestions.
- Track who changed an application record's Version and when.
- Improve audit confidence for future multi-year rule sets.

## Version Assignment Progress Dashboard

Add cleanup metrics to the Dashboard or a dedicated Version cleanup panel.

Metrics:

- Assigned Records.
- Uncategorized Records.
- Records Needing Version Review.
- Records by Version.
- Uncategorized records by Date Issued year.

Interaction:

- Clicking a metric opens Applications filtered to the relevant Version/review state.
- Keep existing dashboard card expand behavior consistent with current UI.

## Uncategorized Cleanup Report

Add a report/table for records not assigned to a Version.

Columns:

- Date Issued.
- PTC Number.
- Applicant Name.
- Regional Office.
- Provincial Office.
- Type of Application text/status.
- Suggested Version, if available.
- Action link to view application.

Filters:

- Date Issued year.
- Regional Office.
- Provincial Office.
- Suggested Version.

Behavior:

- Table rows link to `/applications/[id]`.
- Bulk select can hand off to the existing bulk assign Version action.

## Date-Based Version Suggestions

Add optional suggestion rules. These are helper rules only, not automatic assignment.

Suggested model:

- `PtcVersionDateRule`
  - `id`
  - `versionId`
  - `startDate`, nullable
  - `endDate`, nullable
  - `active`, default `true`
  - `createdAt`
  - `updatedAt`

Admin behavior:

- Admin can define date ranges for a Version.
- Ranges may be open-ended if needed.
- Overlapping active date rules should be blocked to avoid conflicting suggestions.

Suggestion behavior:

- If a record is Uncategorized and Date Issued falls inside one active range, show that Version as Suggested Version.
- If no range matches, show blank.
- If Date Issued is blank, show blank.
- Do not auto-assign; admin must apply manually or through bulk assignment.

Recommended initial rules:

- `2023 and 2024`: 2023-01-01 to 2024-12-31.
- `2025`: 2025-01-01 to 2025-12-31.

Only add those if the user/admin confirms they match the real audit rules.

## Version Change Audit Trail

Add logging for Version assignment changes.

Minimum audit metadata:

- Application record id.
- Previous Version id/name or Uncategorized.
- New Version id/name or Uncategorized.
- Whether Type of Application was reset.
- Number of submitted document selections cleared.
- User who made the change.
- Timestamp.

Implementation options:

- Prefer using existing `ActivityLog` with structured JSON metadata.
- Only add a dedicated table if ActivityLog becomes too limited.

UI display:

- Application detail page Progress History or a separate Activity section shows Version changes.
- Bulk assignment creates one activity entry per affected application record.

## Report Enhancements

Add Version context to exports:

- Application export includes Version.
- Missing Documents export includes Version.
- Summary exports include selected Version in the sheet title or metadata row.

Add cleanup-oriented exports:

- Export Uncategorized records.
- Export Records Needing Version Review.

## Test Plan

Unit tests:

- Uncategorized cleanup metrics count assigned vs unassigned records correctly.
- Date rule suggestions return the expected Version for Date Issued.
- Blank Date Issued returns no suggestion.
- Overlapping active date rules are blocked.
- Version change activity metadata records previous/new Version and reset counts.

Integration/build checks:

- `npx prisma migrate dev` if adding date rules.
- `npm run test`.
- `npm run build`.

Manual browser checks:

- Dashboard or cleanup report shows Uncategorized counts.
- Date-based suggestions appear but do not auto-assign records.
- Bulk assigning suggested records writes activity logs.
- Application detail page shows Version change history.
- Exports include Version context.

## Acceptance Criteria

- Admins can clearly see how many records still need Version assignment.
- Date Issued helps suggest cleanup targets without silently changing records.
- Version assignment changes are traceable for audit purposes.
- Exports preserve the Version context used for report calculations.

## Assumptions

- Suggestions are advisory only.
- Version assignment remains a deliberate user action.
- Existing `ActivityLog` should be used for Version change history unless implementation proves it insufficient.
- Date ranges are optional and must be reviewed before production use.