import { Helmet } from 'react-helmet-async';

interface SpeakableSection {
  xpath: string;
  text?: string;
}

interface SpeakableSchemaProps {
  sections?: SpeakableSection[];
}

/**
 * Speakable schema helps voice assistants (Alexa, Google Assistant) identify
 * which parts of your content are suitable for text-to-speech playback.
 * This is especially useful for news-style content and key information.
 */
export default function SpeakableSchema({
  sections = []
}: SpeakableSchemaProps) {

  // Default speakable sections if none provided
  const defaultSections: SpeakableSection[] = [
    { xpath: "/html/head/title" },
    { xpath: '/html/head/meta[@name="description"]/@content' },
    { xpath: "//main//h1" },
    { xpath: "//main//h2" }
  ];

  const speakableSections = sections.length > 0 ? sections : defaultSections;

  const schema = {
    "@context": "https://schema.org",
    "@type": "SpeakableSpecification",
    "cssSelector": speakableSections.map(s => s.xpath).join(", ")
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}

/**
 * Pre-configured speakable content for key pages.
 * Use this for pages that should be optimized for voice search queries like:
 * "Hey Google, tell me about ARES 23247 robotics team"
 * "Alexa, what does ARES 23247 do?"
 */
export const SPEAKABLE_CONTENT = {
  home: {
    sections: [
      {
        xpath: "//main//h1",
        text: "ARES 23247 - Building the future of robotics in Morgantown, West Virginia with the Mountaineer Mindset."
      },
      {
        xpath: "//main//p[1]",
        text: "ARES 23247 is a FIRST Tech Challenge robotics team based in Morgantown, West Virginia. We offer youth robotics programs, STEM education, and competition opportunities for students throughout West Virginia."
      }
    ]
  },
  about: {
    sections: [
      {
        xpath: "//main//h1",
        text: "About ARES 23247 - Appalachian Robotics & Engineering Society"
      },
      {
        xpath: "//main//p[contains(@class, 'text-xl')]",
        text: "ARES 23247 is a FIRST Tech Challenge robotics team based in Morgantown, West Virginia. We are more than a team, we are a training ground for the next generation of West Virginia's technical elite."
      }
    ]
  },
  join: {
    sections: [
      {
        xpath: "//main//h1",
        text: "Join ARES 23247 Robotics Team in Morgantown, West Virginia"
      },
      {
        xpath: "//main//p[1]",
        text: "Become a student or mentor for the ARES 23247 robotics team. No prior experience required. We teach you everything you need to know about robotics, programming, and engineering."
      }
    ]
  }
};
