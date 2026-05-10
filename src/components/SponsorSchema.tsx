import { Helmet } from 'react-helmet-async';
import { siteConfig } from "../site.config";
import type { Sponsor } from "../api";

interface SponsorSchemaProps {
  sponsors: Sponsor[];
}

/**
 * Organization schema with funders/sponsors
 * This helps establish the relationship between ARES and their sponsors
 */
export default function SponsorSchema({ sponsors }: SponsorSchemaProps) {
  const activeSponsors = sponsors.filter(s => s.isActive);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ARES 23247",
    "alternateName": "Appalachian Robotics & Engineering Society",
    "url": siteConfig.urls.base,
    "logo": `${siteConfig.urls.base}/ares_hero.png`,
    "funder": activeSponsors.map(sponsor => ({
      "@type": "Organization",
      "name": sponsor.name,
      "url": sponsor.websiteUrl || undefined,
      "logo": sponsor.logoUrl || undefined,
      "description": `Sponsor of ARES 23247 Robotics Team - ${sponsor.tier} Tier`
    })).filter(s => s.url || s.logo),
    "sponsor": activeSponsors.map(sponsor => ({
      "@type": "Organization",
      "name": sponsor.name,
      "url": sponsor.websiteUrl || undefined,
      "logo": sponsor.logoUrl || undefined,
      "sponsorship": {
        "@type": "Sponsorship",
        "sponsor": {
          "@type": "Organization",
          "name": "ARES 23247"
        },
        "sponsorshipLevel": sponsor.tier
      }
    })).filter(s => s.url || s.logo)
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}
