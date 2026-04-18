import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

export default function SEO({ 
  title, 
  description = "ARES 23247 - Appalachian Robotics & Engineering Society. FIRST® Tech Challenge Team based in Morgantown, WV.", 
  image = "https://ares23247.com/ares_hero.png", 
  url,
  type = "website"
}: SEOProps) {
  
  const siteTitle = `${title} | ARES 23247`;
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : "https://ares23247.com");

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ARES 23247 (Appalachian Robotics & Engineering Society)",
    "url": "https://ares23247.com",
    "logo": "https://ares23247.com/ares_hero.png",
    "description": "FIRST® Tech Challenge (FTC) Robotics Team based in Morgantown, West Virginia.",
    "sameAs": [
      "https://github.com/ARES23247"
    ]
  };

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="theme-color" content="#dc2626" />
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
    </Helmet>
  );
}
