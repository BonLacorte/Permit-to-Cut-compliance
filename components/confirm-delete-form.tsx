"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

type HiddenField = {
  name: string;
  value: string;
};

export function ConfirmDeleteForm({
  action,
  fields,
  triggerText,
  pendingText = "Deleting...",
  title,
  message,
  confirmText = "Delete",
  triggerClassName = "button danger",
  submitClassName = "button danger"
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: HiddenField[];
  triggerText: string;
  pendingText?: string;
  title: string;
  message: string;
  confirmText?: string;
  triggerClassName?: string;
  submitClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={triggerClassName} type="button" onClick={() => setOpen(true)}>{triggerText}</button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal compact-modal">
            <h2>{title}</h2>
            <p>{message}</p>
            <form action={action} className="actions" onSubmit={() => setOpen(false)}>
              {fields.map((field) => <input key={field.name} type="hidden" name={field.name} value={field.value} />)}
              <SubmitButton className={submitClassName} pendingText={pendingText}>{confirmText}</SubmitButton>
              <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}