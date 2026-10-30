# Claude Code Instructions

The canonical agent instructions are in `AGENTS.md`. Read it, and read
`docs/design.md` before making design decisions.

Repo rules:

- Read before editing.
- Use `bun run` for all tooling. This is a Bun workspace; there is no Python or
  Ruby workspace.
- Keep changes scoped.
- Update `.env.example`, tests, and docs when contracts change.
- Check the licence of every asset and model, not just every package. See
  `COPYRIGHT.md`.
- Use gitignored `.context/` for workspace-local operational memory. Promote
  durable knowledge into tracked docs instead of committing `.context/`.
