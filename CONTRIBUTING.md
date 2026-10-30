# Contributing

Dormouse is a 508.dev project. Contributions are welcome.

## Before you start

Read [`docs/design.md`](docs/design.md). It is the plan of record and it
explains *why* each decision was made, including several that look arbitrary
until you know the reason (no YouTube, no TTS, no walk cycles). If you want to
change one of those, that is a conversation worth having — open an issue rather
than a surprise PR.

[`DECISIONS.md`](DECISIONS.md) is the scannable short form.

## Workflow

1. Branch from `main`.
2. Make the change.
3. Run `bun run check` (lint, typecheck, test, build).
4. Open a PR describing what changed, how you validated it, and the risk.

Screenshots matter here more than in most projects. If you touched anything
visual, include one.

## House rules

- Keep edits surgical; do not reformat unrelated files.
- Add or update tests when behaviour changes.
- Update `.env.example` when you add configuration.
- Update the docs when you change a developer workflow.
- Never commit secrets. Never commit media files — the catalogue manifest
  records provenance, and the media itself lives in R2.

## Asset contributions

Art and audio have a licence bar that code does not:

- **Audio:** Freesound CC0 or CC BY 4.0 only. **Never NonCommercial** — it is
  incompatible with the paid content packs.
- **Generated art:** commercially usable models only. FLUX.1-schnell, SDXL and
  Qwen-Image are fine; **FLUX.1-dev is non-commercial and must not be used.**
- **Video:** every catalogue addition needs a row in `catalogue/manifest.json`
  with the source, the claimed licence, the evidence for the claim, and who
  verified it. "It's on archive.org" is not a rights position.

See [`COPYRIGHT.md`](COPYRIGHT.md).

## Code of conduct

Be decent. This is a project about making people feel less alone at 3am; act
like it.
