import type { LucideIcon } from 'lucide-react';

type StatCardProps = { icon: LucideIcon; label: string; value: string | number; hint?: string };

export function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
  return (
    <article className="panel flex items-start gap-3 p-5">
      <span className="rounded-xl bg-surface-inner p-2.5"><Icon aria-hidden size={19} strokeWidth={1.5} /></span>
      <div>
        <p className="font-heading text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-sm">{label}</p>
        {hint && <p className="mt-1.5 text-xs text-text-muted">{hint}</p>}
      </div>
    </article>
  );
}
