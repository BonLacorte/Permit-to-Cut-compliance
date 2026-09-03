"use client";

import { useState } from "react";
import { deleteUserAction, resetUserPasswordAction, updateUserFeatureAccessAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  features: string[];
};

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);

  return (
    <>
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Feature Access</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    {user.role === "SUPERADMIN" ? <span className="badge ok">All checker features</span> : null}
                    {user.role === "ADMIN" ? (
                      <form action={updateUserFeatureAccessAction} className="inline-edit-form">
                        <input type="hidden" name="userId" value={user.id} />
                        <label className="checkbox-row"><input name="ptcFeesChecker" type="checkbox" defaultChecked={user.features.includes("PTC_FEES_CHECKER")} />PTC Fees</label>
                        <label className="checkbox-row"><input name="ptcValidityChecker" type="checkbox" defaultChecked={user.features.includes("PTC_VALIDITY_CHECKER")} />PTC Validity</label>
                        <label className="checkbox-row"><input name="pttFeesChecker" type="checkbox" defaultChecked={user.features.includes("PTT_FEES_CHECKER")} />PTT Fees</label>
                        <label className="checkbox-row"><input name="pttValidityChecker" type="checkbox" defaultChecked={user.features.includes("PTT_VALIDITY_CHECKER")} />PTT Validity</label>
                        <label className="checkbox-row"><input name="pttVehicleCapacityChecker" type="checkbox" defaultChecked={user.features.includes("PTT_VEHICLE_CAPACITY_CHECKER")} />PTT Vehicle Capacity</label>
                        <SubmitButton className="button secondary" pendingText="Saving...">Save</SubmitButton>
                      </form>
                    ) : null}
                    {user.role === "STAFF" ? <span className="muted">Not available for Staff</span> : null}
                  </td>
                  <td>{user.createdAt}</td>
                  <td>
                    <div className="actions compact-actions">
                      <button className="button secondary" type="button" onClick={() => setResetting(user)}>Reset Password</button>
                      <button className="button danger" type="button" disabled={isSelf || user.role === "SUPERADMIN"} onClick={() => setDeleting(user)}>
                        {isSelf ? "Current User" : user.role === "SUPERADMIN" ? "Protected" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? <tr><td colSpan={6}>No users found.</td></tr> : null}
          </tbody>
        </table>
      </section>

      {resetting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal compact-modal">
            <h2>Reset Password</h2>
            <p>Set a new password for <strong>{resetting.name}</strong> ({resetting.email}).</p>
            <form action={resetUserPasswordAction} className="form" onSubmit={() => setResetting(null)}>
              <input type="hidden" name="userId" value={resetting.id} />
              <div className="field"><label>New Password</label><input name="newPassword" type="password" minLength={6} required /></div>
              <div className="field"><label>Confirm Password</label><input name="confirmPassword" type="password" minLength={6} required /></div>
              <div className="actions">
                <SubmitButton pendingText="Resetting...">Reset Password</SubmitButton>
                <button className="button secondary" type="button" onClick={() => setResetting(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal compact-modal">
            <h2>Delete User</h2>
            <p>Delete <strong>{deleting.name}</strong>? Existing application records and activity will be reassigned to your admin account.</p>
            <form action={deleteUserAction} className="actions" onSubmit={() => setDeleting(null)}>
              <input type="hidden" name="id" value={deleting.id} />
              <SubmitButton className="button danger" pendingText="Deleting...">Delete</SubmitButton>
              <button className="button secondary" type="button" onClick={() => setDeleting(null)}>Cancel</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
