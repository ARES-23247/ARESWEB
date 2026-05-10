import { Helmet } from 'react-helmet-async';
import { siteConfig } from "../site.config";

interface MetaTagsProps {
  article?: boolean;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
}

/**
 * Additional SEO meta tags that provide extra signals to search engines
 */
export default function MetaTags({
  article = false,
  author,
  publishedTime,
  modifiedTime,
  section = "Robotics",
  tags = []
}: MetaTagsProps) {

  // Morgantown, WV coordinates
  const latitude = "39.6295";
  const longitude = "-79.9554";

  return (
    <Helmet>
      {/* Article-specific meta tags (Open Graph) */}
      {article && (
        <>
          <meta property="article:published_time" content={publishedTime || new Date().toISOString()} />
          <meta property="article:modified_time" content={modifiedTime || new Date().toISOString()} />
          <meta property="article:section" content={section} />
          <meta property="article:tag" content="robotics" />
          <meta property="article:tag" content="FIRST" />
          <meta property="article:tag" content="FTC" />
          <meta property="article:tag" content="STEM" />
          <meta property="article:tag" content="Morgantown" />
          <meta property="article:tag" content="West Virginia" />
          {tags.map((tag, i) => (
            <meta key={i} property="article:tag" content={tag} />
          ))}
        </>
      )}

      {/* Author meta tag */}
      {author && <meta name="author" content={author} />}

      {/* Geographic meta tags for local SEO */}
      <meta name="geo.position" content={`${latitude};${longitude}`} />
      <meta name="geo.placename" content="Morgantown, West Virginia" />
      <meta name="geo.region" content="US-WV" />

      {/* ICBM tag (old school but still used) */}
      <meta name="ICBM" content={`${latitude}, ${longitude}`} />

      {/* Application/Platform specific */}
      <meta name="application-name" content="ARES 23247" />
      <meta name="apple-mobile-web-app-title" content="ARES" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

      {/* Windows tiles */}
      <meta name="msapplication-TileColor" content="#C00000" />
      <meta name="msapplication-TileImage" content={`${siteConfig.urls.base}/mstile-144x144.png`} />

      {/* Mobile browser color */}
      <meta name="mobile-web-app-capable" content="yes" />

      {/* Category/subject classification */}
      <meta name="category" content="Robotics, STEM, Education, Technology" />
      <meta name="subject" content="FIRST Tech Challenge Robotics Team" />

      {/* Audience targeting */}
      <meta name="target" content="all" />
      <meta name="HandheldFriendly" content="true" />
      <meta name="MobileOptimized" content="width" />

      {/* Distribution (for local/regional relevance) */}
      <meta name="distribution" content="global" />
      <meta name="coverage" content="worldwide" />

      {/* Language and locale */}
      <meta httpEquiv="Content-Language" content="en" />
      <meta name="language" content="English" />

      {/* Revisit-after (suggests crawl frequency) */}
      <meta name="revisit-after" content="7 days" />

      {/* Robots-specific directives */}
      <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />

      {/* Verification placeholders (add your codes) */}
      {/* <meta name="google-site-verification" content="YOUR_GOOGLE_VERIFICATION_CODE" /> */}
      {/* <meta name="msvalidate.01" content="YOUR_BING_VERIFICATION_CODE" /> */}
      {/* <meta name="p:domain_verify" content="YOUR_PINTEREST_VERIFICATION_CODE" /> */}

      {/* Twitter additional meta */}
      <meta name="twitter:site" content="@ARESFTC" />
      <meta name="twitter:creator" content="@ARESFTC" />

      {/* Link preview hints */}
      <link rel="image_src" href={`${siteConfig.urls.base}/ares_hero.png`} />

      {/* Canonical for www and non-www */}
      <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : siteConfig.urls.base} />
    </Helmet>
  );
}

/**
 * Geographic coordinates for ARES 23247 locations
 */
export const ARES_LOCATIONS = {
  morgantown: {
    name: "Morgantown, West Virginia",
    latitude: "39.6295",
    longitude: "-79.9554",
    region: "US-WV"
  },
  fairmont: {
    name: "Fairmont, West Virginia",
    latitude: "39.4859",
    longitude: "-80.1468",
    region: "US-WV"
  }
} as const;
