// Function map (line numbers include this header):
// 1. Avatar - line 8: Renders or handles this feature.
//
import { useState } from "react";

type AvatarProps = { name: string; src?: string | null; className?: string };

export function Avatar({ name, src, className = "h-11 w-11" }: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-inner font-heading text-sm ${className}`}
    >
      {src && failedSource !== src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <span aria-label={name}>{initials}</span>
      )}
    </span>
  );
}
