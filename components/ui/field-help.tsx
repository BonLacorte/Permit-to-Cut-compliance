"use client";

type FieldHelpProps = {
  label: string;
  text: string;
};

export function FieldHelp({ label, text }: FieldHelpProps) {
  return (
    <span
      aria-label={label}
      role="img"
      style={{
        alignItems: "center",
        background: "#e2e8f0",
        borderRadius: "999px",
        color: "#0f172a",
        cursor: "help",
        display: "inline-flex",
        fontSize: "0.75rem",
        fontWeight: 700,
        height: "1.25rem",
        justifyContent: "center",
        marginLeft: "0.35rem",
        width: "1.25rem"
      }}
      title={text}
    >
      ?
    </span>
  );
}
