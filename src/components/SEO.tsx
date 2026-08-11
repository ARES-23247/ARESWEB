import { Helmet } from "react-helmet-async";
import { siteConfig } from "@/lib/site-config";

const DEFAULT_KEYWORDS = [
  "ARES 23247",
  "robotics",
  "Morgantown robotics",
  "West Virginia robotics",
  "FIRST® Robotics",
  "FTC robotics",
  "STEM education",
  "youth robotics",
  "robotics team",
  "engineering",
  "FIRST® Tech Challenge"
].join(", ");

const DEFAULT_IMAGE = `${siteConfig.urls.base}/favicon.webp`;

export interface SchemaData {
  authorName?: string;
  datePublished?: string;
  dateModified?: string;
  startDate?: string;
  endDate?: string;
  locationName?: string;
  locationAddress?: string;
  eventAttendanceMode?: string;
  wordCount?: number;
  readingTime?: string;
}

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string;
  image?: string;
  imageAlt?: string;
  url?: string;
  type?: "website" | "article" | "event";
  noindex?: boolean;
  schemaData?: SchemaData;
}

export function getCanonicalUrl(url?: string): string {
  const requestedPath = url ?? (typeof window !== "undefined" ? window.location.pathname : "/");

  try {
    const parsed = new URL(requestedPath, siteConfig.urls.base);
    return new URL(`${parsed.pathname || "/"}`, siteConfig.urls.base).toString();
  } catch {
    return `${siteConfig.urls.base}/`;
  }
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== "")
  ) as T;
}

export const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "ARES 23247",
  "alternateName": "Appalachian Robotics & Engineering Society",
  "url": siteConfig.urls.base,
  "logo": DEFAULT_IMAGE,
  "image": DEFAULT_IMAGE,
  "description": "ARES 23247 is a FIRST® Tech Challenge robotics team in Morgantown, West Virginia.",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Morgantown",
    "addressRegion": "WV",
    "addressCountry": "US"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "general inquiries",
    "email": siteConfig.contact.email,
    "url": `${siteConfig.urls.base}/join`
  },
  "sameAs": [
    `https://github.com/${siteConfig.urls.githubOrg}`,
    siteConfig.urls.toa
  ]
};

export const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "ARES 23247",
  "url": siteConfig.urls.base,
  "description": "The official website for ARES 23247, a FIRST® Tech Challenge team in Morgantown, West Virginia.",
  "publisher": {
    "@type": "Organization",
    "name": "ARES 23247",
    "url": siteConfig.urls.base
  }
};

interface AdditionalSchemaOptions {
  type: SEOProps["type"];
  title: string;
  description: string;
  keywords: string;
  image: string;
  canonicalUrl: string;
  schemaData?: SchemaData;
}

export function createAdditionalSchema({
  type,
  title,
  description,
  keywords,
  image,
  canonicalUrl,
  schemaData
}: AdditionalSchemaOptions): Record<string, unknown> | null {
  if (type === "article" && schemaData) {
    const author = schemaData.authorName
      ? { "@type": "Person", "name": schemaData.authorName }
      : { "@type": "Organization", "name": "ARES 23247", "url": siteConfig.urls.base };

    return compactObject({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": title,
      "image": image,
      "author": author,
      "publisher": {
        "@type": "Organization",
        "name": "ARES 23247",
        "logo": { "@type": "ImageObject", "url": DEFAULT_IMAGE }
      },
      "datePublished": schemaData.datePublished,
      "dateModified": schemaData.dateModified,
      "description": description,
      "keywords": keywords,
      "inLanguage": "en-US",
      "wordCount": schemaData.wordCount,
      "timeRequired": schemaData.readingTime,
      "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl }
    });
  }

  if (type === "event" && schemaData?.startDate) {
    const location = schemaData.locationName || schemaData.locationAddress
      ? compactObject({
          "@type": "Place",
          "name": schemaData.locationName,
          "address": schemaData.locationAddress
        })
      : undefined;

    return compactObject({
      "@context": "https://schema.org",
      "@type": "Event",
      "name": title,
      "startDate": schemaData.startDate,
      "endDate": schemaData.endDate,
      "eventAttendanceMode": schemaData.eventAttendanceMode,
      "location": location,
      "image": image,
      "description": description,
      "organizer": {
        "@type": "Organization",
        "name": "ARES 23247",
        "url": siteConfig.urls.base
      }
    });
  }

  return null;
}

export default function SEO({
  title,
  description = "ARES 23247 is a FIRST® Tech Challenge team in Morgantown, West Virginia.",
  keywords = DEFAULT_KEYWORDS,
  image,
  imageAlt,
  url,
  type = "website",
  noindex = false,
  schemaData
}: SEOProps) {
  const siteTitle = title.endsWith("ARES 23247") ? title : `${title} | ARES 23247`;
  const currentUrl = getCanonicalUrl(url);
  const socialImage = image || DEFAULT_IMAGE;
  const socialImageAlt = imageAlt || `${title} — ARES 23247`;
  const hasSearchQuery = (
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("q")
  ) || Boolean(url && /[?&]q=/.test(url));

  const additionalSchema = createAdditionalSchema({
    type,
    title,
    description,
    keywords,
    image: socialImage,
    canonicalUrl: currentUrl,
    schemaData
  });

  const openGraphType = type === "article" ? "article" : "website";

  return (
    <Helmet>
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="theme-color" content="#C00000" />
      <meta name="robots" content={(noindex || hasSearchQuery) ? "noindex, follow" : "index, follow"} />
      <link rel="canonical" href={currentUrl} />

      <meta property="og:type" content={openGraphType} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:alt" content={socialImageAlt} />
      <meta property="og:site_name" content="ARES 23247" />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={socialImage} />
      <meta name="twitter:image:alt" content={socialImageAlt} />

      <script type="application/ld+json">{JSON.stringify(ORGANIZATION_SCHEMA)}</script>
      <script type="application/ld+json">{JSON.stringify(WEBSITE_SCHEMA)}</script>
      {additionalSchema && (
        <script type="application/ld+json">{JSON.stringify(additionalSchema)}</script>
      )}
    </Helmet>
  );
}
