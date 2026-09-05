# Shared agent instructions

Repository guidance is committed source. Every clone receives the same
`AGENTS.md`, skill packages, and tool entry points. Put engineering policy and
the skill index in `AGENTS.md`; keep specialized procedures in `.agents/skills/`.
Do not copy policy into vendor-specific skill trees or personal settings.

| Client | Repository entry point | Specialized guidance |
| --- | --- | --- |
| Codex | Root `AGENTS.md` | `.agents/skills/*/SKILL.md` |
| Gemini CLI | `GEMINI.md` imports `@./AGENTS.md` | Same `.agents/skills/` tree |
| Antigravity | `.agents/rules/aresweb-project.md`, Always On, imports `@../../AGENTS.md` | Same `.agents/skills/` tree |
| Claude Code | `CLAUDE.md` imports `@AGENTS.md` | Read relevant links in the shared guide |
| GitHub Copilot | `.github/copilot-instructions.md` links to `../AGENTS.md` | Read relevant links in the shared guide |

`agents/openai.yaml` within each skill supplies Codex UI labels and a suggested
prompt. It contains no additional repository engineering policy. The stable
`aresweb-ast-migration` skill name also covers the current Markdown content flow.

## Check a contributor's setup

Open the repository root as the workspace and use current clients that support
the documented shared paths. Run:

```text
pnpm run validate:agents
git ls-files AGENTS.md GEMINI.md CLAUDE.md .agents .github/copilot-instructions.md
```

The validator checks imports, Always On activation, skill metadata and links,
repository-map paths, listed root package scripts, Git tracking, and effective
Git ignore rules (even for forced-added files). New skill resources must be
staged before validation. It rejects duplicate workspace skill trees and a root
`AGENTS.override.md` that would shadow the common guide.

Start a fresh Codex task and ask it to list the repository instruction sources
and six shared skill names. In Gemini CLI, use `/memory reload`, `/memory show`,
`/skills reload`, and `/skills list` to inspect loaded guidance. In Antigravity,
check the workspace rule in Customizations → Rules is Always On, then start a
new conversation and ask it to identify the shared guide and relevant skill.
If skill discovery is unavailable, the links in `AGENTS.md` provide direct access.

Repository validation proves file availability and wiring; it does not inspect
another contributor's running client. Personal context, disabled skills, custom
ignore settings, workspace trust, and managed policies can affect a session.
Tool credentials, sandbox access and approval controls remain client/account
settings. Shared instructions do not grant those permissions.

## Maintaining the guide

Check claims against the source map in `AGENTS.md`, package scripts, and the
protected workflow. The current app is Vite/React Router, the APIs use isolated
Express apps, online games run on Cloud Run, and document rendering supports
Markdown and legacy AST records. Historical plans and audits are evidence of
past work, not the current architecture contract.

Keep temporary notes in root `scratch/`; publish final audits under `docs/audits/`.
Do not put credentials or private session transcripts in shared instruction files.
Change shared files through a normal pull request and run the agent validator
plus the required checks in `AGENTS.md` when code changes.

## Discovery references

Paths and import behavior checked against official documentation on 2026-09-05:

- [Codex project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
  and [local skills](https://learn.chatgpt.com/docs/build-skills).
- [Gemini context imports](https://geminicli.com/docs/cli/gemini-md/)
  and [workspace skill discovery](https://geminicli.com/docs/cli/using-agent-skills/).
- [Antigravity workspace rules and relative imports](https://antigravity.google/docs/rules-workflows)
  and [shared workspace skills](https://antigravity.google/docs/skills).
