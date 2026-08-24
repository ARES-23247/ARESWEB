import React, { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/api";

type ImageProps = Omit<React.ComponentProps<"img">, "src"> & {
  src?: string | null;
};

export function isAuthenticatedMediaUrl(value: unknown): value is string {
  return typeof value === "string"
    && value.startsWith("/api/")
    && (value.split("/").includes("admin")
      || value.startsWith("/api/photos/public/content/"));
}

export function adminMediaFallbackUrl(value: string): string | null {
  const match = value.match(
    /^\/api\/photos\/public\/content\/(?:posts|docs|documents)\/[A-Za-z0-9_-]{1,300}\/([A-Za-z0-9_-]{1,300})\/(original|medium|thumbnail)$/u,
  );
  return match ? `/api/photos/admin/media/${match[1]}/${match[2]}` : null;
}

async function loadImageBlob(url: string): Promise<Blob> {
  const response = await authenticatedFetch(url);
  if (!response.ok) {
    const fallback = response.status === 404 ? adminMediaFallbackUrl(url) : null;
    if (!fallback) throw new Error(`Protected image request failed with HTTP ${response.status}.`);
    const fallbackResponse = await authenticatedFetch(fallback);
    if (!fallbackResponse.ok) {
      throw new Error(`Protected image request failed with HTTP ${fallbackResponse.status}.`);
    }
    const fallbackType = fallbackResponse.headers.get("content-type") || "";
    if (!fallbackType.startsWith("image/")) throw new Error("Protected media response was not an image.");
    return fallbackResponse.blob();
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error("Protected media response was not an image.");
  return response.blob();
}

export default function AuthenticatedImage({
  src,
  alt = "",
  className,
  ...props
}: ImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(
    src && !isAuthenticatedMediaUrl(src) ? src : null,
  );
  const [state, setState] = useState<"loading" | "ready" | "error">(
    src && isAuthenticatedMediaUrl(src) ? "loading" : src ? "ready" : "error",
  );

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      setState("error");
      return;
    }
    if (!isAuthenticatedMediaUrl(src)) {
      setResolvedSrc(src);
      setState("ready");
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setResolvedSrc(null);
    setState("loading");
    void loadImageBlob(src)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setResolvedSrc(objectUrl);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!resolvedSrc) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-black/30 text-center text-xs text-marble/60 ${className || ""}`}
        role={alt ? "img" : undefined}
        aria-label={alt ? (state === "error" ? `${alt} (image unavailable)` : `${alt} (loading)`) : undefined}
        aria-hidden={alt ? undefined : true}
        aria-busy={state === "loading" || undefined}
        data-media-state={state}
      >
        {alt && state === "error" ? "Image unavailable" : null}
      </span>
    );
  }

  return <img {...props} src={resolvedSrc} alt={alt} className={className} />;
}
