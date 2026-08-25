import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { ChangePasswordButton } from "@/components/change-password-button";
import { SubmitButton } from "@/components/submit-button";
import { userHasFeature, requireUser } from "@/lib/auth";
import { FeatureKey, Role } from "@prisma/client";

const ptcNav = [
  ["Dashboard", "/dashboard"],
  ["Applications", "/applications"],
  ["Missing Documents", "/reports/missing-documents"],
  ["Document Summary", "/reports/document-summary"],
  ["Document Coverage", "/reports/document-coverage"],
  ["Application Summary", "/reports/application-summary"],
  ["Completion Summary", "/reports/completion-summary"],
  ["Document Combinations", "/reports/document-combinations"]
];

const pttNav = [
  ["Applications", "/ptt/applications"]
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canUseFeesChecker = await userHasFeature(user, FeatureKey.PTC_FEES_CHECKER);
  const ptcLinks = canUseFeesChecker ? [...ptcNav.slice(0, 2), ["RA 8048 Fees Calculator", "/ptc/fees-calculator"], ...ptcNav.slice(2)] : ptcNav;
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
              <Link href="/admin/master-data">Master Data</Link>
              {user.role === Role.SUPERADMIN ? <Link href="/admin/users">Accounts & Access</Link> : null}
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
