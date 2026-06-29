import { Helmet } from 'react-helmet-async';
import { siteConfig } from "@/lib/site-config";

const DEFAULT_KEYWORDS = [
  "ARES 23247",
  "robotics",
  "Morgantown robotics",
  "West Virginia robotics",
  "*FIRST*® Robotics",
  "FTC robotics",
  "STEM education",
  "youth robotics",
  "robotics team",
  "robotics club",
  "competition robotics",
  "Appalachian Robotics",
  "engineering",
  "robotics for kids",
  "robotics for teens",
  "robotics near me",
  "robotics programs",
  "robotics classes",
  "*FIRST*® Tech Challenge",
  "Morgantown STEM",
  "West Virginia STEM"
].join(", ");

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string;
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
  description = "ARES 23247 - Appalachian Robotics & Engineering Society. A *FIRST*® Tech Challenge Team offering youth robotics in Morgantown, WV.",
  keywords = DEFAULT_KEYWORDS,
  image = `${siteConfig.urls.base}/ares_hero.png`,
  url,
  type = "website",
  schemaData
}: SEOProps) {
  
  const siteTitle = `${title} | ARES 23247`;
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : siteConfig.urls.base);

  // Check if URL search query parameter 'q' is present
  let hasSearchQuery = false;
  if (typeof window !== 'undefined') {
    hasSearchQuery = new URLSearchParams(window.location.search).has('q');
  } else if (url) {
    try {
      hasSearchQuery = new URL(url, siteConfig.urls.base).searchParams.has('q');
    } catch {
      hasSearchQuery = url.includes('?q=') || url.includes('&q=');
    }
  }

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "name": "ARES 23247 (Appalachian Robotics & Engineering Society)",
    "url": siteConfig.urls.base,
    "logo": `${siteConfig.urls.base}/ares_hero.png`,
    "description": "*FIRST*® Tech Challenge (FTC) Robotics Team based in Morgantown, West Virginia. Offering youth robotics programs, STEM education, and competition robotics for students in Morgantown and throughout West Virginia.",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Morgantown",
      "addressLocality": "Morgantown",
      "addressRegion": "WV",
      "postalCode": "26501",
      "addressCountry": "US"
    },
    "areaServed": [
      {
        "@type": "City",
        "name": "Morgantown",
        "addressRegion": "WV"
      },
      {
        "@type": "State",
        "name": "West Virginia"
      }
    ],
    "location": {
      "@type": "Place",
      "name": "Morgantown, West Virginia",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Morgantown",
        "addressRegion": "WV",
        "addressCountry": "US"
      }
    },
    "keywords": "robotics, *FIRST*®, FTC, STEM, Morgantown, West Virginia, engineering, competition robotics, ARES 23247, youth robotics, robotics team, robotics club, robotics competition, robotics classes, robotics education, robotics for kids, robotics for teens, robotics near me, robotics West Virginia, robotics Morgantown, robotics programs, robotics training, *FIRST*® Tech Challenge, FTC robotics, STEM education, engineering programs, Morgantown robotics team, West Virginia robotics",
    "sameAs": [
      "https://github.com/ARES23247",
      "https://theorangealliance.org/teams/23247"
    ]
  };

  // Organization schema for Google Knowledge Panel
  const knowledgePanelSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ARES 23247",
    "alternateName": "Appalachian Robotics & Engineering Society",
    "url": siteConfig.urls.base,
    "logo": {
      "@type": "ImageObject",
      "url": `${siteConfig.urls.base}/ares_hero.png`,
      "width": 500,
      "height": 500,
      "caption": "ARES 23247 Logo"
    },
    "image": `${siteConfig.urls.base}/ares_hero.png`,
    "description": "ARES 23247 is a *FIRST*® Tech Challenge robotics team based in Morgantown, West Virginia. We provide youth robotics programs, STEM education, and competition opportunities for students throughout West Virginia.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Morgantown",
      "addressRegion": "WV",
      "postalCode": "26501",
      "addressCountry": "US"
    },
    "areaServed": {
      "@type": "GeoCircle",
      "geoMidpoint": {
        "@type": "GeoCoordinates",
        "latitude": 39.6295,
        "longitude": -79.9554,
        "name": "Morgantown, WV"
      },
      "geoRadius": "100000"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Join the Team",
      "email": siteConfig.contact.email,
      "url": `${siteConfig.urls.base}/join`
    },
    "sameAs": [
      `https://github.com/${siteConfig.urls.githubOrg}`,
      `https://instagram.com/ares23247`,
      `https://www.youtube.com/@ARESFTC`,
      `https://www.facebook.com/ARES23247`,
      `https://www.linkedin.com/${siteConfig.urls.linkedin}`,
      `https://theorangealliance.org/teams/23247`
    ],
    "foundingDate": "2021",
    "founder": "*FIRST*® Robotics West Virginia",
    "memberOf": [
      {
        "@type": "Organization",
        "name": "*FIRST*® Inspires",
        "url": "https://www.firstinspires.org"
      }
    ],
    "knowsAbout": [
      "Robotics",
      "*FIRST*® Tech Challenge",
      "STEM Education",
      "Computer Programming",
      "Mechanical Engineering",
      "CAD Design",
      "3D Printing"
    ]
  };

  // WebSite schema for Google Sitelinks Search Box
  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ARES 23247",
    "alternateName": "Appalachian Robotics & Engineering Society",
    "url": siteConfig.urls.base,
    "description": "*FIRST*® Tech Challenge Robotics Team in Morgantown, West Virginia. Youth robotics programs, STEM education, and competition opportunities.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteConfig.urls.base}/academy?q={search_term_string}`
      },
      "query-input": {
        "@type": "PropertyValueSpecification",
        "valueRequired": true,
        "valueName": "search_term_string"
      }
    },
    "publisher": {
      "@type": "Organization",
      "name": "ARES 23247",
      "url": siteConfig.urls.base
    }
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
        "name": schemaData.authorName || "ARES Team",
        "url": schemaData.authorName ? `${siteConfig.urls.base}/blog?author=${encodeURIComponent(schemaData.authorName as string)}` : undefined
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
      "dateModified": schemaData.dateModified || schemaData.datePublished || new Date().toISOString(),
      "description": description,
      "keywords": keywords,
      "inLanguage": "en-US",
      "articleSection": "Robotics Education",
      "wordCount": schemaData.wordCount || undefined,
      "timeRequired": schemaData.readingTime || undefined,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": currentUrl
      },
      "locationCreated": {
        "@type": "Place",
        "name": "Morgantown, West Virginia",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Morgantown",
          "addressRegion": "WV",
          "addressCountry": "US"
        }
      }
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
      <meta name="keywords" content={keywords} />
      <meta name="theme-color" content="#C00000" />
      <meta name="robots" content={hasSearchQuery ? "noindex, follow" : "index, follow"} />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="ARES 23247" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:locality" content="Morgantown" />
      <meta property="og:region" content="WV" />
      <meta property="og:country-name" content="United States" />

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
      <script type="application/ld+json">
        {JSON.stringify(knowledgePanelSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(webSiteSchema)}
      </script>
      {additionalSchema && (
        <script type="application/ld+json">
          {JSON.stringify(additionalSchema)}
        </script>
      )}
    </Helmet>
  );
}
