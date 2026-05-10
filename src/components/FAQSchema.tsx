import { Helmet } from 'react-helmet-async';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQItem[];
}

export default function FAQSchema({ faqs }: FAQSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
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

// Pre-configured FAQs for local SEO
export const LOCAL_ROBOTICS_FAQS: FAQItem[] = [
  {
    question: "Is there a robotics team in Morgantown, West Virginia?",
    answer: "Yes! ARES 23247 (Appalachian Robotics & Engineering Society) is a FIRST Tech Challenge robotics team based in Morgantown, WV. We offer youth robotics programs for students interested in STEM and competition robotics."
  },
  {
    question: "How do I join a robotics team in West Virginia?",
    answer: "You can join ARES 23247 by visiting our Join page at aresfirst.org/join. We welcome students from Morgantown and surrounding areas in North Central West Virginia. No prior experience is required - we teach you everything you need to know about robotics, programming, and engineering."
  },
  {
    question: "What robotics programs are available in Morgantown, WV?",
    answer: "ARES 23247 offers comprehensive youth robotics programs including FIRST Tech Challenge competition robotics, STEM education, outreach events, and the ARES Academy learning platform. We serve students in Morgantown and throughout West Virginia."
  },
  {
    question: "Where can I learn robotics in West Virginia?",
    answer: "ARES 23247 provides robotics education through our ARES Academy (aresfirst.org/academy), hands-on building sessions, competition participation, and community outreach events. We're based in Morgantown and welcome students from across West Virginia."
  },
  {
    question: "What is FIRST Robotics in Morgantown?",
    answer: "FIRST Robotics is a worldwide STEM competition program. ARES 23247 is Morgantown's FIRST Tech Challenge team (Team #23247). We design, build, and program robots to compete in tournaments while learning engineering skills and Gracious Professionalism."
  }
];
