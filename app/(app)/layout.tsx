import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";

const nav = [
  ["Dashboard", "/dashboard"],
  ["Applications", "/applications"],
  ["Missing Documents", "/reports/missing-documents"],
  ["Document Summary", "/reports/document-summary"],
  ["Application Summary", "/reports/application-summary"],
  ["Completion Summary", "/reports/completion-summary"],
  ["Document Combinations", "/reports/document-combinations"],
  ["Notes", "/notes"]
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Permit-to-Cut Compliance</div>
        <nav className="nav">
          {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          {user.role === "ADMIN" ? (
            <>
              <Link href="/admin/master-data">Master Data</Link>
              <Link href="/admin/users">Users</Link>
            </>
          ) : null}
          <form action={logoutAction}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <strong>{user.name}</strong>
            <div className="muted">{user.role.toLowerCase()}</div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
