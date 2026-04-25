const { z } = require('zod');
const schema = z.object({
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  sort_order: z.number().nullish(),
  description: z.string().nullish(),
  is_portfolio: z.number().nullish(),
  is_executive_summary: z.number().nullish(),
  is_deleted: z.number().nullish(),
  status: z.string().nullish(),
  revision_of: z.string().nullish(),
  original_author_nickname: z.string().optional(),
  original_author_avatar: z.string().optional(),
});

const docs = [
    {
      "slug": "getting-started",
      "title": "Quick Start Guide",
      "category": "ARESLib Getting Started",
      "sort_order": 10,
      "description": "Initialize ARESLib in your FTC project and configure the core subsystems.",
      "is_portfolio": 0,
      "is_executive_summary": 0,
      "is_deleted": 0,
      "status": "published",
      "revision_of": null
    }
];

try {
  z.array(schema).parse(docs);
  console.log('Passed!');
} catch (e) {
  console.error(e);
}
