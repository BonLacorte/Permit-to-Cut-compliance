import { createUserAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { UsersTable } from "@/components/users-table";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const currentUser = await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="grid">
      <div>
        <h1>Users</h1>
        <p className="muted">Admins manage user access; staff can manage application progress.</p>
      </div>
      <section className="panel">
        <form action={createUserAction} className="form">
          <div className="grid cols-2">
            <div className="field"><label>Name</label><input name="name" required /></div>
            <div className="field"><label>Email</label><input name="email" type="email" required /></div>
            <div className="field"><label>Password</label><input name="password" type="password" minLength={6} required /></div>
            <div className="field">
              <label>Role</label>
              <select name="role" defaultValue="STAFF">
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <SubmitButton pendingText="Creating user...">Create User</SubmitButton>
        </form>
      </section>
      <UsersTable
        currentUserId={currentUser.id}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toLocaleDateString()
        }))}
      />
    </div>
  );
}