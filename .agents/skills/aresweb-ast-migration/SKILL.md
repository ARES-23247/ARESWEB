---
name: aresweb-ast-migration
description: Reusable pipeline and standards for safely converting standard Markdown strings into Firestore-compatible Tiptap ProseMirror Abstract Syntax Trees (AST). Use this anytime there are malformed legacy documents or large-scale document imports.
---

# ARESWEB Tiptap AST Migration Skill

The ARES 23247 CMS publisher suite natively relies on the Tiptap/ProseMirror Abstract Syntax Tree (AST) JSON format to display technical documentation, blog posts, and interactive simulators. Because the legacy framework previously utilized Astro with standard string Markdown, raw imports directly into the Firestore `docs` collection will result in unrenderable pages and `"Untitled"` dashboard names. 

Whenever you are tasked with importing, auditing, or repairing documentation in Firestore, you **MUST** follow this AST conversion protocol.

## 1. Local Auditing and Scripting Protocol

To diagnose and batch-update Firestore documents, write a temporary Node.js script in the `scratch/` directory that initializes the `firebase-admin` SDK to read and update collection documents.

Never attempt to print large JSON representations directly to the console or CLI as they will truncate. Always write them to a JSON file first.

---

## 2. Missing Title Heuristic

If a database entry shows `Untitled` (often because a legacy markdown header was stripped), implement a heuristic fallback utilizing RegEx to extract the `# Heading1` string directly from the markdown representation and update the document's `title` field.

---

## 3. Tiptap AST Translation Standards

Never attempt to manually structure JSON objects yourself for large files. Create a discrete sub-pipeline strictly leveraging `@tiptap/html` and `marked`. 

```javascript
import { marked } from 'marked';
import { generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

// First resolve raw markdown string to standard HTML layout
const html = marked.parse(markdownContent);

// Translate directly into Tiptap's schema utilizing equivalent extensions setup
const jsonAst = generateJSON(html, [
  StarterKit,
  Image,
  Link,
]);

const finalContent = JSON.stringify(jsonAst);
```

---

## 4. Firestore Execution

To perform bulk updates:
1. Write a script utilizing `adminDb.collection("docs").doc(slug).update({ content: finalContent, title: extractedTitle })`.
2. Run it locally using environment credentials.
3. Conclude the workflow by deleting the temporary script from the repository workspace.
