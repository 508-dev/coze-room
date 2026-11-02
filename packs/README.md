# Versioned packs

Each pack is `packs/<id>/manifest.json` plus pack-relative files. `version: 1`
identifies the manifest schema; publish changed content under a new id/directory.
Select a pack with `RoomSpec.packId`; without it the scene uses placeholders.

`test-fixture` is an original, two-colour technical test swatch, not room art.
It uses only Atropoeia colours and the repository's GPL-3.0 licence. There is no
third-party source. Real PNG/OGG content must go through Git LFS and the provenance
and licence checks in `COPYRIGHT.md`. Do not put secrets or unlicensed assets here:
the entire directory is public in dev and included in client builds.

See `docs/frontend.md` for the schema and extension contract.
