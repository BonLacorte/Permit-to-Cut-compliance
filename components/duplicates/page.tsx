import Link from "next/link";
import { FeatureKey } from "@prisma/client";
import { requireFeature } from "@/lib/auth";
import { duplicateComparison, duplicateGroupList } from "@/lib/duplicate-review";
import { type PermitGroup } from "@/lib/duplicate-numbers";
import { DuplicateComparison, DuplicateGroupList, type ComparisonRecord } from "@/components/duplicates/review";

export async function DuplicateReviewPage({ group, number }: { group: PermitGroup; number?: string }) {
  await requireFeature(FeatureKey.DUPLICATE_MANAGEMENT);
  const records = number ? await duplicateComparison(group, number) : null;
  return <div className="grid"><div><h1>{group} Duplicate Review</h1><p className="muted">Matches span all Versions, including archived and Uncategorized. Permit-number punctuation and leading zeros are preserved.</p><div className="actions"><Link className="button secondary" href={`/${group.toLowerCase()}/applications`}>Back to Applications</Link>{number && <Link className="button secondary" href={`/${group.toLowerCase()}/applications/duplicates`}>All duplicate groups</Link>}</div></div>
    {records ? records.length >= 2 ? <DuplicateComparison key={number} group={group} records={records as ComparisonRecord[]} /> : <section className="panel">This number no longer has duplicate records. Return to the group list to refresh.</section> : <DuplicateGroupList group={group} groups={await duplicateGroupList(group)} />}
  </div>;
}
