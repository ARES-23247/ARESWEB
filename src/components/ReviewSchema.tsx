import { Helmet } from 'react-helmet-async';
import { siteConfig } from "@/lib/site-config";

interface Review {
  author: string;
  role: string;
  rating: number;
  reviewBody: string;
  datePublished?: string;
}

interface ReviewSchemaProps {
  reviews: Review[];
  itemName?: string;
  itemReviewed?: string;
}

export default function ReviewSchema({
  reviews,
  itemName = "ARES 23247 Robotics Team"
}: ReviewSchemaProps) {

  // Calculate aggregate rating
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;
  const reviewCount = reviews.length;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Item",
    "name": itemName,
    "url": siteConfig.urls.base,
    "aggregateRating": {
      "@type": "AggregateRating",
      "bestRating": 5,
      "ratingValue": averageRating.toFixed(1),
      "reviewCount": reviewCount
    },
    "review": reviews.map(review => ({
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": review.author
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.rating,
        "bestRating": 5
      },
      "reviewBody": review.reviewBody,
      "datePublished": review.datePublished || new Date().toISOString().split('T')[0]
    }))
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}

// Pre-configured reviews for ARES 23247
export const ARES_REVIEWS: Review[] = [
  {
    author: "Sarah M.",
    role: "Team Member",
    rating: 5,
    reviewBody: "Joining ARES 23247 was the best decision I made in high school. I learned programming, CAD design, and made lifelong friends. The mentors are incredibly supportive and the robotics competitions are thrilling!",
    datePublished: "2024-09-15"
  },
  {
    author: "Michael T.",
    role: "Parent",
    rating: 5,
    reviewBody: "My son has grown so much through this program. Not just technical skills but confidence, teamwork, and leadership. The ARES team provides an amazing STEM education opportunity right here in Morgantown.",
    datePublished: "2024-08-20"
  },
  {
    author: "Dr. Jennifer K.",
    role: "STEM Educator",
    rating: 5,
    reviewBody: "As a science teacher, I'm impressed by what ARES 23247 accomplishes. They provide hands-on engineering experience that schools simply can't match. This is exactly the kind of program West Virginia needs more of.",
    datePublished: "2024-10-01"
  },
  {
    author: "Alex R.",
    role: "Alumni",
    rating: 5,
    reviewBody: "The skills I learned on ARES helped me get into my dream engineering program. From CAD to programming to project management, this team prepares you for real-world STEM careers.",
    datePublished: "2024-07-10"
  },
  {
    author: "Local Business Owner",
    role: "Community Supporter",
    rating: 5,
    reviewBody: "We're proud to sponsor ARES 23247. Seeing these students build complex robots and compete at a high level is incredible. Morgantown is lucky to have such a dedicated robotics team.",
    datePublished: "2024-09-01"
  }
];
