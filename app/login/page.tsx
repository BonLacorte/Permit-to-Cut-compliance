import { loginAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage() {
  return (
    <main className="login">
      <section className="panel">
        <h1>Grounds Compliance</h1>
        <p className="muted">Sign in to manage permit-to-cut document progress.</p>
        <form action={loginAction} className="form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>
        </form>
      </section>
    </main>
  );
}