import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { ChangePasswordButton } from "@/components/change-password-button";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";

const nav = [
  ["Dashboard", "/dashboard"],
  ["Applications", "/applications"],
  ["Missing Documents", "/reports/missing-documents"],
  ["Document Summary", "/reports/document-summary"],
  ["Application Summary", "/reports/application-summary"],
  ["Completion Summary", "/reports/completion-summary"],
  ["Document Combinations", "/reports/document-combinations"]
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-user">
          <strong>{user.name}</strong>
          <span>{user.role.toLowerCase()}</span>
          <div className="sidebar-account-actions">
            <ChangePasswordButton />
          </div>
        </div>
        <nav className="nav">
          {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          {user.role === "ADMIN" ? (
            <>
              <Link href="/admin/master-data">Master Data</Link>
              <Link href="/admin/users">Users</Link>
            </>
          ) : null}
          <form action={logoutAction}>
            <SubmitButton className="nav-submit" pendingText="Signing out...">Sign out</SubmitButton>
          </form>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}