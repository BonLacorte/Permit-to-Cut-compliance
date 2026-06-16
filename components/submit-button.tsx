"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
};

export function SubmitButton({ children, pendingText = "Saving...", className = "button", disabled = false }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? <span className="spinner" aria-hidden="true" /> : null}
      {pending ? pendingText : children}
    </button>
  );
}