// Function map (line numbers include this header):
// 1. Avatar - line 8: Renders or handles this feature.
//
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type AvatarProps = { name: string; src?: string | null; className?: string };

export function Avatar({ name, src, className = "h-11 w-11" }: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [resolvedSource, setResolvedSource] = useState<{
    source: string;
    url: string;
  } | null>(null);
  const directSource =
    src && (/^https?:\/\//i.test(src) || /^\/images\//i.test(src))
      ? src
      : null;
  useEffect(() => {
    let active = true;
    if (!src || directSource || !supabase) return;
    void supabase.storage
      .from("pet-photos")
      .createSignedUrl(src, 3600)
      .then(({ data, error }) => {
        if (active && !error && data?.signedUrl) {
          setResolvedSource({ source: src, url: data.signedUrl });
        }
      });
    return () => {
      active = false;
    };
  }, [directSource, src]);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const resolvedUrl =
    resolvedSource && resolvedSource.source === src ? resolvedSource.url : null;
  const renderedSource =
    directSource || resolvedUrl;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-inner font-heading text-sm ${className}`}
    >
      {renderedSource && failedSource !== renderedSource ? (
        <img
          src={renderedSource}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailedSource(renderedSource)}
        />
      ) : (
        <span aria-label={name}>{initials}</span>
      )}
    </span>
  );
}
