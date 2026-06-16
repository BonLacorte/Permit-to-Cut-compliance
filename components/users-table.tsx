"use client";

import { useState } from "react";
import { deleteUserAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  return (
    <>
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.createdAt}</td>
                  <td>
                    <button className="button danger" type="button" disabled={isSelf} onClick={() => setDeleting(user)}>
                      {isSelf ? "Current User" : "Delete"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? <tr><td colSpan={5}>No users found.</td></tr> : null}
          </tbody>
        </table>
      </section>

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