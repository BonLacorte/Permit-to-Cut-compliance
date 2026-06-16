import { createUserAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  await requireAdmin();
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
          <button className="button" type="submit">Create User</button>
        </form>
      </section>
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
