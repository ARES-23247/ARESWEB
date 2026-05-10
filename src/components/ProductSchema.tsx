import { Helmet } from 'react-helmet-async';
import { siteConfig } from "../site.config";

export interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category: string | null;
  stock: number;
}

interface ProductSchemaProps {
  products: StoreProduct[];
}

/**
 * Product schema helps products appear in Google Shopping and product search results.
 */
export default function ProductSchema({ products }: ProductSchemaProps) {
  const productSchemas = products.map(product => ({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": `${product.description || `Official ${product.name} from ARES 23247 Robotics Team in Morgantown, West Virginia.`} Support youth robotics and STEM education.`,
    "image": product.imageUrl || `${siteConfig.urls.base}/ares_hero.png`,
    "sku": product.id,
    "offers": {
      "@type": "Offer",
      "url": `${siteConfig.urls.base}/store`,
      "priceCurrency": "USD",
      "price": product.price,
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year from now
      "availability": product.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "ARES 23247",
        "url": siteConfig.urls.base
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": 0,
          "currency": "USD"
        },
        "deliveryLocation": {
          "@type": "DefinedRegion",
          "name": "United States"
        }
      }
    },
    "category": product.category || "Robotics Team Merchandise",
    "brand": {
      "@type": "Organization",
      "name": "ARES 23247",
      "url": siteConfig.urls.base,
      "logo": `${siteConfig.urls.base}/ares_hero.png`
    },
    "manufacturer": {
      "@type": "Organization",
      "name": "ARES 23247"
    },
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "Team",
        "value": "ARES 23247"
      },
      {
        "@type": "PropertyValue",
        "name": "Location",
        "value": "Morgantown, West Virginia"
      },
      {
        "@type": "PropertyValue",
        "name": "Program",
        "value": "FIRST Tech Challenge"
      }
    ]
  }));

  return (
    <Helmet>
      {productSchemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
