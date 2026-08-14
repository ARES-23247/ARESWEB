import type { ComponentProps } from "react";
import { getOgImageUrl } from "@/components/SEO";
import { cleanThumbnailUrl } from "@/lib/utils";

interface BlogThumbnailIdentity {
  title: string;
  thumbnail?: string;
  author?: string;
  date?: string;
}

type BlogThumbnailImageProps = BlogThumbnailIdentity &
  Omit<ComponentProps<"img">, "src" | "alt" | "onError">;

export function getBlogThumbnailFallback({
  title,
  author,
  date,
}: BlogThumbnailIdentity): string {
  return getOgImageUrl(title, { category: "Blog", author, date });
}

export function getBlogThumbnailSource(post: BlogThumbnailIdentity): string {
  return cleanThumbnailUrl(post.thumbnail) || getBlogThumbnailFallback(post);
}

export default function BlogThumbnailImage({
  title,
  thumbnail,
  author,
  date,
  ...imageProps
}: BlogThumbnailImageProps) {
  const identity = { title, thumbnail, author, date };
  const fallbackImage = getBlogThumbnailFallback(identity);

  return (
    <img
      {...imageProps}
      src={getBlogThumbnailSource(identity)}
      alt=""
      onError={(event) => {
        if (event.currentTarget.src !== fallbackImage) {
          event.currentTarget.src = fallbackImage;
        }
      }}
    />
  );
}
