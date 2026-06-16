"use client";

export function BulletList({ items, empty = "None" }: { items: string[]; empty?: string }) {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return <span className="muted">{empty}</span>;

  return (
    <ul className="compact-list">
      {clean.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}