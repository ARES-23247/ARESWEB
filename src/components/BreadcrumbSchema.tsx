import { Helmet } from 'react-helmet-async';
import { siteConfig } from "../site.config";

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbSchemaProps {
  breadcrumbs: BreadcrumbItem[];
}

export default function BreadcrumbSchema({ breadcrumbs }: BreadcrumbSchemaProps) {
  const itemList = breadcrumbs.map((crumb, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": crumb.name,
    "item": `${siteConfig.urls.base}${crumb.path}`
  }));

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": itemList
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}

// Helper to generate breadcrumbs from current path
export function generateBreadcrumbs(pathname: string, title: string): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [
    { name: "Home", path: "/" }
  ];

  const segments = pathname.split('/').filter(Boolean);

  // Add intermediate segments
  let currentPath = "";
  const segmentNames: Record<string, string> = {
    "about": "About Us",
    "blog": "Team Blog",
    "events": "Events",
    "join": "Join Team",
    "sponsors": "Sponsors",
    "outreach": "Community Impact",
    "seasons": "Team Legacy",
    "gallery": "Team Gallery",
    "academy": "ARES Academy",
    "docs": "Documentation",
    "store": "Official Store",
    "leaderboard": "Leaderboard",
    "tech-stack": "Tech Stack",
    "privacy": "Privacy Policy",
    "accessibility": "Accessibility",
    "locations": "Locations"
  };

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    crumbs.push({
      name: segmentNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
      path: currentPath
    });
  }

  // Add current page
  crumbs.push({
    name: title,
    path: pathname
  });

  return crumbs;
}
