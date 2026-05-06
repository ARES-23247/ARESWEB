import { Helmet } from 'react-helmet-async';
import { siteConfig } from "../site.config";

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  schemaData?: {
    authorName?: string;
    datePublished?: string;
    startDate?: string;
    endDate?: string;
    locationName?: string;
    locationAddress?: string;
    [key: string]: unknown;
  };
}

export default function SEO({ 
  title, 
  description = "ARES 23247 - Appalachian Robotics & Engineering Society. A FIRST® Tech Challenge Team offering youth robotics in Morgantown, WV.", 
  image = `${siteConfig.urls.base}/ares_hero.png`, 
  url,
  type = "website",
  schemaData
}: SEOProps) {
  
  const siteTitle = `${title} | ARES 23247`;
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : siteConfig.urls.base);

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "ARES 23247 (Appalachian Robotics & Engineering Society)",
    "url": siteConfig.urls.base,
    "logo": `${siteConfig.urls.base}/ares_hero.png`,
    "description": "FIRST® Tech Challenge (FTC) Robotics Team based in Morgantown, West Virginia.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Morgantown",
      "addressRegion": "WV",
      "addressCountry": "US"
    },
    "sameAs": [
      "https://github.com/ARES23247"
    ]
  };

  let additionalSchema = null;
  if (type === "article" && schemaData) {
    additionalSchema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": title,
      "image": image,
      "author": {
        "@type": "Person",
        "name": schemaData.authorName || "ARES Team"
      },
      "publisher": {
        "@type": "Organization",
        "name": "ARES 23247",
        "logo": {
          "@type": "ImageObject",
          "url": `${siteConfig.urls.base}/ares_hero.png`
        }
      },
      "datePublished": schemaData.datePublished || new Date().toISOString(),
      "description": description
    };
  } else if (type === "event" && schemaData) {
    additionalSchema = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": title,
      "startDate": schemaData.startDate,
      "endDate": schemaData.endDate || schemaData.startDate,
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "eventStatus": "https://schema.org/EventScheduled",
      "location": {
        "@type": "Place",
        "name": schemaData.locationName || "Location TBD",
        "address": {
          "@type": "Text",
          "text": schemaData.locationAddress || "Morgantown, WV"
        }
      },
      "image": image,
      "description": description,
      "organizer": {
        "@type": "Organization",
        "name": "ARES 23247",
        "url": siteConfig.urls.base
      }
    };
  }

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="theme-color" content="#C00000" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="ARES 23247" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Structured Data (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      {additionalSchema && (
        <script type="application/ld+json">
          {JSON.stringify(additionalSchema)}
        </script>
      )}
    </Helmet>
  );
}
