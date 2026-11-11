// Function map (line numbers include this header):
// 1. StatusChip - line 11: Renders or handles this feature.
//
const tones = {
  neutral: "bg-status-neutral text-text-primary",
  rose: "bg-status-rose text-text-primary",
  scheduled: "bg-status-neutral text-text-primary",
  medication: "bg-status-neutral text-text-primary",
} as const;

export function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: keyof typeof tones;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {tone === "scheduled" && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-status-scheduled"
        />
      )}
      {tone === "medication" && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-status-medication"
        />
      )}
      {label}
    </span>
  );
}
