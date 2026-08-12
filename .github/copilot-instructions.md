# ARESWEB AI contributor instructions

Treat `AGENTS.md` as the repository-wide engineering and verification contract.
Read the relevant canonical skill under `.agents/skills/` before changing a
protected area. Do not rely on historical planning or audit files as current
architecture guidance.

## Canonical skills

- API and backend data boundaries:
  `.agents/skills/aresweb-api-reference/SKILL.md`
- Tiptap/ProseMirror content migrations:
  `.agents/skills/aresweb-ast-migration/SKILL.md`
- CI, tests, builds, and deployment:
  `.agents/skills/aresweb-ci/SKILL.md`
- Complete repository and technical-debt audits:
  `.agents/skills/aresweb-comprehensive-audit/SKILL.md`
- React UI, accessibility, and brand consistency:
  `.agents/skills/aresweb-web-accessibility/SKILL.md`
- Authentication, authorization, privacy, secrets, and uploads:
  `.agents/skills/aresweb-zero-trust-security/SKILL.md`

Use only the skills relevant to the requested work. When multiple boundaries
overlap, apply each relevant skill without weakening the stricter requirement.

## Delivery

Run the full verification gate in `AGENTS.md` before handing off a code change.
Do not deploy, rotate secrets, or change production data without explicit user
approval. Production deployment must use the protected GitHub Actions workflow.
