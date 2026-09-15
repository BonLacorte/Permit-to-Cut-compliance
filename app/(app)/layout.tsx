import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ChangePasswordButton } from "@/components/layout/change-password-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { userHasFeature, requireUser } from "@/lib/auth";
import { FeatureKey, Role } from "@prisma/client";
import { routes } from "@/lib/routes";

const ptcNav = [
  ["Dashboard", routes.ptc.dashboard],
  ["Applications", routes.ptc.applications],
  ["Missing Documents", routes.ptcReports.missingDocuments],
  ["Document Summary", routes.ptcReports.documentSummary],
  ["Document Coverage", routes.ptcReports.documentCoverage],
  ["Application Summary", routes.ptcReports.applicationSummary],
  ["Completion Summary", routes.ptcReports.completionSummary],
  ["Document Combinations", routes.ptcReports.documentCombinations]
];

const pttNav = [
  ["Applications", routes.ptt.applications]
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canUseFeesChecker = await userHasFeature(user, FeatureKey.PTC_FEES_CHECKER);
  const ptcLinks = canUseFeesChecker ? [...ptcNav.slice(0, 2), ["RA 8048 Fees Calculator", routes.ptc.feesCalculator], ...ptcNav.slice(2)] : ptcNav;
  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPERADMIN;

  return (
    <AppShell sidebar={
      <>
        <div className="sidebar-user">
          <strong>{user.name}</strong>
          <span>{user.role.toLowerCase()}</span>
          <div className="sidebar-account-actions">
            <ChangePasswordButton />
          </div>
        </div>
        <nav className="nav">
          <div className="nav-group">
            <div className="nav-group-title">PTC</div>
            {ptcLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </div>
          <div className="nav-group">
            <div className="nav-group-title">PTT</div>
            {pttNav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </div>
          {isAdmin ? (
            <div className="nav-group">
              <div className="nav-group-title">Admin</div>
              <Link href={routes.admin.masterData}>Master Data</Link>
              {user.role === Role.SUPERADMIN ? <Link href={routes.admin.users}>Accounts & Access</Link> : null}
            </div>
          ) : null}
          <form action={logoutAction}>
            <SubmitButton className="nav-submit" pendingText="Signing out...">Sign out</SubmitButton>
          </form>
        </nav>
      </>
    }>
      {children}
    </AppShell>
  );
}
