"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { changeOwnPasswordAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Change Password</button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal compact-modal">
            <h2>Change Password</h2>
            <p className="warning-text">After changing your password, you will be signed out and must log in again.</p>
            <form action={changeOwnPasswordAction} className="form">
              <input type="hidden" name="returnTo" value={pathname} />
              <div className="field">
                <label htmlFor="currentPassword">Current password</label>
                <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
              </div>
              <div className="field">
                <label htmlFor="newPassword">New password</label>
                <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={6} required />
              </div>
              <div className="field">
                <label htmlFor="confirmPassword">Confirm new password</label>
                <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required />
              </div>
              <div className="actions">
                <SubmitButton pendingText="Changing password...">Change Password and Sign Out</SubmitButton>
                <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}