import { loginAction } from "@/app/actions";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="login">
      <section className="panel">
        <h1>Grounds Compliance</h1>
        <p className="muted">Sign in to manage permit-to-cut document progress.</p>
        {searchParams.error ? <p style={{ color: "var(--danger)" }}>{searchParams.error}</p> : null}
        <form action={loginAction} className="form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" defaultValue="admin@example.com" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" defaultValue="admin123" required />
          </div>
          <button className="button" type="submit">Sign in</button>
        </form>
        <p className="muted">Seed users: admin@example.com / admin123, staff@example.com / staff123</p>
      </section>
    </main>
  );
}
