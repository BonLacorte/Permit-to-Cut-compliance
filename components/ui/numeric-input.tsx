"use client";

import type { InputHTMLAttributes } from "react";

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  integer?: boolean;
};

/**
 * A numeric-looking text field avoids browser steppers and wheel-driven value changes.
 * Server actions remain the source of truth for numeric parsing and validation.
 */
export function NumericInput({ integer = false, ...props }: NumericInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      pattern={integer ? "[0-9]*" : "[0-9.,]*"}
      onWheel={(event) => event.currentTarget.blur()}
    />
  );
}
