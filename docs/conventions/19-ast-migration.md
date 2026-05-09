# Tiptap AST Migration

> Convert Markdown to Tiptap ProseMirror AST for D1 docs. Use when importing or repairing documentation.

ARES CMS uses Tiptap/ProseMirror AST JSON. Legacy Markdown imports require conversion.

## Remote Auditing

Export D1 to JSON first (CLI truncates large files):
```bash
npx wrangler d1 execute ares-db --remote --command="SELECT slug, title, content FROM docs;" --json > db_dump.json
```

## Missing Title Resolution

If title shows "Untitled", extract from markdown using RegEx:
```javascript
const title = markdown.match(/^#\s+(.+)$/m)?.[1] || "Untitled";
```

## AST Conversion

```javascript
import { marked } from 'marked';
import { generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

const html = marked.parse(markdownContent);
const jsonAst = generateJSON(html, [StarterKit, Image, Link]);
const finalContent = JSON.stringify(jsonAst);
```

## Live Edge Execution

1. Generate `.sql` file with `UPDATE` statements
2. Escape apostrophes as `''` for SQLite
3. Apply via: `npx wrangler d1 execute ares-db --remote --file=migration.sql`
4. Delete temporary scripts
