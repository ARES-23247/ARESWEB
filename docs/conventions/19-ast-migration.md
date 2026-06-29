# Tiptap AST Migration

> Convert Markdown to Tiptap ProseMirror AST for Firestore documents. Use when importing or repairing documentation.

ARES CMS uses Tiptap/ProseMirror AST JSON. Legacy Markdown imports require conversion.

## Remote Auditing

Write a temporary Node.js script in the `scratch/` directory that uses `firebase-admin` to read and update collection documents:
```javascript
import { adminDb } from "../functions/src/lib/firebase-admin";

const docSnap = await adminDb.collection("docs").doc(slug).get();
const docData = docSnap.data();
```

## Missing Title Resolution

If the title is empty or shows "Untitled", extract the first header from the markdown content using RegEx:
```javascript
const title = markdown.match(/^#\s+(.+)$/m)?.[1] || "Untitled";
```

## AST Conversion

Translate markdown into Tiptap's schema utilizing `@tiptap/html` and `marked`:
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

## Live Execution

1. Write a script utilizing `adminDb.collection("docs").doc(slug).update({ content: finalContent, title: extractedTitle })`.
2. Run it locally using environment credentials (e.g. `node scratch/run_migration.js`).
3. Delete the temporary script from the repository workspace when finished.
