import type { ReactNode } from 'react';
export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="fieldset gap-2">
      <span className="label text-base-content font-medium">{label}</span>
      {children}
    </label>
  );
}
